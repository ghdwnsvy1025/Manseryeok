"use client";

import Link from "next/link";
import { useMemo } from "react";
import NewDiaryGate from "@/components/journal/NewDiaryGate";
import PersonalizationStatsPanel, {
  type CategoryStatsRow,
} from "@/components/journal/PersonalizationStatsPanel";
import { isPersonalizationEnabled } from "@/lib/app/featureFlags";

/**
 * Phase 4 — 개인화 Ridge MVP
 * 표시 플래그 OFF 시 안내만. 학습 결과는 별도 저장소·재학습 경로에서 주입.
 * 이번 화면은 확정 운세 점수를 만들지 않는다.
 */
function PersonalizationStatsInner() {
  const displayOn = isPersonalizationEnabled();

  const rows: CategoryStatsRow[] = useMemo(
    () =>
      displayOn
        ? [
            {
              categoryKey: "emotion_balance",
              categoryLabel: "감정 균형",
              validSampleCount: 0,
              model: null,
            },
            {
              categoryKey: "energy",
              categoryLabel: "에너지",
              validSampleCount: 0,
              model: null,
            },
            {
              categoryKey: "sleep_recovery",
              categoryLabel: "수면·회복",
              validSampleCount: 0,
              model: null,
            },
          ]
        : [],
    [displayOn]
  );

  if (!displayOn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--px-fg)" }}>
          개인화 통계
        </h1>
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          Phase 4 — 개인화 Ridge MVP 표시 플래그가 꺼져 있습니다.{" "}
          <code className="text-xs">NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY</code>
          를 켠 뒤 다시 빌드하세요. 학습 플래그와 분리되어 있습니다.
        </p>
        <Link
          href="/journal"
          className="inline-block text-sm font-semibold underline"
          style={{ color: "var(--px-accent)" }}
        >
          새 일기로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <PersonalizationStatsPanel rows={rows} />
      <p className="text-xs" style={{ color: "var(--px-muted)" }}>
        모델이 학습되면 카테고리별 기준선·신뢰도·제한적 패턴 요약이 여기에
        채워집니다. 재물·사고·건강의 단정 예측은 표시하지 않습니다.
      </p>
      <Link
        href="/journal"
        className="inline-block text-sm font-semibold underline"
        style={{ color: "var(--px-accent)" }}
      >
        일기 이어 쓰기
      </Link>
    </div>
  );
}

export default function JournalStatsPage() {
  return (
    <NewDiaryGate>
      <PersonalizationStatsInner />
    </NewDiaryGate>
  );
}
