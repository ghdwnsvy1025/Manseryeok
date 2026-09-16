/**
 * 가설 카드 시스템 검증
 *
 * 두 가지를 한다.
 * 1. 판정 로직이 정직한가 (표본 부족 시 단정하지 않는가, 반대 결과를 예외로 처리하는가)
 * 2. 실제 사주로 뽑은 카드 문구가 사람이 읽을 만한가 — 콘솔로 출력해 눈으로 본다
 */
import { describe, expect, test } from "@jest/globals";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import type { SajuProfilePillars, UserBirthPillarDetail } from "@/lib/diary/types";

import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts, matchesCondition } from "@/lib/hypothesis/dayFacts";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import {
  evaluateHypothesis,
  evaluateAll,
  hypothesisCompletion,
  MIN_MATCHED_DAYS,
} from "@/lib/hypothesis/evaluate";
import { METRICS, type DayFacts, type DayRecord } from "@/lib/hypothesis/types";
import { HYPOTHESIS_CATALOG } from "@/lib/hypothesis/catalog";
import { withIGa } from "@/lib/hypothesis/josa";

const OPTIONS = {
  calendarType: "solar" as const,
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight" as const,
  timeCorrection: "none" as const,
};

/** 생일만 갈아끼워 쓰는 공통 입력 */
const OPTIONS_INPUT = {
  year: 1990,
  month: 1,
  day: 1,
  hour: 12,
  minute: 0,
  gender: "male" as const,
  options: OPTIONS,
};

/**
 * 로직 검증용 고정 사주 — 바꾸지 말 것.
 * 기존 만세력 회귀 테스트와 같은 값이라 계산이 틀어지면 여기서도 잡힌다.
 */
const SAMPLE: SajuInput = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  gender: "male",
  options: OPTIONS,
};

/**
 * 미리보기용 생일 — 자유롭게 바꿔서 카드 문구를 눈으로 확인한다.
 * 어떤 어설션도 이 값에 의존하지 않는다.
 */
const PREVIEW: SajuInput = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  gender: "male",
  options: OPTIONS,
};

function toDetail(pillar: {
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
}): UserBirthPillarDetail {
  return {
    stemHanja: pillar.stem.hanja,
    branchHanja: pillar.branch.hanja,
    stemKo: pillar.stem.ko,
    branchKo: pillar.branch.ko,
    ganjiKo: `${pillar.stem.ko}${pillar.branch.ko}`,
  };
}

function buildPillars(input: SajuInput): SajuProfilePillars {
  const result = calculateSaju(input);
  return {
    year: toDetail(result.pillars.year),
    month: toDetail(result.pillars.month),
    day: toDetail(result.pillars.day),
    hour: result.pillars.hour ? toDetail(result.pillars.hour) : null,
  };
}

/** 날짜 목록 생성 */
function datesFrom(start: string, count: number): string[] {
  const out: string[] = [];
  const base = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe("조사 처리", () => {
  test("받침 유무에 따라 이/가를 고른다", () => {
    expect(withIGa("나무(木)")).toBe("나무(木)가");
    expect(withIGa("불(火)")).toBe("불(火)이");
    expect(withIGa("흙(土)")).toBe("흙(土)이");
    expect(withIGa("쇠(金)")).toBe("쇠(金)가");
    expect(withIGa("물(水)")).toBe("물(水)이");
  });
});

describe("원국 요약", () => {
  test("십신·오행이 계산되고 합이 맞는다", () => {
    const natal = buildNatalSummary(buildPillars(SAMPLE));

    expect(natal.dayMaster).toBe("庚");
    expect(natal.dayMasterElement).toBe("metal");

    const familySum = Object.values(natal.familyCounts).reduce((a, b) => a + b, 0);
    const godSum = Object.values(natal.godCounts).reduce((a, b) => a + b, 0);
    expect(familySum).toBeCloseTo(godSum, 0);

    const ratioSum = Object.values(natal.elementRatio).reduce((a, b) => a + b, 0);
    expect(ratioSum).toBeCloseTo(1, 5);

    expect(natal.elementRatio[natal.weakestElement])
      .toBeLessThanOrEqual(natal.elementRatio[natal.strongestElement]);
  });
});

describe("가설 선택", () => {
  test("요청한 수만큼 뽑되 지표가 한쪽으로 몰리지 않는다", () => {
    const natal = buildNatalSummary(buildPillars(SAMPLE));
    const rules = generateHypotheses(natal, 10);

    expect(rules.length).toBeGreaterThanOrEqual(8);
    expect(rules.length).toBeLessThanOrEqual(10);

    // 같은 지표 3개 이상 금지
    const perMetric = new Map<string, number>();
    for (const r of rules) {
      perMetric.set(r.metric, (perMetric.get(r.metric) ?? 0) + 1);
    }
    for (const [, n] of perMetric) {
      expect(n).toBeLessThanOrEqual(2);
    }

    // id 중복 없음
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });

  test("최저 오행이 동률이면 그 카드를 아예 뽑지 않는다", () => {
    // 1995-10-25 13:57 → 을해·병술·기축·신미
    // 목·화·금·수가 각각 1개(13%)로 4파전, 토만 4개(50%)
    const natal = buildNatalSummary(
      buildPillars({ ...OPTIONS_INPUT, year: 1995, month: 10, day: 25, hour: 13, minute: 57 })
    );

    expect(natal.weakestIsTied).toBe(true);
    expect(natal.strongestIsTied).toBe(false);

    const rules = generateHypotheses(natal, 20);

    // 넷이 동률인데 하나를 골라 "당신에게 부족한 기운"이라고 말할 수 없다
    expect(rules.find((r) => r.id === "weak_element_happiness_up")).toBeUndefined();

    // 토는 유일한 최다라 이 카드는 나온다
    const strong = rules.find((r) => r.id === "strong_element_emotion_down");
    expect(strong).toBeDefined();
    expect(strong!.copy.basis).toContain("가장 많습니다");
  });

  test("최저 오행이 유일하면 카드가 나오고 '가장'을 쓴다", () => {
    const natal = buildNatalSummary(buildPillars(SAMPLE));
    expect(natal.weakestIsTied).toBe(false);

    const rules = generateHypotheses(natal, 20);
    const weak = rules.find((r) => r.id === "weak_element_happiness_up");
    expect(weak).toBeDefined();
    // 오행 이야기는 근거에만 있고, 예측 문장에는 없어야 한다.
    // 사용자는 "나무가 부족한 날"인지 알 수 없으므로 그걸로 답을 물을 수 없다.
    expect(weak!.copy.basis).toContain("가장 적습니다");
    expect(weak!.copy.claim).not.toContain("부족한");
  });

  test("모든 카드 제목은 '날'로 끝난다", () => {
    // 이 카드가 아는 것은 성격이 아니라 "어떤 날에 당신 숫자가 어땠나"뿐이다.
    // "…사는 사람" 같은 제목은 측정하지 않은 것을 주장하는 것이라 금지한다.
    for (const r of HYPOTHESIS_CATALOG) {
      expect(`${r.id}: ${r.title}`).toMatch(/날$/);
    }
  });

  test("같은 조건이라도 제목이 겹치지 않는다", () => {
    const titles = HYPOTHESIS_CATALOG.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("삭제된 카드는 카탈로그에 없다", () => {
    // 2026-09-09 사용자 검토에서 뺀 카드
    expect(HYPOTHESIS_CATALOG.find((r) => r.id === "hap_happiness_up")).toBeUndefined();
  });

  test("오행 가설은 자리표시자가 아니라 이 사람의 실제 오행으로 바뀐다", () => {
    const natal = buildNatalSummary(buildPillars(SAMPLE));
    const rules = generateHypotheses(natal, 20);

    const weakRule = rules.find((r) => r.id === "weak_element_happiness_up");
    if (weakRule) {
      expect(weakRule.condition).toEqual({
        kind: "element",
        element: natal.weakestElement,
      });
      expect(weakRule.copy.basis).toContain("%");
    }
  });
});

describe("검증 판정", () => {
  const natal = buildNatalSummary(buildPillars(SAMPLE));
  const pillars = buildPillars(SAMPLE);
  const rule = HYPOTHESIS_CATALOG.find((r) => r.id === "officer_focus_up")!;

  /** 조건일에 값이 높게 나오도록 만든 기록 */
  function makeRecords(
    dates: string[],
    factsByDate: Map<string, DayFacts>,
    matchedValue: number,
    unmatchedValue: number
  ): DayRecord[] {
    return dates.map((date) => {
      const hit = matchesCondition(factsByDate.get(date)!, rule.condition);
      return {
        date,
        metrics: { [rule.metric]: hit ? matchedValue : unmatchedValue },
      };
    });
  }

  const dates = datesFrom("2026-01-01", 90);
  const factsByDate = new Map<string, DayFacts>(
    dates.map((d) => [d, buildDayFacts(d, pillars, natal)])
  );

  test("표본이 모자라면 단정하지 않는다", () => {
    const few = dates.slice(0, 4);
    const records = makeRecords(few, factsByDate, 5, 1);
    const card = evaluateHypothesis(rule, records, factsByDate);

    expect(card.status).toBe("collecting");
    expect(card.progress).toBeLessThan(1);
    expect(card.headline).toMatch(/검증 중|아직/);
  });

  test("이론대로 나오면 confirmed", () => {
    const records = makeRecords(dates, factsByDate, 5, 2);
    const card = evaluateHypothesis(rule, records, factsByDate);

    expect(card.evidence.matchedDays).toBeGreaterThanOrEqual(MIN_MATCHED_DAYS);
    expect(card.status).toBe("confirmed");
    expect(card.evidence.gap).toBeGreaterThan(0);
    expect(card.headline).toContain(METRICS[rule.metric].label);
  });

  test("이론과 반대면 exception — '틀림'이라는 말을 쓰지 않는다", () => {
    const records = makeRecords(dates, factsByDate, 2, 5);
    const card = evaluateHypothesis(rule, records, factsByDate);

    expect(card.status).toBe("exception");
    expect(card.headline).toContain("달랐");
    expect(card.headline).not.toContain("틀렸");
    expect(card.headline).not.toContain("틀림");
  });

  test("차이가 미미하면 neutral", () => {
    const records = makeRecords(dates, factsByDate, 3.1, 3);
    const card = evaluateHypothesis(rule, records, factsByDate);

    expect(card.status).toBe("neutral");
  });

  test("카탈로그 전체 문구에 '틀렸' 표현이 없다", () => {
    for (const r of HYPOTHESIS_CATALOG) {
      const all = Object.values(r.copy).join(" ");
      expect(all).not.toContain("틀렸");
      expect(all).not.toContain("틀림");
    }
  });

  test("모든 카드에 문구 다섯 개가 다 채워져 있다", () => {
    for (const r of HYPOTHESIS_CATALOG) {
      for (const [key, text] of Object.entries(r.copy)) {
        expect(`${r.id}.${key}: ${text}`.length).toBeGreaterThan(
          `${r.id}.${key}: `.length + 10
        );
      }
      expect(r.title.length).toBeGreaterThan(3);
    }
  });

  test("판정 문구는 반드시 수치를 동반한다", () => {
    // 근거 없이 단정하지 않는다 — 모든 판정문에 표본 수가 들어가야 한다
    for (const r of HYPOTHESIS_CATALOG) {
      for (const key of ["confirmed", "exception", "neutral"] as const) {
        expect(`${r.id}.${key}`).toBe(`${r.id}.${key}`);
        expect(r.copy[key]).toContain("{days}");
      }
      // 차이를 주장하는 문구에는 수치와 지표가 함께 나와야 한다
      for (const key of ["confirmed", "exception"] as const) {
        expect(r.copy[key]).toContain("{gap}");
        expect(r.copy[key]).toContain("{metricJosa}");
      }
    }
  });

  test("지표 뒤 조사를 손으로 고정하지 않는다", () => {
    // "{metric}이" 처럼 박아두면 '행복도이' 같은 문장이 나간다.
    // 조사는 반드시 {metricJosa} 로 넘겨 코드가 고르게 한다.
    for (const r of HYPOTHESIS_CATALOG) {
      for (const [key, text] of Object.entries(r.copy)) {
        expect(`${r.id}.${key}: ${text}`).not.toMatch(/\{metric\}[이가]/);
      }
    }
  });

  test("모든 지표 이름에 올바른 조사가 붙는다", () => {
    const wrong: string[] = [];

    for (const meta of Object.values(METRICS)) {
      const joined = withIGa(meta.label);
      // 받침 있으면 '이', 없으면 '가'
      const lastChar = meta.label[meta.label.length - 1]!;
      const code = lastChar.charCodeAt(0);
      const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
      const expected = `${meta.label}${hasBatchim ? "이" : "가"}`;
      if (joined !== expected) wrong.push(`${meta.label} → ${joined}`);
    }

    expect(wrong).toEqual([]);
    // 실제로 문제였던 것들
    expect(withIGa("행복도")).toBe("행복도가");
    expect(withIGa("몸 상태")).toBe("몸 상태가");
    expect(withIGa("마음의 여유")).toBe("마음의 여유가");
    expect(withIGa("관계·연애")).toBe("관계·연애가");
    expect(withIGa("집중·실행")).toBe("집중·실행이");
    expect(withIGa("수면·회복")).toBe("수면·회복이");
  });

  test("claim 은 사용자가 자기 경험으로 답할 수 있어야 한다", () => {
    // Day 0 에 사용자는 이 문장에 "맞아요/글쎄요"로 답한다.
    // 사주만 아는 정보(규칙·주기·오행)가 들어가면 답할 수가 없다.
    const NOT_JUDGEABLE = [
      "규칙이 있",      // "그 날짜에는 규칙이 있습니다"
      "정해져 있",      // "미리 정해져 있습니다"
      "우연이 아",      // "그날은 우연이 아닙니다"
      "사주",           // "당신의 사주와 부딪치는 날"
      "기운이",         // "나무 기운이 들어오는 날"
      "오행",
      "간지",
      "일진",
      "{elementPhrase}", // 오행 자리표시자는 basis 에만
    ];

    for (const r of HYPOTHESIS_CATALOG) {
      for (const phrase of NOT_JUDGEABLE) {
        expect(`${r.id} → ${r.copy.claim}`).not.toContain(phrase);
      }
    }
  });

  test("claim 에는 십신·관계 전문용어를 쓰지 않는다", () => {
    // 사용자가 처음 보는 문장이다. 용어는 basis 에서만 쓴다.
    // "지지"·"천간"은 일상어와 겹쳐(지지 않으려 / 천간지간) 오탐이 나므로 제외한다.
    const JARGON = ["십신", "비겁", "식상", "재성", "관성", "인성", "원국", "지장간", "상관견관"];
    for (const r of HYPOTHESIS_CATALOG) {
      for (const word of JARGON) {
        expect(`${r.id} → ${r.copy.claim}`).not.toContain(word);
      }
    }
  });

  test("완성도는 판정된 카드 비율을 따른다", () => {
    const rules = generateHypotheses(natal, 10);

    const empty = evaluateAll(rules, [], factsByDate);
    expect(hypothesisCompletion(empty)).toBe(0);

    const full: DayRecord[] = dates.map((date) => ({
      date,
      metrics: Object.fromEntries(
        rules.map((r) => [r.metric, Math.random() * 4 + 1])
      ),
    }));
    const evaluated = evaluateAll(rules, full, factsByDate);
    expect(hypothesisCompletion(evaluated)).toBeGreaterThan(0);
    expect(hypothesisCompletion(evaluated)).toBeLessThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────
// 제품 타임라인 — 각 가설이 며칠이면 판정 가능한가
// Day 7 / Day 30 / Day 60 마일스톤 약속이 실제로 지켜지는지 확인한다.
// ────────────────────────────────────────────────
describe("판정까지 걸리는 날", () => {
  test("절반 이상은 60일 안에 판정 가능한 표본이 모인다", () => {
    const pillars = buildPillars(PREVIEW);
    const natal = buildNatalSummary(pillars);
    const rules = generateHypotheses(natal, 10);

    const dates = datesFrom("2026-01-01", 120);
    const factsByDate = new Map<string, DayFacts>(
      dates.map((d) => [d, buildDayFacts(d, pillars, natal)])
    );

    /** 조건일이 MIN_MATCHED_DAYS 개 모이는 데 걸리는 날 수 */
    const daysToDecide = rules.map((rule) => {
      let hits = 0;
      for (let i = 0; i < dates.length; i += 1) {
        if (matchesCondition(factsByDate.get(dates[i]!)!, rule.condition)) {
          hits += 1;
          if (hits >= MIN_MATCHED_DAYS) return i + 1;
        }
      }
      return Infinity;
    });

    const lines: string[] = ["", "  판정까지 걸리는 날 (조건일 5개 확보 기준)", "  " + "─".repeat(58)];
    rules.forEach((rule, i) => {
      const d = daysToDecide[i]!;
      const label = d === Infinity ? "120일+ (너무 느림)" : `${d}일`;
      lines.push(`  ${label.padStart(18)}  │ ${rule.title}`);
    });
    const within60 = daysToDecide.filter((d) => d <= 60).length;
    lines.push("  " + "─".repeat(58));
    lines.push(`  60일 안에 판정: ${within60}/${rules.length}장`);
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // 카드 절반 이상이 60일 안에 결론이 나야 마일스톤 약속이 성립한다
    expect(within60).toBeGreaterThanOrEqual(Math.ceil(rules.length / 2));
  });
});

// ────────────────────────────────────────────────
// 눈으로 확인 — 실제 카드 출력
// ────────────────────────────────────────────────
describe("Day 0 카드 미리보기", () => {
  test("사람이 읽을 만한 문장이 나온다", () => {
    const pillars = buildPillars(PREVIEW);
    const natal = buildNatalSummary(pillars);
    const rules = generateHypotheses(natal, 10);

    const ELEMENT_KO = {
      wood: "목(나무)",
      fire: "화(불)",
      earth: "토(흙)",
      metal: "금(쇠)",
      water: "수(물)",
    } as const;

    const lines: string[] = [];
    lines.push("");
    lines.push("═".repeat(66));
    lines.push(
      `  ${PREVIEW.year}-${String(PREVIEW.month).padStart(2, "0")}-${String(PREVIEW.day).padStart(2, "0")} ` +
      `${PREVIEW.hour}:${String(PREVIEW.minute).padStart(2, "0")} 양력`
    );
    lines.push(
      `  사주팔자 — 년 ${pillars.year.ganjiKo} · 월 ${pillars.month.ganjiKo} · ` +
      `일 ${pillars.day.ganjiKo} · 시 ${pillars.hour?.ganjiKo ?? "—"}`
    );
    lines.push(`  일간 ${natal.dayMasterKo}(${natal.dayMaster})`);
    lines.push(
      `  십신 — 비겁 ${natal.familyCounts.peer} · 식상 ${natal.familyCounts.output} · ` +
      `재성 ${natal.familyCounts.wealth} · 관성 ${natal.familyCounts.officer} · 인성 ${natal.familyCounts.resource}`
    );
    lines.push(
      "  오행 — " +
      (["wood", "fire", "earth", "metal", "water"] as const)
        .map((e) => `${ELEMENT_KO[e]} ${Math.round(natal.elementRatio[e] * 100)}%`)
        .join(" · ")
    );
    lines.push("═".repeat(66));

    rules.forEach((rule, i) => {
      lines.push("");
      lines.push(`  가설 #${i + 1}  [${METRICS[rule.metric].label}]  ${rule.title}`);
      lines.push(`  ${rule.copy.claim}`);
      lines.push(`  └ 근거: ${rule.copy.basis}`);
    });
    lines.push("");
    lines.push("═".repeat(66));

    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.copy.claim.length).toBeGreaterThan(10);
      expect(rule.copy.basis.length).toBeGreaterThan(10);
    }
  });
});
