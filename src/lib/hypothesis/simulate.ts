/**
 * 가설 검증용 가짜 기록 생성기 — 개발·테스트 전용.
 *
 * 목적: 화면을 만들기 전에 "카드가 진짜로 뒤집히는가"를 확인한다.
 * 실제 사용자가 90일을 쓰기 전에는 이 제품의 핵심 약속을 검증할 방법이 없기 때문이다.
 *
 * 세 개의 세계를 만든다.
 *   truth     — 이론대로인 사람. 조건일에 지표가 실제로 오르내린다 → confirmed 기대
 *   inverted  — 이론과 반대인 사람. 예외 서술이 나와야 한다      → exception 기대
 *   unrelated — 사주와 무관한 사람. 조건과 상관없이 무작위       → neutral 기대
 *
 * DB에 넣지 않는다. 메모리에서만 만든다.
 */
import { matchesCondition } from "./dayFacts";
import {
  METRICS,
  type DayFacts,
  type DayRecord,
  type HypothesisRule,
  type MetricCode,
} from "./types";

export type World = "truth" | "inverted" | "unrelated";

/** 재현 가능한 난수 — 테스트가 흔들리지 않아야 한다 */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 지표의 중앙값과 폭 */
function scaleOf(metric: MetricCode): { mid: number; min: number; max: number; step: number } {
  return METRICS[metric].scale === "happiness10"
    ? { mid: 5, min: 0, max: 10, step: 2.0 }
    : { mid: 3, min: 1, max: 5, step: 1.0 };
}

export type SimulateOptions = {
  /** 시작일 (YYYY-MM-DD) */
  startDate: string;
  /** 며칠치 */
  days: number;
  /** 날짜별 사주 사실 */
  factsByDate: Map<string, DayFacts>;
  /** 이 가설들에 대해 신호를 심는다 */
  rules: HypothesisRule[];
  world: World;
  /** 기록을 빠뜨리는 비율 (0 = 매일 씀). 현실은 0.3~0.4 */
  missRate?: number;
  /** 잡음 크기 (지표 폭 대비) */
  noise?: number;
  seed?: number;
};

export function enumerateDates(startDate: string, days: number): string[] {
  const out: string[] = [];
  const base = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < days; i += 1) {
    out.push(new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * 가짜 기록을 만든다.
 *
 * 한 지표에 여러 가설이 걸릴 수 있으므로, 해당하는 가설들의 신호를 **합산**한다.
 * (실제 사람도 그렇다 — 충이면서 관성일인 날이 있다.)
 */
export function simulateRecords(opts: SimulateOptions): DayRecord[] {
  const {
    startDate,
    days,
    factsByDate,
    rules,
    world,
    missRate = 0,
    noise = 0.35,
    seed = 20260909,
  } = opts;

  const rng = makeRng(seed);
  const dates = enumerateDates(startDate, days);
  const records: DayRecord[] = [];

  // 이 시뮬레이션이 다루는 지표 전부
  const metrics = Array.from(new Set(rules.map((r) => r.metric)));

  for (const date of dates) {
    if (missRate > 0 && rng() < missRate) continue;

    const facts = factsByDate.get(date);
    if (!facts) continue;

    const values: Partial<Record<MetricCode, number>> = {};

    for (const metric of metrics) {
      const { mid, min, max, step } = scaleOf(metric);
      let value = mid;

      for (const rule of rules) {
        if (rule.metric !== metric) continue;
        if (!matchesCondition(facts, rule.condition)) continue;

        // 이론이 말하는 방향
        const theory = rule.direction === "higher" ? 1 : -1;
        // 세계에 따라 신호를 뒤집거나 없앤다
        const sign = world === "truth" ? theory : world === "inverted" ? -theory : 0;

        value += sign * step;
      }

      // 잡음 — 신호가 잡음에 묻히지 않을 정도로만
      value += (rng() - 0.5) * 2 * noise * step;

      values[metric] = Math.round(clamp(value, min, max) * 10) / 10;
    }

    records.push({ date, metrics: values });
  }

  return records;
}

/**
 * 며칠째에 판정이 났는지 — 마일스톤 약속(9일/26일/57일)이 지켜지는지 확인용.
 * 판정이 안 나면 null.
 */
export function daysUntilDecided(
  rule: HypothesisRule,
  records: DayRecord[],
  factsByDate: Map<string, DayFacts>,
  evaluate: (
    rule: HypothesisRule,
    records: DayRecord[],
    facts: Map<string, DayFacts>
  ) => { status: string }
): number | null {
  for (let i = 1; i <= records.length; i += 1) {
    const slice = records.slice(0, i);
    if (evaluate(rule, slice, factsByDate).status !== "collecting") {
      // 며칠째인지는 기록 건수가 아니라 달력 날짜 기준이어야 한다
      const first = records[0]!.date;
      const last = slice[slice.length - 1]!.date;
      const span =
        (new Date(`${last}T00:00:00Z`).getTime() -
          new Date(`${first}T00:00:00Z`).getTime()) /
        86400000;
      return Math.round(span) + 1;
    }
  }
  return null;
}
