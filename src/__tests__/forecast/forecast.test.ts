import { describe, expect, test } from "@jest/globals";
import { resolveMaturity, MATURITY_LABELS } from "@/lib/forecast/maturity";
import { addDaysToDateString, buildTomorrowSajuContext } from "@/lib/forecast/tomorrowContext";
import { findSimilarDays } from "@/lib/forecast/similarDays";
import { buildLocalNightReport } from "@/lib/forecast/buildLocalNightReport";
import {
  assertNoSensitiveFields,
  parseForecastAiOutput,
  sanitizeAiOutput,
  containsForbiddenExpression,
} from "@/lib/forecast/aiSchema";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";

function makeEntry(
  date: string,
  opts?: Partial<DiaryEntry>
): DiaryEntry {
  return {
    ...createDiaryEntry(date, "메모", {
      happinessRating: 3,
      energyRating: 3,
      primaryArea: "일",
      emotions: ["평온"],
      tags: ["업무"],
    }),
    ...opts,
  };
}

describe("forecast maturity", () => {
  test("기록 수에 따라 단계가 오른다", () => {
    expect(resolveMaturity(0)).toBe("base");
    expect(resolveMaturity(6)).toBe("base");
    expect(resolveMaturity(7)).toBe("early");
    expect(resolveMaturity(20)).toBe("personal");
    expect(resolveMaturity(50)).toBe("flow");
  });

  test("정확도라는 표현을 쓰지 않는다", () => {
    for (const label of Object.values(MATURITY_LABELS)) {
      expect(label).not.toMatch(/정확도/);
    }
  });
});

describe("tomorrowContext", () => {
  test("오늘 기준 내일을 계산한다", () => {
    expect(addDaysToDateString("2024-01-31", 1)).toBe("2024-02-01");
  });

  test("원국이 있으면 십신을 계산한다", () => {
    const profile = {
      id: "p1",
      isPrimary: true,
      birthDate: "1990-01-01",
      birthTimeUnknown: true,
      calendarType: "solar",
      timezone: "Asia/Seoul",
      dayChangeRule: "midnight",
      timeCorrection: "none",
      pillars: {
        year: {
          stemHanja: "庚",
          branchHanja: "午",
          stemKo: "경",
          branchKo: "오",
          ganjiKo: "경오",
        },
        month: {
          stemHanja: "戊",
          branchHanja: "子",
          stemKo: "무",
          branchKo: "자",
          ganjiKo: "무자",
        },
        day: {
          stemHanja: "甲",
          branchHanja: "子",
          stemKo: "갑",
          branchKo: "자",
          ganjiKo: "갑자",
        },
      },
      calculationVersion: "0.1.0",
      createdAt: "",
      updatedAt: "",
      schemaVersion: 2,
    } as SajuProfile;

    const facts = buildTomorrowSajuContext({
      todayDate: "2024-06-15",
      sajuProfile: profile,
    });
    expect(facts.targetDate).toBe("2024-06-16");
    expect(facts.ganjiKo).toBeTruthy();
    expect(facts.tenGod).toBeTruthy();
  });
});

describe("similarDays", () => {
  test("동일 간지를 우선한다", () => {
    const target = makeEntry("2024-06-15");
    const same = makeEntry("2024-04-16");
    same.dayPillar = { ...target.dayPillar };
    const other = makeEntry("2024-05-01");
    other.dayPillar = {
      ...other.dayPillar,
      ganjiKo: "다른간지",
      stem: { hanja: "乙", ko: "을" },
      branch: { hanja: "丑", ko: "축" },
    };

    const result = findSimilarDays({
      entries: [target, same, other],
      targetGanjiKo: target.dayPillar.ganjiKo,
      targetStemKo: target.dayPillar.stem.ko,
      targetBranchKo: target.dayPillar.branch.ko,
      targetTenGod: null,
      excludeDate: target.date,
    });
    expect(result.primaryKind).toBe("ganji");
    expect(result.sampleSizes.ganji).toBe(1);
  });
});

describe("buildLocalNightReport", () => {
  test("일기 없이도 로컬 리포트를 만든다", () => {
    const today = makeEntry("2024-06-15", { happinessRating: 4, energyRating: 2 });
    const { forecast, maturityLabel } = buildLocalNightReport({
      todayEntry: today,
      entries: [today],
      sajuProfile: null,
    });
    expect(forecast.targetDate).toBe("2024-06-16");
    expect(forecast.emotionForecast.forecast).toBeTruthy();
    expect(forecast.oneAction.action).toBeTruthy();
    expect(forecast.innerSignal.isHypothesis).toBe(true);
    expect(maturityLabel).toMatch(/기본|초기|개인|흐름/);
    expect(forecast.disclaimer).not.toMatch(/정확도/);
  });
});

describe("aiSchema privacy", () => {
  test("content 필드를 거부한다", () => {
    expect(assertNoSensitiveFields({ content: "비밀 일기" })).toMatch(/content/);
    expect(assertNoSensitiveFields({ birthDate: "1990-01-01" })).toMatch(/birthDate/);
    expect(assertNoSensitiveFields({ targetDate: "2024-01-01", localDraft: { todaySummary: "ok" } })).toBeNull();
  });

  test("금지 표현이 있으면 sanitize가 실패한다", () => {
    expect(containsForbiddenExpression("우울증이 있습니다")).toBe(true);
    const bad = parseForecastAiOutput({
      todaySummary: "요약",
      possibleInnerSignal: "당신은 우울증 증상이 있습니다",
      neededCondition: "조건",
      emotionForecast: "감정",
      focusForecast: "집중",
      conditionForecast: "컨디션",
      oneAction: "행동",
      reflectionSentence: "성찰",
    });
    expect(bad).not.toBeNull();
    expect(sanitizeAiOutput(bad!)).toBeNull();
  });
});
