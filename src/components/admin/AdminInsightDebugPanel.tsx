"use client";

import { useState, type ReactNode } from "react";
import type { AdminDebugSections } from "@/lib/admin/insightDebugView";

type ApiResult = {
  eventDate: string;
  userId: string | null;
  versions: Record<string, unknown>;
  flags: Record<string, unknown>;
  sections: AdminDebugSections;
  privacy: {
    diaryContentIncluded: boolean;
    sensitiveAccess: boolean;
    note: string;
  };
  errors: Record<string, string | null>;
  raw: unknown;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="space-y-1.5 p-2 border"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg3)",
      }}
    >
      <h3
        className="text-[11px] font-black tracking-wide"
        style={{ color: "var(--px-accent)" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: unknown }) {
  const text =
    value == null || value === ""
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return (
    <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
      <span className="font-bold" style={{ color: "var(--px-text)" }}>
        {label}:{" "}
      </span>
      <span className="break-all">{text}</span>
    </p>
  );
}

export default function AdminInsightDebugPanel() {
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [userId, setUserId] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ date });
      if (userId.trim()) qs.set("userId", userId.trim());
      if (includeContent) qs.set("includeContent", "1");
      const res = await fetch(`/api/admin/daily-insight?${qs}`);
      const data = (await res.json()) as ApiResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "조회 실패");
        setResult(null);
        return;
      }
      setResult(data);
    } catch {
      setError("요청 실패");
    } finally {
      setLoading(false);
    }
  };

  const s = result?.sections;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className="p-2 border text-xs"
          style={{ borderColor: "var(--px-border)" }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className="p-2 border text-xs"
          style={{ borderColor: "var(--px-border)" }}
          placeholder="userId (선택)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>
      <label
        className="flex items-center gap-2 text-[10px] font-bold"
        style={{ color: "var(--px-text2)" }}
      >
        <input
          type="checkbox"
          checked={includeContent}
          onChange={(e) => setIncludeContent(e.target.checked)}
        />
        일기 원문 포함 요청 (ADMIN_SENSITIVE_EMAILS만 허용)
      </label>
      <button
        type="button"
        className="px-btn w-full py-2 text-sm"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? "조회 중…" : "인사이트/운세/문장 근거 조회"}
      </button>
      {error && (
        <p className="text-xs font-bold" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      {result && s && (
        <div className="space-y-2">
          <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
            {result.privacy.note}
          </p>

          <Section title="공통 컨텍스트">
            <KV label="context ID" value={s.common.contextId} />
            <KV label="data cutoff" value={s.common.dataCutoffAt} />
            <KV label="timezone" value={s.common.timezone} />
            <KV label="엔진 버전" value={s.common.engineVersion} />
            <KV label="규칙 버전" value={s.common.ruleVersion} />
            <KV label="매핑 버전" value={s.common.mappingVersion} />
            <KV label="prior days" value={s.common.priorUniqueDays} />
            <KV label="confidence" value={s.common.overallConfidence} />
          </Section>

          <Section title="질문">
            {s.question ? (
              <>
                <KV label="최종 질문" value={s.question.questionText} />
                <KV label="question ID" value={s.question.questionId} />
                <KV label="키워드 코드" value={s.question.keywordCodes} />
                <KV label="상위 키워드" value={s.question.topKeywords} />
                <KV label="모듈 점수" value={s.question.moduleScores} />
                <KV label="신뢰도" value={s.question.confidence} />
                <KV label="모델" value={s.question.modelVersion} />
                <KV label="근거" value={s.question.evidence} />
              </>
            ) : (
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                해당 날짜 질문 없음
              </p>
            )}
          </Section>

          <Section title="운세">
            {s.fortune ? (
              <>
                <KV label="헤드라인" value={s.fortune.overallHeadline} />
                <KV label="요약" value={s.fortune.overallSummary} />
                <KV label="종합 신뢰도" value={s.fortune.overallConfidence} />
                <KV label="점수 버전" value={s.fortune.scoringVersion} />
                {s.fortune.sections.map((sec) => (
                  <div
                    key={sec.domain}
                    className="mt-1 pt-1 border-t"
                    style={{ borderColor: "var(--px-border)" }}
                  >
                    <KV
                      label={sec.domain}
                      value={`score ${sec.score ?? "—"} · conf ${sec.confidence ?? "—"}`}
                    />
                    <KV label="headline" value={sec.headline} />
                    <KV label="기회" value={sec.opportunity} />
                    <KV label="주의" value={sec.caution} />
                    <KV label="행동" value={sec.action} />
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                해당 날짜 운세 없음
              </p>
            )}
          </Section>

          <Section title="명언 / 오늘의 문장">
            {s.quote ? (
              <>
                <KV label="유형" value={s.quote.contentType} />
                <KV label="문구" value={s.quote.quoteText} />
                <KV label="저자" value={s.quote.authorName} />
                <KV label="작품" value={s.quote.workTitle} />
                <KV label="검증" value={s.quote.verificationStatus} />
                <KV label="권리" value={s.quote.rightsStatus} />
                <KV label="적합 점수" value={s.quote.fitnessScore} />
                <KV label="제외 이유" value={s.quote.exclusionReasons} />
                <KV label="반복 제한" value={s.quote.repeatLimitHit} />
                <KV label="폴백 단계" value={s.quote.fallbackStage} />
              </>
            ) : (
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                해당 날짜 전달 없음
              </p>
            )}
          </Section>

          <Section title="사주">
            <KV label="일간/십신" value={s.saju?.dayMaster ?? s.saju?.tenGod} />
            <KV label="십신" value={s.saju?.tenGod} />
            <KV label="키워드" value={s.saju?.keywords} />
            <KV label="포커스 힌트" value={s.saju?.focusHints} />
            <KV label="사주 가중" value={s.saju?.sajuWeight} />
            <KV label="요약" value={s.saju?.plainSummary} />
            <KV label="규칙 버전" value={s.saju?.ruleVersion} />
          </Section>

          <Section title="모델">
            <KV label="Ridge eval 버전" value={s.model.ridgeEvalVersion} />
            <KV
              label="합충 점수 반영"
              value={s.model.relationsScoringEnabled}
            />
            <KV label="메모" value={s.model.note} />
            <KV label="전체 버전" value={result.versions} />
          </Section>

          <Section title="피드백 / 노출">
            <KV
              label="질문 이벤트"
              value={s.feedback.questionEvents.slice(0, 12)}
            />
            <KV
              label="콘텐츠 피드백"
              value={s.feedback.contentFeedback.slice(0, 8)}
            />
            <KV label="노출" value={s.feedback.exposures.slice(0, 12)} />
          </Section>

          {Object.values(result.errors).some(Boolean) && (
            <Section title="조회 오류">
              {Object.entries(result.errors).map(([k, v]) =>
                v ? <KV key={k} label={k} value={v} /> : null
              )}
            </Section>
          )}

          <button
            type="button"
            className="text-[10px] font-bold underline"
            style={{ color: "var(--px-text2)" }}
            onClick={() => setShowRaw((v) => !v)}
          >
            {showRaw ? "raw JSON 닫기" : "raw JSON (권한 있을 때만)"}
          </button>
          {showRaw && (
            <pre
              className="text-[10px] p-2 border overflow-auto max-h-48"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg3)",
                color: "var(--px-text2)",
              }}
            >
              {JSON.stringify(
                {
                  privacy: result.privacy,
                  raw: result.raw,
                  sections: result.sections,
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
