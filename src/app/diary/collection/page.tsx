"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildGanjiCollection, getCollectionSummary, type GanjiCollectionEntry, type GanjiCollectionStatus } from "@/lib/diary/collection";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import type { DiaryEntry } from "@/lib/diary/types";

const STATUS_STYLE: Record<GanjiCollectionStatus, { border: string; opacity: number }> = {
  locked: { border: "var(--px-border)", opacity: 0.35 },
  discovered: { border: "#60a5fa", opacity: 1 },
  pattern: { border: "var(--px-accent)", opacity: 1 },
};

function CollectionTile({ item }: { item: GanjiCollectionEntry }) {
  const style = STATUS_STYLE[item.status];
  return (
    <div
      className="p-2 border-2 text-center min-h-[4rem] flex flex-col justify-center"
      style={{
        borderColor: style.border,
        background: "var(--px-bg3)",
        opacity: style.opacity,
        boxShadow: item.status === "pattern" ? "2px 2px 0 #000" : undefined,
      }}
      title={item.status === "locked" ? "미수집" : `${item.entryCount}회 기록`}
    >
      <p
        className="text-sm font-black leading-none"
        style={{ color: item.status === "locked" ? "var(--px-text2)" : "var(--px-accent)" }}
      >
        {item.ganjiKo}
      </p>
      {item.status !== "locked" && (
        <>
          <p className="text-xs font-bold mt-1" style={{ color: "#4ade80" }}>
            {item.avgWellbeing > 0 ? `${item.avgWellbeing}점` : `${item.entryCount}회`}
          </p>
          {item.status === "pattern" && (
            <p className="ui-hint">{item.entryCount}회</p>
          )}
        </>
      )}
    </div>
  );
}

export default function CollectionPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDiaryStorage()
      .then((s) => s.list())
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const collection = useMemo(() => buildGanjiCollection(entries), [entries]);
  const summary = useMemo(() => getCollectionSummary(entries), [entries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          ■ 간지 도감
        </h2>
        <Link
          href="/diary/stats"
          className="text-xs font-bold px-2 py-1 border"
          style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
        >
          ← 통계
        </Link>
      </div>

      {loading && <p className="ui-hint">불러오는 중...</p>}

      {!loading && entries.length === 0 && (
        <div
          className="p-4 border-2 space-y-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
        >
          <p className="ui-guide">일진을 기록하면 간지 도감에 도장이 찍혀요.</p>
          <Link href="/diary" className="ui-primary-btn inline-block px-4 py-2 text-xs">
            오늘 일진 기록하기
          </Link>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div
            className="p-3 border-2 grid grid-cols-3 gap-2 text-center"
            style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
          >
            <div>
              <p className="ui-list-label">간지</p>
              <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
                {summary.ganjiCollected}/{summary.ganjiTotal}
              </p>
            </div>
            <div>
              <p className="ui-list-label">천간</p>
              <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
                {summary.stemCollected}/{summary.stemTotal}
              </p>
            </div>
            <div>
              <p className="ui-list-label">지지</p>
              <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
                {summary.branchCollected}/{summary.branchTotal}
              </p>
            </div>
          </div>

          <p className="ui-guide px-1">
            기록한 간지는 색이 채워져요. 2회 이상 기록하면 금테(패턴)로 표시되고{" "}
            <Link href="/diary/stats" className="font-bold" style={{ color: "var(--px-accent)" }}>
              통계
            </Link>
            에서 평균을 볼 수 있어요.
          </p>

          <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
            {collection.map((item) => (
              <CollectionTile key={item.ganjiKo} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
