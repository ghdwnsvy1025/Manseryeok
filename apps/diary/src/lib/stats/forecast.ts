// 다음 달 좋은 날·조심할 날 예측 (2026-10-31 사용자 결정 Q1 = b): 오늘 운세 점수와 같은 계산을 다음 달 매일에 돌린다.
//   사주 판정(코어 일진 유불리 + 충합 + 운 맥락, computeCoreFortune) → 내 기록 보정(adjustWithEntries — v4.19: 같은 일간·일지 날 행복도가
//   전체 평균보다 높거나 낮은 만큼 ±0.8점 안에서) → 10점. 그중 가장 높은 날 하나, 가장 낮은 날 하나. 모델(글)은 부르지 않는다 — 코드 계산만, 비용 0.
// 서버 전용(엔진·코어 판정).
import "server-only";
import { computeCoreFortune } from "@/lib/fortune/core";
import { adjustWithEntries, toTenPoint, type EntryLike } from "@/lib/fortune/personal";
import type { CoreLuckPart } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import type { BirthProfile, PillarsSnapshot } from "@/lib/profile";

export interface ForecastDay {
  date: string;
  ganjiKo: string;
  /** 10점 척도 (오늘 운세 점수와 같은 식) */
  score: number;
  /** 왜 이 날인지 한 줄 */
  reason: string;
  /** 내 기록이 점수에 들어간 비중(0~1). 0이면 사주 판정만. v4.19: 보정이 실제로 걸린 날(shift ≠ 0)만 0이 아니다 */
  weight: number;
}

/** "YYYY-MM" 다음 달 */
export function nextMonthOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function daysIn(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}

const GOOD = new Set(["용", "희"]);
const BAD = new Set(["기", "구"]);

/** v4.19: "내 기록" 이유는 보정이 실제로 걸렸고(shift ≠ 0) 그 방향이 이 날의 종류와 같을 때만 (전체 평균 대비 편차 — personal.ts) */
function reasonOf(kind: "best" | "worst", stem: CoreLuckPart, branch: CoreLuckPart, shift: number): string {
  if (kind === "best" && shift > 0) return "이런 기운의 날, 내 기록이 좋았어요";
  if (kind === "worst" && shift < 0) return "이런 기운의 날, 내 기록이 무거웠어요";
  const labels = [stem.label, branch.label];
  if (kind === "best") {
    if (labels.some((l) => l === "용")) return "내게 가장 필요한 기운이 들어오는 날";
    if (labels.some((l) => l && GOOD.has(l))) return "나를 돕는 기운이 들어오는 날";
    return "흐름이 비교적 순한 날";
  }
  if (labels.some((l) => l === "기")) return "덜어 내면 좋은 기운이 겹치는 날";
  if (labels.some((l) => l && BAD.has(l))) return "힘을 아껴 두면 좋은 날";
  return "흐름이 조금 무거운 날";
}

const addDay = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * 오늘 다음 날부터 days일 동안의 좋을 날·조심할 날 pick개씩 (2026-11-17 그릴링 Q9·Q10, 명세 47). 점수 순, 같은 점수면 이른 날.
 * 점수 순으로 돌려준다 — best[0]이 가장 좋을 날, worst[0]이 가장 조심할 날(칩 둘이 쓴다). 달력 도장은 여섯 날 전부.
 * 좋을 날과 조심할 날은 겹치지 않는다(점수가 모두 같으면 조심할 날은 비운다).
 */
export function forecastWindow(input: { pillars: PillarsSnapshot; profile: BirthProfile | null; entries: EntryLike[]; from: string; days?: number; pick?: number }): { best: ForecastDay[]; worst: ForecastDay[] } {
  const n = input.days ?? 30;
  const pick = input.pick ?? 3;
  const rows = Array.from({ length: n }, (_, i) => addDay(input.from, i + 1)).map((date) => {
    const g = dayGanji(date);
    const core = computeCoreFortune({ pillars: input.pillars, profile: input.profile, date, todayHanja: g.hanja });
    const personal = adjustWithEntries(core.parts.score01, input.entries, { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
    return { date, g, core, personal, score: toTenPoint(personal.score) };
  });
  const day = (r: (typeof rows)[number], kind: "best" | "worst"): ForecastDay => ({
    date: r.date,
    ganjiKo: r.g.ko,
    score: r.score,
    reason: reasonOf(kind, r.core.dayLuck.stem, r.core.dayLuck.branch, r.personal.shift ?? 0),
    weight: (r.personal.shift ?? 0) !== 0 ? r.personal.weight : 0,
  });
  const desc = [...rows].sort((a, b) => b.score - a.score || (a.date < b.date ? -1 : 1));
  const asc = [...rows].sort((a, b) => a.score - b.score || (a.date < b.date ? -1 : 1));
  const best = desc.slice(0, pick);
  const bestDates = new Set(best.map((r) => r.date));
  const top = best[0]?.score ?? 0;
  const worst = asc.filter((r) => !bestDates.has(r.date) && r.score < top).slice(0, pick);
  return { best: best.map((r) => day(r, "best")), worst: worst.map((r) => day(r, "worst")) };
}

/**
 * 그 달의 가장 좋은 날·조심할 날. 같은 점수면 이른 날. 시간 모름으로 용신이 없으면(유불리 축 없음) 점수 차이가 작아도 그대로 고른다.
 * 계산은 날마다 한 번(약 30번) — 나 탭 한 번 그릴 때 수십 ms.
 */
export function forecastMonth(input: { pillars: PillarsSnapshot; profile: BirthProfile | null; entries: EntryLike[]; ym: string }): { best: ForecastDay | null; worst: ForecastDay | null } {
  const rows = daysIn(input.ym).map((date) => {
    const g = dayGanji(date);
    const core = computeCoreFortune({ pillars: input.pillars, profile: input.profile, date, todayHanja: g.hanja });
    const personal = adjustWithEntries(core.parts.score01, input.entries, { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
    return { date, g, core, personal, score: toTenPoint(personal.score) };
  });
  if (rows.length === 0) return { best: null, worst: null };
  const best = rows.reduce((a, r) => (r.score > a.score ? r : a));
  const worst = rows.reduce((a, r) => (r.score < a.score ? r : a));
  const day = (r: (typeof rows)[number], kind: "best" | "worst"): ForecastDay => ({
    date: r.date,
    ganjiKo: r.g.ko,
    score: r.score,
    reason: reasonOf(kind, r.core.dayLuck.stem, r.core.dayLuck.branch, r.personal.shift ?? 0),
    weight: (r.personal.shift ?? 0) !== 0 ? r.personal.weight : 0,
  });
  return { best: day(best, "best"), worst: worst.score < best.score ? day(worst, "worst") : null };
}
