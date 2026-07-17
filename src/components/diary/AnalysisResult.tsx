"use client";

import {
  DETAIL_SCORE_DIMENSIONS,
  EMOTION_LABEL_KO,
  type DiaryAnalysis,
} from "@/lib/diary/dimensions";
import {
  APPRAISAL_LABELS,
  CIRCUMPLEX_LABELS,
  PANAS_LABELS,
  PERMA_LABELS_KO,
  SDT_LABELS,
  type ScoredEvidence,
} from "@/lib/diary/psychology";

const BAR_COLORS: Record<string, string> = {
  depression_score: "#94a3b8",
  anxiety_score: "#f87171",
  stress_score: "#fb923c",
  achievement_score: "#fbbf24",
  meaning_score: "#a78bfa",
  energy_score: "#60a5fa",
  relationship_score: "#f472b6",
  gratitude_score: "#34d399",
  self_acceptance_score: "#818cf8",
};

const THEORY_COLORS: Record<string, string> = {
  positive_affect: "#34d399",
  negative_affect: "#f87171",
  valence: "#a78bfa",
  arousal: "#fbbf24",
  positive_emotion: "#34d399",
  engagement: "#60a5fa",
  relationships: "#f472b6",
  meaning: "#a78bfa",
  accomplishment: "#fbbf24",
  autonomy: "#818cf8",
  competence: "#60a5fa",
  relatedness: "#f472b6",
};

type Props = {
  analysis: DiaryAnalysis;
  /** 점수 직접 입력 모드 — 하단 세부 감정 점수 숨김 */
  hideDetailScores?: boolean;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="ui-section-title">
      {children}
    </p>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span className="text-[11px] px-1.5 py-0.5 border font-medium" style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}>
      신뢰도 {value}%
    </span>
  );
}

function TheoryScoreBar({
  label,
  item,
  max,
  color,
  centerZero = false,
}: {
  label: string;
  item: ScoredEvidence;
  max: number;
  color: string;
  centerZero?: boolean;
}) {
  const widthPct = centerZero
    ? ((item.score + max) / (max * 2)) * 100
    : (item.score / max) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold w-28 shrink-0 leading-tight" style={{ color }}>
          {label}
        </span>
        <div
          className="flex-1 h-4 border relative"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
        >
          {centerZero && (
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{ left: "50%", background: "var(--px-border)" }}
            />
          )}
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, widthPct))}%`,
              background: color,
              boxShadow: `0 0 6px ${color}88`,
            }}
          />
        </div>
        <span className="text-xs font-bold w-10 text-right shrink-0" style={{ color }}>
          {centerZero && item.score > 0 ? "+" : ""}
          {item.score}
        </span>
        <ConfidenceBadge value={item.confidence} />
      </div>
      {item.evidence && (
        <p className="ui-hint pl-28 leading-relaxed">
          ↳ {item.evidence}
        </p>
      )}
    </div>
  );
}

function AppraisalBlock({
  label,
  analysis: text,
  confidence,
}: {
  label: string;
  analysis: string;
  confidence: number;
}) {
  if (!text) return null;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: "var(--px-text)" }}>
          {label}
        </span>
        <ConfidenceBadge value={confidence} />
      </div>
      <p className="ui-guide">
        {text}
      </p>
    </div>
  );
}

export default function AnalysisResult({ analysis, hideDetailScores = false }: Props) {
  const emotionKo = EMOTION_LABEL_KO[analysis.emotion_label] ?? analysis.emotion_label;
  const psych = analysis.psychological_analysis;

  return (
    <div className="space-y-4">
      {/* 8. 종합 행복 점수 */}
      <div
        className="flex items-center justify-between gap-3 p-3 border-2"
        style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
      >
        <div>
          <p className="ui-list-label">
            종합 행복 점수
          </p>
          <p className="text-3xl font-black" style={{ color: "var(--px-accent)" }}>
            {analysis.daily_wellbeing_score}
            <span className="text-sm ml-1">/ 100</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-block px-2 py-1 text-xs font-bold border"
            style={{ borderColor: "var(--px-accent)", color: "var(--px-accent)" }}
          >
            {emotionKo}
          </span>
          <p className="ui-hint mt-1">
            신뢰도 {analysis.confidence}%
          </p>
        </div>
      </div>

      {/* 1. 핵심 감정 요약 */}
      <div className="space-y-1">
        <SectionTitle>1. 핵심 감정 요약</SectionTitle>
        <p className="text-sm font-bold" style={{ color: "var(--px-text)" }}>
          {analysis.summary}
        </p>
        {analysis.reason && (
          <p className="ui-hint">
            {analysis.reason}
          </p>
        )}
        {psych?.comprehensive_wellbeing_reason && (
          <p className="ui-hint mt-1">
            <span className="font-bold">점수 근거: </span>
            {psych.comprehensive_wellbeing_reason}
          </p>
        )}
      </div>

      {analysis.dominant_emotions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.dominant_emotions.map((e) => (
            <span
              key={e}
              className="text-[11px] px-2 py-1 border font-bold"
              style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {analysis.key_events.length > 0 && (
        <div>
          <p className="ui-section-title mb-1">
            주요 사건
          </p>
          <ul className="ui-guide space-y-0.5">
            {analysis.key_events.map((ev) => (
              <li key={ev}>· {ev}</li>
            ))}
          </ul>
        </div>
      )}

      {psych && (
        <>
          {/* 3. PANAS */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
            <SectionTitle>3. PANAS 점수 (0–10)</SectionTitle>
            {(Object.keys(psych.panas) as (keyof typeof psych.panas)[]).map((key) => (
              <TheoryScoreBar
                key={key}
                label={PANAS_LABELS[key]}
                item={psych.panas[key]}
                max={10}
                color={THEORY_COLORS[key] ?? "var(--px-accent)"}
              />
            ))}
          </div>

          {/* 4. Circumplex */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
            <SectionTitle>4. Circumplex 분석</SectionTitle>
            <TheoryScoreBar
              label={CIRCUMPLEX_LABELS.valence}
              item={psych.circumplex.valence}
              max={5}
              color={THEORY_COLORS.valence}
              centerZero
            />
            <TheoryScoreBar
              label={CIRCUMPLEX_LABELS.arousal}
              item={psych.circumplex.arousal}
              max={10}
              color={THEORY_COLORS.arousal}
            />
          </div>

          {/* 5. PERMA */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
            <SectionTitle>5. PERMA 점수 (0–10)</SectionTitle>
            {(Object.keys(psych.perma) as (keyof typeof psych.perma)[]).map((key) => (
              <TheoryScoreBar
                key={key}
                label={PERMA_LABELS_KO[key]}
                item={psych.perma[key]}
                max={10}
                color={THEORY_COLORS[key] ?? "var(--px-accent)"}
              />
            ))}
          </div>

          {/* 6. SDT */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
            <SectionTitle>6. SDT 점수 (0–10)</SectionTitle>
            {(Object.keys(psych.sdt) as (keyof typeof psych.sdt)[]).map((key) => (
              <TheoryScoreBar
                key={key}
                label={SDT_LABELS[key]}
                item={psych.sdt[key]}
                max={10}
                color={THEORY_COLORS[key] ?? "var(--px-accent)"}
              />
            ))}
          </div>

          {/* 7. Appraisal */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
            <SectionTitle>7. Appraisal 분석</SectionTitle>
            {psych.appraisal.key_event && (
              <p className="text-xs font-bold" style={{ color: "var(--px-text)" }}>
                핵심 사건: {psych.appraisal.key_event}
              </p>
            )}
            <div className="space-y-2">
              {(Object.keys(APPRAISAL_LABELS) as (keyof typeof APPRAISAL_LABELS)[]).map((key) => (
                <AppraisalBlock
                  key={key}
                  label={APPRAISAL_LABELS[key]}
                  analysis={psych.appraisal[key].analysis}
                  confidence={psych.appraisal[key].confidence}
                />
              ))}
            </div>
          </div>

          {/* 9. 회복/행동 제안 */}
          {psych.recovery_suggestions.length > 0 && (
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
              <SectionTitle>9. 오늘 나에게 필요한 회복/행동 제안</SectionTitle>
              <ul className="ui-guide space-y-1">
                {psych.recovery_suggestions.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* 2. 세부 감정 점수 */}
      {!hideDetailScores && (
      <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
        <SectionTitle>2. 세부 감정 점수 (0–100, 정서적 신호)</SectionTitle>
        {DETAIL_SCORE_DIMENSIONS.map((dim) => {
          const value = analysis[dim.id];
          const scoreReason = analysis.score_reasons?.[dim.id];

          if (value === null) {
            return (
              <div key={dim.id} className="opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-14 shrink-0" style={{ color: "var(--px-text2)" }}>
                    {dim.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--px-text2)" }}>
                    해당 없음
                  </span>
                </div>
              </div>
            );
          }

          const color = BAR_COLORS[dim.id] ?? "var(--px-accent)";
          return (
            <div key={dim.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold w-14 shrink-0" style={{ color }}>
                  {dim.label}
                </span>
                <div
                  className="flex-1 h-4 border"
                  style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${value}%`,
                      background: color,
                      boxShadow: `0 0 6px ${color}88`,
                    }}
                  />
                </div>
                <span className="text-xs font-bold w-8 text-right" style={{ color }}>
                  {value}
                </span>
              </div>
              {scoreReason && (
                <p className="ui-hint pl-14 leading-relaxed">
                  ↳ {scoreReason}
                </p>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
