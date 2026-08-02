"use client";

import type { FortuneEvidence } from "@/lib/journal/fortune/evidence";
import {
  journalSharePercent,
  natalSharePercent,
} from "@/lib/journal/fortune/localPeek";

function confidencePlain(confidence: number | null | undefined): string {
  const c = confidence ?? 0;
  if (c >= 0.7) return "꽤 확실해요";
  if (c >= 0.45) return "참고해도 좋아요";
  return "참고용";
}

function MeterBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="h-1.5 w-full border"
      style={{ borderColor: "var(--px-border2)", background: "var(--px-bg3)" }}
    >
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: color ?? "var(--px-accent)",
        }}
      />
    </div>
  );
}

function WeightRow({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color?: string;
  hint: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-black" style={{ color: "var(--px-text)" }}>
          {label}
        </span>
        <span
          className="text-[11px] font-black tabular-nums"
          style={{ color: "var(--px-accent)" }}
        >
          {pct}%
        </span>
      </div>
      <MeterBar value={value} color={color} />
      <p className="text-[10px] leading-tight" style={{ color: "var(--px-text2)" }}>
        {hint}
      </p>
    </div>
  );
}

/**
 * 운세 본문 아래 상시 노출 — 지금 운세 = 기록 N% + 사주 M%
 */
export function FortuneEvidenceSummary({
  evidence,
  onDetailClick,
  detailLabel = "자세히",
}: {
  evidence: FortuneEvidence;
  onDetailClick?: () => void;
  detailLabel?: string;
}) {
  const journalPct = journalSharePercent(evidence);
  const natalPct = natalSharePercent(evidence);

  return (
    <div
      className="border-2 px-3.5 py-3.5 space-y-2"
      style={{
        borderColor: "var(--px-accent)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--px-accent) 22%, var(--px-bg2)), var(--px-bg3))",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label={`지금 운세는 기록 ${journalPct}퍼센트와 사주 ${natalPct}퍼센트`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[15px] font-black leading-snug tracking-tight min-w-0"
          style={{ color: "#fffef8" }}
        >
          지금 운세 ={" "}
          <span style={{ color: "var(--px-accent)" }}>기록 {journalPct}%</span>
          <span style={{ color: "#d4d4e0" }}> + </span>
          <span style={{ color: "#fde68a" }}>사주 {natalPct}%</span>
        </p>
        {onDetailClick && (
          <button
            type="button"
            onClick={onDetailClick}
            className="shrink-0 text-[12px] font-black underline mt-0.5"
            style={{ color: "var(--px-accent)" }}
          >
            {detailLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** 신호 혼합·키워드 등 상세 근거 */
export default function FortuneEvidencePanel({
  evidence,
  compact,
}: {
  evidence: FortuneEvidence;
  /** 레벨 팝업 등 좁은 모달용 — 상단 큰 배너 생략(요약이 이미 있을 때) */
  compact?: boolean;
}) {
  const journalPct = journalSharePercent(evidence);
  const natalPct = natalSharePercent(evidence);

  return (
    <div
      className={compact ? "space-y-3" : "mt-1 p-2.5 space-y-3 border"}
      style={
        compact
          ? undefined
          : { borderColor: "var(--px-border2)", background: "var(--px-bg3)" }
      }
    >
      {!compact && (
        <div
          className="p-2 border-2 flex items-center justify-center gap-1 text-center"
          style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
        >
          <span className="text-sm font-black" style={{ color: "#fffef8" }}>
            지금 운세 ={" "}
            <span style={{ color: "var(--px-accent)" }}>기록 {journalPct}%</span>
            <span style={{ color: "#d4d4e0" }}> + </span>
            <span style={{ color: "#fde68a" }}>사주 {natalPct}%</span>
          </span>
        </div>
      )}

      <p
        className="text-[10px] leading-relaxed text-center"
        style={{ color: "var(--px-text2)" }}
      >
        {evidence.dayPhaseLabel} · 기록 {evidence.priorUniqueDays}일
        {evidence.journalShareCap < 1
          ? ` · 일수 상한 ${Math.round(evidence.journalShareCap * 100)}%`
          : ""}
      </p>

      <div className="space-y-2">
        <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
          신호 혼합 비율
        </p>
        <WeightRow
          label="최근 상태(내 기록)"
          value={evidence.weights.recent}
          color="var(--px-accent)"
          hint="일기·체크인에서 뽑은 최근 카테고리 점수"
        />
        <WeightRow
          label="키워드 흐름"
          value={evidence.weights.keyword}
          color="var(--px-text)"
          hint="요즘 자주 올라오는 주제(현저성)"
        />
        <WeightRow
          label="사주×오늘 일진"
          value={evidence.weights.natal}
          color="var(--px-text2)"
          hint="원국 특징과 오늘 간지를 엮은 이론 신호"
        />
      </div>

      {evidence.topKeywords.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
            지금 뜨는 키워드
          </p>
          <div className="space-y-1">
            {evidence.topKeywords.map((k) => (
              <div key={k.code} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold shrink-0 w-16 truncate"
                  style={{ color: "var(--px-text)" }}
                >
                  {k.plainLabel}
                </span>
                <div className="flex-1">
                  <MeterBar value={Math.min(1, k.score / 6)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
        {confidencePlain(evidence.overallConfidence)} · 표본이 적으면 해석이
        가운데(균형) 쪽으로 당겨집니다.
      </p>
    </div>
  );
}
