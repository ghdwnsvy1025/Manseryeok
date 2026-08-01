"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { HomeEStats } from "@/lib/journal/homeStats";
import WaveText from "@/components/motion/WaveText";
import { personalizationFromXp } from "@/lib/journal/personalization";
import { formatPersonalizationLevel } from "@/lib/product/personalizationLevel";
import { XP_GAUGE_FILL } from "@/lib/ui/xpGauge";

type Props = {
  stats: HomeEStats;
};

/** 홈 — 개인화 요약만. 행복도 추이 그래프는 통계 탭으로 이동. */
export default function HomeEBlock({ stats }: Props) {
  const lv = stats.level;
  const personalization = useMemo(
    () => personalizationFromXp(lv.totalXp),
    [lv.totalXp]
  );

  return (
    <section className="space-y-3">
      <div className="ui-emphasize-head">
        <WaveText className="ui-emphasize-title">맞춤 레벨</WaveText>
        <Link
          href="/stats"
          className="text-xs font-bold underline shrink-0"
          style={{ color: "#60a5fa" }}
          onClick={() => {
            void import("@/lib/analytics/posthog").then(
              ({ ANALYTICS_EVENTS, captureUiClick }) => {
                captureUiClick(
                  ANALYTICS_EVENTS.homeStatsTrendClicked,
                  "home_stats_trend"
                );
              }
            );
          }}
        >
          기록 · 추이 보기
        </Link>
      </div>

      <div
        className="p-3 border-2 space-y-1.5"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p
              className="text-sm font-bold shrink-0"
              style={{ color: "var(--px-text)" }}
            >
              {formatPersonalizationLevel(lv.level)}
            </p>
            <span
              className="inline-flex items-center px-1.5 py-0.5 border text-[11px] font-black leading-none"
              style={{
                color: "var(--px-accent)",
                borderColor: "var(--px-accent)",
                background:
                  "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))",
              }}
            >
              {personalization.stageLabel}
            </span>
          </div>
          <p className="ui-hint shrink-0">
            {lv.isMax ? "MAX" : `다음까지 ${lv.xpToNext} XP`}
          </p>
        </div>
        <div
          className="h-2.5 border overflow-hidden"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${Math.max(4, Math.round(lv.progressRatio * 100))}%`,
              background: XP_GAUGE_FILL,
            }}
          />
        </div>
        <p
          className="text-[12px] font-bold leading-snug"
          style={{ color: "var(--px-accent)" }}
        >
          {personalization.fitComplete
            ? "맞춤 완료 · 레벨이 오를수록 운세가 더 정확해져요"
            : "레벨이 높아질수록 운세가 더 정확해져요"}
        </p>
      </div>
    </section>
  );
}
