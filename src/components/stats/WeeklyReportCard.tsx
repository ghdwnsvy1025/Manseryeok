"use client";

import { useState } from "react";
import type { WeeklyReport } from "@/lib/journal/statsInsight";
import { deltaTone, happinessTone } from "@/lib/journal/statsTone";

type Props = {
  report: WeeklyReport;
};

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 주간 리포트 — 요일 스트립 + 하이라이트 + 공유 */
export default function WeeklyReportCard({ report }: Props) {
  const [shared, setShared] = useState<"idle" | "done" | "failed">("idle");

  const share = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: report.shareText });
        setShared("done");
        return;
      }
      await navigator.clipboard.writeText(report.shareText);
      setShared("done");
    } catch {
      setShared("failed");
    }
  };

  const highlights = [
    report.bestDay
      ? {
          label: "좋았던 날",
          value: `${report.bestDay.date.slice(5).replace("-", ".")} · ${report.bestDay.value.toFixed(1)}`,
          color: happinessTone(report.bestDay.value),
        }
      : null,
    report.bestCategory
      ? {
          label: "잘 지킨 것",
          value: `${report.bestCategory.name} ${report.bestCategory.average.toFixed(1)}`,
          color: undefined,
        }
      : null,
    report.worstCategory
      ? {
          label: "아쉬운 것",
          value: `${report.worstCategory.name} ${report.worstCategory.average.toFixed(1)}`,
          color: undefined,
        }
      : null,
    report.newGanji.length > 0
      ? {
          label: "새 간지",
          value: report.newGanji.join(", "),
          color: "var(--px-accent)",
        }
      : null,
  ].filter((h): h is NonNullable<typeof h> => h != null);

  return (
    <div
      className="p-3 border-2 space-y-3"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg3)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="stats-label">주간 리포트</p>
          <p
            className="text-sm font-extrabold tabular-nums"
            style={{ color: "var(--px-text)" }}
          >
            {report.rangeLabel}
          </p>
        </div>
        <p className="tabular-nums shrink-0 text-right">
          <span
            className="stats-metric !text-lg"
            style={
              report.avg != null
                ? { color: happinessTone(report.avg) }
                : undefined
            }
          >
            {report.avg != null ? report.avg.toFixed(1) : "-"}
          </span>
          {report.avg != null ? (
            <span className="stats-metric-unit">/10</span>
          ) : null}
          {report.deltaFromPrevWeek != null ? (
            <span
              className="ml-1.5 text-[11px] font-extrabold"
              style={{ color: deltaTone(report.deltaFromPrevWeek) }}
            >
              {report.deltaFromPrevWeek > 0
                ? `+${report.deltaFromPrevWeek.toFixed(1)}`
                : report.deltaFromPrevWeek.toFixed(1)}
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {report.days.map((day, i) => (
          <div key={day.date} className="space-y-1 text-center">
            <p className="stats-label">{WEEKDAY_KO[i % 7]}</p>
            <div
              className="h-9 border flex items-center justify-center"
              style={{
                borderColor: "var(--px-border)",
                background:
                  day.value != null
                    ? `color-mix(in srgb, ${happinessTone(day.value)} 22%, var(--px-bg2))`
                    : "var(--px-bg2)",
              }}
              title={
                day.value != null
                  ? `${day.date} · ${day.value.toFixed(1)}점`
                  : `${day.date} · 미기록`
              }
            >
              <span
                className="text-xs font-black tabular-nums"
                style={{
                  color:
                    day.value != null
                      ? happinessTone(day.value)
                      : "var(--px-border2)",
                }}
              >
                {day.value != null ? day.value.toFixed(0) : "·"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="stats-label tabular-nums">
        기록 {report.recordedDays}/{report.totalDays}일
      </p>

      {highlights.length > 0 && (
        <dl className="space-y-1">
          {highlights.map((h) => (
            <div key={h.label} className="flex items-baseline justify-between gap-3">
              <dt className="stats-label">{h.label}</dt>
              <dd
                className="text-xs font-extrabold tabular-nums text-right"
                style={{ color: h.color ?? "var(--px-text-on-panel)" }}
              >
                {h.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {report.recordedDays === 0 && (
        <p className="stats-label">하루만 남겨도 리포트가 채워집니다</p>
      )}

      {report.recordedDays > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void share()}
            className="px-3 py-1.5 text-xs font-extrabold border-2"
            style={{
              borderColor: "var(--px-border2)",
              color: "var(--px-text-on-panel)",
              background: "var(--px-bg2)",
            }}
          >
            리포트 공유
          </button>
          {shared === "done" && (
            <span
              className="text-[11px] font-extrabold"
              style={{ color: "#4ade80" }}
            >
              복사했어요
            </span>
          )}
          {shared === "failed" && (
            <span
              className="text-[11px] font-extrabold"
              style={{ color: "#f87171" }}
            >
              공유 실패
            </span>
          )}
        </div>
      )}
    </div>
  );
}
