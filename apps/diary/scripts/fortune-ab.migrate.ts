// 운세 전후 비교 측정 (v4.18 → v4.19, 2026-10-31). 앱 주인 원국·기록으로 8일치를 실제 모델로 만들고(캐시 저장 없음)
// 시간·호출·토큰·비용·출고를 기록한다. 실행: AB_LABEL=v418 npx vitest run --config vitest.scripts.config.ts scripts/fortune-ab.migrate.ts
import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/time";
import { birthProfileOf } from "@/lib/db";

const OUT = "C:/Users/HongJunpyo/Desktop/사주 앱/사주 일기/피드백/v419측정";
const DAYS = Number(process.env.AB_DAYS ?? 8);
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 }; // Sonnet 5 $/1M

test("ab", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  const { computeFortune, FORTUNE_VERSION } = await import("@/lib/fortune");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
  const me = users.users.find((u) => u.id.startsWith("1aa4bbd3"))!;
  const { data: prof } = await sb.from("night_saju_profiles").select("*").eq("user_id", me.id).single();
  const { data: entries } = await sb.from("night_entries").select("entry_date, happiness, day_ganji_index, day_stem, day_branch").eq("user_id", me.id);
  const rows = [];
  for (let i = 0; i < DAYS; i++) {
    const date = addDays("2026-11-01", i);
    const t = performance.now();
    const c = await computeFortune({ date, pillars: prof.pillars, profile: birthProfileOf(prof), entries: entries!, recent: [] }, { useModel: true });
    const ms = Math.round(performance.now() - t);
    const u = (c.usage ?? {}) as Record<string, number>;
    const cost = ((u.input ?? 0) * PRICE.input + (u.output ?? 0) * PRICE.output + (u.cacheRead ?? 0) * PRICE.cacheRead + (u.cacheWrite ?? 0) * PRICE.cacheWrite) / 1e6;
    rows.push({ date, ms, source: c.source, attempts: c.attempts, usage: u, cost: +cost.toFixed(4), score: c.score, headline: c.headline, body: c.body, do: c.do, dont: c.dont, areas: c.areas, metrics: (c as Record<string, unknown>).metrics ?? null });
    console.log(date, ms, "ms", c.source, "attempts", c.attempts, "$", cost.toFixed(4));
  }
  const n = rows.length, avg = (f: (r: (typeof rows)[number]) => number) => +(rows.reduce((s, r) => s + f(r), 0) / n).toFixed(3);
  const sorted = [...rows].map((r) => r.ms).sort((a, b) => a - b);
  const sum = { version: FORTUNE_VERSION, n, 평균ms: avg((r) => r.ms), p50ms: sorted[Math.floor(n / 2)], 최대ms: sorted[n - 1], 평균시도: avg((r) => r.attempts ?? 0), 평균비용: avg((r) => r.cost), 모델글비율: rows.filter((r) => r.source === "llm").length / n, 첫시도통과: rows.filter((r) => r.attempts === 1 && r.source === "llm").length / n };
  writeFileSync(`${OUT}/${process.env.AB_LABEL ?? FORTUNE_VERSION}.json`, JSON.stringify({ 요약: sum, rows }, null, 2));
  console.log("요약", JSON.stringify(sum));
}, 900_000);
