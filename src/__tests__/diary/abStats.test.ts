import { createDiaryEntry } from "@/lib/diary/createEntry";
import { normalizeDiaryEntry } from "@/lib/diary/migrate";
import {
  aggregateByStem,
  aggregateByBranch,
  aggregateByGanji,
  aggregateByTenGod,
} from "@/lib/diary/abStats";
import { buildDailySajuContext, formatBLinkCopy } from "@/lib/product/dailySajuContext";
import { buildMockDiaryEntries } from "@/mocks/diary";

describe("DailySajuContext", () => {
  test("날짜만으로 천간·지지·간지를 채운다", () => {
    const ctx = buildDailySajuContext("2026-07-20", null);
    expect(ctx.ganjiKo.length).toBeGreaterThan(0);
    expect(ctx.stemKo.length).toBeGreaterThan(0);
    expect(ctx.branchKo.length).toBeGreaterThan(0);
    expect(ctx.tenGod).toBeNull();
  });

  test("plain 문구와 사주 문구가 다르다", () => {
    const ctx = buildDailySajuContext("2026-07-20", null);
    const plain = formatBLinkCopy(ctx, true);
    const saju = formatBLinkCopy(ctx, false);
    expect(plain).toContain("흐름");
    expect(saju).toContain("천간");
  });
});

describe("focusRating persist via normalize", () => {
  test("focusRating이 정규화 후 유지된다", () => {
    const entry = createDiaryEntry("2026-07-20", "테스트", {
      happinessRating: 4,
      focusRating: 5,
      energyRating: 3,
      primaryArea: "일",
      tags: ["몰입"],
    });
    const normalized = normalizeDiaryEntry(entry as unknown as Record<string, unknown>);
    expect(normalized.focusRating).toBe(5);
    expect(normalized.energyRating).toBe(3);
    expect(normalized.heavenlyStem).toBeTruthy();
    expect(normalized.earthlyBranch).toBeTruthy();
  });

  test("weatherMetadata.focusRating 폴백", () => {
    const entry = createDiaryEntry("2026-07-19", "메타", {
      happinessRating: 3,
    });
    const raw = {
      ...entry,
      focusRating: undefined,
      weatherMetadata: { focusRating: 2 },
    };
    const normalized = normalizeDiaryEntry(raw as unknown as Record<string, unknown>);
    expect(normalized.focusRating).toBe(2);
  });
});

describe("abStats", () => {
  const entries = buildMockDiaryEntries("records_15", "2026-07-20");

  test("천간 10개 집계", () => {
    const stems = aggregateByStem(entries);
    expect(stems).toHaveLength(10);
    const withData = stems.filter((s) => s.uniqueDays > 0);
    expect(withData.length).toBeGreaterThan(0);
  });

  test("지지 12개 집계", () => {
    const branches = aggregateByBranch(entries);
    expect(branches).toHaveLength(12);
  });

  test("간지 단건 요약", () => {
    const ganjiKo = entries[0].dayPillar.ganjiKo;
    const stats = aggregateByGanji(entries, ganjiKo);
    expect(stats.uniqueDays).toBeGreaterThanOrEqual(1);
    expect(stats.key).toBe(ganjiKo);
  });

  test("십신은 프로필 없으면 전부", () => {
    const gods = aggregateByTenGod(entries, null);
    expect(gods).toHaveLength(10);
    expect(gods.every((g) => g.uniqueDays === 0)).toBe(true);
  });
});
