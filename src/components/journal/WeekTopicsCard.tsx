"use client";

import type { WeekTopicSummary } from "@/lib/journal/topics/weekTopics";

type Props = {
  summary: WeekTopicSummary;
  /**
   * card — 독립 패널
   * nested — 요약 등 안에 구분선만
   * focus — 홈 「살피면 좋은 쪽」과 같은 좌측 액센트 행
   */
  variant?: "card" | "nested" | "focus";
};

const FOCUS_COLOR = "#f472b6";

/**
 * 행복도·상태값과 다른 축 — 일기 글에 반복된 화제
 */
export default function WeekTopicsCard({
  summary,
  variant = "card",
}: Props) {
  const { topics, plainLine, from, to, entryDays } = summary;

  if (variant === "focus") {
    return (
      <div
        className="space-y-2.5 pl-2.5"
        style={{ borderLeft: `3px solid ${FOCUS_COLOR}` }}
        aria-label="이번 주 화제"
      >
        <p
          className="text-xs font-black tracking-wide"
          style={{ color: FOCUS_COLOR }}
        >
          이번 주 화제
        </p>

        {topics.length > 0 ? (
          <div className="space-y-2.5">
            {topics.slice(0, 2).map((t) => (
              <div
                key={t.topicId}
                className="p-3 border-2 space-y-2 min-w-0"
                style={{
                  borderColor: `color-mix(in srgb, ${FOCUS_COLOR} 55%, var(--px-border))`,
                  background: "var(--px-bg3)",
                }}
              >
                {/* 화제 키워드 — 아래 위로/조언과 구별 */}
                <p
                  className="inline-block max-w-full px-2 py-0.5 text-[12px] font-black leading-snug border-2 truncate"
                  style={{
                    color: FOCUS_COLOR,
                    borderColor: `color-mix(in srgb, ${FOCUS_COLOR} 65%, var(--px-border))`,
                    background: `color-mix(in srgb, ${FOCUS_COLOR} 14%, var(--px-bg2))`,
                  }}
                  title={t.label}
                >
                  {t.label}
                </p>
                {t.supportLine && (
                  <p
                    className="text-[13px] font-medium leading-relaxed pt-1.5 border-t"
                    style={{
                      color: "var(--px-text2)",
                      borderColor: "var(--px-border)",
                      lineHeight: 1.65,
                    }}
                  >
                    {t.supportLine}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-sm font-bold leading-snug"
            style={{ color: "var(--px-text-on-panel)" }}
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
        <p
          className="text-[11px] font-black"
          style={{ color: "var(--signal-emotion)" }}
        >
          이번 주 화제
        </p>
        <p
          className="text-[10px] font-bold tabular-nums"
          style={{ color: "var(--px-text2)" }}
        >
          {from.slice(5)} ~ {to.slice(5)} · {entryDays}일
        </p>
      </div>

      <p
        className="text-sm font-bold leading-snug"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {plainLine}
      </p>

      {topics.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <li
              key={t.topicId}
              className="px-2 py-1 text-[11px] font-bold border-2"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--signal-emotion) 45%, var(--px-border))",
                background:
                  "color-mix(in srgb, var(--signal-emotion) 12%, var(--px-bg3))",
                color: "var(--signal-emotion)",
              }}
              title={`${t.dayCount}일에 등장 · 언급 ${t.mentionCount}회`}
            >
              {t.label}
              <span
                className="ml-1 tabular-nums opacity-80"
                style={{ color: "var(--px-text2)" }}
              >
                {t.dayCount}일
              </span>
            </li>
          ))}
        </ul>
      )}

      {variant === "card" && (
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
          행복도·상태 점수와 별개로, 일기 글에 반복해서 나온 소재를 모은 거예요.
        </p>
      )}
    </>
  );

  if (variant === "nested") {
    return (
      <div
        className="space-y-2 pt-3 border-t"
        style={{ borderColor: "var(--px-border)" }}
        aria-label="이번 주 화제"
      >
        {body}
      </div>
    );
  }

  return (
    <section
      className="p-3 border-2 space-y-2.5"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label="이번 주 화제"
    >
      {body}
    </section>
  );
}
