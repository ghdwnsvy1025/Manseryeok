import type { Element } from "@/lib/saju/constants";
import type { CanonicalKeywordCode } from "@/lib/journal/keywords/canonical";
import type { DayMasterStrength } from "./types";

const FIXED: Record<Element, CanonicalKeywordCode[]> = {
  wood: ["execution", "self_direction", "change_acceptance"],
  fire: ["vitality", "emotion_expression", "achievement"],
  earth: ["stability", "responsibility_regulation", "focus"],
  metal: ["decision_organize", "relation_boundary", "finance_manage"],
  water: ["recovery", "emotion_awareness", "reflection_meaning"],
};

/**
 * 사주 규칙 결과를 16 키워드로 변환.
 * 사주 용어는 reason에만 남기고, code는 canonical만 사용.
 */
export function mapRuleToKeywords(input: {
  dayMasterElement: Element;
  strength: DayMasterStrength;
  yong: Element;
  hee: Element;
  gi: Element;
  central: Element;
  isolatedCount: number;
}): Array<{ code: CanonicalKeywordCode; weight: number; reason: string }> {
  void input.dayMasterElement;
  const scores = new Map<
    CanonicalKeywordCode,
    { weight: number; reason: string }
  >();

  const bump = (
    code: CanonicalKeywordCode,
    weight: number,
    reason: string
  ) => {
    const prev = scores.get(code);
    if (!prev || weight > prev.weight) {
      scores.set(code, { weight, reason });
    } else {
      scores.set(code, {
        weight: Math.min(1, prev.weight + weight * 0.3),
        reason: prev.reason,
      });
    }
  };

  for (const code of FIXED[input.yong]) {
    bump(code, 0.85, "용신 후보 오행");
  }
  for (const code of FIXED[input.hee]) {
    bump(code, 0.55, "희신(조절 자원) 오행");
  }
  for (const code of FIXED[input.central]) {
    bump(code, 0.45, "중심 기운");
  }

  if (input.strength === "weak") {
    bump("recovery", 0.7, "일간 세력이 약함");
    bump("stability", 0.5, "일간 세력이 약함");
  } else if (input.strength === "strong") {
    bump("execution", 0.65, "일간 세력이 강함");
    bump("responsibility_regulation", 0.55, "과사용 조절 필요");
  }

  if (input.isolatedCount > 0) {
    bump("relation_boundary", 0.4, "고립 글자 존재");
    bump("emotion_awareness", 0.35, "고립 글자 존재");
  }

  bump("responsibility_regulation", 0.3, "기신 과사용 주의");
  void FIXED[input.gi];

  return [...scores.entries()]
    .map(([code, v]) => ({
      code,
      weight: Math.round(v.weight * 100) / 100,
      reason: v.reason,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
}
