/**
 * 원국 → 이 사람에게 던질 가설 카드 선택
 *
 * 선택 기준
 * 1. requires 를 만족하는 규칙만
 * 2. weight 높은 순
 * 3. 다양성 — 같은 지표·같은 십신 가족에 몰리지 않게
 * 4. 매일 기록되는 지표(핵심 4 + 행복도)를 앞쪽에 — 빨리 검증되어야 훅이 산다
 */
import { HYPOTHESIS_CATALOG } from "./catalog";
import { METRICS, type GodFamily, type HypothesisRule, type MetricCode, type NatalSummary } from "./types";
import { describeElement } from "./dayFacts";
import { withIGa } from "./josa";

/** 한 사람에게 보여줄 카드 수 */
export const DEFAULT_CARD_COUNT = 10;

/** 같은 지표로 만들 수 있는 카드 최대 수 */
const MAX_PER_METRIC = 2;
/** 같은 십신 가족 조건의 카드 최대 수 */
const MAX_PER_FAMILY = 3;

function satisfiesRequirement(rule: HypothesisRule, natal: NatalSummary): boolean {
  const req = rule.requires;
  switch (req.kind) {
    case "always":
      return true;
    case "family_min":
      return natal.familyCounts[req.family] >= req.min;
    case "family_max":
      return natal.familyCounts[req.family] <= req.max;
    // 최저/최고 오행이 동률이면 이 카드를 뽑지 않는다.
    // 넷이 13%로 같은데 그중 하나를 집어 "당신에게 부족한 기운"이라고 말하면,
    // 사주를 아는 사용자가 원국을 보는 순간 근거가 무너진다.
    // 근거를 못 대는 카드는 한 장도 내보내지 않는 편이 낫다.
    case "element_weakest":
      return !natal.weakestIsTied;
    case "element_strongest":
      return !natal.strongestIsTied;
    // 용신을 못 구한 원국(간지가 깨졌거나 계산 실패)에는 이 카드를 내지 않는다
    case "yongsin_exists":
      return natal.yongsin != null;
    default:
      return false;
  }
}

/** 오행 이름을 사람 말로 — "목" → "나무(木)" */
const ELEMENT_KO_WORD: Record<string, string> = {
  목: "나무(木)",
  화: "불(火)",
  토: "흙(土)",
  금: "쇠(金)",
  수: "물(水)",
};

/**
 * 용신 규칙의 근거 문장을 이 사람의 실제 값으로 채운다.
 *
 * 카탈로그에는 "사주의 균형을 잡아 주는 기운"이라고만 적혀 있다.
 * 그 자리에 **어떤 오행이 왜 용신인지, 어떤 간지가 오는 날인지**를 넣어야
 * 이 앱의 원칙("근거를 반드시 보여준다")이 지켜진다.
 */
function specializeYongsin(rule: HypothesisRule, natal: NatalSummary): HypothesisRule {
  const y = natal.yongsin;
  if (!y) return rule;

  const dominant = ELEMENT_KO_WORD[y.dominantKo] ?? y.dominantKo;
  const element = ELEMENT_KO_WORD[y.elementKo] ?? y.elementKo;
  const ganji = y.ganjiHanja.join("·");

  // 간지 목록을 두 문장에 다 넣으면 "甲·乙·寅·卯가 들어오는 날"이 연달아 두 번 나온다.
  // 한 번만 말한다.
  const where = y.fromTZone
    ? `${ganji}로 이미 사주 안에 있고, ${ganji}가 들어오는 날이 이 카드가 보는 날입니다.`
    : `사주 안에는 없어서, ${ganji}가 들어오는 날이 그 자리를 대신합니다.`;

  return {
    ...rule,
    copy: {
      ...rule.copy,
      basis:
        `원국에서 ${dominant} 기운이 ${y.dominantPercent}%로 가장 많습니다. ` +
        `그걸 눌러 주는 ${element} 기운이 용신이에요. ${where}`,
    },
  };
}

/** 오행 규칙은 카탈로그의 자리표시자를 이 사람의 실제 오행으로 바꾼다 */
function specialize(rule: HypothesisRule, natal: NatalSummary): HypothesisRule {
  if (rule.condition.kind === "yongsin") return specializeYongsin(rule, natal);
  if (rule.condition.kind !== "element") return rule;

  const element =
    rule.requires.kind === "element_weakest"
      ? natal.weakestElement
      : natal.strongestElement;

  const isWeakest = rule.requires.kind === "element_weakest";
  const elementLabel = describeElement(element);
  const percent = Math.round(natal.elementRatio[element] * 100);

  // 여기 도달했다는 건 satisfiesRequirement 가 동률을 이미 걸러냈다는 뜻이다.
  // 즉 이 오행은 유일한 최저/최고이므로 "가장"이라고 단정해도 된다.
  // 카탈로그의 {elementPhrase} 자리에 들어갈 말.
  // "이미 강한"은 그 자체로 뜻이 서므로 "가장"을 덧붙이지 않는다.
  const elementPhrase = isWeakest
    ? `가장 부족한 ${elementLabel} 기운이`
    : `이미 강한 ${elementLabel} 기운이`;

  const amountPhrase = isWeakest ? "가장 적습니다" : "가장 많습니다";

  const fill = (text: string): string =>
    text.replace(/\{elementPhrase\}/g, elementPhrase);

  return {
    ...rule,
    condition: { kind: "element", element },
    copy: {
      claim: fill(rule.copy.claim),
      confirmed: fill(rule.copy.confirmed),
      exception: fill(rule.copy.exception),
      neutral: fill(rule.copy.neutral),
      basis: isWeakest
        ? `원국에서 ${withIGa(elementLabel)} ${percent}%로 ${amountPhrase}. 그날 ${withIGa(elementLabel)} 들어오면 균형이 맞춰집니다.`
        : `원국에서 ${withIGa(elementLabel)} ${percent}%로 ${amountPhrase}. 그날 ${withIGa(elementLabel)} 또 들어오면 한쪽으로 쏠립니다.`,
    },
  };
}

/** 규칙이 어떤 십신 가족을 조건으로 쓰는지 (없으면 null) */
function conditionFamily(rule: HypothesisRule): GodFamily | null {
  const c = rule.condition;
  if (c.kind === "stem_family" || c.kind === "branch_family" || c.kind === "any_family") {
    return c.family;
  }
  return null;
}

/**
 * 정렬 점수 — weight 를 기본으로 하되,
 * 매일 기록되는 지표에 가산점을 준다(검증이 빨리 끝나야 이탈하지 않는다).
 */
function sortScore(rule: HypothesisRule, natal: NatalSummary): number {
  let score = rule.weight;

  if (METRICS[rule.metric].daily) score += 3;

  // 원국에서 두드러지는 가족일수록 이 사람에게 할 말이 많다
  const family = conditionFamily(rule);
  if (family) {
    score += Math.min(natal.familyCounts[family], 6) * 0.5;
  }

  return score;
}

export function generateHypotheses(
  natal: NatalSummary,
  count: number = DEFAULT_CARD_COUNT
): HypothesisRule[] {
  const eligible = HYPOTHESIS_CATALOG
    .filter((rule) => satisfiesRequirement(rule, natal))
    .map((rule) => specialize(rule, natal))
    .sort((a, b) => sortScore(b, natal) - sortScore(a, natal));

  const picked: HypothesisRule[] = [];
  const perMetric = new Map<MetricCode, number>();
  const perFamily = new Map<GodFamily, number>();

  for (const rule of eligible) {
    if (picked.length >= count) break;

    const metricUsed = perMetric.get(rule.metric) ?? 0;
    if (metricUsed >= MAX_PER_METRIC) continue;

    const family = conditionFamily(rule);
    if (family) {
      const familyUsed = perFamily.get(family) ?? 0;
      if (familyUsed >= MAX_PER_FAMILY) continue;
      perFamily.set(family, familyUsed + 1);
    }

    perMetric.set(rule.metric, metricUsed + 1);
    picked.push(rule);
  }

  return picked;
}
