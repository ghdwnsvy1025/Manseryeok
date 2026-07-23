import {
  progressFromTotalXp,
  scoreEntryXp,
  totalPersonalizationXp,
  xpCostToNext,
  cumulativeXpForLevel,
  PERSONALIZATION_MAX_LEVEL,
} from "@/lib/product/personalizationLevel";
import { createDiaryEntry } from "@/lib/diary/createEntry";

describe("personalizationLevel", () => {
  test("초반 레벨 비용이 후반보다 작다", () => {
    expect(xpCostToNext(0)).toBeLessThan(xpCostToNext(5));
    expect(xpCostToNext(5)).toBeLessThan(xpCostToNext(9));
  });

  test("Lv10 누적 XP는 약 1년 목표 수준 (하루 ~18XP)", () => {
    const max = cumulativeXpForLevel(PERSONALIZATION_MAX_LEVEL);
    expect(PERSONALIZATION_MAX_LEVEL).toBe(10);
    expect(xpCostToNext(0)).toBe(180); // ≈10일
    expect(max).toBeGreaterThan(5000);
    expect(max).toBeLessThan(20000);
  });

  test("구체 기록이 빈 기록보다 XP가 높다", () => {
    const bare = scoreEntryXp(createDiaryEntry("2026-01-01", ""));
    const rich = scoreEntryXp(
      createDiaryEntry(
        "2026-01-01",
        "오늘은 업무 마감과 운동을 했고 컨디션이 괜찮았다.",
        {
          happinessRating: 4,
          energyRating: 3,
          focusRating: 4,
          conditionRating: 4,
          primaryArea: "일",
          emotions: ["기쁨", "뿌듯"],
          tags: ["마감"],
        }
      )
    );
    expect(rich).toBeGreaterThan(bare + 10);
  });

  test("demo는 XP 0, 같은 날짜는 최고점만", () => {
    const demo = createDiaryEntry("2026-01-01", "demo", {
      happinessRating: 5,
      dataOrigin: "demo",
    });
    const a = createDiaryEntry("2026-01-02", "짧음", {
      happinessRating: 3,
    });
    const b = createDiaryEntry(
      "2026-01-02",
      "더 길고 자세한 기록입니다. ".repeat(5),
      {
        happinessRating: 5,
        energyRating: 4,
        focusRating: 5,
        conditionRating: 5,
        primaryArea: "공부",
        emotions: ["집중"],
      }
    );
    expect(scoreEntryXp(demo)).toBe(0);
    expect(totalPersonalizationXp([demo, a, b])).toBe(scoreEntryXp(b));
  });

  test("progressFromTotalXp 레벨 경계", () => {
    expect(progressFromTotalXp(0).level).toBe(0);
    const atL5 = cumulativeXpForLevel(5);
    expect(progressFromTotalXp(atL5).level).toBe(5);
    expect(progressFromTotalXp(atL5).xpIntoLevel).toBe(0);
    const max = cumulativeXpForLevel(10);
    expect(progressFromTotalXp(max).isMax).toBe(true);
    expect(progressFromTotalXp(max).level).toBe(10);
  });
});
