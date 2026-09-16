/**
 * 꽃잎 점검 — 실제 앱 CSS 로 움직이는지·사라지는지·동작 줄이기에서 꺼지는지 잰다.
 *   node scripts/petal-check.mjs <스크린샷 폴더>
 */
import { chromium } from "playwright";
import path from "node:path";
const OUT = process.argv[2] ?? ".";

const PETALS = (variant, n) =>
  Array.from({ length: n }, (_, i) =>
    `<span class="petal-col" style="left:${5 + i * (90 / n)}%;animation-duration:${variant === "burst" ? 2.8 + (i % 4) * 0.2 : 16 + i}s;animation-delay:${variant === "burst" ? (i % 5) * 0.12 : -(i * 2)}s">` +
    `<span class="petal petal--${i % 2}" style="width:10px;height:10px;opacity:${variant === "burst" ? 0.9 : 0.2};animation-duration:${variant === "burst" ? 1.5 : 4.5}s"></span></span>`
  ).join("");

async function mount(page, variant, n) {
  await page.evaluate(({ html, variant }) => {
    document.querySelectorAll("#petal-probe").forEach((e) => e.remove());
    const host = document.createElement("div");
    host.id = "petal-probe";
    host.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none";
    host.innerHTML = `<div class="petal-layer petal-layer--${variant}">${html}</div>`;
    document.body.appendChild(host);
  }, { html: PETALS(variant, n), variant });
}

const snap = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#petal-probe .petal-col")].map((c) => {
      const r = c.firstElementChild.getBoundingClientRect();
      return { y: Math.round(r.top), op: Number(getComputedStyle(c).opacity) };
    })
  );

const b = await chromium.launch();
for (const reduced of [false, true]) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  const skin = await page.evaluate(() => document.documentElement.dataset.skin);
  console.log(`\n== 동작 줄이기 ${reduced ? "켬" : "끔"} · data-skin=${skin} ==`);

  // ambient
  await mount(page, "ambient", 6);
  const visibleAmbient = await page.evaluate(() => getComputedStyle(document.querySelector("#petal-probe .petal-layer")).display);
  const a1 = await snap(page);
  await page.waitForTimeout(2000);
  const a2 = await snap(page);
  const moved = a1.filter((p, i) => Math.abs(p.y - a2[i].y) >= 2).length;
  console.log(`평소(ambient)  display=${visibleAmbient}  2초 동안 움직인 꽃잎 ${moved}/${a1.length}  (예: y ${a1[0].y} → ${a2[0].y})`);

  // burst
  await mount(page, "burst", 20);
  await page.waitForTimeout(1200);
  const b1 = await snap(page);
  if (!reduced) await page.screenshot({ path: path.join(OUT, "burst-1.2s.png") });
  await page.waitForTimeout(3800);
  const b2 = await snap(page);
  if (!reduced) await page.screenshot({ path: path.join(OUT, "burst-5s.png") });
  const shown1 = b1.filter((p) => p.op > 0.2).length;
  const shown2 = b2.filter((p) => p.op > 0.05).length;
  const visibleBurst = await page.evaluate(() => getComputedStyle(document.querySelector("#petal-probe .petal-layer")).display);
  console.log(`흩날림(burst)  display=${visibleBurst}  1.2초에 보이는 꽃잎 ${shown1}/20 · 5초에 남은 꽃잎 ${shown2}/20`);
  await ctx.close();
}
await b.close();
