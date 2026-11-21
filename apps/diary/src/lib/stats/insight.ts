// 나 탭 물음 인장 둘의 답 (2026-11-17 그릴링 Q3·Q5·Q12·Q17·Q18, 명세 47).
//   "나는 언제 행복했지?" — 날의 성격(십신 다섯 갈래)별 내 행복도 평균. 가장 높은 갈래 하나를 한 문장으로.
//   "예상은 맞았을까?"   — 운세가 좋음/주의로 본 날에 내가 실제로 매긴 행복도. 날 수로만 말한다(백분율 없음, Q18).
// 전부 이미 저장된 기록에서 읽을 때 계산한다. 운세 점수는 바꾸지 않는다 — 거울이지 채점이 아니다(기록 반영 설계).
import { bandOf } from "../fortune/personal";
import { FAMILY_WORD } from "../fortune/recall";
import type { TenGodFamily } from "../fortune/types";
import { groupsOfDay } from "./states";

/** 물음 인장 둘이 열리는 기록 날 수 (Q12) */
export const INSIGHT_UNLOCK_DAYS = 7;
/** 갈래를 말해도 되는 최소 날 수 (Q17: 3일 미만인 갈래는 말하지 않는다) */
export const GROUP_MIN_DAYS = 3;
/** 1등 갈래가 전체 평균보다 이만큼은 높아야 "가장 행복했어요"라고 말한다 (0.3 차이로 단정하지 않게 — 2026-11-17 화면 검토) */
export const GROUP_MIN_GAP = 0.5;
/** 실제로 좋았던 날·힘들었던 날의 선 (행복도 1~10) */
export const ACTUAL_GOOD = 7;
export const ACTUAL_HARD = 4;

export interface InsightEntry {
  entry_date: string;
  happiness: number;
  day_stem: string;
  day_branch: string;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;
/** 갈래가 들어온 날이 어떤 날인지 한 줄 (2026-11-19 앱 주인: "표현하는 기운~책임의 기운 값이 뭔지 모르겠어", 명세 49). 낱말 옆에 붙인다 */
export const GROUP_DAY_HINT: Record<TenGodFamily, string> = {
  비겁: "내 뜻대로 하고 싶어지는 날",
  식상: "말하고 만들고 싶어지는 날",
  재성: "돈과 실속을 챙기게 되는 날",
  관성: "맡은 일과 책임이 커지는 날",
  인성: "배우고 쉬며 생각하게 되는 날",
};
/** 오각형 꼭짓점에 적는 짧은 이름 (명세 54). 풀어 쓴 말은 GROUP_DAY_HINT */
export const GROUP_DAY_SHORT: Record<TenGodFamily, string> = { 비겁: "내 뜻", 식상: "표현", 재성: "실속", 관성: "책임", 인성: "배움" };
const FAMILIES: TenGodFamily[] = ["비겁", "식상", "재성", "관성", "인성"];

export interface GroupHappiness {
  group: TenGodFamily;
  /** 쉬운 말 (recall.ts FAMILY_WORD — 기록 한 줄과 같은 낱말) */
  word: string;
  /** 그런 날이 어떤 날인지 한 줄 (GROUP_DAY_HINT) */
  hint: string;
  /** 오각형 꼭짓점에 적는 짧은 이름 (GROUP_DAY_SHORT) */
  short: string;
  /** 그 갈래가 온 날 수 */
  n: number;
  /** 그날들의 행복도 평균 (n이 0이면 null) */
  avg: number | null;
}

export interface HappyWhen {
  /** 다섯 갈래 전부 (평균 높은 순, 표본 모자란 갈래는 뒤) */
  rows: GroupHappiness[];
  /** 오각형용: 늘 같은 차례(내 뜻 → 표현 → 실속 → 책임 → 배움)의 다섯 줄. rows와 같은 값이고 차례만 다르다 */
  ring: GroupHappiness[];
  /** 전체 평균 */
  overall: number | null;
  /** 말해도 되는 갈래 가운데 평균이 가장 높고, 전체 평균보다 높은 것. 없으면 null */
  top: GroupHappiness | null;
  /** 한 문장. top이 없으면 null (화면이 "아직 뚜렷한 차이가 없어요"로) */
  sentence: string | null;
}

/** "나는 언제 행복했지?" — dayMaster = 내 일간(한자) */
export function happyWhen(entries: InsightEntry[], dayMaster: string): HappyWhen {
  const sum = new Map<TenGodFamily, { s: number; n: number }>();
  for (const e of entries) {
    for (const g of groupsOfDay(e, dayMaster)) {
      const cur = sum.get(g) ?? { s: 0, n: 0 };
      sum.set(g, { s: cur.s + e.happiness, n: cur.n + 1 });
    }
  }
  const rows: GroupHappiness[] = FAMILIES.map((group) => {
    const c = sum.get(group);
    return { group, word: FAMILY_WORD[group], hint: GROUP_DAY_HINT[group], short: GROUP_DAY_SHORT[group], n: c?.n ?? 0, avg: c && c.n ? round1(c.s / c.n) : null };
  }).sort((a, b) => Number(b.n >= GROUP_MIN_DAYS) - Number(a.n >= GROUP_MIN_DAYS) || (b.avg ?? -1) - (a.avg ?? -1));
  const overall = entries.length ? round1(entries.reduce((a, e) => a + e.happiness, 0) / entries.length) : null;
  const first = rows[0];
  const top = first && first.n >= GROUP_MIN_DAYS && first.avg !== null && overall !== null && first.avg - overall >= GROUP_MIN_GAP ? first : null;
  return { rows, ring: FAMILIES.map((g) => rows.find((r) => r.group === g)!), overall, top, sentence: top ? `${top.hint}에 가장 행복했어요` : null };
}

export interface VersusDay {
  date: string;
  /** 운세가 본 단계 */
  band: "좋음" | "주의";
  happiness: number;
  /** 예상과 같은 쪽이었나 (좋음 → 행복도 7 이상, 주의 → 4 이하) */
  hit: boolean;
  /**
   * 한눈에 보는 표시 (명세 54): same = 예상과 같은 쪽(○), opposite = 반대쪽(× — 좋을 날인데 4 이하, 조심할 날인데 7 이상),
   * between = 그 사이(△ — 행복도 5·6)
   */
  result: "same" | "opposite" | "between";
}

export interface ForecastVersus {
  /** 운세가 좋음으로 본 날 가운데 기록이 있는 날 수, 그중 실제로 좋았던 날·힘들었던 날 */
  good: { days: number; good: number; hard: number };
  /** 운세가 주의로 본 날 가운데 기록이 있는 날 수, 그중 실제로 힘들었던 날·좋았던 날 */
  caution: { days: number; hard: number; good: number };
  /** 최근 것부터 */
  days: VersusDay[];
  /** 한두 문장. 견줄 날이 없으면 빈 배열 */
  sentences: string[];
}

/** "예상은 맞았을까?" — fortunes = 그날 실제로 보여 준 운세 점수(night_fortunes.score, 10점) */
export function forecastVersus(entries: Pick<InsightEntry, "entry_date" | "happiness">[], fortunes: { fortune_date: string; score: number }[]): ForecastVersus {
  const byDate = new Map(entries.map((e) => [e.entry_date, e.happiness]));
  const days: VersusDay[] = [];
  for (const f of fortunes) {
    const h = byDate.get(f.fortune_date);
    const band = bandOf(f.score);
    if (h === undefined || band === "무난") continue;
    const hit = band === "좋음" ? h >= ACTUAL_GOOD : h <= ACTUAL_HARD;
    const opposite = band === "좋음" ? h <= ACTUAL_HARD : h >= ACTUAL_GOOD;
    days.push({ date: f.fortune_date, band, happiness: h, hit, result: hit ? "same" : opposite ? "opposite" : "between" });
  }
  days.sort((a, b) => (a.date < b.date ? 1 : -1));
  const g = days.filter((d) => d.band === "좋음");
  const c = days.filter((d) => d.band === "주의");
  const good = { days: g.length, good: g.filter((d) => d.happiness >= ACTUAL_GOOD).length, hard: g.filter((d) => d.happiness <= ACTUAL_HARD).length };
  const caution = { days: c.length, hard: c.filter((d) => d.happiness <= ACTUAL_HARD).length, good: c.filter((d) => d.happiness >= ACTUAL_GOOD).length };
  const sentences: string[] = [];
  // 0일이면 "0일이 실제로…" 대신 "…날은 없었어요"
  if (good.days > 0) sentences.push(`좋을 날로 본 ${good.days}일 중 ${good.good > 0 ? `${good.good}일이 실제로 좋았어요` : "실제로 좋았던 날은 없었어요"}${good.hard > 0 ? `. ${good.hard}일은 힘들었어요` : ""}`);
  if (caution.days > 0) sentences.push(`조심할 날로 본 ${caution.days}일 중 ${caution.hard > 0 ? `${caution.hard}일이 실제로 힘들었어요` : "실제로 힘들었던 날은 없었어요"}${caution.good > 0 ? `. ${caution.good}일은 오히려 좋았어요` : ""}`);
  return { good, caution, days, sentences };
}
