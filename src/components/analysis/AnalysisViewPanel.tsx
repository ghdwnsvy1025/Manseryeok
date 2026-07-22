"use client";

import type { AnalysisViewModel } from "@/lib/analysis/types";
import type { AnalysisNarrativeOutput } from "@/lib/analysis/narrativeContract";

function LayerBlock({
  title,
  sourceType,
  body,
  available,
}: {
  title: string;
  sourceType: string;
  body: string;
  available: boolean;
}) {
  return (
    <section
      className="rounded-lg border p-4 space-y-2"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg2)",
        opacity: available ? 1 : 0.85,
      }}
      aria-label={title}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-bold text-sm" style={{ color: "var(--px-fg)" }}>
          {title}
        </h3>
        <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>
          {sourceType}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--px-fg)" }}>
        {body}
      </p>
    </section>
  );
}

/**
 * Phase 5 — 분석 UI·서술: 세 층 + 근거 (합치지 않음)
 */
export default function AnalysisViewPanel({
  viewModel,
  narrative,
}: {
  viewModel: AnalysisViewModel;
  narrative?: AnalysisNarrativeOutput | null;
}) {
  const theory = narrative?.theoryText ?? viewModel.astrologyTheoryLayer.body;
  const record = narrative?.recordText ?? viewModel.personalRecordLayer.body;
  const action =
    narrative?.suggestionText ?? viewModel.actionSuggestionLayer.body;

  return (
    <div className="space-y-4" aria-label="분석 결과">
      <header className="space-y-1">
        <p
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: "var(--px-muted)" }}
        >
          Phase 5 — 분석 UI·서술
        </p>
        <h2 className="text-lg font-bold" style={{ color: "var(--px-fg)" }}>
          {viewModel.categoryLabel} ·{" "}
          {viewModel.periodType === "daily"
            ? "일간"
            : viewModel.periodType === "weekly"
              ? "주간"
              : "월간"}
        </h2>
        <p className="text-xs" style={{ color: "var(--px-muted)" }}>
          {viewModel.periodStart}
          {viewModel.periodStart !== viewModel.periodEnd
            ? ` ~ ${viewModel.periodEnd}`
            : ""}
        </p>
      </header>

      <LayerBlock
        title="명리 이론상"
        sourceType={viewModel.astrologyTheoryLayer.sourceType}
        body={theory}
        available={viewModel.astrologyTheoryLayer.available}
      />
      <LayerBlock
        title="내 기록상"
        sourceType={viewModel.personalRecordLayer.sourceType}
        body={record}
        available={viewModel.personalRecordLayer.available}
      />
      <LayerBlock
        title="실천 제안"
        sourceType={viewModel.actionSuggestionLayer.sourceType}
        body={action}
        available={viewModel.actionSuggestionLayer.available}
      />

      {viewModel.aggregate ? (
        <section
          className="rounded-lg border p-4 space-y-2 text-sm"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
          }}
        >
          <h3 className="font-bold" style={{ color: "var(--px-fg)" }}>
            기간 집계
          </h3>
          <p style={{ color: "var(--px-muted)" }}>
            기록 {viewModel.aggregate.recordedDays}/
            {viewModel.aggregate.expectedDays}일
            {viewModel.aggregate.averageRawScore != null
              ? ` · 원점수 평균 ${viewModel.aggregate.averageRawScore}`
              : ""}
            {viewModel.baselineSummary?.weightedMean != null
              ? ` · 개인 기준선 ${viewModel.baselineSummary.weightedMean.toFixed(1)}`
              : ""}
          </p>
          <p className="text-xs" style={{ color: "var(--px-muted)" }}>
            차트·숫자의 원점수와 개인 기준선은 혼동하지 마세요.
          </p>
          {viewModel.aggregate.topTags.length > 0 ? (
            <p className="text-xs" style={{ color: "var(--px-muted)" }}>
              태그: {viewModel.aggregate.topTags.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <details
        className="rounded-lg border p-4 text-sm"
        style={{
          borderColor: "var(--px-border)",
          background: "var(--px-bg2)",
        }}
      >
        <summary className="font-bold cursor-pointer" style={{ color: "var(--px-fg)" }}>
          근거 · 신뢰도 · 제한
        </summary>
        <dl
          className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs"
          style={{ color: "var(--px-muted)" }}
        >
          <dt>유효 기록</dt>
          <dd style={{ color: "var(--px-fg)" }}>{viewModel.sampleCount}</dd>
          <dt>데이터 단계</dt>
          <dd style={{ color: "var(--px-fg)" }}>
            {viewModel.dataStage ?? "—"}
          </dd>
          <dt>모델 상태</dt>
          <dd style={{ color: "var(--px-fg)" }}>
            {viewModel.modelStatus ?? "—"}
          </dd>
          <dt>신뢰도</dt>
          <dd style={{ color: "var(--px-fg)" }}>
            {viewModel.modelExposureAllowed && viewModel.confidenceScore != null
              ? `${Math.round(viewModel.confidenceScore)} (${viewModel.confidenceBand})`
              : "숨김/해당 없음"}
          </dd>
          <dt>버전</dt>
          <dd style={{ color: "var(--px-fg)" }}>
            calc {viewModel.versionMetadata.calculationVersion ?? "—"} · theory{" "}
            {viewModel.versionMetadata.theoryVersion ?? "—"}
          </dd>
        </dl>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--px-muted)" }}>
          {viewModel.evidence.correlationNotCausationNote}
        </p>
        {viewModel.evidence.recordsNeededForStable != null ? (
          <p className="text-xs" style={{ color: "var(--px-muted)" }}>
            더 안정적인 관찰까지 약{" "}
            {viewModel.evidence.recordsNeededForStable}개 기록이 더 필요할 수
            있습니다.
          </p>
        ) : null}
        {viewModel.limitations.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs" style={{ color: "var(--px-muted)" }}>
            {viewModel.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-[10px] break-all" style={{ color: "var(--px-muted)" }}>
          featureSchema {viewModel.versionMetadata.featureSchemaVersion ?? "—"} ·
          model {viewModel.versionMetadata.modelVersion ?? "—"} · narrative{" "}
          {viewModel.versionMetadata.narrativeVersion}
        </p>
      </details>
    </div>
  );
}
