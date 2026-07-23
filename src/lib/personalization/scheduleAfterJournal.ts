import { isPersonalizationTrainEnabled } from "@/lib/app/featureFlags";
import { PERSONALIZATION_PHASE_LABEL } from "@/lib/personalization/types";

/**
 * 일기 저장 후 Ridge 재학습 후보 스케줄.
 * 학습 목표는 finalScore(user+ai 평균). 실패해도 일기 저장은 유지.
 */
export function schedulePersonalizationTrainAfterJournalSave(opts: {
  localDate: string;
  userId?: string | null;
  categoryKeys?: string[];
}): void {
  if (!isPersonalizationTrainEnabled()) return;

  void (async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        console.info(
          `[${PERSONALIZATION_PHASE_LABEL}] retrain candidate`,
          opts.localDate,
          opts.categoryKeys?.join(",") ?? ""
        );
      }
      // 원격 파이프라인 연결 시: shouldRetrain → runPersonalizationTrainingPipeline
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[${PERSONALIZATION_PHASE_LABEL}] train schedule failed`, err);
      }
    }
  })();
}
