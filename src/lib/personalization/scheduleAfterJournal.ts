import { isPersonalizationTrainEnabled } from "@/lib/app/featureFlags";
import { PERSONALIZATION_PHASE_LABEL } from "@/lib/personalization/types";

/**
 * Phase 4 — 개인화 Ridge MVP
 * 일기 저장 후 재학습 후보 스케줄. 실패해도 throw하지 않음.
 * 실제 학습 파이프라인(스냅샷+점수 로드)은 remote 010·데이터 연동 후 확장.
 */
export function schedulePersonalizationTrainAfterJournalSave(_opts: {
  localDate: string;
  userId?: string | null;
  categoryKeys?: string[];
}): void {
  if (!isPersonalizationTrainEnabled()) return;

  void (async () => {
    try {
      // MVP: 학습 트리거만 게이트. 원격 테이블·점수 로드는 운영 연동 단계에서 연결.
      if (process.env.NODE_ENV === "development") {
        console.info(
          `[${PERSONALIZATION_PHASE_LABEL}] train flag ON — retrain candidate noted`
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[${PERSONALIZATION_PHASE_LABEL}] train schedule failed`, err);
      }
    }
  })();
}
