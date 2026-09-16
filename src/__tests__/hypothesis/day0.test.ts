/**
 * Day 0 카드 덱 — 안전장치 검증
 *
 * 두 가지를 지킨다.
 * 1. 플래그가 꺼져 있으면 기존 동작과 완전히 같다 (지인 베타가 쓰는 앱이다)
 * 2. 사용자가 Day 0에 찍은 답은 판정에 절대 섞이지 않는다
 *
 * 2번이 특히 중요하다. 섞이는 순간 "데이터로 검증했다"는 말이 거짓이 된다.
 */
import { afterEach, describe, expect, test } from "@jest/globals";
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
  countAgreed,
  hasSeenDay0Cards,
  loadDay0Answers,
  saveDay0Answers,
  clearDay0Answers,
  type Day0Guess,
} from "@/lib/hypothesis/day0Answers";
import type { DayFacts } from "@/lib/hypothesis/types";

const OPTIONS = {
  calendarType: "solar" as const,
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight" as const,
  timeCorrection: "none" as const,
};

const SAMPLE: SajuInput = {
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  gender: "male", options: OPTIONS,
};

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

// ── localStorage 흉내 (jest 환경은 node) ──
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

function withBrowser(fn: () => void) {
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  const store = new MemoryStorage();
  g.window = { localStorage: store };
  g.localStorage = store;
  try {
    fn();
  } finally {
    delete g.window;
    delete g.localStorage;
  }
}

describe("답변 저장", () => {
  test("저장하고 다시 읽는다", () => {
    withBrowser(() => {
      expect(hasSeenDay0Cards("p1")).toBe(false);

      const guesses: Record<string, Day0Guess> = {
        a: "agree", b: "disagree", c: "agree", d: "unsure",
      };
      saveDay0Answers("p1", guesses, ["a", "b", "c", "d"]);

      const loaded = loadDay0Answers("p1");
      expect(loaded).not.toBeNull();
      expect(loaded!.guesses).toEqual(guesses);
      expect(loaded!.ruleIds).toEqual(["a", "b", "c", "d"]);
      expect(countAgreed(loaded)).toBe(2);
      expect(hasSeenDay0Cards("p1")).toBe(true);
    });
  });

  test("프로필이 다르면 섞이지 않는다", () => {
    withBrowser(() => {
      saveDay0Answers("p1", { a: "agree" }, ["a"]);
      expect(hasSeenDay0Cards("p1")).toBe(true);
      expect(hasSeenDay0Cards("p2")).toBe(false);
    });
  });

  test("지우면 다시 안 본 상태가 된다", () => {
    withBrowser(() => {
      saveDay0Answers("p1", { a: "agree" }, ["a"]);
      clearDay0Answers("p1");
      expect(hasSeenDay0Cards("p1")).toBe(false);
    });
  });

  test("브라우저가 아니면 조용히 넘어간다", () => {
    expect(() => saveDay0Answers("p1", { a: "agree" }, ["a"])).not.toThrow();
    expect(loadDay0Answers("p1")).toBeNull();
    expect(hasSeenDay0Cards("p1")).toBe(false);
  });
});

describe("답변은 판정에 섞이지 않는다", () => {
  test("Day 0에 뭐라고 답하든 판정 결과가 같다", () => {
    const pillars = buildPillars(SAMPLE);
    const natal = buildNatalSummary(pillars);
    const rules = generateHypotheses(natal, 10);
    const dates = enumerateDates("2026-01-01", 120);
    const facts = new Map<string, DayFacts>(
      dates.map((d) => [d, buildDayFacts(d, pillars, natal)])
    );
    const records = simulateRecords({
      startDate: "2026-01-01", days: 120, factsByDate: facts,
      rules, world: "truth", seed: 5150,
    });

    const before = evaluateAll(rules, records, facts).map((c) => ({
      id: c.rule.id, status: c.status, headline: c.headline, gap: c.evidence.gap,
    }));

    // 전부 "맞다"고 답한 뒤 다시 판정
    withBrowser(() => {
      saveDay0Answers(
        "p1",
        Object.fromEntries(rules.map((r) => [r.id, "agree" as Day0Guess])),
        rules.map((r) => r.id)
      );

      const after = evaluateAll(rules, records, facts).map((c) => ({
        id: c.rule.id, status: c.status, headline: c.headline, gap: c.evidence.gap,
      }));

      expect(after).toEqual(before);
    });
  });

  test("판정 코드가 Day 0 답변 모듈을 import 하지 않는다", () => {
    // 실수로 이어 붙이는 것을 소스 수준에서 막는다
    const root = path.join(process.cwd(), "src", "lib", "hypothesis");
    for (const file of ["evaluate.ts", "generate.ts", "dayFacts.ts", "fromJournal.ts"]) {
      const src = fs.readFileSync(path.join(root, file), "utf-8");
      expect(`${file}: ${src.includes("day0Answers")}`).toBe(`${file}: false`);
    }
  });
});

describe("플래그 OFF면 기존 동작", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FF_HYPOTHESIS_CARDS;
    jest.resetModules();
  });

  test("기본값은 꺼짐", async () => {
    jest.resetModules();
    const flags = await import("@/lib/app/featureFlags");
    expect(flags.DEFAULT_FEATURE_FLAGS.hypothesisCardsEnabled).toBe(false);
    expect(flags.isHypothesisCardsEnabled()).toBe(false);
  });

  test("환경변수로 켤 수 있다", async () => {
    process.env.NEXT_PUBLIC_FF_HYPOTHESIS_CARDS = "true";
    jest.resetModules();
    const flags = await import("@/lib/app/featureFlags");
    expect(flags.isHypothesisCardsEnabled()).toBe(true);
  });

  test("진입 화면이 플래그와 '이미 봤는지'를 둘 다 확인한다", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "page.tsx"),
      "utf-8"
    );
    expect(src).toContain("isHypothesisCardsEnabled()");
    expect(src).toContain("hasSeenDay0Cards");
    // 카드 단계 중에 로그인 이벤트로 튕기지 않아야 한다
    expect(src).toContain('if (prev === "cards") return prev;');
  });
});
