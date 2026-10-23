/**
 * 운세 글 말뭉치 — 사주 3 × 이어진 날짜 5일을 실제 모델로 만들어 JSON 배열로 저장한다(되풀이 검토 스킬 text-repeat-review 입력용).
 * 날마다 앞 날들의 글을 recent로 넘겨 실제 서비스처럼(어제·그제와 꼴 겹침 회피) 돈다.
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts scripts/fortune-corpus.ts
 *   환경변수 CORPUS_OUT(저장 파일), CORPUS_DAYS(기본 5), CORPUS_START(기본 2026-10-15), FORTUNE_REVIEW_MODEL(검수 켜기)
 *
 * - 모델 호출이 있다 (사주 수 × 날 수 × 1~2회). 재작성은 한 번까지(maxAttempts 2).
 * - .env.local의 ANTHROPIC_API_KEY를 읽기만 하고 값은 출력하지 않는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { buildBrief, recentFromRows } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import Anthropic from "@anthropic-ai/sdk";
import { generateFortuneText } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const ROOT = path.resolve(__dirname, "..");
const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
function loadEnv(): void {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("="); if (line.startsWith("#") || i < 0) continue;
    const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
}
const PROFILES: { name: string; p: BirthProfile }[] = [
  { name: "A-1990-01-01", p: { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" } },
  { name: "B-1995-05-15", p: { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 5, birthDay: 15, birthHour: 9, birthMinute: 0, city: "seoul" } },
  { name: "C-1984-11-03", p: { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1984, birthMonth: 11, birthDay: 3, birthHour: 7, birthMinute: 30, city: "busan" } },
  // v4.15 (2026-10-23): 사용자가 고른 30일 모의 생성 사주
  { name: "D-1994-01-28", p: { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1994, birthMonth: 1, birthDay: 28, birthHour: 12, birthMinute: 0, city: "seoul" } },
];
/** 환경변수 CORPUS_PROFILES="D" 또는 "A,B"로 사주를 고른다(이름의 첫 글자). 비우면 A·B·C */
const pickProfiles = (): typeof PROFILES => { const want = (process.env.CORPUS_PROFILES ?? "A,B,C").split(",").map((x) => x.trim()); return PROFILES.filter((x) => want.includes(x.name[0]!)); };
const addDays = (d: string, n: number) => { const [y, m, dd] = d.split("-").map(Number) as [number, number, number]; const t = new Date(Date.UTC(y, m - 1, dd + n)); return t.toISOString().slice(0, 10); };

test("fortune corpus: 사주 3 × 날짜 N", async () => {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error(".env.local에 ANTHROPIC_API_KEY가 필요합니다");
  const DAYS = Number(process.env.CORPUS_DAYS ?? 5), START = process.env.CORPUS_START ?? "2026-10-15";
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  const out = process.env.CORPUS_OUT ?? path.join(ROOT, "..", "..", "..", "..", "문서", `운세말뭉치_${START}.json`);   // apps/diary → Manseryeok → 사주 일기 → 사주 앱/문서
  const corpus: { id: string; 칸: Record<string, string>; meta: Record<string, unknown> }[] = [];
  let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, templates = 0;
  for (const { name, p } of pickProfiles()) {
    const prof = computeProfile({ ...p, name: "x" }); if (!prof.ok) throw new Error(prof.error);
    const rows: { fortune_date: string; content: { headline?: string; body?: string; stage?: string; tags?: NonNullable<Awaited<ReturnType<typeof generateFortuneText>>["tags"]> } | null }[] = [];
    for (let k = 0; k < DAYS; k++) {
      const date = addDays(START, k); const [y, m, d] = date.split("-").map(Number) as [number, number, number];
      const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
      const today = dayGanji(date); const todayInfo = { ko: today.ko, hanja: today.hanja, stemKo: today.stemKo, branchKo: today.branchKo };
      const core = computeCoreFortune({ pillars: prof.value.pillars, profile: p, date, todayHanja: today.hanja });
      const personal = adjustWithEntries(core.parts.score01, [], { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
      const score10 = toTenPoint(personal.score), band = bandOf(score10);
      const recent = recentFromRows(rows.slice(-14));   // v4.16: 태그 7일·제목 14일·첫 문장 3일은 brief가 가른다
      const input = { core, personal, today: todayInfo, date, weekday, score10, band, recent };
      const fallback = templateText(templateInputFromCore(core), personal, todayInfo);
      const r = await generateFortuneText(input, fallback, { maxAttempts: Number(process.env.CORPUS_ATTEMPTS ?? 2), client });   // v4.16: CORPUS_ATTEMPTS=3이면 운영과 같은 재작성 2회   // 서비스용 클라이언트는 8초 타임아웃(전체검토 A-2)이라 말뭉치 생성에는 넉넉한 것을 따로 씀
      usage.input += r.usage.input; usage.output += r.usage.output; usage.cacheRead += r.usage.cacheRead; usage.cacheWrite += r.usage.cacheWrite; if (r.source === "template") templates++;
      const t = r.text;
      corpus.push({ id: `${name}_${date}`, 칸: { headline: t.headline, body: t.body, do: t.do, dont: t.dont, ...(t.areas?.length ? { areas: t.areas.map((a) => a.line).join(" ") } : {}) },
        meta: { source: r.source, attempts: r.attempts, patches: r.patches, band, angle: buildBrief(input).angle, stage: r.stage ?? null, structure: r.judge?.구조 ?? null, judge: r.judge ?? null, tags: r.tags ?? null, core: r.core ?? null, review: r.review ?? null, issues: r.issues, ...(r.source === "template" && r.lastModelText ? { lastModelText: r.lastModelText } : {}) } });   // v4.14: 템플릿으로 떨어진 편은 마지막 탈락 초고를 남겨 검사기를 고친 뒤 오프라인 재검사할 수 있게
      rows.push({ fortune_date: date, content: { headline: t.headline, body: t.body, ...(r.stage ? { stage: r.stage } : {}), ...(r.tags ? { tags: r.tags } : {}) } });
      console.log(`${name} ${date} ${band} ${r.source} attempts=${r.attempts}${r.patches ? ` patches=${r.patches}` : ""}${r.review ? ` review=${r.review.status}` : ""} :: ${t.headline}${r.source === "template" ? ` [사유: ${r.issues.map((x) => x.join(" / ")).join(" | ")}]` : ""}`);
    }
  }
  writeFileSync(out, JSON.stringify(corpus, null, 1), "utf8");
  console.log(`저장 ${out} · ${corpus.length}편 · 템플릿 ${templates} · 토큰 입력 ${usage.input} 출력 ${usage.output} 캐시읽기 ${usage.cacheRead} 캐시쓰기 ${usage.cacheWrite}`);
}, 1_800_000);   // v4.15: 30일 × 최대 3회 호출이면 10분을 넘는다
