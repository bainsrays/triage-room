// Headless Playwright smoke test against the built+previewed app.
// Run with: node scripts/smoke.mjs  (expects `vite preview --port 4179` running)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4179";
const QA_DIR = new URL("../qa/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(QA_DIR, { recursive: true });

const consoleErrors = [];

function logStep(msg) {
  console.log(`\n=== ${msg}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  logStep("1. Landing page");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${QA_DIR}01-landing.png`, fullPage: true });

  logStep("2. Start shift -> queue");
  await page.getByRole("link", { name: /start a shift/i }).first().click();
  await page.waitForURL(/\/queue/);
  await page.getByRole("button", { name: /start shift/i }).click().catch(() => {});
  await page.screenshot({ path: `${QA_DIR}02-queue.png`, fullPage: true });

  logStep("3. Open INC-2110");
  const row = page.locator("tr", { hasText: "INC-2110" });
  await row.getByRole("link", { name: /open|review/i }).click();
  await page.waitForURL(/\/ticket\/INC-2110/);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${QA_DIR}03-workspace.png`, fullPage: true });

  logStep("4. Open 2 tool tabs");
  const tabs = page.getByRole("tab");
  const tabCount = await tabs.count();
  console.log(`   found ${tabCount} tool tabs`);
  if (tabCount > 1) {
    await tabs.nth(1).click();
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: `${QA_DIR}04-tool-panel.png`, fullPage: true });

  logStep("5. Open SQL scratchpad, run a SELECT");
  const openScratchpad = page.getByRole("button", { name: /open scratchpad/i });
  if (await openScratchpad.count()) {
    await openScratchpad.click();
    await page.waitForTimeout(300);
  }
  const sqlBox = page.locator("#sql-scratchpad-input");
  await sqlBox.waitFor({ state: "visible", timeout: 5000 });
  await sqlBox.fill("SELECT * FROM crypto_deposits;");
  await page.getByRole("button", { name: /run/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${QA_DIR}05-sql-select.png`, fullPage: true });
  const selectError = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  console.log("   after SELECT, alert text:", selectError);

  logStep("6. Run a DROP TABLE (should be rejected)");
  await sqlBox.fill("DROP TABLE crypto_deposits;");
  await page.getByRole("button", { name: /run/i }).click();
  await page.waitForTimeout(300);
  const dropAlert = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  console.log("   after DROP, alert text:", dropAlert);
  await page.screenshot({ path: `${QA_DIR}06-sql-drop-rejected.png`, fullPage: true });

  logStep("7. Pick root cause + resolution");
  const rootCauseRadios = page.locator('input[name="root-cause"]');
  await rootCauseRadios.first().waitFor({ state: "visible" });
  // Click the label wrapping the first radio (correct option is first per content authoring in most tickets; not guaranteed, but fine for smoke test)
  await page.locator('input[name="root-cause"]').first().click();
  await page.locator('input[name="resolution"]').first().click();
  await page.screenshot({ path: `${QA_DIR}07-pickers.png`, fullPage: true });

  logStep("8. Escalate with payload");
  await page.getByRole("button", { name: /escalate this ticket/i }).click();
  await page.getByLabel(/route to team/i).selectOption({ label: "Crypto Ops" });
  const checkboxes = page.locator('fieldset input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  if (cbCount > 0) await checkboxes.nth(0).check();
  if (cbCount > 1) await checkboxes.nth(1).check();
  await page.screenshot({ path: `${QA_DIR}08-escalation.png`, fullPage: true });

  logStep("9. Write reply containing a fake card number (must be flagged)");
  const reply = page.locator("#reply-editor");
  await reply.fill(
    "Hi Chiamaka, thanks for the transaction hash. Please confirm the card 4111111111111111 you used, and I will follow up within 3-5 business days once Crypto Ops confirms the recovery."
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${QA_DIR}09-composer-flagged.png`, fullPage: true });
  const panCheckText = await page.locator("text=No full card number exposed").locator("..").locator("..").textContent().catch(() => null);
  console.log("   PAN check area text:", panCheckText);

  logStep("10. Fix the reply (remove PAN) and submit");
  await reply.fill(
    "Hi Chiamaka, thank you for the transaction hash, that helps a lot. Your 500 USDT was sent on BNB Smart Chain to an address issued for Ethereum, so it never credited automatically. Your funds are not lost — I am opening a wrong-network recovery request with Crypto Ops now, and this typically takes 3-5 business days once confirmed. Please do not send anything further to that address in the meantime. I will update you as soon as Crypto Ops confirms the recovery."
  );
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /submit ticket/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${QA_DIR}10-after-submit.png`, fullPage: true });

  logStep("11. Score card renders");
  await page.waitForURL(/\/score/, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${QA_DIR}11-scorecard.png`, fullPage: true });

  logStep("12. Download PNG");
  const downloadPromise = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  await page.getByRole("button", { name: /download card/i }).click();
  const download = await downloadPromise;
  if (download) {
    await download.saveAs(`${QA_DIR}score-card-export.png`);
    console.log("   PNG export saved to qa/score-card-export.png");
  } else {
    console.log("   WARNING: no download event captured within timeout");
  }

  logStep("13. Responsive check at 390px");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${QA_DIR}12-mobile-landing.png`, fullPage: true });
  await page.goto(`${BASE}/queue`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${QA_DIR}13-mobile-queue.png`, fullPage: true });

  console.log("\n=== Console errors captured during smoke test ===");
  if (consoleErrors.length === 0) {
    console.log("(none)");
  } else {
    consoleErrors.forEach((e) => console.log(" -", e));
  }

  await browser.close();
  console.log("\nSmoke test complete.");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
