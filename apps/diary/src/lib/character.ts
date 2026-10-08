// 내 캐릭터 = 일주 캐릭터 (톤 v3.3 / 07-내캐릭터). 가입 때 정해지고 바뀌지 않는다.
// 그림은 바이럴 60갑자 세트 복사본: public/characters/{간지}.webp (동물만), public/cards-square/{간지}.webp (정사각 카드(능력·설명 없음, 1080×1080)).
import type { PillarsSnapshot } from "./profile";

/** 지지 한글 → 동물 (07 명세 표). 子쥐 丑소 寅호랑이 卯토끼 辰용 巳뱀 午말 未양 申원숭이 酉닭 戌개 亥돼지 */
export const BRANCH_ANIMAL: Record<string, string> = {
  자: "쥐",
  축: "소",
  인: "호랑이",
  묘: "토끼",
  진: "용",
  사: "뱀",
  오: "말",
  미: "양",
  신: "원숭이",
  유: "닭",
  술: "개",
  해: "돼지",
};

export interface MyCharacter {
  /** 일주 한글 ("기축") */
  ganjiKo: string;
  /** 지지 동물 ("소") */
  animal: string;
  /** 동물만 그려진 그림 (제목 옆·로딩·격자 칸) */
  characterSrc: string;
  /** 정사각 카드(능력·설명 없음, 1080×1080) (팡·welcome·나 화면 머리·공유 카드) */
  cardSrc: string;
}

/** 간지 한글 → 캐릭터. 프로필이 없어도 간지만 알면 쓸 수 있다 */
export function characterOfGanji(ganjiKo: string): MyCharacter {
  const branch = ganjiKo.slice(-1);
  return {
    ganjiKo,
    animal: BRANCH_ANIMAL[branch] ?? "",
    characterSrc: `/characters/${ganjiKo}.webp`,
    cardSrc: `/cards-square/${ganjiKo}.webp`,
  };
}

/** 프로필의 네 기둥 → 내 캐릭터 (일주 기준) */
export function characterOf(pillars: PillarsSnapshot): MyCharacter {
  return characterOfGanji(pillars.day.ko);
}

/**
 * 오늘 화면 제목 아래 한 줄 (00 v3.3 "60칸 띠 삭제"):
 * "60갑자 중 51번째 · 기록 12일째". 기록이 없으면 "60갑자 중 51번째 · 첫 기록을 기다려요".
 * @param todayIndex 오늘 일진의 60갑자 순번 (甲子 = 0)
 * @param entryCount 지금까지 기록한 날 수
 */
export function todayLine(todayIndex: number, entryCount: number): string {
  const nth = `60갑자 중 ${todayIndex + 1}번째`;
  return entryCount > 0 ? `${nth} · 기록 ${entryCount}일째` : `${nth} · 첫 기록을 기다려요`;
}
