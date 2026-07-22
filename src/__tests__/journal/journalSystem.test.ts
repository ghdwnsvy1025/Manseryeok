import { describe, expect, test } from "@jest/globals";
import { CATEGORY_CATALOG, DEFAULT_RECOMMENDED_CODES } from "@/lib/journal/categoryCatalog";
import { EVENT_TAG_CATALOG } from "@/lib/journal/eventTagCatalog";
import {
  buildPreferencesFromSelection,
  createDefaultPreferences,
  getEnabledCodesOrdered,
} from "@/lib/journal/preferences";
import { MemoryJournalStorage } from "@/lib/journal/indexedDbStorage";
import {
  averageValidScores,
  validateEnabledCategorySelection,
  validateScorePayload,
  validateTagCodes,
} from "@/lib/journal/validation";
import {
  MAX_ENABLED_CATEGORIES,
  MIN_ENABLED_CATEGORIES,
  type CategoryCode,
  type CategoryScoreRecord,
} from "@/lib/journal/types";
import { isNewDiaryEnabled, DEFAULT_FEATURE_FLAGS } from "@/lib/app/featureFlags";

describe("journal category seed", () => {
  test("시스템 카테고리 9개", () => {
    expect(CATEGORY_CATALOG).toHaveLength(9);
    expect(CATEGORY_CATALOG.every((c) => c.isSystem)).toBe(true);
  });

  test("권장 기본 선택 6개", () => {
    expect(DEFAULT_RECOMMENDED_CODES).toHaveLength(6);
    expect(createDefaultPreferences().filter((p) => p.enabled)).toHaveLength(6);
  });

  test("사건 태그 seed", () => {
    expect(EVENT_TAG_CATALOG.length).toBeGreaterThanOrEqual(15);
  });
});

describe("category preference rules", () => {
  test("최소 4개 미만 거부", () => {
    const codes = DEFAULT_RECOMMENDED_CODES.slice(0, 3) as CategoryCode[];
    expect(validateEnabledCategorySelection(codes).ok).toBe(false);
  });

  test("최대 9개 초과 거부", () => {
    const codes = [
      ...CATEGORY_CATALOG.map((c) => c.code),
      "emotional_balance",
    ] as CategoryCode[];
    expect(validateEnabledCategorySelection(codes).ok).toBe(false);
  });

  test("4~9개 허용", () => {
    expect(validateEnabledCategorySelection(DEFAULT_RECOMMENDED_CODES).ok).toBe(
      true
    );
    expect(
      validateEnabledCategorySelection(
        CATEGORY_CATALOG.map((c) => c.code)
      ).ok
    ).toBe(true);
    expect(MIN_ENABLED_CATEGORIES).toBe(4);
    expect(MAX_ENABLED_CATEGORIES).toBe(9);
  });

  test("선택 해제 후 과거 preference 행 유지(disabled)", () => {
    const prev = createDefaultPreferences("u1");
    const nextCodes = DEFAULT_RECOMMENDED_CODES.slice(0, 4) as CategoryCode[];
    const next = buildPreferencesFromSelection(nextCodes, prev, "u1");
    const enabled = getEnabledCodesOrdered(next);
    expect(enabled).toEqual(nextCodes);
    const disabled = next.filter((p) => !p.enabled);
    expect(disabled.length).toBeGreaterThan(0);
    expect(disabled.every((p) => p.disabledAt != null)).toBe(true);
  });
});

describe("category scores", () => {
  test("1~5만 허용", () => {
    expect(
      validateScorePayload({
        categoryCode: "energy",
        rawScore: 3,
        isNotApplicable: false,
      }).ok
    ).toBe(true);
    expect(
      validateScorePayload({
        categoryCode: "energy",
        rawScore: 0 as unknown as number,
        isNotApplicable: false,
      }).ok
    ).toBe(false);
    expect(
      validateScorePayload({
        categoryCode: "energy",
        rawScore: 6 as unknown as number,
        isNotApplicable: false,
      }).ok
    ).toBe(false);
  });

  test("해당 없음은 rawScore null (0 아님)", () => {
    const r = validateScorePayload({
      categoryCode: "energy",
      rawScore: null,
      isNotApplicable: true,
    });
    expect(r.ok).toBe(true);
    expect(
      validateScorePayload({
        categoryCode: "energy",
        rawScore: 0 as unknown as number,
        isNotApplicable: true,
      }).ok
    ).toBe(false);
  });

  test("통계에서 해당 없음 제외", () => {
    const scores: CategoryScoreRecord[] = [
      {
        id: "1",
        entryId: "e",
        userId: "u",
        categoryCode: "energy",
        rawScore: 4,
        isNotApplicable: false,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        entryId: "e",
        userId: "u",
        categoryCode: "work_study",
        rawScore: null,
        isNotApplicable: true,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    expect(averageValidScores(scores)).toBe(4);
  });
});

describe("journal CRUD (memory)", () => {
  test("작성·조회·수정·태그·중복날짜", async () => {
    const storage = new MemoryJournalStorage();
    const created = await storage.save({
      entryDate: "2026-07-21",
      content: "첫 기록",
      overallSatisfaction: 4,
      moodLabel: "평온",
      mainEventText: "회의",
      scores: [
        { categoryCode: "energy", rawScore: 4, isNotApplicable: false },
        { categoryCode: "focus_execution", rawScore: null, isNotApplicable: true },
      ],
      tagCodes: ["rest", "learning"],
    });
    expect(created.scores.find((s) => s.categoryCode === "energy")?.rawScore).toBe(4);
    expect(
      created.scores.find((s) => s.categoryCode === "focus_execution")?.isNotApplicable
    ).toBe(true);
    expect(
      created.scores.find((s) => s.categoryCode === "focus_execution")?.rawScore
    ).toBeNull();
    expect(created.tags.map((t) => t.tagCode).sort()).toEqual(["learning", "rest"]);

    const loaded = await storage.getByDate("2026-07-21");
    expect(loaded?.content).toBe("첫 기록");
    expect(loaded?.userId).toBe("test-user");

    const updated = await storage.save({
      entryDate: "2026-07-21",
      content: "수정됨",
      overallSatisfaction: 5,
      moodLabel: "기쁨",
      mainEventText: null,
      scores: [
        { categoryCode: "energy", rawScore: 5, isNotApplicable: false },
      ],
      tagCodes: ["family"],
      existingId: created.id,
    });
    expect(updated.id).toBe(created.id);
    expect(updated.content).toBe("수정됨");
    expect(updated.tags).toHaveLength(1);

    const list = await storage.list();
    expect(list.filter((e) => e.entryDate === "2026-07-21")).toHaveLength(1);
  });

  test("사용자 격리: 다른 userId 항목과 섞이지 않음(메모리 단일 유저)", async () => {
    const storage = new MemoryJournalStorage();
    await storage.save({
      entryDate: "2026-01-01",
      content: "mine",
      overallSatisfaction: 3,
      moodLabel: null,
      mainEventText: null,
      scores: [],
      tagCodes: [],
    });
    const all = await storage.list();
    expect(all.every((e) => e.userId === "test-user")).toBe(true);
  });

  test("태그 검증", () => {
    expect(validateTagCodes(["rest", "family"]).ok).toBe(true);
    expect(validateTagCodes(["not_a_real_tag"]).ok).toBe(false);
  });
});

describe("feature flag new diary default OFF", () => {
  test("기본 OFF", () => {
    expect(DEFAULT_FEATURE_FLAGS.newDiaryEnabled).toBe(false);
    expect(isNewDiaryEnabled()).toBe(false);
  });
});
