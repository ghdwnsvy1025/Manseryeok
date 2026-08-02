"use client";

import type { WeekTopicSummary } from "@/lib/journal/topics/weekTopics";

type Props = {
  summary: WeekTopicSummary;
  /** 상위 화제를 묶은 합쳐 조언 (홈 focus용) */
  combinedAdvice?: string | null;
  /**
   * card — 독립 패널
   * nested — 요약 등 안에 구분선만 (기록 탭: 칩만, 나열 문장 없음)
   * focus — 홈: 칩 + 감성 조언 한 문장
   */
  variant?: "card" | "nested" | "focus";
};

/**
 * 행복도·상태값과 다른 축 — 일기 글에 반복된 화제
 */
export default function WeekTopicsCard({
  summary,
  combinedAdvice,
  variant = "card",
}: Props) {
  const { topics, plainLine, from, to, entryDays } = summary;
  const topTopics = topics.slice(0, 3);
  const adviceLine = combinedAdvice?.trim() || null;

  const topicChips = (
    <ol className="space-y-2 list-none m-0 p-0">
      {topTopics.map((t, idx) => {
        const lead = idx === 0;
        return (
          <li
            key={t.topicId}
            className="flex items-center gap-2.5 min-w-0 border-2 px-3 py-2.5"
            style={{
              borderColor: lead ? "var(--px-accent)" : "var(--px-border2)",
              borderLeftWidth: lead ? 4 : 2,
              background: "var(--px-bg2)",
              boxShadow: lead ? "2px 2px 0 #000" : "none",
            }}
            title={`${t.label} · ${t.dayCount}일`}
          >
            <span
              className="shrink-0 w-7 h-7 flex items-center justify-center text-[13px] font-black border-2 tabular-nums"
              style={{
                color: lead ? "#111" : "#fafafc",
                borderColor: lead ? "var(--px-accent)" : "var(--px-border2)",
                background: lead ? "var(--px-accent)" : "var(--px-bg3)",
              }}
              aria-hidden
            >
              {idx + 1}
            </span>
            <span
              className={`min-w-0 flex-1 truncate font-black leading-snug ${
                lead ? "text-[1.08rem]" : "text-[15px]"
              }`}
              style={{ color: "#fffef8" }}
            >
              {t.label}
            </span>
            <span
              className="shrink-0 text-[14px] font-black tabular-nums"
              style={{ color: lead ? "var(--px-accent)" : "#c8c8d4" }}
            >
              {t.dayCount}
              <span
                className="ml-0.5 text-[12px] font-bold"
                style={{ color: "#a8a8b8" }}
              >
                일
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );

  if (variant === "focus") {
    return (
      <div
        className="space-y-3 p-3.5 border-2"
        style={{
          borderColor: "var(--px-border2)",
          background: "var(--px-bg3)",
          boxShadow: "2px 2px 0 #000",
        }}
        aria-label="지난 30일 화제"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="text-[15px] font-black tracking-wide"
            style={{ color: "#fffef8" }}
          >
            지난 30일 화제
          </p>
          <p
            className="text-[12px] font-bold tabular-nums"
            style={{ color: "#b0b0c0" }}
          >
            {entryDays}일 기록
          </p>
        </div>

        {topTopics.length > 0 ? (
          <div className="space-y-2.5">
            {topicChips}
            {adviceLine && (
              <p
                className="text-[14px] font-semibold leading-relaxed"
                style={{ color: "#e8e8f0", lineHeight: 1.65 }}
              >
                {adviceLine}
              </p>
            )}
          </div>
        ) : (
          <p
            className="text-[14px] font-semibold leading-snug"
            style={{ color: "#e8e8f0" }}
          >
            {plainLine}
          </p>
        )}
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-black" style={{ color: "#fffef8" }}>
          지난 30일 화제
        </p>
        <p
          className="text-[12px] font-bold tabular-nums"
          style={{ color: "#b0b0c0" }}
        >
          {from.slice(5)} ~ {to.slice(5)} · {entryDays}일
        </p>
      </div>

      {topTopics.length > 0 ? (
        topicChips
      ) : (
        <p
          className="text-[14px] font-semibold leading-snug"
          style={{ color: "#e8e8f0" }}
        >
          {plainLine}
        </p>
      )}

      {variant === "card" && adviceLine ? (
        <p
          className="text-[14px] font-semibold leading-relaxed"
          style={{ color: "#e8e8f0", lineHeight: 1.65 }}
        >
          {adviceLine}
        </p>
      ) : null}
    </>
  );

  if (variant === "nested") {
    return (
      <div
        className="space-y-2.5 pt-3 border-t"
        style={{ borderColor: "var(--px-border)" }}
        aria-label="지난 30일 화제"
      >
        {body}
      </div>
    );
  }

  return (
    <section
      className="p-3.5 border-2 space-y-2.5"
      style={{
        background: "var(--px-bg3)",
        borderColor: "var(--px-border2)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label="지난 30일 화제"
    >
      {body}
    </section>
  );
}
