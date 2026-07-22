"use client";

import { isPersonalizationEnabled } from "@/lib/app/featureFlags";
import type { PersonalizationModelRecord } from "@/lib/personalization/types";
import {
  degradedCopy,
  earlySignalCopy,
  needsMoreRecordsCopy,
} from "@/lib/personalization/copy";

export type CategoryStatsRow = {
  categoryKey: string;
  categoryLabel: string;
  validSampleCount: number;
  model: PersonalizationModelRecord | null;
};

function stageLabel(stage: string): string {
  switch (stage) {
    case "insufficient_data":
      return "데이터 부족";
    case "early_signal":
      return "초기 신호";
    case "active":
      return "활성";
    case "stable_candidate":
      return "안정 후보";
    default:
      return stage;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "활성";
    case "degraded":
      return "기준선 미달";
    case "insufficient_signal":
      return "신호 부족";
    case "insufficient_data":
      return "기록 부족";
    default:
      return status;
  }
}

function bandLabel(band: string): string {
  switch (band) {
    case "insufficient":
      return "부족";
    case "low":
      return "낮음";
    case "medium":
      return "보통";
    case "high":
      return "높음";
    case "very_high":
      return "매우 높음";
    default:
      return band;
  }
}

function summaryForRow(row: CategoryStatsRow): string {
  const m = row.model;
  if (!m || row.validSampleCount < 14) {
    return needsMoreRecordsCopy(row.validSampleCount);
  }
  if (!m.predictionVisible) {
    return degradedCopy();
  }
  if (m.dataStage === "early_signal") {
    return earlySignalCopy();
  }
  return (
    m.summaryText ??
    "최근 기록에서 검증된 특징과 점수 사이의 경향이 관찰되었습니다. 원인이나 미래를 확정하지 않습니다."
  );
}

/**
 * Phase 4 — 개인화 Ridge MVP UI
 * 확정 운세 점수·원시 계수·디버그 JSON 비표시
 */
export default function PersonalizationStatsPanel({
  rows,
}: {
  rows: CategoryStatsRow[];
}) {
  if (!isPersonalizationEnabled()) {
    return (
      <section
        className="rounded-lg border p-4 text-sm"
        style={{
          borderColor: "var(--px-border)",
          background: "var(--px-bg2)",
          color: "var(--px-muted)",
        }}
      >
        개인화 통계 화면은 현재 꺼져 있습니다.
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="개인화 Ridge 통계">
      <header className="space-y-1">
        <p
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: "var(--px-muted)" }}
        >
          Phase 4 — 개인화 Ridge MVP
        </p>
        <h2 className="text-lg font-bold" style={{ color: "var(--px-fg)" }}>
          카테고리별 개인 패턴
        </h2>
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          개인 기록과 검증된 사주 특징 사이의 통계적 경향만 보여 줍니다. 확정적
          예언이 아닙니다.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          아직 표시할 카테고리 기록이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const m = row.model;
            const showPerf =
              m &&
              m.predictionVisible &&
              m.modelStatus === "active" &&
              m.modelMetrics.validationSampleCount > 0;

            return (
              <li
                key={row.categoryKey}
                className="rounded-lg border p-4 space-y-2"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg2)",
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className="font-bold"
                    style={{ color: "var(--px-fg)" }}
                  >
                    {row.categoryLabel}
                  </h3>
                  <span
                    className="text-xs"
                    style={{ color: "var(--px-muted)" }}
                  >
                    기록 {row.validSampleCount}개
                  </span>
                </div>

                <dl
                  className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"
                  style={{ color: "var(--px-muted)" }}
                >
                  <dt>데이터 단계</dt>
                  <dd style={{ color: "var(--px-fg)" }}>
                    {m ? stageLabel(m.dataStage) : "데이터 부족"}
                  </dd>
                  <dt>모델 상태</dt>
                  <dd style={{ color: "var(--px-fg)" }}>
                    {m ? statusLabel(m.modelStatus) : "미학습"}
                  </dd>
                  <dt>개인 기준선</dt>
                  <dd style={{ color: "var(--px-fg)" }}>
                    {m
                      ? m.normalization.weightedMean.toFixed(2)
                      : "—"}
                  </dd>
                  <dt>신뢰도</dt>
                  <dd style={{ color: "var(--px-fg)" }}>
                    {m
                      ? `${Math.round(m.confidenceScore)} (${bandLabel(
                          m.confidenceBand
                        )})`
                      : "—"}
                  </dd>
                  {showPerf ? (
                    <>
                      <dt>기준선 대비</dt>
                      <dd style={{ color: "var(--px-fg)" }}>
                        MAE 개선{" "}
                        {m!.modelMetrics.maeImprovement.toFixed(3)}
                      </dd>
                    </>
                  ) : null}
                </dl>

                <p className="text-sm leading-relaxed" style={{ color: "var(--px-fg)" }}>
                  {summaryForRow(row)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
