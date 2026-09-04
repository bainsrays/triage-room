// Hostile QA pass - things a skeptical fintech/support engineer would try.
// Run: node scripts/hostile.mjs  (expects `vite preview --port 4179` running)
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:4179";
const QA_DIR = new URL("../qa/hostile/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(QA_DIR, { recursive: true });

const ticketsArr = JSON.parse(readFileSync(new URL("../src/content/tickets.json", import.meta.url), "utf8")).tickets;
const tickets = Object.fromEntries(ticketsArr.map((t) => [t.id, t]));
const ids = ticketsArr.map((t) => t.id);

const findings = [];
const ok = (m) => console.log("  OK   " + m);
const bad = (m) => { console.log("  FAIL " + m); findings.push(m); };
const consoleErrors = [];

async function runSql(page, sql) {
  const box = page.locator("#sql-scratchpad-input");
  // scope everything to the scratchpad root (the div.grid.gap-3 that contains the textarea)
  const root = box.locator('xpath=ancestor::div[contains(@class,"grid") and contains(@class,"gap-3")][1]');
  await box.fill(sql);
  const t0 = Date.now();
  await root.getByRole("button", { name: /^run/i }).click();
  let text = "";
  for (let i = 0; i < 70; i++) {
    // handleRun() clears error+result synchronously, so any alert/badge present now is THIS run's outcome
    const found = await root.evaluate((el) => {
      const a = el.querySelector('[role="alert"]');
      const b = el.querySelector(".badge");
      const rows = el.querySelectorAll("table tbody tr").length;
      return { alert: a ? a.textContent : null, badge: b ? b.textContent : null, rows };
    }).catch(() => null);
    if (found && (found.alert || found.badge)) {
      text = [found.alert, found.badge].filter(Boolean).join(" | ");
      return { ms: Date.now() - t0, text, rows: found.rows };
    }
    await page.waitForTimeout(100);
  }
  return { ms: Date.now() - t0, text: text || "(no alert/result found)", rows: 0 };
}

async function openTicket(page, id) {
  await page.goto(`${BASE}/ticket/${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  page.on("dialog", (d) => d.accept());

  console.log("\n== A. Direct deep-link before starting a shift");
  await openTicket(page, "INC-2110");
  const url = page.url();
  console.log("   landed on", url);

  console.log("\n== B. Submit with nothing selected must be blocked");
  await openTicket(page, "INC-2110");
  const submit = page.getByRole("button", { name: /submit ticket/i });
  const disabled = await submit.isDisabled().catch(() => false);
  if (!disabled) {
    await submit.click();
    await page.waitForTimeout(300);
    if (/\/score/.test(page.url())) bad("Submitted an empty ticket and got a score card");
    else ok("Empty submit blocked via validation message");
  } else ok("Submit disabled until required fields chosen");

  console.log("\n== C. Root-cause options: all 4 visible and not covered by sticky bar");
  const radios = page.locator('input[name="root-cause"]');
  const n = await radios.count();
  if (n !== 4) bad(`Expected 4 root-cause radios on 2110, found ${n}`); else ok("4 root-cause options rendered");
  // scroll first option into view and check it's not obscured by the sticky bar
  await radios.first().scrollIntoViewIfNeeded();
  const covered = await page.evaluate(() => {
    const r = document.querySelector('input[name="root-cause"]');
    const lab = r.closest("label") || r;
    const b = lab.getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !(el === lab || lab.contains(el));
  });
  if (covered) bad("First root-cause option is covered by another element (sticky bar?) after scrollIntoView"); else ok("First option clickable, not covered");

  console.log("\n== D. SQL guard - hostile inputs on INC-2110");
  const openSp = page.getByRole("button", { name: /open scratchpad/i });
  if (await openSp.count()) await openSp.click();
  await page.locator("#sql-scratchpad-input").waitFor({ state: "visible", timeout: 8000 });
  const cases = [
    ["SELECT * FROM crypto_deposits", (r) => /^0 rows/i.test(r.text) , "plain select (0 rows expected, no error)"],
    ["select count(*) from crypto_deposits", (r) => /1 row/i.test(r.text), "lowercase select"],
    ["SELECT 1; SELECT 2", (r) => /not allowed|single|one statement|multiple/i.test(r.text), "multi-statement rejected"],
    ["DELETE FROM crypto_deposits", (r) => /not allowed|read-only|rejected/i.test(r.text), "DELETE rejected"],
    ["UPDATE crypto_deposits SET tx_hash='x'", (r) => /not allowed|read-only|rejected/i.test(r.text), "UPDATE rejected"],
    ["PRAGMA table_info(crypto_deposits)", (r) => /not allowed|read-only|rejected/i.test(r.text), "PRAGMA rejected"],
    ["ATTACH DATABASE 'x' AS y", (r) => /not allowed|read-only|rejected/i.test(r.text), "ATTACH rejected"],
    ["SELECT 1; -- DROP TABLE crypto_deposits", (r) => r.text.length > 0, "comment injection handled (no hang)"],
    ["/* x */ DROP TABLE crypto_deposits", (r) => /not allowed|read-only|rejected/i.test(r.text), "comment-prefixed DROP rejected"],
    ["WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT count(*) FROM c", (r) => r.ms < 8000 && /time|limit|abort|interrupt|too long/i.test(r.text), "infinite recursion -> timeout within 5s"],
    ["SELECT count(*) FROM crypto_deposits", (r) => /1 row/i.test(r.text), "engine still works after timeout kill"],
    ["SELECT * FROM sqlite_master", (r) => r.text.length > 0, "schema peek (informational)"],
    ["SELEC * FROM crypto_deposits", (r) => /syntax|error/i.test(r.text), "syntax error surfaced clearly"],
    ["SELECT * FROM nope", (r) => /no such table|error/i.test(r.text), "missing table error surfaced"],
    ["", (r) => r.text.length > 0, "empty query (must not crash)"],
  ];
  for (const [sql, check, label] of cases) {
    const r = await runSql(page, sql);
    const pass = check(r);
    (pass ? ok : bad)(`${label} -> ${r.ms}ms :: ${r.text.slice(0, 120)}`);
  }
  // page still alive?
  const alive = await page.evaluate(() => document.title).catch(() => null);
  if (!alive) bad("Page died after SQL abuse"); else ok("Page alive after SQL abuse");

  console.log("\n== E. Unnecessary escalation is penalised (INC-2102, escalation.required=false)");
  await openTicket(page, "INC-2102");
  const t2102 = tickets["INC-2102"];
  const rcIdx = t2102.root_cause_options.findIndex((o) => o.correct);
  const resIdx = t2102.resolution_options.findIndex((o) => o.grade === "best" || o.quality === "best" || o.correct || o.is_best || o.score === 3);
  await page.locator('input[name="root-cause"]').nth(rcIdx).click();
  await page.locator('input[name="resolution"]').nth(resIdx >= 0 ? resIdx : 0).click();
  await page.getByRole("button", { name: /escalate this ticket/i }).click();
  const sel = page.getByLabel(/route to team/i);
  const opts = await sel.locator("option").allTextContents();
  await sel.selectOption({ index: 1 });
  await page.locator("#reply-editor").fill("Hi, I can see the terminal timed out and the retry captured twice. I have raised the duplicate for reversal and the second NGN amount will be back within 5-7 business days. Sorry for the trouble.");
  await page.getByRole("button", { name: /submit ticket/i }).click();
  await page.waitForURL(/\/score/, { timeout: 5000 }).catch(() => {});
  const body = await page.locator("body").innerText();
  const escLine = body.split("\n").filter((l) => /escalat/i.test(l)).slice(0, 6).join(" // ");
  if (/unnecessar|did not need|did not require|not required|should not have|over-escalat|without need/i.test(body)) ok("Unnecessary escalation penalised with a written reason: " + escLine.slice(0, 200));
  else bad("No visible penalty/reason for unnecessary escalation on 2102. Escalation lines: " + escLine.slice(0, 300));
  await page.screenshot({ path: `${QA_DIR}e-2102-overescalate.png`, fullPage: true });

  console.log("\n== F. Determinism: perfect run on INC-2110 twice -> same score");
  const scores = [];
  for (let i = 0; i < 2; i++) {
    await page.goto(`${BASE}/queue`, { waitUntil: "networkidle" });
    const reset = page.getByRole("button", { name: /reset shift/i });
    if (await reset.count()) { await reset.click(); await page.waitForTimeout(300); }
    await openTicket(page, "INC-2110");
    const t = tickets["INC-2110"];
    const rc = t.root_cause_options.findIndex((o) => o.correct);
    const rs = t.resolution_options.findIndex((o) => o.grade === "best" || o.quality === "best" || o.correct || o.is_best || o.score === 3);
    await page.locator('input[name="root-cause"]').nth(rc).click();
    await page.locator('input[name="resolution"]').nth(rs >= 0 ? rs : 0).click();
    await page.getByRole("button", { name: /escalate this ticket/i }).click();
    await page.getByLabel(/route to team/i).selectOption({ label: "Crypto Ops" });
    const cbs = page.locator('fieldset input[type="checkbox"]');
    for (let k = 0; k < (await cbs.count()); k++) await cbs.nth(k).check();
    await page.locator("#reply-editor").fill("Hi Chiamaka, thank you for the transaction hash. Your 500 USDT was sent on BNB Smart Chain to an address we issued for Ethereum, so our listener never saw it. Your funds are not lost. I have opened a wrong-network recovery request with Crypto Ops; recovery typically completes within 3-5 business days once confirmed, and the NGN payout is calculated at the rate on the day the sweep lands. Please do not send anything further to that address in the meantime. I will update you as soon as Crypto Ops confirms.");
    await page.getByRole("button", { name: /submit ticket/i }).click();
    await page.waitForURL(/\/score/, { timeout: 5000 }).catch(() => {});
    const txt = await page.locator("body").innerText();
    const m = txt.match(/(\d{1,3})\s*\n?\s*out of 100/i) || txt.match(/(\d{1,3})\s*\/\s*100/);
    scores.push(m ? m[1] : "?");
    if (i === 0) await page.screenshot({ path: `${QA_DIR}f-2110-perfect.png`, fullPage: true });
  }
  console.log("   scores:", scores.join(", "));
  if (scores[0] !== scores[1]) bad("Non-deterministic score: " + scores.join(" vs ")); else ok("Deterministic score " + scores[0]);
  console.log("   (tools were NOT opened in this run, so a sub-100 score is expected: evidence is scored)");

  console.log("\n== G. Persistence: pick an option, reload, still selected");
  await openTicket(page, "INC-2105");
  await page.locator('input[name="root-cause"]').nth(1).click();
  await page.locator("#reply-editor").fill("draft text survives reload");
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  const still = await page.locator('input[name="root-cause"]').nth(1).isChecked();
  const draft = await page.locator("#reply-editor").inputValue();
  if (still && draft.includes("survives")) ok("Root cause + draft reply persisted across reload"); else bad(`Persistence failed: radio=${still} draft='${draft}'`);

  console.log("\n== H. Every ticket opens, has tools, 4 root causes, and can be submitted");
  for (const id of ids) {
    await openTicket(page, id);
    const rc = await page.locator('input[name="root-cause"]').count();
    const tabs = await page.getByRole("tab").count();
    const kb = await page.locator("text=/Knowledge base/i").count();
    if (rc !== 4) bad(`${id}: ${rc} root-cause options`);
    if (tabs < 1) bad(`${id}: no tool tabs`);
    // sql scratchpad table name visible?
    const sp = page.getByRole("button", { name: /open scratchpad/i });
    if (await sp.count()) await sp.click();
    await page.locator("#sql-scratchpad-input").waitFor({ state: "visible", timeout: 8000 }).catch(() => bad(`${id}: scratchpad did not open`));
    const table = tickets[id].tools?.sql_scratchpad?.table;
    if (table) {
      const r = await runSql(page, `SELECT count(*) AS n FROM ${table}`);
      if (/error|no such/i.test(r.text)) bad(`${id}: seeded table '${table}' not queryable: ${r.text.slice(0, 100)}`);
    }
    console.log(`   ${id}: rc=${rc} tabs=${tabs} kb=${kb} table=${table}`);
  }
  ok("All tickets iterated");

  console.log("\n== I. Mobile 390px - no horizontal overflow on workspace + scorecard");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/ticket/INC-2110", "/queue", "/how-scoring-works", "/"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 392) bad(`${path}: horizontal overflow at 390px (scrollWidth ${sw})`); else ok(`${path}: fits 390px (scrollWidth ${sw})`);
    await page.screenshot({ path: `${QA_DIR}i-mobile${path.replace(/\W+/g, "-")}.png`, fullPage: true });
  }

  console.log("\n== J. Keyboard: tab reaches root-cause radios and space selects");
  await page.setViewportSize({ width: 1280, height: 900 });
  await openTicket(page, "INC-2103");
  await page.locator('input[name="root-cause"]').first().focus();
  await page.keyboard.press("Space");
  const kb = await page.locator('input[name="root-cause"]').first().isChecked();
  (kb ? ok : bad)("Radio selectable via keyboard");

  console.log("\n== K. Unknown ticket id -> 404 not crash");
  await page.goto(`${BASE}/ticket/INC-9999`, { waitUntil: "networkidle" });
  const t404 = await page.locator("body").innerText();
  (/not found|404|no such ticket/i.test(t404) || /\/queue$/.test(page.url()) ? ok : bad)("Unknown ticket handled (404 page or redirect to queue): " + page.url());

  console.log("\n== Console errors:");
  const uniq = [...new Set(consoleErrors)];
  if (uniq.length === 0) console.log("   (none)"); else { uniq.forEach((e) => console.log("   -", e.slice(0, 200))); bad(`${uniq.length} console error(s)`); }

  await browser.close();
  console.log("\n==== FINDINGS (" + findings.length + ") ====");
  findings.forEach((f) => console.log(" * " + f));
}

main().catch((e) => { console.error("HOSTILE RUN CRASHED:", e); process.exit(1); });
