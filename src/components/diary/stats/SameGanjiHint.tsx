"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { getStatsForGroup } from "@/lib/diary/stats";
import type { DiaryEntry } from "@/lib/diary/types";

type Props = {
  ganjiKo: string;
  currentDate: string;
};

export default function SameGanjiHint({ ganjiKo, currentDate }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    getDiaryStorage()
      .then((s) => s.list())
      .then(setEntries)
      .catch(() => {});
  }, []);

  const pastEntries = useMemo(
    () => entries.filter((e) => e.dayPillar.ganjiKo === ganjiKo && e.date !== currentDate),
    [entries, ganjiKo, currentDate]
  );

  const stats = useMemo(
    () => (ganjiKo ? getStatsForGroup(ganjiKo, "ganji", entries) : null),
    [entries, ganjiKo]
  );

  if (!ganjiKo || pastEntries.length === 0 || !stats) return null;

  return (
    <Link
      href="/diary/stats"
      className="block p-2 border text-center text-xs font-bold"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg3)",
        color: "var(--px-text2)",
      }}
    >
      <span style={{ color: "var(--px-accent)" }}>{ganjiKo}일</span>
      {" "}에 쓴 적 {stats.entryCount}번
      {stats.avgDailyWellbeing > 0 && (
        <>
          {" "}· 평균{" "}
          <span style={{ color: "#4ade80" }}>{stats.avgDailyWellbeing}점</span>
        </>
      )}
      {" "}→ 간지별 행복도 보기
    </Link>
  );
}
