/**
 * 용신 카드 검증.
 *
 * "용신일에 실제로 힘이 덜 들었나"를 기록으로 확인하는 카드다.
 * 이 앱만 할 수 있는 질문이라 판정이 조용히 어긋나면 안 된다.
 */
import { describe, expect, test } from "@jest/globals";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts, matchesCondition } from "@/lib/hypothesis/dayFacts";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import { evaluateAll } from "@/lib/hypothesis/evaluate";
import { HYPOTHESIS_CATALOG } from "@/lib/hypothesis/catalog";
import type { DayFacts, DayRecord } from "@/lib/hypothesis/types";
import type { SajuProfilePillars } from "@/lib/diary/types";

/** 사장님 사주 — 1995-10-25 13:57 · 辛未 己丑 丙戌 乙亥 */
const OWNER: SajuProfilePillars = {
  hour: { stemHanja: "辛", branchHanja: "未", stemKo: "신", branchKo: "미", ganjiKo: "신미" },
  day: { stemHanja: "己", branchHanja: "丑", stemKo: "기", branchKo: "축", ganjiKo: "기축" },
  month: { stemHanja: "丙", branchHanja: "戌", stemKo: "병", branchKo: "술", ganjiKo: "병술" },
  year: { stemHanja: "乙", branchHanja: "亥", stemKo: "을", branchKo: "해", ganjiKo: "을해" },
};

/** 촬영 데모 사주 — 1990-05-15 14:30 · 癸未 庚辰 辛巳 庚午 */
const DEMO: SajuProfilePillars = {
  hour: { stemHanja: "癸", branchHanja: "未", stemKo: "계", branchKo: "미", ganjiKo: "계미" },
  day: { stemHanja: "庚", branchHanja: "辰", stemKo: "경", branchKo: "진", ganjiKo: "경진" },
  month: { stemHanja: "辛", branchHanja: "巳", stemKo: "신", branchKo: "사", ganjiKo: "신사" },
  year: { stemHanja: "庚", branchHanja: "午", stemKo: "경", branchKo: "오", ganjiKo: "경오" },
};

const YONGSIN_RULE = HYPOTHESIS_CATALOG.find((r) => r.id === "yongsin_energy_up")!;

describe("원국 요약이 용신을 들고 있다", () => {
  test("사장님 원국 — 토가 가장 많아 목이 용신", () => {
    const y = buildNatalSummary(OWNER).yongsin!;
    expect(`${y.dominantKo} → ${y.elementKo}`).toBe("토 → 목");
    expect(y.fromTZone).toBe(false);
    expect(y.ganjiHanja).toEqual(["甲", "乙", "寅", "卯"]);
  });

  test("데모 원국 — 화가 가장 많아 수가 용신, T존에서 찾음", () => {
    const y = buildNatalSummary(DEMO).yongsin!;
    expect(`${y.dominantKo} → ${y.elementKo}`).toBe("화 → 수");
    expect(y.fromTZone).toBe(true);
    expect(y.ganjiHanja).toEqual(["癸"]);
  });
});

describe("용신일 판정", () => {
  test("일주에 용신 간지가 있는 날만 걸린다", () => {
    const natal = buildNatalSummary(OWNER);
    // 용신 = 甲 乙 寅 卯
    const cases: Array<[string, boolean]> = [];
    // 2026년 9월 한 달을 훑으며 실제 일주로 확인한다
    for (let d = 1; d <= 30; d += 1) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      const facts = buildDayFacts(date, OWNER, natal);
      cases.push([date, facts.isYongsin]);
    }
    const hits = cases.filter(([, ok]) => ok).length;
    // 甲/乙 일간(12/60) ∪ 寅/卯 일지(10/60) — 겹치는 2일 빼면 20/60 = 3분의 1
    expect(hits).toBeGreaterThanOrEqual(6);
    expect(hits).toBeLessThanOrEqual(14);
  });

  test("데모 원국은 용신이 癸 하나라 훨씬 드물게 온다", () => {
    const natal = buildNatalSummary(DEMO);
    let hits = 0;
    for (let d = 1; d <= 30; d += 1) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      if (buildDayFacts(date, DEMO, natal).isYongsin) hits += 1;
    }
    // 癸 일간은 60일에 6번 → 한 달에 2~4일
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(hits).toBeLessThanOrEqual(5);
  });

  test("용신이 없으면 어떤 날도 용신일이 아니다", () => {
    const natal = { ...buildNatalSummary(OWNER), yongsin: null };
    const facts = buildDayFacts("2026-09-15", OWNER, natal);
    expect(facts.isYongsin).toBe(false);
    expect(matchesCondition(facts, { kind: "yongsin" })).toBe(false);
  });
});

describe("카드 선택", () => {
  test("용신을 구할 수 있으면 카드가 뽑힌다", () => {
    for (const pillars of [OWNER, DEMO]) {
      const rules = generateHypotheses(buildNatalSummary(pillars));
      expect(rules.map((r) => r.id)).toContain("yongsin_energy_up");
    }
  });

  test("근거 문장이 이 사람의 실제 오행·간지로 채워진다", () => {
    const rules = generateHypotheses(buildNatalSummary(OWNER));
    const card = rules.find((r) => r.id === "yongsin_energy_up")!;
    expect(card.copy.basis).toContain("흙(土)");
    expect(card.copy.basis).toContain("나무(木)");
    expect(card.copy.basis).toContain("甲·乙·寅·卯");
    // 카탈로그의 자리표시자 문장이 그대로 남아 있으면 안 된다
    expect(card.copy.basis).not.toBe(YONGSIN_RULE.copy.basis);
  });

  test("T존에서 찾았으면 '이미 사주 안에 있다'고 말한다", () => {
    const rules = generateHypotheses(buildNatalSummary(DEMO));
    const card = rules.find((r) => r.id === "yongsin_energy_up")!;
    expect(card.copy.basis).toContain("이미 사주 안에");
    expect(card.copy.basis).toContain("癸");
  });

  test("같은 말을 두 번 하지 않는다", () => {
    // "甲·乙·寅·卯가 들어오는 날이 …. 甲·乙·寅·卯가 들어오는 날이 …" 로 나간 적이 있다
    for (const pillars of [OWNER, DEMO]) {
      const rules = generateHypotheses(buildNatalSummary(pillars));
      const basis = rules.find((r) => r.id === "yongsin_energy_up")!.copy.basis;
      const repeated = basis.match(/들어오는 날/g) ?? [];
      expect(`반복 ${repeated.length}회: ${basis}`).toBe(`반복 1회: ${basis}`);
    }
  });

  test("T존에 없으면 '사주 안에는 없다'고 말한다", () => {
    const rules = generateHypotheses(buildNatalSummary(OWNER));
    const card = rules.find((r) => r.id === "yongsin_energy_up")!;
    expect(card.copy.basis).toContain("사주 안에는 없어서");
  });
});

/** 용신일에만 값을 올린 가짜 기록 */
function makeRecords(
  pillars: SajuProfilePillars,
  natal: ReturnType<typeof buildNatalSummary>,
  opts: { yongsinValue: number; otherValue: number; days: number }
): { records: DayRecord[]; factsByDate: Map<string, DayFacts> } {
  const records: DayRecord[] = [];
  const factsByDate = new Map<string, DayFacts>();
  const start = new Date("2026-01-01T00:00:00Z");

  for (let i = 0; i < opts.days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const facts = buildDayFacts(date, pillars, natal);
    factsByDate.set(date, facts);
    records.push({
      date,
      metrics: {
        energy: facts.isYongsin ? opts.yongsinValue : opts.otherValue,
      },
    });
  }
  return { records, factsByDate };
}

describe("뒤집힘 — 세 세계", () => {
  const natal = buildNatalSummary(OWNER);
  const rules = generateHypotheses(natal).filter(
    (r) => r.id === "yongsin_energy_up"
  );

  test("용신일에 실제로 높으면 '맞았습니다'", () => {
    const { records, factsByDate } = makeRecords(OWNER, natal, {
      yongsinValue: 5,
      otherValue: 3,
      days: 120,
    });
    const [card] = evaluateAll(rules, records, factsByDate);
    expect(card!.status).toBe("confirmed");
    expect(card!.evidence.gap).toBeGreaterThan(0);
  });

  test("반대로 나오면 '당신은 달랐습니다'", () => {
    const { records, factsByDate } = makeRecords(OWNER, natal, {
      yongsinValue: 2,
      otherValue: 4,
      days: 120,
    });
    const [card] = evaluateAll(rules, records, factsByDate);
    expect(card!.status).toBe("exception");
    expect(card!.headline).toContain("사주에서 가장 중요하게 보는 자리");
  });

  test("차이가 없으면 '큰 차이가 없었습니다'", () => {
    const { records, factsByDate } = makeRecords(OWNER, natal, {
      yongsinValue: 3,
      otherValue: 3,
      days: 120,
    });
    const [card] = evaluateAll(rules, records, factsByDate);
    expect(card!.status).toBe("neutral");
  });

  test("표본이 모자라면 아직 판정하지 않는다", () => {
    const { records, factsByDate } = makeRecords(OWNER, natal, {
      yongsinValue: 5,
      otherValue: 3,
      days: 6,
    });
    const [card] = evaluateAll(rules, records, factsByDate);
    expect(card!.status).toBe("collecting");
  });
});

describe("문구 규칙", () => {
  test("제목이 '날'로 끝난다", () => {
    expect(YONGSIN_RULE.title.endsWith("날")).toBe(true);
  });

  test("claim 에 사주 용어가 없다 — 경험만으로 답할 수 있어야 한다", () => {
    for (const term of ["용신", "오행", "천간", "지지", "간지", "일주", "원국"]) {
      expect(`claim: ${YONGSIN_RULE.copy.claim}`).not.toContain(term);
    }
  });

  test("'틀렸다'를 쓰지 않는다", () => {
    const all = Object.values(YONGSIN_RULE.copy).join(" ");
    expect(all).not.toContain("틀렸");
    expect(all).not.toContain("틀린");
  });
});
