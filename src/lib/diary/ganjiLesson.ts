import { BRANCH_META, ELEMENT_LABELS, STEM_META } from "@/lib/saju/constants";
import type { DiaryDayPillar } from "./types";

const ZODIAC_HINT: Record<string, string> = {
  자: "차분히 내면을 다지기",
  축: "꾸준히 쌓아가기",
  인: "새 바람을 맞이하기",
  묘: "섬세하게 관계 챙기기",
  진: "변화 속에서 중심 잡기",
  사: "집중과 통찰에 유리",
  오: "에너지를 밖으로 펼치기",
  미: "돌봄과 정리에 좋음",
  신: "기민하게 판단하기",
  유: "디테일과 완성도 챙기기",
  술: "마무리와 책임감",
  해: "휴식과 영감 받기",
};

export function getGanjiLesson(dayPillar: DiaryDayPillar): {
  title: string;
  body: string;
} {
  const stemMeta = STEM_META[dayPillar.stem.hanja];
  const branchMeta = BRANCH_META[dayPillar.branch.hanja];
  const stemKo = dayPillar.stem.ko;
  const branchKo = dayPillar.branch.ko;
  const ganjiKo = dayPillar.ganjiKo;

  const stemEl = stemMeta ? ELEMENT_LABELS[stemMeta.element] : "";
  const branchEl = branchMeta ? ELEMENT_LABELS[branchMeta.element] : "";
  const zodiac = branchMeta?.zodiacKo ?? "";
  const branchHint = ZODIAC_HINT[branchKo] ?? "오늘의 지지 기운을 느껴 보세요";

  return {
    title: `오늘 ${ganjiKo}일 한 줄`,
    body: `${stemKo}(${stemEl}) + ${branchKo}(${branchEl}, ${zodiac}) — 하늘은 ${stemKo}, 땅은 ${branchKo}. ${branchHint}에 잘 맞는 날이에요.`,
  };
}
