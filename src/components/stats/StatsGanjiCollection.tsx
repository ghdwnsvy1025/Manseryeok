"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CollectionMission } from "@/lib/journal/statsInsight";
import type {
  GanjiCollectionEntry,
  GanjiCollectionStatus,
} from "@/lib/diary/collection";
import { happinessTone } from "@/lib/journal/statsTone";

const STATUS_STYLE: Record<
  GanjiCollectionStatus,
  { border: string; opacity: number }
> = {
  locked: { border: "var(--px-border)", opacity: 0.35 },
  discovered: { border: "#60a5fa", opacity: 1 },
  pattern: { border: "var(--px-accent)", opacity: 1 },
};

type Props = {
  collection: GanjiCollectionEntry[];
  collected: number;
  patternCount: number;
  ganjiHappiness: Map<string, { average: number; count: number }>;
  mission: CollectionMission;
  /** 미션 배너는 상단으로 올렸으면 false */
  showMissionBanner?: boolean;
};

function CollectionTile({
  item,
  happiness,
}: {
  item: GanjiCollectionEntry;
  happiness: { average: number; count: number } | undefined;
}) {
  const style = STATUS_STYLE[item.status];
  const avg = happiness?.average;
  return (
    <div
      className="p-2 border-2 text-center min-h-[3.6rem] flex flex-col justify-center"
      style={{
        borderColor: style.border,
        background:
          avg != null && item.status !== "locked"
            ? `color-mix(in srgb, ${happinessTone(avg)} 22%, var(--px-bg3))`
            : "var(--px-bg3)",
        opacity: style.opacity,
        boxShadow: item.status === "pattern" ? "1px 1px 0 #000" : undefined,
      }}
      title={
        item.status === "locked"
          ? "미수집"
          : avg != null
            ? `${item.entryCount}회 · 행복 ${avg.toFixed(1)}`
            : `${item.entryCount}회`
      }
    >
      <p
        className="text-sm font-black leading-none"
        style={{
          color:
            item.status === "locked" ? "var(--px-text2)" : "var(--px-accent)",
        }}
      >
        {item.ganjiKo}
      </p>
      {item.status !== "locked" && (
        <p
          className="text-[10px] font-extrabold mt-1 tabular-nums"
          style={{
            color: avg != null ? happinessTone(avg) : "var(--px-accent)",
          }}
        >
          {avg != null ? avg.toFixed(1) : `${item.entryCount}회`}
        </p>
      )}
    </div>
  );
}

/** 간지 도감 — 수집 진행 + 미리보기, 펼치면 60칸 */
export default function StatsGanjiCollection({
  collection,
  collected,
  patternCount,
  ganjiHappiness,
  mission,
  showMissionBanner = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const progress = Math.min(100, Math.round((collected / 60) * 100));

  const unlockedPreview = useMemo(
    () => collection.filter((c) => c.status !== "locked").slice(0, 10),
    [collection]
  );

  return (
    <section className="stats-section" aria-label="간지 도감">
      <div className="stats-section-head">
        <p className="ui-section-title">간지 도감</p>
        <p className="stats-label tabular-nums">
          <span style={{ color: "var(--px-accent)", fontWeight: 900 }}>
            {collected}
          </span>
          /60
          {patternCount > 0 ? ` · 패턴 ${patternCount}` : ""}
        </p>
      </div>

      <div className="stats-panel space-y-3 !shadow-none">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="stats-label">수집률</p>
            <p className="text-xs font-extrabold tabular-nums" style={{ color: "var(--px-accent)" }}>
              {progress}%
            </p>
          </div>
          <div className="stats-progress-track" aria-hidden>
            <div
              className="stats-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {showMissionBanner && (
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-sm font-extrabold truncate"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              {mission.title}
            </p>
            {mission.ctaLabel ? (
              <Link href={mission.href} className="stats-link shrink-0">
                기록 →
              </Link>
            ) : null}
          </div>
        )}

        {collected === 0 ? (
          <div className="space-y-1">
            <p
              className="text-sm font-extrabold"
              style={{ color: "var(--px-accent)" }}
            >
              첫 간지: {mission.ganjiKo}
            </p>
            <p className="stats-label">오늘 기록하면 도감 1칸이 열려요</p>
          </div>
        ) : (
          !expanded &&
          unlockedPreview.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5">
              {unlockedPreview.map((item) => (
                <CollectionTile
                  key={item.ganjiKo}
                  item={item}
                  happiness={ganjiHappiness.get(item.ganjiKo)}
                />
              ))}
            </div>
          )
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full py-2 text-xs font-extrabold border-2"
          style={{
            borderColor: "var(--px-border2)",
            color: "var(--px-text-on-panel)",
            background: "var(--px-bg3)",
          }}
          aria-expanded={expanded}
        >
          {expanded ? "60칸 접기" : `60칸 펼치기`}
        </button>

        {expanded && (
          <div className="grid grid-cols-5 gap-1.5">
            {collection.map((item) => (
              <CollectionTile
                key={item.ganjiKo}
                item={item}
                happiness={ganjiHappiness.get(item.ganjiKo)}
              />
            ))}
          </div>
        )}
      </div>

      <Link href="/diary/collection" className="stats-link">
        도감 페이지 →
      </Link>
    </section>
  );
}
