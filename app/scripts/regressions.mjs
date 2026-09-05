import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const server = await createServer({ root, server: { host: "127.0.0.1", port: 4188, strictPort: true, open: false }, logLevel: "error" });
let browser;
let checks = 0;
const errors = [];
const base = "http://127.0.0.1:4188";
const storageKey = "triageroom.shiftState.v1";

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  console.log(`PASS ${message}`);
}

async function openPage(context, ticketId = "INC-2101") {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/ticket/${ticketId}`, { waitUntil: "networkidle" });
  await page.locator("#reply-editor").waitFor();
  return page;
}

async function savedDraft(page, ticketId, draft) {
  await page.waitForFunction(({ storageKey, ticketId, draft }) =>
    JSON.parse(localStorage.getItem(storageKey))?.tickets[ticketId]?.replyDraft === draft,
  { storageKey, ticketId, draft });
}

try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await openPage(context);
  async function visibleSql() {
    await page.getByRole("button", { name: "Open scratchpad" }).click();
    const panel = page.locator('section[aria-labelledby="sql-heading"]');
    await panel.getByRole("button", { name: /^Run/ }).click();
    await panel.locator("table tbody tr").first().waitFor();
    return panel.locator("table").innerText();
  }
  check((await visibleSql()).includes("TRX-9F31A2"), "first ticket SQL evidence");
  await page.locator('main a[href="/queue"]').first().click();
  await page.locator('a[href="/ticket/INC-2102"]').first().click();
  const secondSql = await visibleSql();
  check(secondSql.includes("TRX-A014C2") && !secondSql.includes("TRX-9F31A2"), "SQL follows actual ticket navigation");
  const sqlResults = await page.evaluate(async () => {
    const { runSqlQuery, extractSeedTables } = await import("/src/lib/sqlDb.ts");
    const { TICKETS } = await import("/src/lib/tickets.ts");
    const results = [];
    for (const ticket of [...TICKETS, TICKETS[0]]) {
      const { tables } = extractSeedTables(ticket);
      if (!tables.length) continue;
      const result = await runSqlQuery(tables, `SELECT * FROM "${tables[0].name}";`);
      results.push({ id: ticket.id, result, expectedRows: tables[0].rows.length });
    }
    return results;
  });
  for (const result of sqlResults) {
    check(result.result.ok && result.result.result.rowCount === result.expectedRows, `${result.id} SQL seed loads and returns correct row count`);
  }
  await context.close();

  const tabs = await browser.newContext();
  const first = await openPage(tabs);
  const second = await openPage(tabs, "INC-2102");
  await first.locator("#reply-editor").fill("Ifeoma draft from tab A");
  await savedDraft(first, "INC-2101", "Ifeoma draft from tab A");
  await second.locator("#reply-editor").fill("Tunde draft from tab B");
  await savedDraft(second, "INC-2102", "Tunde draft from tab B");
  await first.reload();
  check(await first.locator("#reply-editor").inputValue() === "Ifeoma draft from tab A", "second tab cannot erase first draft");
  for (let index = 0; index < 12; index += 1) {
    await Promise.all([
      first.locator("#reply-editor").fill(`Concurrent A ${index}`),
      second.locator("#reply-editor").fill(`Concurrent B ${index}`),
    ]);
  }
  await savedDraft(first, "INC-2101", "Concurrent A 11");
  await savedDraft(second, "INC-2102", "Concurrent B 11");
  check(true, "simultaneous tab writes retain both drafts");
  await first.locator("#reply-editor").fill("");
  await first.locator("#reply-editor").pressSequentially("Fast typing keeps every character.", { delay: 1 });
  await savedDraft(first, "INC-2101", "Fast typing keeps every character.");
  check(await first.locator("#reply-editor").inputValue() === "Fast typing keeps every character.", "asynchronous persistence preserves fast typing");
  await second.goto(`${base}/ticket/INC-2101`);
  await second.locator('input[name="root-cause"]').first().check();
  await first.waitForFunction(() => document.querySelector('input[name="root-cause"]')?.checked);
  check(await first.locator("#reply-editor").inputValue() === "Fast typing keeps every character.", "same-ticket evidence choices preserve another tab's draft and sync live");
  for (const tab of await first.getByRole("tab").all()) await tab.click();
  await first.locator("details.kb-item summary").first().click();
  await second.goto(`${base}/queue`);
  second.on("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: /Reset shift/i }).click();
  await first.waitForFunction(() => document.querySelector("#reply-editor")?.value === "");
  check(true, "reset propagates to another open ticket");
  check(!(await first.locator("details.kb-item p").first().isVisible()), "reset collapses previously read KB content");
  for (const tab of await first.getByRole("tab").all()) await tab.click();
  await first.waitForFunction((key) => JSON.parse(localStorage.getItem(key))?.tickets["INC-2101"]?.toolOpens.length === 3, storageKey);
  check(true, "all evidence tabs can earn credit again after reset");
  await first.locator("#reply-editor").fill("New shift draft");
  await savedDraft(first, "INC-2101", "New shift draft");
  const afterReset = await first.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  check(!afterReset.tickets["INC-2102"] && Object.keys(afterReset.scores).length === 0, "edits after reset do not resurrect old tickets or scores");
  await tabs.close();

  const evidence = await browser.newContext();
  const evidencePage = await openPage(evidence, "INC-2109");
  await evidencePage.getByRole("tab", { name: "Partner Status" }).click();
  const nestedText = await evidencePage.getByRole("tabpanel").innerText();
  check(!nestedText.includes("[object Object]") && nestedText.includes("OLAMIDE FASHOLA") && nestedText.includes("AWAITING_MANUAL_MATCH"), "nested wire evidence remains readable");
  for (const [ticketId, tab, expected] of [
    ["INC-2103", "Auth & Risk Events", "Score driven by device"],
    ["INC-2111", "Transaction Log", "Shortfall reconciles exactly"],
  ]) {
    await evidencePage.goto(`${base}/ticket/${ticketId}`);
    await evidencePage.getByRole("tab", { name: tab }).click();
    check((await evidencePage.getByRole("tabpanel").innerText()).includes(expected), `${ticketId} table sibling metadata is shown`);
  }
  await evidencePage.goto(`${base}/ticket/INC-2104`);
  const article = evidencePage.locator("details.kb-item").first();
  check(!(await article.locator("p").isVisible()), "KB article starts collapsed");
  await article.locator("summary").click();
  await evidencePage.waitForFunction((key) => JSON.parse(localStorage.getItem(key))?.tickets["INC-2104"]?.knowledgeBaseOpened, storageKey);
  check(await article.locator("p").isVisible(), "opening KB shows content and earns read credit");
  await article.locator("summary").click();
  check(!(await article.locator("p").isVisible()), "KB can be collapsed again");
  await evidence.close();

  const unavailable = await browser.newContext();
  await unavailable.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
    navigator.locks.request = () => Promise.reject(new Error("Access denied"));
  });
  const offlinePage = await openPage(unavailable);
  await offlinePage.locator("#reply-editor").fill("Memory-only draft");
  await offlinePage.locator('input[name="root-cause"]').first().check();
  check(await offlinePage.locator("#reply-editor").inputValue() === "Memory-only draft", "unavailable storage keeps session edits in memory");
  await unavailable.close();

  const quotaTabs = await browser.newContext();
  const memoryPage = await openPage(quotaTabs);
  const writingPage = await openPage(quotaTabs, "INC-2102");
  await memoryPage.evaluate(() => {
    window.restoreStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
  });
  await memoryPage.locator("#reply-editor").fill("Unsaved local draft");
  await writingPage.locator("#reply-editor").fill("Remote saved draft");
  await savedDraft(writingPage, "INC-2102", "Remote saved draft");
  await memoryPage.waitForTimeout(100);
  check(await memoryPage.locator("#reply-editor").inputValue() === "Unsaved local draft", "remote storage events preserve memory-only drafts");
  await memoryPage.evaluate(() => { Storage.prototype.setItem = window.restoreStorageWrite; });
  await memoryPage.locator('input[name="root-cause"]').first().check();
  await savedDraft(memoryPage, "INC-2101", "Unsaved local draft");
  await savedDraft(writingPage, "INC-2102", "Remote saved draft");
  check(true, "storage recovery saves both local and remote work");
  await quotaTabs.close();
  check(errors.length === 0, `no uncaught browser errors (${errors.join("; ")})`);
  console.log(`Regression checks passed: ${checks}`);
} finally {
  await browser?.close();
  await server.close();
}
