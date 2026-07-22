/**
 * Phase 1 Legacy 회귀: 기존 diary 스키마 마이그레이션(normalize) 비파괴
 */
import { describe, expect, test } from "@jest/globals";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { normalizeDiaryEntry } from "@/lib/diary/migrate";
import { DIARY_SCHEMA_VERSION } from "@/lib/diary/types";

describe("Legacy 데이터 마이그레이션(normalize) 회귀", () => {
  test("최소 필드 raw도 dayPillar·천간지지 backfill 후 schemaVersion 승격", () => {
    const raw = {
      id: "mig-1",
      date: "2025-06-10",
      content: "",
      dayPillar: {
        ganji: "甲子",
        ganjiKo: "갑자",
        ganjiIndex: 0,
        stem: { hanja: "甲", ko: "갑" },
        branch: { hanja: "子", ko: "자" },
      },
      analysis: null,
      createdAt: "2025-06-10T01:00:00.000Z",
      updatedAt: "2025-06-10T01:00:00.000Z",
    };

    const n = normalizeDiaryEntry(raw as Record<string, unknown>);
    expect(n.schemaVersion).toBe(DIARY_SCHEMA_VERSION);
    expect(n.heavenlyStem).toBe("갑");
    expect(n.earthlyBranch).toBe("자");
    expect(typeof n.weekday).toBe("number");
    expect(n.dataOrigin === "user" || n.dataOrigin === "demo" || n.dataOrigin === "import").toBe(
      true
    );
  });

  test("idempotent: normalize를 두 번 적용해도 핵심 필드 동일", () => {
    const entry = createDiaryEntry("2025-08-01", "두 번 정규화", {
      happinessRating: 5,
      emotions: ["기쁨"],
      tags: ["휴식"],
      energyRating: 4,
      focusRating: 5,
    });
    const once = normalizeDiaryEntry(
      JSON.parse(JSON.stringify(entry)) as Record<string, unknown>
    );
    const twice = normalizeDiaryEntry(
      JSON.parse(JSON.stringify(once)) as Record<string, unknown>
    );

    expect(twice.happinessRating).toBe(once.happinessRating);
    expect(twice.emotions).toEqual(once.emotions);
    expect(twice.tags).toEqual(once.tags);
    expect(twice.focusRating).toBe(once.focusRating);
    expect(twice.dayPillar.ganjiKo).toBe(once.dayPillar.ganjiKo);
    expect(twice.schemaVersion).toBe(DIARY_SCHEMA_VERSION);
  });

  test("weatherMetadata.focusRating 폴백이 본문 필드를 덮어쓰지 않음", () => {
    const entry = createDiaryEntry("2025-09-01", "메타", {
      happinessRating: 3,
      focusRating: 4,
    });
    const raw = {
      ...entry,
      weatherMetadata: { focusRating: 1, tenGod: "편재" },
    };
    const n = normalizeDiaryEntry(raw as unknown as Record<string, unknown>);
    expect(n.focusRating).toBe(4);
  });

  test("원본 content·id·date는 정규화 후 유지 (비파괴)", () => {
    const entry = createDiaryEntry("2025-10-02", "절대 지우지 말 것");
    const n = normalizeDiaryEntry({
      ...(entry as unknown as Record<string, unknown>),
      schemaVersion: 2,
    });
    expect(n.id).toBe(entry.id);
    expect(n.date).toBe("2025-10-02");
    expect(n.content).toBe("절대 지우지 말 것");
  });
});
