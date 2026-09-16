/**
 * 오늘의 확인된 패턴 → 운세 연결 검증
 *
 * 가장 중요한 것은 **안전한 기본값**이다.
 * 확인된 날이 하나도 없으면 이 기능은 통째로 빠져서, 운세가 지금과 완전히
 * 똑같이 나와야 한다. 이 기능 때문에 운세가 깨지는 일은 없어야 한다.
 */
import { describe, expect, test } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";

import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import type { SajuProfilePillars, UserBirthPillarDetail } from "@/lib/diary/types";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts } from "@/lib/hypothesis/dayFacts";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import { evaluateAll } from "@/lib/hypothesis/evaluate";
import { simulateRecords, enumerateDates } from "@/lib/hypothesis/simulate";
import {
  findTodayPatterns,
  todayPatternLine,
  toFortuneFacts,
  buildTodayPatternsFromEntries,
} from "@/lib/hypothesis/todayPattern";
import { METRICS, type DayFacts } from "@/lib/hypothesis/types";

const SAMPLE: SajuInput = {
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  gender: "male",
  options: {
    calendarType: "solar", timezone: "Asia/Seoul",
    dayChangeRule: "midnight", timeCorrection: "none",
  },
};

function toDetail(p: {
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
}): UserBirthPillarDetail {
  return {
    stemHanja: p.stem.hanja, branchHanja: p.branch.hanja,
    stemKo: p.stem.ko, branchKo: p.branch.ko,
    ganjiKo: `${p.stem.ko}${p.branch.ko}`,
  };
}

const r = calculateSaju(SAMPLE);
const pillars: SajuProfilePillars = {
  year: toDetail(r.pillars.year),
  month: toDetail(r.pillars.month),
  day: toDetail(r.pillars.day),
  hour: r.pillars.hour ? toDetail(r.pillars.hour) : null,
};
const natal = buildNatalSummary(pillars);
const rules = generateHypotheses(natal);

const START = "2026-01-01";
const DAYS = 120;
const TODAY = "2026-04-01"; // 기록 구간 밖의 하루 — 조건 판정만 본다

const dates = enumerateDates(START, DAYS);
const factsByDate = new Map<string, DayFacts>(
  dates.map((d) => [d, buildDayFacts(d, pillars, natal)])
);
const records = simulateRecords({
  startDate: START, days: DAYS, factsByDate,
  rules, world: "truth", missRate: 0, seed: 31337,
});
const cards = evaluateAll(rules, records, factsByDate);

describe("안전한 기본값", () => {
  test("확인된 날이 없으면 빈 배열", () => {
    const noneSettled = evaluateAll(rules, [], factsByDate);
    const patterns = findTodayPatterns({ cards: noneSettled, pillars, natal, date: TODAY });

    expect(patterns).toEqual([]);
    expect(todayPatternLine(patterns)).toBeNull();
    expect(toFortuneFacts(patterns)).toEqual([]);
  });

  test("기록이 아예 없어도 터지지 않는다", () => {
    expect(buildTodayPatternsFromEntries({ pillars, entries: [], date: TODAY })).toEqual([]);
  });

  test("사주 프로필이 없어도 터지지 않는다", () => {
    expect(buildTodayPatternsFromEntries({ pillars: null, entries: [], date: TODAY })).toEqual([]);
  });

  test("운세 API가 빈 배열이면 필드를 아예 넣지 않는다", () => {
    // 필드가 undefined 면 JSON.stringify 에서 사라져 프롬프트가 예전과 같아진다
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "journal", "todayFortune.ts"),
      "utf-8"
    );
    expect(src).toContain("opts?.verifiedDayFacts && opts.verifiedDayFacts.length > 0");
    expect(src).toContain(": undefined,");
  });
});

describe("오늘 해당하는 날 고르기", () => {
  test("확인이 끝난 카드만 쓴다", () => {
    const patterns = findTodayPatterns({ cards, pillars, natal, date: TODAY });
    for (const p of patterns) {
      const card = cards.find((c) => c.rule.id === p.ruleId)!;
      expect(card.status === "confirmed" || card.status === "exception").toBe(true);
    }
  });

  test("차이가 큰 것부터 정렬된다", () => {
    const patterns = findTodayPatterns({ cards, pillars, natal, date: TODAY });
    const gaps = patterns.map((p) => p.gap);
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
  });

  test("사실 문구가 지표의 up/down 과 일치한다", () => {
    const patterns = findTodayPatterns({ cards, pillars, natal, date: TODAY });
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      const meta = METRICS[p.metric];
      expect(p.fact).toBe(p.up ? meta.up : meta.down);
    }
  });
});

describe("홈 한 줄", () => {
  test("최대 두 개까지만 이어 붙인다", () => {
    const patterns = findTodayPatterns({ cards, pillars, natal, date: TODAY });
    const line = todayPatternLine(patterns);
    expect(line).not.toBeNull();
    // 쉼표가 하나 이하 = 항목 두 개 이하
    expect((line!.match(/,/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(line!.length).toBeLessThan(40);
  });

  test("하나면 그대로 쓴다", () => {
    const one = findTodayPatterns({ cards, pillars, natal, date: TODAY }).slice(0, 1);
    expect(todayPatternLine(one)).toBe(one[0]!.fact);
  });
});

describe("운세에 넘기는 문장", () => {
  test("지표·차이·근거일수가 모두 들어간다", () => {
    const patterns = findTodayPatterns({ cards, pillars, natal, date: TODAY });
    const facts = toFortuneFacts(patterns);

    expect(facts.length).toBe(patterns.length);
    for (let i = 0; i < facts.length; i += 1) {
      const p = patterns[i]!;
      expect(facts[i]).toContain(p.dayTitle);
      expect(facts[i]).toContain(METRICS[p.metric].label);
      expect(facts[i]).toContain(String(p.gap));
      expect(facts[i]).toContain(`${p.matchedDays}일`);
    }
  });

  test("예외인 것은 '이론과 반대'라고 명시한다", () => {
    // 이론과 반대인 세계를 따로 만들어 확인
    const inverted = simulateRecords({
      startDate: START, days: DAYS, factsByDate,
      rules, world: "inverted", missRate: 0, seed: 31337,
    });
    const invCards = evaluateAll(rules, inverted, factsByDate);
    const patterns = findTodayPatterns({ cards: invCards, pillars, natal, date: TODAY });

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.every((p) => p.isException)).toBe(true);
    for (const line of toFortuneFacts(patterns)) {
      expect(line).toContain("반대");
      expect(line).toContain("본인 기록이 우선");
    }
  });
});

describe("프롬프트 규칙", () => {
  test("기록이 이론을 이긴다고 명시돼 있다", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "journal", "fortune", "personalizedPrompt.ts"),
      "utf-8"
    );
    expect(src).toContain("verifiedDayPatterns");
    expect(src).toContain("이쪽이 이긴다");
    // 근거 수치를 사용자 문장에 그대로 노출하지 않도록 지시
    expect(src).toContain("숫자·일수를 사용자 문장에 그대로 노출하지 않는다");
  });
});
