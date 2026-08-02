"use client";

import { useState } from "react";
import type { WeeklyReport } from "@/lib/journal/statsInsight";
import { happinessTone } from "@/lib/journal/statsTone";
import { shareAppText } from "@/lib/app/shareInvite";

type Props = {
  report: WeeklyReport;
  /** 모달 안이면 바깥 패딩·그림자만 살짝 다르게 */
  embedded?: boolean;
};

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 주간 리포트 — 숫자·요일만 한눈에 */
export default function WeeklyReportCard({ report, embedded }: Props) {
  const [shared, setShared] = useState<"idle" | "done" | "failed">("idle");

  const share = async () => {
    try {
      await shareAppText(report.shareText, "/");
      setShared("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setShared("failed");
    }
  };

  const highlights = [
    report.bestDay
      ? {
          key: "best-day",
          eyebrow: "가장 환했던 날",
          title: report.bestDay.date.slice(5).replace("-", "."),
          value: report.bestDay.value.toFixed(1),
          tone: happinessTone(report.bestDay.value),
          hint: "그날의 행복도",
        }
      : null,
    report.bestCategory
      ? {
          key: "best-cat",
          eyebrow: "잘 흘러간 영역",
          title: report.bestCategory.name,
          value: report.bestCategory.average.toFixed(1),
          tone: "var(--px-accent)",
          hint: "주간 평균",
        }
      : null,
    report.worstCategory
      ? {
          key: "soft-cat",
          eyebrow: "돌봐줄 영역",
          title: report.worstCategory.name,
          value: report.worstCategory.average.toFixed(1),
          tone: "#e88caa",
          hint: "주간 평균",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    eyebrow: string;
    title: string;
    value: string;
    tone: string;
    hint: string;
  }>;

  return (
    <div
      className="p-3.5 border-2 space-y-3.5"
      style={{
        borderColor: "var(--px-accent)",
        background: "var(--px-bg3)",
        boxShadow: embedded ? "4px 4px 0 #4a3a00" : "3px 3px 0 #4a3a00",
      }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="stats-emphasize-title !text-[17px]">주간 리포트</p>
          <p
            className="text-[13px] font-bold tabular-nums mt-1"
            style={{ color: "var(--px-text2)" }}
          >
            {report.rangeLabel}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-[12px] font-black tracking-wide"
            style={{ color: "var(--px-text2)" }}
          >
            이번 주 평균
          </p>
          <p
            className="text-[2rem] font-black tabular-nums leading-none mt-1"
            style={{
              color:
                report.avg != null
                  ? happinessTone(report.avg)
                  : "var(--px-text2)",
            }}
          >
            {report.avg != null ? report.avg.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {report.days.map((day, i) => (
          <div key={day.date} className="text-center space-y-1">
            <p
              className="text-[12px] font-black"
              style={{ color: "var(--px-text2)" }}
            >
              {WEEKDAY_KO[i % 7]}
            </p>
            <div
              className="h-11 border-2 flex items-center justify-center"
              style={{
                borderColor: "var(--px-border)",
                background:
                  day.value != null
                    ? `color-mix(in srgb, ${happinessTone(day.value)} 25%, var(--px-bg2))`
                    : "var(--px-bg2)",
              }}
            >
              <span
                className="text-base font-black tabular-nums"
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

      {highlights.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 pt-1">
          {highlights.map((h) => (
            <div
              key={h.key}
              className="relative overflow-hidden border-2 px-3.5 py-3"
              style={{
                borderColor: h.tone,
                background: `color-mix(in srgb, ${h.tone} 12%, var(--px-bg2))`,
                boxShadow: `2px 2px 0 color-mix(in srgb, ${h.tone} 40%, #000)`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-left">
                  <p
                    className="text-[12px] font-black tracking-[0.04em]"
                    style={{ color: h.tone }}
                  >
                    {h.eyebrow}
                  </p>
                  <p
                    className="mt-1 text-[17px] font-black leading-tight truncate"
                    style={{ color: "var(--px-text)" }}
                  >
                    {h.title}
                  </p>
                  <p
                    className="mt-1 text-[12px] font-bold"
                    style={{ color: "var(--px-text2)" }}
                  >
                    {h.hint}
                  </p>
                </div>
                <p
                  className="shrink-0 text-[2rem] font-black tabular-nums leading-none"
                  style={{ color: h.tone }}
                >
                  {h.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {report.recordedDays > 0 && (
        <button
          type="button"
          onClick={() => void share()}
          className="w-full py-3 text-[15px] font-black border-2"
          style={{
            borderColor: "var(--px-accent)",
            color: "#111",
            background: "var(--px-accent)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          {shared === "done"
            ? "공유됨 · 링크 포함"
            : shared === "failed"
              ? "공유 실패"
              : "친구에게 공유"}
        </button>
      )}
    </div>
  );
}
