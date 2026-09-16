/**
 * 뒤집힘 검증 — 이 제품의 핵심 약속이 실제로 작동하는가.
 *
 * "쓸수록 정확해진다"는 말은, 기록이 쌓이면 카드가 실제로 판정으로 바뀐다는 뜻이다.
 * 화면을 만들기 전에 여기서 먼저 확인한다. 여기서 실패하면 화면은 의미가 없다.
 *
 * 세 개의 세계로 검증한다.
 *   truth     이론대로인 사람  → confirmed
 *   inverted  이론과 반대인 사람 → exception ("당신은 달랐습니다")
 *   unrelated 사주와 무관한 사람 → neutral
 */
import { describe, expect, test } from "@jest/globals";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import type { SajuProfilePillars, UserBirthPillarDetail } from "@/lib/diary/types";

import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts } from "@/lib/hypothesis/dayFacts";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import { evaluateAll, evaluateHypothesis, hypothesisCompletion } from "@/lib/hypothesis/evaluate";
import { simulateRecords, enumerateDates, type World } from "@/lib/hypothesis/simulate";
import { toDayRecords } from "@/lib/hypothesis/fromJournal";
import { METRICS, type DayFacts, type HypothesisStatus } from "@/lib/hypothesis/types";
import type { JournalEntry } from "@/lib/journal/types";

const OPTIONS = {
  calendarType: "solar" as const,
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight" as const,
  timeCorrection: "none" as const,
};

const SAMPLE: SajuInput = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  gender: "male",
  options: OPTIONS,
};

const START = "2026-01-01";
const DAYS = 120;

function toDetail(p: {
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
}): UserBirthPillarDetail {
  return {
    stemHanja: p.stem.hanja,
    branchHanja: p.branch.hanja,
    stemKo: p.stem.ko,
    branchKo: p.branch.ko,
    ganjiKo: `${p.stem.ko}${p.branch.ko}`,
  };
}

function buildPillars(input: SajuInput): SajuProfilePillars {
  const r = calculateSaju(input);
  return {
    year: toDetail(r.pillars.year),
    month: toDetail(r.pillars.month),
    day: toDetail(r.pillars.day),
    hour: r.pillars.hour ? toDetail(r.pillars.hour) : null,
  };
}

// ── 공통 설정 ──
const pillars = buildPillars(SAMPLE);
const natal = buildNatalSummary(pillars);
const rules = generateHypotheses(natal, 10);
const dates = enumerateDates(START, DAYS);
const factsByDate = new Map<string, DayFacts>(
  dates.map((d) => [d, buildDayFacts(d, pillars, natal)])
);

function run(world: World, opts?: { missRate?: number; seed?: number }) {
  const records = simulateRecords({
    startDate: START,
    days: DAYS,
    factsByDate,
    rules,
    world,
    missRate: opts?.missRate ?? 0,
    seed: opts?.seed,
  });
  return { records, cards: evaluateAll(rules, records, factsByDate) };
}

describe("세 개의 세계", () => {
  test("이론대로인 사람 → 대부분 confirmed", () => {
    const { cards } = run("truth");
    const confirmed = cards.filter((c) => c.status === "confirmed");

    expect(confirmed.length).toBeGreaterThanOrEqual(Math.ceil(cards.length * 0.8));
    expect(cards.some((c) => c.status === "exception")).toBe(false);
  });

  test("이론과 반대인 사람 → 대부분 exception, 문구는 '달랐습니다'", () => {
    const { cards } = run("inverted");
    const exceptions = cards.filter((c) => c.status === "exception");

    expect(exceptions.length).toBeGreaterThanOrEqual(Math.ceil(cards.length * 0.8));
    expect(cards.some((c) => c.status === "confirmed")).toBe(false);

    for (const card of exceptions) {
      expect(card.headline).toContain("달랐");
      expect(card.headline).not.toContain("틀렸");
    }
  });

  test("무관한 사람 → 대부분 neutral", () => {
    const { cards } = run("unrelated");
    const neutral = cards.filter((c) => c.status === "neutral");

    expect(neutral.length).toBeGreaterThanOrEqual(Math.ceil(cards.length * 0.8));
  });

  test("기록이 없으면 아무것도 단정하지 않는다", () => {
    const cards = evaluateAll(rules, [], factsByDate);

    expect(cards.every((c) => c.status === "collecting")).toBe(true);
    expect(hypothesisCompletion(cards)).toBe(0);
  });
});

describe("현실적인 기록 습관", () => {
  test("40%를 빼먹어도 절반 이상은 판정된다", () => {
    const { cards } = run("truth", { missRate: 0.4, seed: 424242 });
    const settled = cards.filter((c) => c.status !== "collecting");

    expect(settled.length).toBeGreaterThanOrEqual(Math.ceil(cards.length / 2));
  });

  test("완성도는 기록이 쌓일수록 오른다", () => {
    const { records } = run("truth");
    const at = (n: number) =>
      hypothesisCompletion(evaluateAll(rules, records.slice(0, n), factsByDate));

    const d7 = at(7);
    const d30 = at(30);
    const d90 = at(90);

    expect(d7).toBeLessThan(d30);
    expect(d30).toBeLessThanOrEqual(d90);
    expect(d90).toBeGreaterThan(0.5);
  });
});

describe("앱 기록 → 가설 입력 어댑터", () => {
  function entry(over: Partial<JournalEntry>): JournalEntry {
    return {
      id: "e1",
      userId: null,
      sajuProfileId: null,
      entryDate: "2026-01-01",
      userTimezone: "Asia/Seoul",
      content: "",
      overallSatisfaction: null,
      happinessScore: null,
      moodLabel: null,
      moodLabels: [],
      mainEventText: null,
      source: "new_diary",
      scores: [],
      tags: [],
      coreStates: null,
      domainScores: null,
      checkinVersion: 2,
      xpGranted: false,
      xpAwarded: 0,
      schemaVersion: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      ...over,
    } as JournalEntry;
  }

  test("체크인 v2 — 행복도와 서열이 그대로 넘어온다", () => {
    const [record] = toDayRecords([
      entry({
        happinessScore: 8,
        coreStates: {
          energy: { ordinal: 4, isNotApplicable: false },
          focus_execution: { ordinal: 2, isNotApplicable: false },
        },
        domainScores: [{ code: "work_study", ordinal: 5, isNotApplicable: false }],
      }),
    ]);

    expect(record!.metrics.happiness).toBe(8);
    expect(record!.metrics.energy).toBe(4);
    expect(record!.metrics.focus_execution).toBe(2);
    expect(record!.metrics.work_study).toBe(5);
  });

  test("'해당 없음'은 값으로 넣지 않는다", () => {
    const [record] = toDayRecords([
      entry({
        happinessScore: 5,
        coreStates: { energy: { ordinal: 4, isNotApplicable: true } },
        domainScores: [{ code: "relationship", ordinal: 3, isNotApplicable: true }],
      }),
    ]);

    expect(record!.metrics.energy).toBeUndefined();
    expect(record!.metrics.relationship).toBeUndefined();
  });

  test("레거시 1~10 점수는 서열로 되돌려 채운다", () => {
    const [record] = toDayRecords([
      entry({
        checkinVersion: 1,
        overallSatisfaction: 7,
        scores: [
          { categoryCode: "energy", userScore: 10, rawScore: 10, isNotApplicable: false },
          { categoryCode: "physical_condition", userScore: 1, rawScore: 1, isNotApplicable: false },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      }),
    ]);

    expect(record!.metrics.happiness).toBe(7);
    expect(record!.metrics.energy).toBe(5); // 10 → 서열 5
    expect(record!.metrics.physical_condition).toBe(1); // 1 → 서열 1
  });

  test("서열 원본이 있으면 레거시 점수가 덮어쓰지 않는다", () => {
    const [record] = toDayRecords([
      entry({
        coreStates: { energy: { ordinal: 2, isNotApplicable: false } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scores: [{ categoryCode: "energy", userScore: 10, rawScore: 10, isNotApplicable: false }] as any,
      }),
    ]);

    expect(record!.metrics.energy).toBe(2);
  });

  test("같은 날짜가 여러 건이면 나중 것만 남는다", () => {
    const records = toDayRecords([
      entry({ id: "a", happinessScore: 3, updatedAt: "2026-01-01T01:00:00Z" }),
      entry({ id: "b", happinessScore: 9, updatedAt: "2026-01-01T09:00:00Z" }),
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]!.metrics.happiness).toBe(9);
  });

  test("빈 기록은 버린다", () => {
    expect(toDayRecords([entry({})])).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────
// 눈으로 확인 — 90일 뒤 카드가 어떻게 뒤집히는가
// ────────────────────────────────────────────────
describe("뒤집힘 미리보기", () => {
  const STATUS_LABEL: Record<HypothesisStatus, string> = {
    collecting: "검증 중",
    confirmed: "맞았습니다",
    exception: "당신은 달랐습니다",
    neutral: "영향 없었습니다",
  };

  test("90일 후 카드 상태와 타임라인을 출력한다", () => {
    const { records } = run("truth");
    const ninety = records.slice(0, 90);
    const cards = evaluateAll(rules, ninety, factsByDate);

    /** 각 카드가 며칠째에 판정됐는지 */
    const decidedOn = rules.map((rule) => {
      for (let i = 1; i <= ninety.length; i += 1) {
        const card = evaluateHypothesis(rule, ninety.slice(0, i), factsByDate);
        if (card.status !== "collecting") return i;
      }
      return null;
    });

    const out: string[] = [];
    out.push("");
    out.push("═".repeat(70));
    out.push("  90일 기록 후 — 카드는 이렇게 뒤집힌다  (이론대로인 사람 가정)");
    out.push(`  완성도 ${Math.round(hypothesisCompletion(cards) * 100)}%`);
    out.push("═".repeat(70));

    cards.forEach((card, i) => {
      const day = decidedOn[i];
      out.push("");
      out.push(
        `  ${String(day ?? "—").padStart(3)}일째  [${STATUS_LABEL[card.status]}]  ${card.rule.title}`
      );
      out.push(`         ${card.headline}`);
      out.push(
        `         └ ${METRICS[card.rule.metric].label} · 조건일 ${card.evidence.matchedDays}일 ` +
        `평균 ${card.evidence.matchedMean} / 그 외 ${card.evidence.unmatchedDays}일 평균 ${card.evidence.unmatchedMean}`
      );
    });

    out.push("");
    out.push("═".repeat(70));
    // eslint-disable-next-line no-console
    console.log(out.join("\n"));

    expect(cards.length).toBeGreaterThan(0);
  });
});
