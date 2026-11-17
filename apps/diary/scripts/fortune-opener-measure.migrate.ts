// 2026-11-17 제목 머리 검사(validate.ts headlineOpener)를 켜기 전에 지난 글로 잰다. 모델·DB 없음.
// 실행 (apps/diary): npx vitest run --config vitest.scripts.config.ts scripts/fortune-opener-measure.migrate.ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { headlineOpener } from "@/lib/fortune/validate";
import { daySeed } from "@/lib/fortune/brief";

const F = path.resolve(__dirname, "../../../../피드백");
test("제목 머리 겹침 재기", () => {
  const sets: Record<string, string> = { 주인_시안5: "11.16_v5_시안5/시안", 주인_시안4: "11.15_v5_시안4/시안" };
  for (const P of ["P1", "P2", "P3", "P4", "P5"]) sets[P] = `11.17_다른사주_검증/${P}/시안`;
  let n = 0; const hits: string[] = [];
  for (const [k, d] of Object.entries(sets)) {
    const xs = readdirSync(path.join(F, d)).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(path.join(F, d, f), "utf8")) as { date: string; text: { headline: string } });
    xs.forEach((x, i) => {
      n++;
      const o = headlineOpener(x.text.headline);
      const r = xs.slice(0, i).find((y) => daySeed(x.date) - daySeed(y.date) <= 3 && headlineOpener(y.text.headline) === o);
      if (o && r) hits.push(`${k} ${x.date.slice(5)} "${x.text.headline}" ← ${r.date.slice(5)} "${r.text.headline}" [${o}]`);
    });
  }
  console.log(`제목 ${n}편 중 걸리는 것 ${hits.length}\n` + hits.join("\n"));
});
