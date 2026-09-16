/** 한 화면만 찍는다: node scripts/shot-one.mjs diary/stats out.png (앞 슬래시 없이) */
import { chromium } from "playwright";
const [, , target, out] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await ctx.addInitScript(() => {
  try { localStorage.setItem("manseryeok_guest_mode", "1"); } catch {}
});
const page = await ctx.newPage();
await page.goto("http://localhost:3000/" + target.replace(/^\//, ""), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: out, fullPage: true });
console.log("찍음 →", out);
await browser.close();
