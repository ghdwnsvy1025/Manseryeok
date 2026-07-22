import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";
import {
  ENERGY_RATING_LABELS,
  type EnergyRating,
} from "@/lib/diary/types";
import { HAPPINESS_RATING_LABELS } from "@/lib/diary/happiness";
import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { MATURITY_LABELS, resolveMaturity } from "./maturity";
import {
  averageEnergy,
  averageHappiness,
  findSimilarDays,
  topTags,
} from "./similarDays";
import { summarizeRecentState } from "./recentState";
import { buildTomorrowSajuContext } from "./tomorrowContext";
import { createForecastId } from "./storage";
import {
  FORECAST_MODEL_VERSION,
  FORECAST_RULE_VERSION,
  type DailyForecast,
  type ForecastDomainBlock,
  type NightReportPayload,
} from "./types";

const TEN_GOD_EMOTION: Record<string, string> = {
  비견: "자기 페이스를 지키려는 마음이 커질 수 있어요",
  겁재: "경쟁·비교 감각이 조금 예민해질 수 있어요",
  식신: "표현·대화하고 싶은 흐름이 있을 수 있어요",
  상관: "의견이 날카로워지거나 비판이 늘 수 있어요",
  편재: "새로운 만남·기회가 늘 수 있어요",
  정재: "현실적인 정리·관리에 마음이 갈 수 있어요",
  편관: "압박·기대를 평소보다 크게 느낄 수 있어요",
  정관: "책임·규칙을 의식하는 흐름일 수 있어요",
  편인: "생각이 많아지거나 혼자 정리하고 싶을 수 있어요",
  정인: "배움·돌봄·안정이 중요해질 수 있어요",
};

const TEN_GOD_FOCUS: Record<string, string> = {
  비견: "혼자 끝낼 수 있는 일에 집중하면 좋아요",
  겁재: "우선순위를 분명히 정해두면 산만함을 줄일 수 있어요",
  식신: "아이디어를 메모해두면 집중이 이어질 수 있어요",
  상관: "비판보다 개선 포인트 한 가지에 집중해보세요",
  편재: "새 일보다 진행 중인 일 하나를 마무리해보세요",
  정재: "체크리스트로 해야 할 일을 정리하면 좋아요",
  편관: "반드시 끝낼 한 가지만 먼저 정해보세요",
  정관: "마감·약속 시간을 명확히 하면 집중이 올라가요",
  편인: "방해받지 않는 짧은 집중 시간을 확보해보세요",
  정인: "자료를 정리하거나 배우는 일에 에너지가 모일 수 있어요",
};

const TEN_GOD_CONDITION: Record<string, string> = {
  비견: "페이스를 지키되 무리한 비교는 줄여보세요",
  겁재: "긴장되면 짧은 휴식을 끼워보세요",
  식신: "활동 후 회복 시간을 남겨두면 좋아요",
  상관: "과열되지 않도록 호흡을 가다듬어보세요",
  편재: "이동·만남이 많으면 저녁 피로가 커질 수 있어요",
  정재: "생활 리듬을 일정하게 가져가면 도움이 됩니다",
  편관: "오전보다 저녁에 피로가 빠르게 쌓일 수 있어요",
  정관: "책임감이 커져도 회복 시간을 빼놓지 마세요",
  편인: "생각이 많아지면 수면 리듬을 우선해도 좋아요",
  정인: "회복과 돌봄에 시간을 써도 괜찮아요",
};

const AREA_SIGNAL: Record<string, string> = {
  일: "겉으로는 업무량 때문이라고 느껴도, ‘혼자 책임지고 있다’는 느낌이 더 컸을 가능성이 있어요.",
  관계: "관계에서 필요한 것은 더 많은 대화보다, 의도가 분명하다는 확신일 수 있어요.",
  연애: "상대의 반응을 기다리는 시간이 감정에 더 크게 영향을 주었을 수 있어요.",
  가족: "돌봄과 내 경계 사이에서 균형이 흔들렸을 가능성이 있어요.",
  돈: "숫자 자체보다 ‘선택이 좁혀진 느낌’이 부담으로 작용했을 수 있어요.",
  공부: "성과보다 ‘진전이 보이는지’에 대한 확인이 필요했을 수 있어요.",
  "건강·컨디션": "몸의 피로와 마음의 긴장이 함께 쌓였을 가능성이 있어요.",
  "나 자신": "바깥 일보다 내 페이스를 지키고 싶은 마음이 컸을 수 있어요.",
  "특별한 일 없음": "큰 사건보다 잔잔한 누적 피로가 마음에 남았을 수 있어요.",
};

function block(
  forecast: string,
  traditional: string,
  observed: string | null,
  recent: string | null,
  caveat: string
): ForecastDomainBlock {
  const evidence: ForecastDomainBlock["evidence"] = [
    { kind: "traditional", text: traditional },
  ];
  if (observed) evidence.push({ kind: "observed", text: observed });
  if (recent) evidence.push({ kind: "recent", text: recent });
  evidence.push({ kind: "caution", text: caveat });
  return { forecast, evidence, caveat };
}

function moodLabel(entry: DiaryEntry): string {
  const h = entry.happinessRating;
  if (h != null && h in HAPPINESS_RATING_LABELS) {
    return HAPPINESS_RATING_LABELS[h as 1 | 2 | 3 | 4 | 5];
  }
  return "기록된 기분";
}

export function buildLocalNightReport(input: {
  todayEntry: DiaryEntry;
  entries: DiaryEntry[];
  sajuProfile?: SajuProfile | null;
  existingForecastId?: string;
}): NightReportPayload {
  const { todayEntry, sajuProfile } = input;
  const realCount = filterRealEntries(input.entries).length;
  const maturity = resolveMaturity(realCount);
  const facts = buildTomorrowSajuContext({
    todayDate: todayEntry.date,
    sajuProfile,
  });
  const similar = findSimilarDays({
    entries: input.entries,
    targetGanjiKo: facts.ganjiKo,
    targetStemKo: facts.heavenlyStem,
    targetBranchKo: facts.earthlyBranch,
    targetTenGod: facts.tenGod,
    sajuProfile,
    excludeDate: todayEntry.date,
  });
  const recent = summarizeRecentState({
    entries: input.entries,
    todayDate: todayEntry.date,
    days: 7,
  });

  const tenGod = facts.tenGod;
  const area =
    typeof todayEntry.primaryArea === "string" ? todayEntry.primaryArea : null;
  const energy =
    todayEntry.energyRating != null
      ? ENERGY_RATING_LABELS[todayEntry.energyRating as EnergyRating]
      : null;

  const areaText = area ? `주요 영역은 ${area}` : "주요 영역은 특별히 지정되지 않았어요";
  const emotionText =
    (todayEntry.emotions ?? []).length > 0
      ? `감정 태그: ${(todayEntry.emotions ?? []).slice(0, 4).join(", ")}`
      : "감정 태그는 비어 있어요";
  const tagText =
    (todayEntry.tags ?? []).length > 0
      ? `사건 태그: ${(todayEntry.tags ?? []).slice(0, 4).join(", ")}`
      : null;

  const todaySummary = [
    `오늘은 기분이 「${moodLabel(todayEntry)}」으로 기록됐어요.`,
    energy ? `에너지는 「${energy}」.` : null,
    `${areaText}.`,
    emotionText + ".",
    tagText ? `${tagText}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const innerSignalText =
    (area && AREA_SIGNAL[area]) ||
    (tenGod
      ? `선택하신 태그와 흐름을 보면, ${TEN_GOD_EMOTION[tenGod] ?? "내면의 긴장이 있었을 수 있어요"}. 단정이 아니라 확인해보고 싶은 가설이에요.`
      : "겉으로 고른 기분과 달리, 하루 동안 ‘확인받지 못한 느낌’이 남아 있었을 가능성이 있어요. 가설이니 피드백을 남겨주세요.");

  const neededConditionText =
    area === "일" || area === "공부"
      ? "오늘 필요했던 것은 더 많은 일보다, 해야 할 일의 범위가 분명하다는 확신이었을 수 있어요."
      : area === "관계" || area === "연애" || area === "가족"
        ? "오늘 필요했던 것은 긴 대화보다, 서로의 의도가 분명하다는 느낌이었을 수 있어요."
        : "오늘 필요했던 것은 완벽한 해결보다, 잠시 회복할 여백이었을 수 있어요.";

  const avgH = averageHappiness(similar.primaryEntries);
  const avgE = averageEnergy(similar.primaryEntries);
  const similarTags = topTags(similar.primaryEntries, 3);
  const kindLabel =
    similar.primaryKind === "ganji"
      ? "같은 간지"
      : similar.primaryKind === "tenGod"
        ? "같은 십신"
        : similar.primaryKind === "stem"
          ? "같은 천간"
          : similar.primaryKind === "branch"
            ? "같은 지지"
            : "유사 조건";

  const observedEmotion =
    similar.primaryEntries.length > 0 && avgH != null
      ? `${kindLabel} 기록 ${similar.primaryEntries.length}회 평균 기분 ${avgH}점` +
        (similarTags.length ? `, 자주 등장: ${similarTags.join(", ")}` : "")
      : null;

  const observedEnergy =
    similar.primaryEntries.length > 0 && avgE != null
      ? `${kindLabel} 기록 평균 에너지 ${avgE}점`
      : null;

  const recentLowEnergy =
    recent.energyAvg != null && recent.energyAvg <= 2
      ? "최근 에너지가 낮은 편이어서 체감 피로는 더 클 수 있어요."
      : recent.moodAvg != null && recent.moodAvg <= 2.5
        ? "최근 기분이 낮은 편이어서 감정 기복이 더 크게 느껴질 수 있어요."
        : null;

  const emotionForecast = block(
    tenGod
      ? TEN_GOD_EMOTION[tenGod]
      : `내일(${facts.ganjiKo})은 감정 변화가 있을 수 있으니, 중요한 반응은 잠시 생각해보세요.`,
    tenGod
      ? `전통 명리: 내일 천간이 일간 기준 「${tenGod}」으로 작용합니다.`
      : `전통 명리: 내일 일진 ${facts.ganjiKo} (${facts.heavenlyStem}${facts.earthlyBranch}). 원국이 있으면 십신 개인화가 가능합니다.`,
    maturity === "base" ? null : observedEmotion,
    recentLowEnergy,
    "미래의 사건을 확정하지 않으며, 관찰을 돕는 예보입니다."
  );

  const focusForecast = block(
    tenGod
      ? TEN_GOD_FOCUS[tenGod]
      : "목표가 분명하면 집중이 이어질 수 있어요. 한 가지만 먼저 정해보세요.",
    tenGod
      ? `명리 참고: ${tenGod} 흐름에서의 집중·정리 경향`
      : `명리 참고: 내일 천간 ${facts.heavenlyStem}, 지지 ${facts.earthlyBranch}`,
    maturity === "base"
      ? null
      : similar.primaryEntries.length > 0
        ? `${kindLabel} ${similar.primaryEntries.length}회 기록을 참고했습니다.`
        : null,
    recent.entryCount > 0 ? recent.text : null,
    "업무·학업 성과를 보장하지 않습니다."
  );

  const conditionForecast = block(
    tenGod
      ? TEN_GOD_CONDITION[tenGod]
      : "활동과 회복의 균형을 맞춰보면 좋아요. 의료적 건강 예측이 아닙니다.",
    facts.relations[0]
      ? `관계 참고: ${facts.relations[0].label} — ${facts.relations[0].description}`
      : `오행·일진 참고: ${facts.ganjiKo}`,
    observedEnergy,
    recentLowEnergy ??
      (recent.conditionAvg != null
        ? `최근 평균 컨디션 ${recent.conditionAvg}점`
        : null),
    "질환·의료 문제를 예측하지 않습니다. 생활 에너지·피로 관찰용입니다."
  );

  const oneAction = {
    action: tenGod
      ? TEN_GOD_FOCUS[tenGod]
      : "내일 반드시 끝낼 일 한 가지만 아침에 적어보세요.",
    reason:
      "여러 조언보다 실행 가능한 한 가지가 다음 날 검증에 더 도움이 됩니다.",
  };

  const reflectionSentence =
    area === "일" || tenGod === "정관" || tenGod === "편관"
      ? "모든 것을 혼자 감당하는 것이 책임감의 증거는 아닙니다."
      : area === "관계" || area === "연애"
        ? "명확한 부탁은 관계를 부담스럽게 만들기보다 오해를 줄이는 방법일 수 있습니다."
        : "오늘의 기록은 나를 판단하기 위해서가 아니라, 내일의 리듬을 맞추기 위한 신호입니다.";

  const now = new Date().toISOString();
  const forecast: DailyForecast = {
    id: input.existingForecastId ?? createForecastId(),
    targetDate: facts.targetDate,
    sourceEntryId: todayEntry.id,
    sourceEntryDate: todayEntry.date,
    sajuProfileId: sajuProfile?.id ?? todayEntry.sajuProfileId ?? null,
    traditionalFacts: facts,
    maturity,
    sampleSizes: similar.sampleSizes,
    recentStateSummary: recent.text,
    todaySummary,
    innerSignal: { text: innerSignalText, isHypothesis: true },
    neededCondition: {
      text: neededConditionText,
      evidence: observedEmotion ? [observedEmotion] : [],
    },
    emotionForecast,
    focusForecast,
    conditionForecast,
    oneAction,
    reflectionSentence,
    disclaimer:
      "사주와 개인 기록을 바탕으로 한 참고 예보입니다. 미래 사건·의료·심리 진단을 확정하지 않습니다.",
    generationMode: "local",
    ruleVersion: FORECAST_RULE_VERSION,
    modelVersion: FORECAST_MODEL_VERSION,
    createdAt: now,
    updatedAt: now,
  };

  return {
    forecast,
    maturityLabel: MATURITY_LABELS[maturity],
  };
}
