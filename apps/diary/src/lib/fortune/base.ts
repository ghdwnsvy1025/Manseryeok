// 오늘 일진 × 내 사주 → 기본 점수. 전부 엔진 계산이고 모델 호출은 없다.
//
// 점수는 0.5(보통)에서 시작해 세 가지로 움직인다.
//   1. 오늘 천간이 내 일간에게 어떤 십신인가 (가장 큰 축)
//   2. 오늘 지지가 내 일지·월지와 합인가 충인가
//   3. 오늘 글자가 내 용신(모자란 쪽)인가 기신(이미 많은 쪽)인가
// 길흉 예언이 아니라 "오늘이 평소보다 수월한가"의 정도다. 범위는 0.15~0.90으로 자른다.
import { BRANCH_META, STEM_META, findYongsin, getTenGod, type StemHanja, type TenGod } from "@saju/engine";
import type { PillarsSnapshot } from "../profile";
import type { BaseFortune, BranchRelation, TenGodFamily, YongsinHit } from "./types";

export const FAMILY_OF: Record<TenGod, TenGodFamily> = {
  비견: "비겁",
  겁재: "비겁",
  식신: "식상",
  상관: "식상",
  편재: "재성",
  정재: "재성",
  편관: "관성",
  정관: "관성",
  편인: "인성",
  정인: "인성",
};

/** 십신별 기본 가감. 레거시 점수표(support≈0.66, tension≈0.40~0.46)를 한 축으로 줄인 값 */
const TEN_GOD_OFFSET: Record<TenGod, number> = {
  비견: 0.03,
  겁재: -0.04,
  식신: 0.08,
  상관: -0.02,
  편재: 0.05,
  정재: 0.08,
  편관: -0.07,
  정관: 0.03,
  편인: 0.02,
  정인: 0.06,
};

/** 십신을 생활어로. 사용자 문장에는 이 말을 쓴다 */
export const TEN_GOD_THEME: Record<TenGod, string> = {
  비견: "내 속도",
  겁재: "경쟁과 추진",
  식신: "표현과 여유",
  상관: "날카로운 말",
  편재: "기회와 확장",
  정재: "차곡차곡",
  편관: "압박과 책임",
  정관: "약속과 역할",
  편인: "혼자 생각",
  정인: "배움과 쉼",
};

const YUKHAP: Record<string, string> = {
  子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯",
  辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午",
};
const CHUNG: Record<string, string> = {
  子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅",
  卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳",
};
const SAMHAP_GROUPS = [
  ["申", "子", "辰"],
  ["亥", "卯", "未"],
  ["寅", "午", "戌"],
  ["巳", "酉", "丑"],
];

export function branchRelation(mine: string, today: string): BranchRelation {
  if (mine === today) return "복음";
  if (YUKHAP[mine] === today) return "육합";
  if (CHUNG[mine] === today) return "충";
  if (SAMHAP_GROUPS.some((g) => g.includes(mine) && g.includes(today))) return "삼합";
  return null;
}

const RELATION_OFFSET: Record<Exclude<BranchRelation, null>, number> = {
  육합: 0.06,
  삼합: 0.04,
  충: -0.08,
  복음: 0,
};

const ELEMENT_KO: Record<string, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function toKo(p: { stem: string; branch: string }) {
  return { stemKo: STEM_META[p.stem]!.ko, branchKo: BRANCH_META[p.branch]!.ko };
}

export function computeBaseFortune(
  pillars: PillarsSnapshot,
  today: { stem: string; branch: string; ko: string },
): BaseFortune {
  const dayStem = pillars.day.stem;
  const tenGod = getTenGod(dayStem as StemHanja, today.stem as StemHanja);
  const family = FAMILY_OF[tenGod];
  const facts: string[] = [];
  let score = 0.5 + TEN_GOD_OFFSET[tenGod];
  facts.push(`오늘 천간 ${today.stem}은 내 일간 ${dayStem}에게 '${TEN_GOD_THEME[tenGod]}'에 해당해요(${tenGod}).`);

  const relation = branchRelation(pillars.day.branch, today.branch);
  if (relation) {
    score += RELATION_OFFSET[relation];
    const word = { 육합: "잘 맞물려요", 삼합: "한편이 돼요", 충: "부딪혀요", 복음: "같은 글자예요" }[relation];
    facts.push(`오늘 지지 ${today.branch}는 내 일지 ${pillars.day.branch}와 ${word}(${relation}).`);
  }
  const monthRelation = branchRelation(pillars.month.branch, today.branch);
  if (monthRelation && monthRelation !== "복음") {
    score += RELATION_OFFSET[monthRelation] / 2;
    facts.push(`내 월지 ${pillars.month.branch}와는 ${monthRelation}이에요.`);
  }

  let yongsin: YongsinHit = null;
  const y = findYongsin({
    year: toKo(pillars.year),
    month: toKo(pillars.month),
    day: toKo(pillars.day),
    hour: pillars.hour ? toKo(pillars.hour) : null,
  });
  if (y) {
    const todayElements = new Set([ELEMENT_KO[STEM_META[today.stem]!.element], ELEMENT_KO[BRANCH_META[today.branch]!.element]]);
    if (todayElements.has(y.element)) {
      yongsin = "용신";
      score += todayElements.size === 1 ? 0.1 : 0.07;
      facts.push(`오늘 글자에 내 사주에 모자란 ${y.element} 기운이 들어 있어요(용신).`);
    } else if (todayElements.has(y.dominant)) {
      yongsin = "기신";
      score -= 0.05;
      facts.push(`오늘 글자에 내 사주에 이미 많은 ${y.dominant} 기운이 더해져요(기신).`);
    }
  }

  return { score: clamp(score, 0.15, 0.9), tenGod, family, relation, monthRelation, yongsin, facts };
}
