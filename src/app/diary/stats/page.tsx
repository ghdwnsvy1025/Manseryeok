"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ScoreBars from "@/components/diary/ScoreBars";
import { GANJI_60 } from "@/lib/saju/constants";
import { STEM_META, BRANCH_META } from "@/lib/saju/constants";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import {
  aggregateByDayPillar,
  getRecentAvgWellbeing,
  getStatsForPillar,
  getTopDayPillars,
} from "@/lib/diary/stats";
import type { DiaryEntry } from "@/lib/diary/types";

const GANJI_KO_LIST = GANJI_60.map((g) => {
  const stem = STEM_META[g[0]];
  const branch = BRANCH_META[g[1]];
  return stem.ko + branch.ko;
});

export default function DiaryStatsPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDiaryStorage()
      .then((storage) => storage.list())
      .then((list) => {
        setEntries(list);
        const top = aggregateByDayPillar(list);
        if (top.length > 0) setSelected(top[0].ganjiKo);
      })
      .finally(() => setLoading(false));
  }, []);

  const pillarStats = useMemo(
    () => (selected ? getStatsForPillar(selected, entries) : null),
    [selected, entries]
  );

  const topPillars = useMemo(() => getTopDayPillars(entries, 5), [entries]);
  const recentWellbeing = useMemo(() => getRecentAvgWellbeing(entries, 30), [entries]);
  const pillarEntries = useMemo(
    () =>
      selected
        ? entries
            .filter((e) => e.dayPillar.ganjiKo === selected)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [selected, entries]
  );

  const recordedPillars = useMemo(() => {
    const set = new Set(entries.map((e) => e.dayPillar.ganjiKo));
    return GANJI_KO_LIST.filter((g) => set.has(g));
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          ■ 일주별 통계
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
          통계를 보려면 먼저 일기를 작성하고 AI 분석을 실행해주세요.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div
            className="p-3 border-2 grid grid-cols-2 gap-3 sm:grid-cols-3"
            style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
          >
            <div>
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                전체 일기
              </p>
              <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
                {entries.length}건
              </p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                기록된 일주
              </p>
              <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
                {recordedPillars.length}종
              </p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                최근 30일 평균 행복도
              </p>
              <p className="text-lg font-black" style={{ color: "#4ade80" }}>
                {recentWellbeing}점
              </p>
            </div>
          </div>

          {topPillars.length > 0 && (
            <div
              className="p-3 border-2"
              style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: "var(--px-accent)" }}>
                가장 많이 기록한 일주 Top 5
              </p>
              <div className="flex flex-wrap gap-2">
                {topPillars.map((p) => (
                  <button
                    key={p.ganjiKo}
                    type="button"
                    onClick={() => setSelected(p.ganjiKo)}
                    className="px-2 py-1 text-xs font-bold border"
                    style={{
                      borderColor: selected === p.ganjiKo ? "var(--px-accent)" : "var(--px-border)",
                      color: selected === p.ganjiKo ? "var(--px-accent)" : "var(--px-text2)",
                      background: "var(--px-bg3)",
                    }}
                  >
                    {p.ganjiKo} ({p.entryCount}회)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="pillar-select" className="text-xs font-bold shrink-0" style={{ color: "var(--px-text2)" }}>
              일주 선택
            </label>
            <select
              id="pillar-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border-2 font-bold"
              style={{
                background: "var(--px-bg2)",
                borderColor: "var(--px-border)",
                color: "var(--px-text)",
              }}
            >
              {recordedPillars.map((g) => (
                <option key={g} value={g}>
                  {g}일
                </option>
              ))}
            </select>
          </div>

          {pillarStats && pillarStats.entryCount > 0 && (
            <div
              className="p-3 border-2 space-y-3"
              style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", boxShadow: "3px 3px 0 #000" }}
            >
              <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                {pillarStats.ganjiKo}일 · {pillarStats.entryCount}회 기록
                {pillarStats.analyzedCount > 0 && (
                  <span className="text-xs font-normal ml-2" style={{ color: "var(--px-text2)" }}>
                    (분석 {pillarStats.analyzedCount}건)
                  </span>
                )}
              </p>
              <p className="text-xs" style={{ color: "var(--px-text2)" }}>
                날짜: {pillarStats.dates.join(", ")}
              </p>
              {pillarStats.analyzedCount > 0 ? (
                <ScoreBars
                  avgScores={pillarStats.avgScores}
                  avgDailyWellbeing={pillarStats.avgDailyWellbeing}
                />
              ) : (
                <p className="text-xs" style={{ color: "var(--px-text2)" }}>
                  AI 분석된 일기가 없습니다.
                </p>
              )}

              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
                <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
                  개별 일기
                </p>
                {pillarEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/diary?date=${entry.date}`}
                    className="block p-2 border"
                    style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
                  >
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span style={{ color: "var(--px-accent)" }}>{entry.date}</span>
                      {entry.analysis && (
                        <span style={{ color: "#4ade80" }}>
                          행복도 {entry.analysis.daily_wellbeing_score}
                        </span>
                      )}
                    </div>
                    {entry.analysis && (
                      <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                        {entry.analysis.summary}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
