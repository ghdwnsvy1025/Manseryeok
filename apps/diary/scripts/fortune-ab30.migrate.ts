// 운세 A/B 비교 (v4.20, 2026-10-31 ChatGPT 2차 검토 23항). 사주 6명 × 30일을 실제 모델로 이어서 만든다(캐시·운영 DB 쓰기 없음).
// - 앞날 글이 다음 날의 "최근 운세"가 된다(운영처럼 14일). 5일에 한 번 "아니에요"(이유 content → obvious → awkward 차례), 7일에 한 번 "맞아요"
// - 같은 날짜를 6명이 받는다(같은 날 다른 사람 비교). 앱 주인은 기록이 있고, 나머지 5명은 기록 없음(1명은 시간 모름)
// - 행마다 작가에게 간 계획(renderBrief)을 남긴다 — 평가(fortune-judge.migrate.ts)가 의미 충실도를 그 계획에 대 본다
// 실행: AB_LABEL=A npx vitest run --config vitest.scripts.config.ts scripts/fortune-ab30.migrate.ts  (약 180편, 한 편 약 $0.008)
import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { addDays, parseYmd } from "@/lib/time";
import { birthProfileOf } from "@/lib/db";
import { computeProfile, type BirthProfile, type PillarsSnapshot } from "@/lib/profile";
import { dayGanji } from "@/lib/ganji";

const OUT = "C:/Users/HongJunpyo/Desktop/사주 앱/사주 일기/피드백/v420측정";
const DAYS = Number(process.env.AB_DAYS ?? 30);
const START = process.env.AB_START ?? "2026-11-01";
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 }; // Sonnet 5 $/1M
const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const REASONS = ["content", "obvious", "awkward"] as const;

/** v419측정 무작위 5명과 같은 사람들 */
const OTHERS: { id: string; p: BirthProfile }[] = [
  { id: "1995남", p: { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 2, birthDay: 16, birthHour: 8, birthMinute: 20, city: "seoul" } },
  { id: "2002여", p: { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 2002, birthMonth: 8, birthDay: 15, birthHour: 7, birthMinute: 44, city: "seoul" } },
  { id: "1989남", p: { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1989, birthMonth: 7, birthDay: 18, birthHour: 19, birthMinute: 51, city: "seoul" } },
  { id: "1986여", p: { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1986, birthMonth: 4, birthDay: 27, birthHour: 8, birthMinute: 17, city: "seoul" } },
  { id: "1996남_시간모름", p: { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1996, birthMonth: 11, birthDay: 22, birthHour: null, birthMinute: null, city: "seoul" } },
];

test("ab30", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  const { computeFortune, FORTUNE_VERSION } = await import("@/lib/fortune");
  const { buildBrief, recentFromRows, renderBrief } = await import("@/lib/fortune/brief");
  const { computeCoreFortune } = await import("@/lib/fortune/core");
  const { adjustWithEntries, bandOf, toTenPoint } = await import("@/lib/fortune/personal");
  const { PROMPT_VERSION } = await import("@/lib/fortune/llm");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
  const me = users.users.find((u) => u.id.startsWith("1aa4bbd3"))!;
  const { data: prof } = await sb.from("night_saju_profiles").select("*").eq("user_id", me.id).single();
  const { data: entries } = await sb.from("night_entries").select("entry_date, happiness, day_ganji_index, day_stem, day_branch").eq("user_id", me.id);

  type Person = { id: string; pillars: PillarsSnapshot; profile: BirthProfile; entries: typeof entries };
  const people: Person[] = [
    { id: "주인", pillars: prof.pillars, profile: birthProfileOf(prof), entries: entries! },
    ...OTHERS.map(({ id, p }) => {
      const r = computeProfile({ ...p, name: id });
      if (!r.ok) throw new Error(`${id}: ${r.error}`);
      return { id, pillars: r.value.pillars, profile: p, entries: [] };
    }),
  ];

  const runPerson = async (person: Person) => {
    const out: Record<string, unknown>[] = [];
    const history: { fortune_date: string; content: unknown; vote?: 1 | -1; voteReason?: (typeof REASONS)[number] }[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = addDays(START, i);
      const recentRows = history.filter((h) => h.fortune_date >= addDays(date, -14)).reverse();
      const recent = recentFromRows(recentRows as never).map((r) => {
        const h = recentRows.find((x) => x.fortune_date === r.date)!;
        return { ...r, ...(h.vote ? { vote: h.vote } : {}), ...(h.voteReason ? { voteReason: h.voteReason } : {}) };
      });
      // 작가에게 간 계획을 index.ts와 같은 재료로 다시 만든다 (평가용)
      const today = dayGanji(date);
      const core = computeCoreFortune({ pillars: person.pillars, profile: person.profile, date, todayHanja: today.hanja });
      const personal = adjustWithEntries(core.parts.score01, person.entries ?? [], { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
      const score10 = toTenPoint(personal.score);
      const ymd = parseYmd(date)!;
      const brief = buildBrief({ core, personal, today: { ko: today.ko, hanja: today.hanja, stemKo: today.stemKo, branchKo: today.branchKo }, date, weekday: WEEKDAYS[new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay()]!, score10, band: bandOf(score10), recent });

      const t = performance.now();
      const c = await computeFortune({ date, pillars: person.pillars, profile: person.profile, entries: person.entries ?? [], recent }, { useModel: true });
      const ms = Math.round(performance.now() - t);
      const u = (c.usage ?? {}) as Record<string, number>;
      const cost = ((u.input ?? 0) * PRICE.input + (u.output ?? 0) * PRICE.output + (u.cacheRead ?? 0) * PRICE.cacheRead + (u.cacheWrite ?? 0) * PRICE.cacheWrite) / 1e6;
      const vote = i % 5 === 2 ? (-1 as const) : i % 7 === 4 ? (1 as const) : undefined;
      const voteReason = vote === -1 ? REASONS[Math.floor(i / 5) % 3] : undefined;
      history.push({ fortune_date: date, content: c, ...(vote ? { vote } : {}), ...(voteReason ? { voteReason } : {}) });
      const clashes = core.relations.hits.filter((h) => h.kind === "충").length;
      out.push({
        person: person.id, date, ms, source: c.source, attempts: c.attempts, usage: u, cost: +cost.toFixed(4), score: c.score, band: c.band,
        headline: c.headline, bodySentences: c.bodySentences ?? null, body: c.body, do: c.do, dont: c.dont, areas: c.areas ?? [],
        plan: c.plan, metrics: (c as Record<string, unknown>).metrics ?? null, clashes, brief: renderBrief(brief), ...(vote ? { vote } : {}), ...(voteReason ? { voteReason } : {}),
      });
      console.log(person.id, date, ms, "ms", c.source, "attempts", c.attempts, "$", cost.toFixed(4));
    }
    return out;
  };
  const rows = (await Promise.all(people.map(runPerson))).flat();

  const n = rows.length;
  const num = (k: string) => rows.map((r) => r[k] as number);
  const sortedMs = num("ms").sort((a, b) => a - b);
  const pct = (p: number) => sortedMs[Math.min(n - 1, Math.floor(n * p))];
  const sum = {
    label: process.env.AB_LABEL ?? FORTUNE_VERSION, version: FORTUNE_VERSION, promptVersion: PROMPT_VERSION, n,
    p50ms: pct(0.5), p95ms: pct(0.95), 최대ms: sortedMs[n - 1],
    평균호출: +(num("attempts").reduce((a, b) => a + b, 0) / n).toFixed(2),
    수리있음: rows.filter((r) => (r.attempts as number) > 1).length / n,
    폴백: rows.filter((r) => r.source !== "llm").length / n,
    첫호출통과: rows.filter((r) => r.attempts === 1 && r.source === "llm").length / n,
    평균입력토큰: Math.round(rows.reduce((s, r) => { const u = r.usage as Record<string, number>; return s + (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0); }, 0) / n),
    평균출력토큰: Math.round(rows.reduce((s, r) => s + ((r.usage as Record<string, number>).output ?? 0), 0) / n),
    평균비용: +(num("cost").reduce((a, b) => a + b, 0) / n).toFixed(4),
    총비용: +num("cost").reduce((a, b) => a + b, 0).toFixed(3),
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${sum.label}.json`, JSON.stringify({ 요약: sum, rows }, null, 2));
  console.log("요약", JSON.stringify(sum));
}, 3_600_000);
