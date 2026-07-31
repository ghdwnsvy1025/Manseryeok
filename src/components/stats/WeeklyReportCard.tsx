"use client";

import { useState } from "react";
import type { WeeklyReport } from "@/lib/journal/statsInsight";
import { deltaTone, happinessTone } from "@/lib/journal/statsTone";

type Props = {
  report: WeeklyReport;
};

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 주간 리포트 — 숫자·요일만 한눈에 */
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

  return (
    <div
      className="p-3 border-2 space-y-3"
      style={{
        borderColor: "var(--px-accent)",
        background: "var(--px-bg3)",
        boxShadow: "3px 3px 0 #4a3a00",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="stats-emphasize-title !text-[15px]">주간 리포트</p>
          <p
            className="text-xs font-bold tabular-nums mt-0.5"
            style={{ color: "var(--px-text2)" }}
          >
            {report.rangeLabel}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-2xl font-black tabular-nums leading-none"
            style={{
              color:
                report.avg != null
                  ? happinessTone(report.avg)
                  : "var(--px-text2)",
            }}
          >
            {report.avg != null ? report.avg.toFixed(1) : "-"}
          </p>
          <p className="text-[11px] font-bold mt-1" style={{ color: "var(--px-text2)" }}>
            {report.recordedDays}/{report.totalDays}일
            {report.deltaFromPrevWeek != null ? (
              <span
                className="ml-1.5 tabular-nums"
                style={{ color: deltaTone(report.deltaFromPrevWeek) }}
              >
                {report.deltaFromPrevWeek > 0
                  ? `+${report.deltaFromPrevWeek.toFixed(1)}`
                  : report.deltaFromPrevWeek.toFixed(1)}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {report.days.map((day, i) => (
          <div key={day.date} className="text-center space-y-1">
            <p
              className="text-[10px] font-black"
              style={{ color: "var(--px-text2)" }}
            >
              {WEEKDAY_KO[i % 7]}
            </p>
            <div
              className="h-10 border-2 flex items-center justify-center"
              style={{
                borderColor: "var(--px-border)",
                background:
                  day.value != null
                    ? `color-mix(in srgb, ${happinessTone(day.value)} 25%, var(--px-bg2))`
                    : "var(--px-bg2)",
              }}
            >
              <span
                className="text-sm font-black tabular-nums"
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

      {(report.bestDay || report.bestCategory || report.worstCategory) && (
        <div
          className="grid gap-1.5 pt-1"
          style={{ borderTop: "1px solid var(--px-border)" }}
        >
          {report.bestDay && (
            <div className="flex justify-between gap-2 text-sm font-bold">
              <span style={{ color: "var(--px-text2)" }}>최고</span>
              <span
                className="tabular-nums"
                style={{ color: happinessTone(report.bestDay.value) }}
              >
                {report.bestDay.date.slice(5).replace("-", ".")} ·{" "}
                {report.bestDay.value.toFixed(1)}
              </span>
            </div>
          )}
          {report.bestCategory && (
            <div className="flex justify-between gap-2 text-sm font-bold">
              <span style={{ color: "var(--px-text2)" }}>잘한 것</span>
              <span style={{ color: "var(--px-text-on-panel)" }}>
                {report.bestCategory.name} {report.bestCategory.average.toFixed(1)}
              </span>
            </div>
          )}
          {report.worstCategory && (
            <div className="flex justify-between gap-2 text-sm font-bold">
              <span style={{ color: "var(--px-text2)" }}>아쉬운 것</span>
              <span style={{ color: "var(--px-text-on-panel)" }}>
                {report.worstCategory.name}{" "}
                {report.worstCategory.average.toFixed(1)}
              </span>
            </div>
          )}
          {report.newGanji.length > 0 && (
            <div className="flex justify-between gap-2 text-sm font-bold">
              <span style={{ color: "var(--px-text2)" }}>새 간지</span>
              <span style={{ color: "var(--px-accent)" }}>
                {report.newGanji.join(" ")}
              </span>
            </div>
          )}
        </div>
      )}

      {report.recordedDays > 0 && (
        <button
          type="button"
          onClick={() => void share()}
          className="w-full py-2.5 text-sm font-black border-2"
          style={{
            borderColor: "var(--px-border)",
            color: "var(--px-text-on-panel)",
            background: "var(--px-bg2)",
          }}
        >
          {shared === "done"
            ? "복사됨"
            : shared === "failed"
              ? "공유 실패"
              : "공유"}
        </button>
      )}
    </div>
  );
}
