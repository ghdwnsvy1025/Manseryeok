/**
 * 점수·신뢰도 → 새 운세 JSON 라벨
 */
import type {
  FortuneConfidenceLabel,
  FortuneDataQualityBlock,
  FortuneDomainResult,
  FortuneFlow,
  FortunePresentationMeta,
  DailyInsightContext,
} from "@/lib/journal/insight/types";
import { KEYWORD_CATALOG } from "@/lib/journal/keywords/catalog";

const LABEL_BY_CODE = Object.fromEntries(
  KEYWORD_CATALOG.map((k) => [k.code, k.plainLabel])
) as Record<string, string>;

export const FORTUNE_NOTICE =
  "이 운세는 학습된 사주 이론과 개인 기록을 바탕으로 오늘의 경향을 해석한 콘텐츠이며, 실제 결과는 환경과 선택에 따라 달라질 수 있습니다.";

export function flowFromScore(score: number): FortuneFlow {
  if (score >= 0.68) return "원활";
  if (score >= 0.54) return "안정";
  if (score >= 0.4) return "혼합";
  return "관리";
}

export function confidenceLabelFromScore(
  confidence: number
): FortuneConfidenceLabel {
  if (confidence >= 0.7) return "높음";
  if (confidence >= 0.45) return "보통";
  return "낮음";
}

export function reasonTagsFromCodes(codes: string[]): string[] {
  return codes
    .map((c) => LABEL_BY_CODE[c] ?? c)
    .filter(Boolean)
    .slice(0, 4);
}

/** interpretation ↔ summary 동기화 (DB 컬럼 summary 유지) */
export function syncDomainCopyFields<
  T extends Pick<FortuneDomainResult, "interpretation" | "summary">,
>(d: T): T {
  const text = (d.interpretation || d.summary || "").trim();
  return { ...d, interpretation: text, summary: text };
}

export function buildDataQuality(
  insight: DailyInsightContext
): FortuneDataQualityBlock {
  const saju = insight.natalDay
    ? "충분"
    : insight.natalPrior.confidence > 0.3
      ? "일부 누락"
      : "부족";
  const diary =
    insight.priorUniqueDays >= 7
      ? "충분"
      : insight.priorUniqueDays >= 2
        ? "일부 누락"
        : "부족";
  // Phase A: 간지 통계는 아직 미연결
  const statistics: FortuneDataQualityBlock["statistics"] = "없음";
  return { saju, diary, statistics };
}

export function buildFortunePresentationMeta(
  insight: DailyInsightContext,
  overall: FortuneDomainResult,
  health: FortuneDomainResult | undefined,
  overrides?: Partial<
    Pick<
      FortunePresentationMeta,
      | "dailyTheme"
      | "todayFocus"
      | "todayAvoid"
      | "luckyRoutine"
      | "signatureEcho"
    >
  >
): FortunePresentationMeta {
  return {
    date: insight.eventDate,
    timezone: insight.timezone,
    todayGanji: insight.ganjiKo,
    dailyTheme:
      overrides?.dailyTheme?.trim() ||
      overall.headline ||
      insight.primaryKeyword ||
      "오늘의 흐름을 차분히 살피기",
    todayFocus:
      overrides?.todayFocus?.trim() ||
      overall.action ||
      "오늘 할 일 중 하나만 분명히 끝내기",
    todayAvoid:
      overrides?.todayAvoid?.trim() ||
      overall.caution ||
      "무리한 확장과 한꺼번에 몰아치기",
    luckyRoutine:
      overrides?.luckyRoutine?.trim() ||
      health?.action ||
      "짧게 스트레칭하거나 수면 시간을 지키세요",
    signatureEcho: overrides?.signatureEcho?.trim() || null,
    dataQuality: buildDataQuality(insight),
    notice: FORTUNE_NOTICE,
  };
}
