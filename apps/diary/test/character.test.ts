// 내 캐릭터 (톤 v3.3 / 07-내캐릭터): 일주 → 동물·그림 경로, 오늘 화면 한 줄
import { describe, expect, test } from "vitest";
import { BRANCH_ANIMAL, characterOf, characterOfGanji, todayLine } from "@/lib/character";

describe("characterOf", () => {
  test("일주 기축 → 소, characters/cards 경로", () => {
    const me = characterOf({
      year: { stem: "乙", branch: "亥", ko: "을해" },
      month: { stem: "己", branch: "卯", ko: "기묘" },
      day: { stem: "己", branch: "丑", ko: "기축" },
      hour: null,
    });
    expect(me).toEqual({ ganjiKo: "기축", animal: "소", characterSrc: "/characters/기축.webp", cardSrc: "/cards/기축.webp" });
  });

  test("12지지 전부 동물이 있다 (07 명세 표)", () => {
    expect(Object.keys(BRANCH_ANIMAL)).toHaveLength(12);
    expect(characterOfGanji("갑자").animal).toBe("쥐");
    expect(characterOfGanji("병인").animal).toBe("호랑이");
    expect(characterOfGanji("계해").animal).toBe("돼지");
  });
});

describe("todayLine (오늘 화면 제목 아래 한 줄)", () => {
  test("기록이 있으면 '기록 N일째'", () => {
    expect(todayLine(50, 12)).toBe("60갑자 중 51번째 · 기록 12일째");
  });
  test("기록이 없으면 '첫 기록을 기다려요'", () => {
    expect(todayLine(50, 0)).toBe("60갑자 중 51번째 · 첫 기록을 기다려요");
    expect(todayLine(0, 0)).toBe("60갑자 중 1번째 · 첫 기록을 기다려요");
  });
});
