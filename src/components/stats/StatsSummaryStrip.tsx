"use client";

import WeekTopicsCard from "@/components/journal/WeekTopicsCard";
import { happinessTone } from "@/lib/journal/statsTone";
import type { WeekTopicSummary } from "@/lib/journal/topics/weekTopics";

type Props = {
  avg30: number | null;
  monthRecordedDays: number;
  streakDays: number;
  recordedToday: boolean;
  weekTopics?: WeekTopicSummary | null;
};

/** 기록 탭 상단 — 요약 숫자 + 이번 주 화제 */
export default function StatsSummaryStrip({
  avg30,
  monthRecordedDays,
  streakDays,
  recordedToday,
  weekTopics,
}: Props) {
  const items = [
    {
      label: "30일 평균",
      value: avg30 != null ? avg30.toFixed(1) : "-",
      unit: avg30 != null ? "/10" : "",
      color: avg30 != null ? happinessTone(avg30) : undefined,
      collect: false,
      hint: null as string | null,
    },
    {
      label: "이달 기록",
      value: String(monthRecordedDays),
      unit: "일",
      color: undefined,
      collect: false,
      hint: null,
    },
    {
      label: "연속",
      value: streakDays > 0 ? String(streakDays) : "0",
      unit: "일",
      color: undefined,
      collect: streakDays > 0,
      hint: !recordedToday && streakDays > 0 ? "오늘 미기록" : null,
    },
  ];

  return (
    <section className="stats-section" aria-label="요약">
      <div className="stats-emphasize-head">
        <p className="stats-emphasize-title">요약</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="stats-panel text-center space-y-1.5 !shadow-none"
          >
            <p className="stats-label">{item.label}</p>
            <p
              className={`stats-metric${item.collect ? " is-collect" : ""}`}
              style={item.color ? { color: item.color } : undefined}
            >
              {item.value}
              {item.unit ? (
                <span className="stats-metric-unit">{item.unit}</span>
              ) : null}
            </p>
            {item.hint ? (
              <p className="stats-status-warn">{item.hint}</p>
            ) : (
              <p className="stats-label opacity-0 select-none" aria-hidden>
                —
              </p>
            )}
          </div>
        ))}
      </div>

      {weekTopics && (
        <div className="mt-3">
          <WeekTopicsCard summary={weekTopics} variant="nested" />
        </div>
      )}
    </section>
  );
}
