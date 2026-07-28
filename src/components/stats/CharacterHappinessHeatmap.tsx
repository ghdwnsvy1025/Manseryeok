"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Element } from "@/lib/saju/constants";
import {
  aggregateHappinessByCharacters,
  describeCharacterHappiness,
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

const UNLOCK_DAYS = 7;

type Tab = "stem" | "branch" | "ganji";

type Props = {
  entries: JournalEntry[];
  uniqueDays: number;
};

function formatSignedDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  return rounded.toFixed(1);
}

/**
 * A+C: 점수=크게·밝은색 / 증감=둘째 줄 초록·빨강 글자 / 오행·점수색은 테두리만
 */
function HappinessTile({
  row,
  compact,
}: {
  row: CharacterHappiness;
  compact?: boolean;
}) {
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
  /** 배경은 아주 옅게 — 점수·증감과 싸우지 않게 */
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
              className="mt-1 text-[11px] font-extrabold tabular-nums leading-none"
              style={{ color: deltaTone(delta, 0) }}
              title={`평균 대비 ${formatSignedDelta(delta)}`}
            >
              {formatSignedDelta(delta)}
            </span>
          ) : (
            <span
              className="mt-1 text-[11px] font-bold leading-none"
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

/** 천간·지지·간지별 행복도 — 기본 접힘, 한 줄 해석 우선 */
export default function CharacterHappinessHeatmap({
  entries,
  uniqueDays,
}: Props) {
  const [tab, setTab] = useState<Tab>("stem");
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(
    () => aggregateHappinessByCharacters(entries),
    [entries]
  );

  const rows =
    tab === "stem" ? data.stems : tab === "branch" ? data.branches : data.ganzhi;
  const cols =
    tab === "stem" ? "grid-cols-5" : tab === "branch" ? "grid-cols-4" : "grid-cols-4";

  const hasAny = data.stems.some((r) => r.count > 0);
  const insight = useMemo(() => describeCharacterHappiness(rows), [rows]);
  const early = uniqueDays < UNLOCK_DAYS;
  const headLabel = early
    ? `${uniqueDays}/${UNLOCK_DAYS}일`
    : `${uniqueDays}일 기록`;

  return (
    <section className="stats-section" aria-label="나의 사주 패턴">
      <div className="stats-section-head">
        <p className="ui-section-title">사주 패턴</p>
        <p className="stats-label tabular-nums">{headLabel}</p>
      </div>

      {!hasAny || early ? (
        <div className="stats-panel !shadow-none space-y-1.5">
          <p
            className="text-sm font-extrabold"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {uniqueDays === 0
              ? "기록 0일 · 패턴 잠금"
              : `${uniqueDays}일 기록 · ${UNLOCK_DAYS}일부터 해석`}
          </p>
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
          {early && (
            <Link href="/journal" className="stats-link inline-block">
              기록해서 채우기 →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-0.5">
          {insight.label ? (
            <p className="stats-label">{insight.label}</p>
          ) : null}
          <p className="stats-insight">{insight.text}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full py-2 text-xs font-extrabold border-2"
        style={{
          borderColor: "var(--px-border2)",
          color: "var(--px-text2)",
          background: "var(--px-bg3)",
        }}
        aria-expanded={expanded}
      >
        {expanded ? "글자 표 접기" : "글자별 표 펼치기"}
      </button>

      {expanded && (
        <div className="stats-panel space-y-2 !shadow-none">
          <div className="flex gap-1.5">
            {(
              [
                ["stem", "천간"],
                ["branch", "지지"],
                ["ganji", "간지"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`stats-chip flex-1 text-center${tab === id ? " is-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "ganji" && rows.length > 0 && (
            <p className="stats-label">테두리 = 행복도 · 숫자색 = 증감</p>
          )}
          {(tab === "stem" || tab === "branch") && hasAny && (
            <p className="stats-label">테두리 = 오행 · 초록/빨강 = 증감</p>
          )}

          {!hasAny ? (
            <p className="stats-label py-4 text-center">데이터 없음</p>
          ) : tab === "ganji" && rows.length === 0 ? (
            <p className="stats-label py-4 text-center">수집 간지 없음</p>
          ) : (
            <div className={`grid gap-1.5 ${cols}`}>
              {(tab === "ganji" ? rows.slice(0, 12) : rows).map((row) => (
                <HappinessTile
                  key={row.key}
                  row={row}
                  compact={tab !== "ganji"}
                />
              ))}
            </div>
          )}

          {tab === "ganji" && rows.length > 12 && (
            <p className="stats-label">상위 12개 · 전체는 도감</p>
          )}
        </div>
      )}
    </section>
  );
}
