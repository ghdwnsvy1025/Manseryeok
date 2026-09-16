/**
 * 봉인 점검 — 접기로 한 주소가 진짜 막히고, 살아 있는 주소는 안 막히는지
 * 실제 브라우저로 전부 눌러 본다.
 *
 *   npm run dev                 (다른 터미널)
 *   node scripts/seal-check.mjs
 *
 * 단위 테스트(sealedRoutes.test.ts)는 판정 함수만 본다.
 * 이 스크립트는 그 함수가 화면에 실제로 걸리는지까지 본다.
 */
import { chromium } from "playwright";

const SEALED = ["/diary","/diary/collection","/diary/history","/diary/stats",
  "/analysis","/analysis/daily","/analysis/weekly","/analysis/monthly","/forecast"];
const ALIVE = ["/","/me","/journal","/journal/stats","/stats","/saju","/saju/other","/saju/profiles"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// 게스트로 들어가야 셸이 열린다
await ctx.addInitScript(() => {
  try { localStorage.setItem("manseryeok_guest_mode", "1"); } catch {}
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

const check = async (path) => {
  await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  const sealed = await page.getByText("이 화면은 접었어요").isVisible().catch(() => false);
  return sealed;
};

console.log("── 접혀야 할 것 ──");
let bad = 0;
for (const p of SEALED) {
  const s = await check(p);
  console.log(`${s ? "✔ 접힘  " : "✘ 열림! "} ${p}`);
  if (!s) bad += 1;
}
console.log("\n── 열려야 할 것 ──");
for (const p of ALIVE) {
  const s = await check(p);
  console.log(`${s ? "✘ 막힘! " : "✔ 열림  "} ${p}`);
  if (s) bad += 1;
}
console.log(`\n어긋난 곳 ${bad}개 · 페이지 오류 ${errs.length}건`);
for (const e of errs.slice(0, 5)) console.log("  - " + e.slice(0, 160));
await browser.close();
process.exitCode = bad ? 1 : 0;
