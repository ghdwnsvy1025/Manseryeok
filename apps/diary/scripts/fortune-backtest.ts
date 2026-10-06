/**
 * 운세 백테스트 — 이관된 기록으로 "점수 vs 실제 행복도" 피어슨 상관을 v3·v4 둘 다 잰다 (docs/FORTUNE_V4.md "10점 환산").
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts scripts/fortune-backtest.ts
 *
 * - Supabase service role로 night_entries(user_id, entry_date, happiness)와 night_saju_profiles를 읽는다. 쓰지 않는다.
 * - v3 = computeBaseFortune(기록 보정 없이 base만), v4 = computeCoreFortune(parts.score01). 둘 다 10점 환산 뒤 비교.
 * - 모델 호출은 하지 않는다. .env.local은 읽기만 하고 값은 출력하지 않는다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test } from "vitest";
import { birthProfileOf, type SajuProfileRow } from "@/lib/db";
import { computeBaseFortune } from "@/lib/fortune/base";
import { COEF, computeCoreFortune } from "@/lib/fortune/core";
import { toTenPoint } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";

const ROOT = path.resolve(__dirname, "..");

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (line.startsWith("#") || i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
const r3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "n/a");

interface EntryRow { user_id: string; entry_date: string; happiness: number }

test("fortune backtest: v3 vs v4 피어슨 상관", async () => {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profiles, error: e1 } = await sb
    .from("night_saju_profiles")
    .select("user_id, id, name, gender, calendar, is_leap_month, birth_year, birth_month, birth_day, birth_hour, birth_minute, city, pillars, engine_version");
  if (e1) throw new Error(`프로필 읽기: ${e1.message}`);
  const { data: entries, error: e2 } = await sb.from("night_entries").select("user_id, entry_date, happiness").order("entry_date").limit(5000);
  if (e2) throw new Error(`기록 읽기: ${e2.message}`);

  const byUser = new Map<string, SajuProfileRow>();
  for (const p of (profiles ?? []) as (SajuProfileRow & { user_id: string })[]) byUser.set(p.user_id, p);

  const v3: number[] = [], v4: number[] = [], raw: number[] = [], rawRel: number[] = [], happy: number[] = [];
  let skipped = 0;
  const warn = console.warn;
  console.warn = () => {}; // 원국 불일치 경고는 건수만 센다
  let mismatch = 0;
  const mismatchKinds = new Set<string>();
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).includes("원국 불일치")) { mismatch++; mismatchKinds.add(args.slice(1).join(" ")); } else warn(...args);
  };
  try {
    for (const e of (entries ?? []) as EntryRow[]) {
      const prof = byUser.get(e.user_id);
      if (!prof || typeof e.happiness !== "number") { skipped++; continue; }
      const today = dayGanji(e.entry_date);
      const b = computeBaseFortune(prof.pillars, { stem: today.hanja[0]!, branch: today.hanja[1]!, ko: today.ko });
      const c = computeCoreFortune({ pillars: prof.pillars, profile: birthProfileOf(prof), date: e.entry_date, todayHanja: today.hanja });
      v3.push(toTenPoint(b.score));
      v4.push(toTenPoint(c.parts.score01));
      raw.push(c.parts.raw);
      rawRel.push(c.parts.raw + c.parts.rel);
      happy.push(e.happiness);
    }
  } finally {
    console.warn = warn;
  }

  const n = happy.length;
  const users = new Set((entries ?? []).filter((e: EntryRow) => byUser.has(e.user_id)).map((e: EntryRow) => e.user_id)).size;
  const lines = [
    `n = ${n} (사용자 ${users}명, 프로필 없는 기록 ${skipped}건 제외, 원국 불일치 경고 ${mismatch}건)`,
    `v3 (base만)            r = ${r3(pearson(v3, happy))}`,
    `v4 (raw+rel+ctx)       r = ${r3(pearson(v4, happy))}`,
    `  v4 raw만             r = ${r3(pearson(raw, happy))}`,
    `  v4 raw+rel           r = ${r3(pearson(rawRel, happy))}`,
    `  계수: scale ${COEF.scale}, rel ±${COEF.rel}×강도(상한 ${COEF.relMax}), 대운충 ${COEF.daeunClash}/${COEF.daeunClashAlert}, 세운충 ${COEF.seunClash}, 월운충 ${COEF.wolunClash}, 합 +${COEF.union}(상한 ${COEF.unionMax})`,
    `  v4 점수 분포: 평균 ${(v4.reduce((a, b) => a + b, 0) / n).toFixed(2)}, 최소 ${Math.min(...v4)}, 최대 ${Math.max(...v4)}`,
    `  행복도 분포: 평균 ${(happy.reduce((a, b) => a + b, 0) / n).toFixed(2)}`,
    ...(mismatchKinds.size ? [`  원국 불일치 종류 (일기 앱 / 코어): ${[...mismatchKinds].join(" | ")}`] : []),
  ];
  console.log("\n" + lines.join("\n") + "\n");
}, 120_000);
