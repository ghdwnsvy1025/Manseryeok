/**
 * 원국을 전문용어 없이 두 줄로.
 *
 * 왜 필요한가 —
 * "나" 탭을 열었을 때 첫 화면이 `辛 식신 未 비견 丁 乙 己` 이면
 * 이 앱을 쓰는 사람 대부분은 거기서 닫는다. 기존 `/saju` 화면이 정확히 그렇다.
 * 그 화면을 지우지는 않는다 — 대신 **읽을 수 있는 말이 먼저 오고,
 * 원국 표는 "자세히" 뒤로 보낸다.**
 *
 * 지어내지 않는 것 —
 * 용신·조후·신강신약은 명리 판단이 필요해 아직 못 한다.
 * 여기서는 계산으로 확실한 것(일간 오행, 오행 비율)만 말한다.
 * 동률이면 "가장"이라고 단정하지 않는다.
 */
import type { Element } from "@/lib/saju/constants";
import { withEunNeun, withIGa } from "./josa";
import type { NatalSummary } from "./types";

/** 괄호 없는 순한글 오행 이름 — 문장 안에서 읽히라고 */
const ELEMENT_WORD: Record<Element, string> = {
  wood: "나무",
  fire: "불",
  earth: "흙",
  metal: "쇠",
  water: "물",
};

/** 한자를 붙인 이름 — 제목처럼 한 번만 쓸 때 */
const ELEMENT_WORD_HANJA: Record<Element, string> = {
  wood: "나무(木)",
  fire: "불(火)",
  earth: "흙(土)",
  metal: "쇠(金)",
  water: "물(水)",
};

/**
 * 비율 차이가 이보다 작으면 "넉넉하다 / 적다"고 말하지 않는다.
 * 오행 5개가 완전히 고르면 각 20%다. 여기서 6%p는 눈에 띄는 쏠림의 하한선.
 */
const NOTABLE_GAP = 0.06;

/**
 * 이보다 작으면 화면에 0%로 찍힌다. 그때 "적은 편"이라고 하면 말과 그림이 어긋난다.
 * 아예 없는 것은 적은 것보다 훨씬 할 말이 많은 사실이라 따로 말해 준다.
 */
const ABSENT = 0.005;

export type NatalPlain = {
  /** 무엇을 타고났는가 — 한 줄 */
  origin: string;
  /** 기운이 어떻게 쏠려 있는가 — 한 줄 */
  balance: string;
};

export function natalPlainLines(natal: NatalSummary): NatalPlain {
  const origin = `${ELEMENT_WORD_HANJA[natal.dayMasterElement]}의 기운을 타고났어요`;

  const strong = natal.elementRatio[natal.strongestElement];
  const weak = natal.elementRatio[natal.weakestElement];
  const spread = strong - weak;

  // 쏠림이 없거나 동률이면 단정하지 않는다.
  if (spread < NOTABLE_GAP || (natal.strongestIsTied && natal.weakestIsTied)) {
    return { origin, balance: "다섯 기운이 고르게 퍼져 있어요" };
  }

  const strongWord = ELEMENT_WORD[natal.strongestElement];
  const weakWord = ELEMENT_WORD[natal.weakestElement];
  const weakPhrase =
    weak < ABSENT
      ? `${withEunNeun(weakWord)} 아예 없어요`
      : `${withIGa(weakWord)} 적은 편이에요`;

  // 한쪽만 동률이면 그쪽은 말하지 않는다 (둘 중 하나만 골라 단정하면 거짓말이 된다)
  if (natal.strongestIsTied) {
    return { origin, balance: weakPhrase };
  }
  if (natal.weakestIsTied) {
    return { origin, balance: `${withIGa(strongWord)} 넉넉한 편이에요` };
  }

  return {
    origin,
    balance: `${withIGa(strongWord)} 넉넉하고, ${weakPhrase}`,
  };
}
