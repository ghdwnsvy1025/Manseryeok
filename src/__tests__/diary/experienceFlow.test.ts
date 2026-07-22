import { describe, expect, test } from "@jest/globals";
import { computeUserAppState } from "@/lib/app/userAppState";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { filterRealEntries, isDemoEntry, resolveDataOrigin } from "@/lib/diary/dataOrigin";
import {
  detectBranchRelations,
  detectStemRelations,
  buildBeginnerTodayFlow,
  buildExpertInsights,
} from "@/lib/saju/interpretation";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  buildRatingTrend,
  weekendComparison,
  weekdayAverages,
} from "@/lib/diary/trendStats";

describe("dataOrigin", () => {
  test("demo id와 dataOrigin을 식별", () => {
    expect(isDemoEntry({ id: "demo-2024-01-01", dataOrigin: "user" })).toBe(true);
    expect(isDemoEntry({ id: "abc", dataOrigin: "demo" })).toBe(true);
    expect(isDemoEntry({ id: "abc", dataOrigin: "user" })).toBe(false);
    expect(resolveDataOrigin({ id: "demo-x" })).toBe("demo");
  });

  test("filterRealEntries는 demo를 제외", () => {
    const real = createDiaryEntry("2024-01-01", "실", { id: "real-1" });
    const demo = createDiaryEntry("2024-01-02", "데모", {
      id: "demo-2024-01-02",
      dataOrigin: "demo",
    });
    expect(filterRealEntries([real, demo])).toHaveLength(1);
  });
});

describe("computeUserAppState", () => {
  test("신규/사주만/미기록/완료 상태를 구분", () => {
    expect(
      computeUserAppState({
        experienceMode: null,
        onboardingCompletedAt: null,
        sajuProfile: null,
        entries: [],
        todayDate: "2024-06-01",
      }).kind
    ).toBe("new_user");

    const profile = {
      id: "p1",
      isPrimary: true,
      birthDate: "1990-01-01",
      birthTimeUnknown: true,
      calendarType: "solar" as const,
      timezone: "Asia/Seoul",
      dayChangeRule: "midnight" as const,
      timeCorrection: "none" as const,
      pillars: {
        year: {
          stemHanja: "甲",
          branchHanja: "子",
          stemKo: "갑",
          branchKo: "자",
          ganjiKo: "갑자",
        },
        month: {
          stemHanja: "甲",
          branchHanja: "子",
          stemKo: "갑",
          branchKo: "자",
          ganjiKo: "갑자",
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
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      schemaVersion: 3,
    };

    expect(
      computeUserAppState({
        experienceMode: "balanced",
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
        sajuProfile: profile,
        entries: [],
        todayDate: "2024-06-01",
      }).kind
    ).toBe("profile_without_diary");

    expect(
      computeUserAppState({
        experienceMode: "balanced",
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
        sajuProfile: null,
        entries: [],
        todayDate: "2024-06-01",
      }).kind
    ).toBe("profile_without_diary");

    const past = createDiaryEntry("2024-05-30", "과거", {
      happinessRating: 4,
      happinessSource: "selected",
    });
    expect(
      computeUserAppState({
        experienceMode: "balanced",
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
        sajuProfile: profile,
        entries: [past],
        todayDate: "2024-06-01",
      }).kind
    ).toBe("returning_not_logged_today");

    const today = createDiaryEntry("2024-06-01", "오늘", {
      happinessRating: 5,
      happinessSource: "selected",
    });
    expect(
      computeUserAppState({
        experienceMode: "saju",
        onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
        sajuProfile: profile,
        entries: [past, today],
        todayDate: "2024-06-01",
      }).kind
    ).toBe("logged_today");
  });
});

describe("interpretation relations", () => {
  test("子午 충을 감지", () => {
    const rel = detectBranchRelations("子", "午");
    expect(rel.some((r) => r.kind === "chung")).toBe(true);
  });

  test("갑기 천간합을 감지", () => {
    const rel = detectStemRelations("甲", "己");
    expect(rel.some((r) => r.kind === "cheon_gan_hap")).toBe(true);
  });

  test("초보/전문 해석이 확정 예측 문구를 쓰지 않음", () => {
    const dayPillar = getPillarsForDate("2024-06-01").dayPillar;
    const beginner = buildBeginnerTodayFlow({ dayPillar });
    const expert = buildExpertInsights({ dayPillar });
    const text = `${beginner.headline} ${expert.map((s) => s.summary).join(" ")}`;
    expect(text).not.toMatch(/반드시|질병|사고|건강이 나빠/);
  });
});

describe("trendStats", () => {
  test("빈 날은 null로 두고 보간하지 않음", () => {
    const e1 = createDiaryEntry("2024-06-01", "a", {
      happinessRating: 4,
      happinessSource: "selected",
    });
    const trend = buildRatingTrend([e1], 3, "happiness", new Date("2024-06-03T12:00:00"));
    expect(trend.points).toHaveLength(3);
    expect(trend.sampleSize).toBe(1);
    expect(trend.points.filter((p) => p.value == null).length).toBe(2);
  });

  test("요일·주말 집계", () => {
    const entries = [
      createDiaryEntry("2024-06-01", "토", { happinessRating: 5, happinessSource: "selected" }),
      createDiaryEntry("2024-06-03", "월", { happinessRating: 3, happinessSource: "selected" }),
    ];
    expect(weekdayAverages(entries).some((w) => w.sampleSize > 0)).toBe(true);
    const weekend = weekendComparison(entries);
    expect(weekend.weekdaySample + weekend.weekendSample).toBeGreaterThan(0);
  });
});
