/**
 * 운세 글 샘플 — 테스트 사주 하나 × 오늘 날짜를 (a) 기록 없음, (b) 기록 20건(가짜)으로 실제 모델을 불러 글 전문과 usage를 찍는다.
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts scripts/fortune-sample.ts
 *
 * - 모델 호출이 있다 (비용). 호출은 샘플당 정확히 1회(maxAttempts 1) — 재작성은 하지 않고 탈락 사유만 찍는다.
 * - .env.local의 ANTHROPIC_API_KEY를 읽기만 하고 값은 출력하지 않는다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { buildBrief, renderBrief } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { generateFortuneText } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, toTenPoint, type EntryLike } from "@/lib/fortune/personal";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const ROOT = path.resolve(__dirname, "..");
const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function loadEnv(): void {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (line.startsWith("#") || i < 0) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
}

// 테스트 사주 A: 1990-01-01 12:00 서울 남 → 己巳 丙子 丙寅 甲午
const PROFILE: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const STEMS_KO = "갑을병정무기경신임계", BRANCHES_KO = "자축인묘진사오미신유술해";

/** 20건 가짜 기록: 오늘과 같은 일간(stem) 날 5건은 행복도 8, 나머지 15건은 다른 글자로 5~7 */
function fakeEntries(today: { stemKo: string; branchKo: string }): EntryLike[] {
  const out: EntryLike[] = [];
  const otherStem = [...STEMS_KO].filter((s) => s !== today.stemKo);
  const otherBranch = [...BRANCHES_KO].filter((b) => b !== today.branchKo);
  for (let i = 0; i < 5; i++) out.push({ day_ganji_index: 100 + i, day_stem: today.stemKo, day_branch: otherBranch[i]!, happiness: 8 });
  for (let i = 0; i < 15; i++) out.push({ day_ganji_index: 200 + i, day_stem: otherStem[i % otherStem.length]!, day_branch: otherBranch[(i + 3) % otherBranch.length]!, happiness: 5 + (i % 3) });
  return out;
}

test("fortune sample: 기록 없음 / 기록 20건 — 모델 호출 2회", async () => {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error(".env.local에 ANTHROPIC_API_KEY가 필요합니다");

  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
  const today = dayGanji(date);
  const todayInfo = { ko: today.ko, hanja: today.hanja, stemKo: today.stemKo, branchKo: today.branchKo };
  const prof = computeProfile({ ...PROFILE, name: "샘플" });
  if (!prof.ok) throw new Error(prof.error);
  const core = computeCoreFortune({ pillars: prof.value.pillars, profile: PROFILE, date, todayHanja: today.hanja });

  const cases: { name: string; entries: EntryLike[] }[] = [
    { name: "(a) 기록 없음", entries: [] },
    { name: "(b) 기록 20건 (같은 일간 5건 평균 8)", entries: fakeEntries(today) },
  ];
  const lines: string[] = [`날짜 ${date} ${weekday} · ${today.ko}일(${today.hanja}) · 사주 ${Object.values(prof.value.pillars).filter(Boolean).map((p) => (p as { ko: string }).ko).join(" ")}`];
  for (const c of cases) {
    const personal = adjustWithEntries(core.parts.score01, c.entries, { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
    const score10 = toTenPoint(personal.score);
    const band = bandOf(score10);
    const input = { core, personal, today: todayInfo, date, weekday, score10, band };
    const fallback = templateText(templateInputFromCore(core), personal, todayInfo);
    const brief = buildBrief(input);
    const r = await generateFortuneText(input, fallback, { maxAttempts: 1 });
    lines.push("", `===== ${c.name} · 점수 ${score10} ${band} · personal n=${personal.n} mean=${personal.mean} =====`);
    lines.push(`brief 글자 수: ${renderBrief(brief).length}`);
    lines.push(`source=${r.source} attempts=${r.attempts} model=${r.model}`);
    lines.push(`usage: input=${r.usage.input} output=${r.usage.output} cache_read=${r.usage.cacheRead} cache_write=${r.usage.cacheWrite}`);
    lines.push(`검사: ${r.issues.map((xs) => (xs.length ? xs.join(" / ") : "통과")).join(" | ")}`);
    const t = r.lastModelText;
    if (t) {
      lines.push(`[모델 글] headline: ${t.headline}`);
      lines.push(`body: ${t.body}`);
      for (const a of t.areas) lines.push(`  [${a.period}] ${a.area}: ${a.line}`);
      lines.push(`do: ${t.do}`);
      lines.push(`dont: ${t.dont}`);
    }
    if (r.source === "template") {
      lines.push(`[최종(템플릿)] ${fallback.headline} / ${fallback.body}`);
    }
  }
  console.log("\n" + lines.join("\n") + "\n");
}, 120_000);
