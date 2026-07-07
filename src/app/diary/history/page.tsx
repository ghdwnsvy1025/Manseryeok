"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import type { DiaryEntry } from "@/lib/diary/types";

export default function DiaryHistoryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDiaryStorage()
      .then((storage) => storage.list())
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          ■ 과거 일기
        </h2>
        <Link
          href="/diary"
          className="text-xs font-bold px-2 py-1 border"
          style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
        >
          ← 일기 쓰기
        </Link>
      </div>

      {loading && (
        <p className="text-xs" style={{ color: "var(--px-text2)" }}>
          불러오는 중...
        </p>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-xs" style={{ color: "var(--px-text2)" }}>
          아직 작성한 일기가 없습니다.
        </p>
      )}

      <div className="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/diary?date=${entry.date}`}
            className="block p-3 border-2"
            style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-bold" style={{ color: "var(--px-accent)" }}>
                {entry.date}
              </span>
              <span className="text-xs" style={{ color: "var(--px-text2)" }}>
                {entry.dayPillar.ganjiKo}일
              </span>
            </div>
            <p className="text-xs line-clamp-2" style={{ color: "var(--px-text)" }}>
              {entry.content}
            </p>
            {entry.analysis && (
              <p className="text-[10px] mt-1 truncate" style={{ color: "var(--px-text2)" }}>
                행복도 {entry.analysis.daily_wellbeing_score} · {entry.analysis.summary}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
