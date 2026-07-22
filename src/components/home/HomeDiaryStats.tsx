"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DiaryEntry } from "@/lib/diary/types";
import {
  buildHomeDiaryStats,
  type HomeAreaHighlight,
  type RatingSeriesPoint,
} from "@/lib/diary/homeStats";
import {
  formatPersonalizationLevel,
  resolvePersonalizationLevelProgress,
  PERSONALIZATION_MAX_LEVEL,
  type PersonalizationLevelProgress,
} from "@/lib/product/personalizationLevel";

type Props = {
  entries: DiaryEntry[];
  todayDate: string;
  todayEntry: DiaryEntry | null;
};

const AREA_ACCENT: Record<string, string> = {
  energy: "var(--signal-energy)",
  focus: "var(--signal-focus)",
  condition: "var(--signal-condition)",
};

export default function HomeDiaryStats({
  entries,
  todayDate,
  todayEntry,
}: Props) {
  const stats = useMemo(
    () => buildHomeDiaryStats(entries, { today: todayDate }),
    [entries, todayDate]
  );
  const levelProgress = useMemo(
    () => resolvePersonalizationLevelProgress(entries),
    [entries]
  );

  return (
    <section className="space-y-3" aria-label="내 통계">
      <div className="flex items-end justify-between gap-2 px-0.5">
        <p className="ui-section-title">■ 내 기록 통계</p>
        <Link
          href="/diary/stats"
          className="text-[11px] font-bold underline"
          style={{ color: "#60a5fa" }}
        >
          패턴 더보기
        </Link>
      </div>

      <Happiness30Card
        avg={stats.happiness30.avg}
        hint={stats.happiness30.hint}
        count={stats.happiness30.count}
      />

      <HappinessTrendChart series={stats.happinessSeries} />

      <AreaHighLow
        highest={stats.highestArea}
        lowest={stats.lowestArea}
      />

      <LevelProgressCard progress={levelProgress} />

      {todayEntry ? (
        <div
          className="p-3 border-2 flex items-center justify-between gap-2"
          style={{
            background:
              "color-mix(in srgb, var(--signal-condition) 12%, var(--px-bg2))",
            borderColor: "var(--signal-condition)",
          }}
        >
          <div>
            <p
              className="text-xs font-black"
              style={{ color: "var(--signal-condition)" }}
            >
              오늘 기록 완료
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--px-text2)" }}>
              행복 {todayEntry.happinessRating ?? "—"}
              {todayEntry.energyRating != null
                ? ` · 에너지 ${todayEntry.energyRating}`
                : ""}
              {todayEntry.focusRating != null
                ? ` · 집중 ${todayEntry.focusRating}`
                : ""}
              {todayEntry.conditionRating != null
                ? ` · 컨디션 ${todayEntry.conditionRating}`
                : ""}
            </p>
          </div>
          <Link
            href={`/diary?date=${todayDate}`}
            className="text-xs font-bold underline shrink-0"
            style={{ color: "var(--px-accent)" }}
          >
            수정
          </Link>
        </div>
      ) : (
        <div
          className="p-3 border-2 flex items-center justify-between gap-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border)",
          }}
        >
          <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            아직 오늘 기록이 없어요
          </p>
          <Link href="/diary" className="ui-primary-btn px-3 py-2 text-xs shrink-0">
            일기 쓰기
          </Link>
        </div>
      )}
    </section>
  );
}

function LevelProgressCard({
  progress,
}: {
  progress: PersonalizationLevelProgress;
}) {
  const currentLabel = formatPersonalizationLevel(progress.level);
  const nextLabel = progress.isMax
    ? "MAX"
    : formatPersonalizationLevel(progress.level + 1);
  const maxLabel = formatPersonalizationLevel(PERSONALIZATION_MAX_LEVEL);
  const span = progress.nextLevelXp - progress.levelStartXp;

  return (
    <div
      className="p-3 border-2 space-y-3"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label={`개인화 레벨 ${currentLabel}`}
    >
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
            개인화 레벨
          </p>
          <p
            className="text-3xl font-black leading-none tabular-nums"
            style={{ color: "var(--px-accent)" }}
          >
            {currentLabel}
            <span
              className="text-sm font-bold ml-1"
              style={{ color: "var(--px-text2)" }}
            >
              / {maxLabel}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
            경험치
          </p>
          <p
            className="text-sm font-black tabular-nums"
            style={{ color: "var(--px-accent)" }}
          >
            {progress.totalXp.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
            {progress.isMax ? "최고 레벨" : `다음 ${nextLabel}까지`}
          </p>
          <p className="text-[10px] font-bold tabular-nums" style={{ color: "var(--px-text2)" }}>
            {progress.isMax ? "완료" : `${progress.xpIntoLevel} / ${span}`}
          </p>
        </div>
        <div
          className="h-2 w-full border"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
          role="progressbar"
          aria-valuenow={Math.round(progress.progressRatio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full"
            style={{
              width: `${progress.progressRatio * 100}%`,
              background: "var(--px-accent)",
            }}
          />
        </div>
      </div>

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
        {progress.isMax
          ? "기록이 충분히 쌓여 해석이 가장 깊게 맞춰져요."
          : "매일 쓰고, 수치·감정·본문을 자세히 적을수록 레벨이 오르고 해석도 더 정확해져요."}
      </p>
    </div>
  );
}

function Happiness30Card({
  avg,
  hint,
  count,
}: {
  avg: number | null;
  hint: string;
  count: number;
}) {
  const ratio = avg != null ? Math.min(1, avg / 10) : 0;
  return (
    <div
      className="p-3 border-2 space-y-2"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black" style={{ color: "var(--signal-emotion)" }}>
          행복도
        </p>
        <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
          최근 30일 평균
        </p>
      </div>
      <p
        className="text-3xl font-black leading-none tabular-nums"
        style={{ color: "var(--signal-emotion)" }}
      >
        {avg != null ? avg : "—"}
        {avg != null && (
          <span className="text-sm font-bold ml-1" style={{ color: "var(--px-text2)" }}>
            /10
          </span>
        )}
      </p>
      <div
        className="h-1.5 w-full border"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        aria-hidden
      >
        <div
          className="h-full"
          style={{
            width: `${ratio * 100}%`,
            background: "var(--signal-emotion)",
          }}
        />
      </div>
      <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
        {hint}
        {count > 0 ? ` · ${count}회` : ""}
      </p>
    </div>
  );
}

function AreaHighLow({
  highest,
  lowest,
}: {
  highest: HomeAreaHighlight | null;
  lowest: HomeAreaHighlight | null;
}) {
  if (!highest && !lowest) {
    return (
      <div
        className="p-3 border-2"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border)",
        }}
      >
        <p className="text-xs font-bold text-center" style={{ color: "var(--px-text2)" }}>
          에너지·집중·컨디션 기록이 쌓이면 강점/약점을 보여줘요
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <AreaCard kind="high" area={highest} />
      <AreaCard kind="low" area={lowest} />
    </div>
  );
}

function AreaCard({
  kind,
  area,
}: {
  kind: "high" | "low";
  area: HomeAreaHighlight | null;
}) {
  const accent =
    area != null
      ? AREA_ACCENT[area.key] ?? "var(--px-accent)"
      : "var(--px-text2)";
  const title = kind === "high" ? "Best" : "Worst";

  return (
    <div
      className="p-3 border-2 space-y-1.5"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
        {title}
      </p>
      {area ? (
        <>
          <p className="text-sm font-black" style={{ color: accent }}>
            {area.label}
          </p>
          <p className="text-xl font-black leading-none tabular-nums" style={{ color: accent }}>
            {area.avg}
            <span className="text-xs font-bold ml-0.5" style={{ color: "var(--px-text2)" }}>
              /{area.max}
            </span>
          </p>
        </>
      ) : (
        <p className="text-xs font-bold py-2" style={{ color: "var(--px-text2)" }}>
          —
        </p>
      )}
    </div>
  );
}

function HappinessTrendChart({ series }: { series: RatingSeriesPoint[] }) {
  const width = 320;
  const height = 120;
  const padX = 8;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = series.length;
  const barGap = 2;
  const barW = n > 0 ? (innerW - barGap * (n - 1)) / n : 0;

  const hasAny = series.some((p) => p.value != null);

  return (
    <div
      className="border-2 p-3 space-y-2"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label="행복도 추이 그래프"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black" style={{ color: "var(--signal-emotion)" }}>
          ■ 행복도 추이
        </p>
        <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
          최근 14일 · 1–10점
        </p>
      </div>

      {!hasAny ? (
        <p className="text-xs font-bold py-6 text-center" style={{ color: "var(--px-text2)" }}>
          아직 행복도 기록이 없어요
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          role="img"
          aria-label="최근 14일 행복도 막대 그래프"
        >
          {[1, 4, 7, 10].map((lv) => {
            const y = padY + innerH - ((lv - 1) / 9) * innerH;
            return (
              <line
                key={lv}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="var(--px-border)"
                strokeWidth={1}
                strokeDasharray={lv === 7 ? "0" : "2 3"}
                opacity={lv === 7 ? 0.9 : 0.45}
              />
            );
          })}

          {series.map((point, i) => {
            const x = padX + i * (barW + barGap);
            if (point.value == null) {
              return (
                <rect
                  key={point.date}
                  x={x}
                  y={padY + innerH - 2}
                  width={Math.max(1, barW)}
                  height={2}
                  fill="var(--px-border2)"
                  opacity={0.35}
                />
              );
            }
            const h = ((point.value - 1) / 9) * innerH;
            const y = padY + innerH - Math.max(h, 4);
            const color =
              point.value >= 8
                ? "var(--signal-condition)"
                : point.value <= 3
                  ? "#f87171"
                  : "var(--signal-emotion)";
            return (
              <g key={point.date}>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(1, barW)}
                  height={Math.max(4, h)}
                  fill={color}
                />
              </g>
            );
          })}

          {series[0] && (
            <text
              x={padX}
              y={height - 2}
              fill="var(--px-text2)"
              fontSize={9}
              fontWeight={700}
            >
              {series[0].date.slice(5).replace("-", ".")}
            </text>
          )}
          {series[n - 1] && (
            <text
              x={width - padX}
              y={height - 2}
              fill="var(--px-text2)"
              fontSize={9}
              fontWeight={700}
              textAnchor="end"
            >
              {series[n - 1]!.date.slice(5).replace("-", ".")}
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
