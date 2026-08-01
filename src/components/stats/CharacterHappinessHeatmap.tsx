"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Element } from "@/lib/saju/constants";
import {
  aggregateHappinessByCharacters,
  type CharacterHappiness,
} from "@/lib/journal/statsInsight";
import { deltaTone, happinessTone } from "@/lib/journal/statsTone";
import type { JournalEntry } from "@/lib/journal/types";

const ELEM_COLORS: Record<Element, string> = {
  wood: "#4ade80",
  fire: "#f87171",
  earth: "#fbbf24",
  metal: "#cbd5e1",
  water: "#60a5fa",
};

const UNLOCK_DAYS = 2;

type Tab = "stem" | "branch";

type Props = {
  entries: JournalEntry[];
  uniqueDays: number;
};

function formatSignedDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  return rounded.toFixed(1);
}

function HappinessTile({
  row,
  compact,
}: {
  row: CharacterHappiness;
  compact?: boolean;
}) {
  /** 0회만 비움 — 1회여도 그날 행복도가 곧 평균 */
  const insufficient = row.count < 1;
  const borderColor = row.element
    ? ELEM_COLORS[row.element]
    : row.average != null
      ? happinessTone(row.average)
      : "var(--px-border)";
  const washColor = row.element
    ? ELEM_COLORS[row.element]
    : row.average != null
      ? happinessTone(row.average)
      : "var(--px-border2)";
  const fillOpacity =
    insufficient || row.average == null
      ? 0.04
      : Math.max(0.06, Math.min(0.18, (row.average / 10) * 0.18));
  const showDelta =
    row.deltaFromOverall != null && Math.abs(row.deltaFromOverall) >= 0.1;
  const delta = row.deltaFromOverall ?? 0;

  return (
    <div
      className={`relative border-2 text-center flex flex-col items-center justify-center ${
        compact ? "px-1.5 py-2 min-h-[4.1rem]" : "px-2 py-2.5 min-h-[4.4rem]"
      }`}
      style={{
        borderColor,
        background: `color-mix(in srgb, ${washColor} ${Math.round(
          fillOpacity * 100
        )}%, var(--px-bg2))`,
        opacity: insufficient ? 0.55 : 1,
      }}
    >
      <span
        className={`block font-black leading-none ${
          compact ? "text-sm" : "text-base"
        }`}
        style={{ color: "var(--px-text2)" }}
      >
        {row.key}
      </span>
      {insufficient || row.average == null ? (
        <span
          className="block mt-1.5 text-sm font-bold"
          style={{ color: "var(--px-text2)" }}
        >
          —
        </span>
      ) : (
        <>
          <span
            className={`block mt-1 font-black tabular-nums leading-none ${
              compact ? "text-lg" : "text-xl"
            }`}
            style={{ color: "var(--px-text)" }}
          >
            {row.average.toFixed(1)}
          </span>
          {showDelta ? (
            <span
              className="mt-1 text-xs font-extrabold tabular-nums leading-none"
              style={{ color: deltaTone(delta, 0) }}
              aria-label={`평균 대비 ${formatSignedDelta(delta)}`}
            >
              {formatSignedDelta(delta)}
            </span>
          ) : (
            <span
              className="mt-1 text-xs font-bold leading-none"
              style={{ color: "var(--px-border2)" }}
            >
              ·
            </span>
          )}
        </>
      )}
      <span
        className="absolute bottom-0.5 right-0.5 text-[9px] font-bold"
        style={{ color: "var(--px-text2)" }}
      >
        {row.count}회
      </span>
    </div>
  );
}

/** 천간·지지별 행복도 — 해금 시 표 기본 펼침 */
export default function CharacterHappinessHeatmap({
  entries,
  uniqueDays,
}: Props) {
  const early = uniqueDays < UNLOCK_DAYS;
  const [tab, setTab] = useState<Tab>("stem");
  const data = useMemo(
    () => aggregateHappinessByCharacters(entries),
    [entries]
  );

  const rows = tab === "stem" ? data.stems : data.branches;
  const cols = tab === "stem" ? "grid-cols-5" : "grid-cols-4";
  const hasAny = data.stems.some((r) => r.count > 0);
  const unlocked = !early && hasAny;

  return (
    <section className="stats-section" aria-label="나의 사주 패턴">
      <div className="stats-emphasize-head">
        <p className="stats-emphasize-title">사주 패턴</p>
        {!unlocked ? (
          <p
            className="text-xs font-black tabular-nums"
            style={{ color: "var(--px-text2)" }}
          >
            {uniqueDays}/{UNLOCK_DAYS}일
          </p>
        ) : data.overall != null ? (
          <p className="tabular-nums shrink-0 text-right">
            <span
              className="text-lg font-black"
              style={{ color: happinessTone(data.overall) }}
            >
              {data.overall.toFixed(1)}
            </span>
            <span className="stats-metric-unit">/10</span>
          </p>
        ) : null}
      </div>

      {!unlocked ? (
        <div className="stats-panel !shadow-none space-y-1.5">
          <p
            className="text-sm font-extrabold"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {uniqueDays === 0
              ? "기록이 쌓이면 천간·지지 패턴이 열려요"
              : `${uniqueDays}/2일 · 상대 비교는 이틀부터`}
          </p>
          {uniqueDays === 0 ? (
            <Link href="/journal" className="stats-link inline-block">
              기록하기 →
            </Link>
          ) : (
            <div className="stats-progress-track" aria-hidden>
              <div
                className="stats-progress-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((uniqueDays / UNLOCK_DAYS) * 100)
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="stats-panel space-y-2 !shadow-none">
          <div className="flex gap-1.5">
            {(
              [
                ["stem", "천간"],
                ["branch", "지지"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  void import("@/lib/analytics/posthog").then(
                    ({ ANALYTICS_EVENTS, captureUiClick }) => {
                      captureUiClick(
                        ANALYTICS_EVENTS.patternTabSelected,
                        "pattern_tab",
                        { tab: id }
                      );
                    }
                  );
                }}
                className={`stats-chip flex-1 text-center${tab === id ? " is-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={`grid gap-1.5 ${cols}`}>
            {rows.map((row) => (
              <HappinessTile key={row.key} row={row} compact />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
