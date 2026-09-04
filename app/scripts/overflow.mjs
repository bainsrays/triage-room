import { chromium } from "playwright";
const BASE = "http://localhost:4179";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const path of ["/ticket/INC-2101","/ticket/INC-2102","/ticket/INC-2103","/ticket/INC-2104","/ticket/INC-2105","/ticket/INC-2106","/ticket/INC-2107","/ticket/INC-2108","/ticket/INC-2109","/ticket/INC-2110","/ticket/INC-2111","/how-scoring-works","/why-these-tickets"]) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const sp = page.getByRole("button", { name: /open scratchpad/i });
  console.log("before scratchpad:", await page.evaluate(() => document.documentElement.scrollWidth)); if (await sp.count()) await sp.click().catch(() => {});
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => { window.scrollTo(0,0);
    const out = [];
    const W = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 392 && r.width < 2000) {
        const cls = (el.className && typeof el.className === "string") ? el.className.slice(0, 80) : "";
        out.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} w=${Math.round(r.width)} :: ${(el.textContent || "").trim().slice(0, 50)}`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, offenders: out.slice(0, 12) };
  });
  console.log("\n" + path, "scrollWidth", res.scrollWidth);
  if (res.scrollWidth > 392) res.offenders.slice(-4).forEach((o) => console.log("  ", o));
}
await browser.close();
