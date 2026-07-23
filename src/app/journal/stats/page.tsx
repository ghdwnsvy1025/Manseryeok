"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NewDiaryGate from "@/components/journal/NewDiaryGate";
import PersonalizationStatsPanel, {
  type CategoryStatsRow,
} from "@/components/journal/PersonalizationStatsPanel";
import { isPersonalizationEnabled } from "@/lib/app/featureFlags";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import {
  bestWorstCategories,
  recomputeD1Aggregates,
  type AstroCategoryAggregate,
} from "@/lib/journal/d1Aggregates";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";

function D1Section({
  aggregates,
  entries,
  enabledCodes,
}: {
  aggregates: AstroCategoryAggregate[];
  entries: JournalEntry[];
  enabledCodes: CategoryCode[];
}) {
  const today = todayDateString();
  const from = today.slice(0, 8) + "01"; // rough month start for best/worst
  const { best, worst } = bestWorstCategories(
    entries,
    from,
    today,
    enabledCodes
  );

  const byType = useMemo(() => {
    const stem = aggregates.filter((a) => a.astroType === "heavenlyStem");
    const branch = aggregates.filter((a) => a.astroType === "earthlyBranch");
    const ganzhi = aggregates.filter((a) => a.astroType === "ganzhi");
    return { stem, branch, ganzhi };
  }, [aggregates]);

  const renderGroup = (title: string, rows: AstroCategoryAggregate[]) => (
    <section className="space-y-2">
      <p className="ui-section-title">{title}</p>
      {rows.length === 0 ? (
        <p className="ui-hint">데이터 없음</p>
      ) : (
        <ul className="space-y-1 text-xs" style={{ color: "var(--px-text2)" }}>
          {rows.slice(0, 24).map((r) => (
            <li key={`${r.astroType}-${r.astroCode}-${r.categoryCode}`}>
              {r.label} · {r.categoryName} 평균 {r.average}/10 · 기록 {r.validCount}회
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-black" style={{ color: "var(--px-accent)" }}>
          D-1 사주 글자별 평균
        </h1>
        <p className="ui-hint">
          최종 A(1~10)를 천간·지지·간지별로 단순 평균합니다. 한 건부터 표시합니다.
        </p>
        {(best || worst) && (
          <p className="text-xs font-bold" style={{ color: "var(--px-text)" }}>
            이번 달 Best{" "}
            {best
              ? `${getCategoryByCode(best.code)?.name} ${best.average}/10`
              : "-"}{" "}
            · Worst{" "}
            {worst
              ? `${getCategoryByCode(worst.code)?.name} ${worst.average}/10`
              : "-"}
          </p>
        )}
      </header>
      {renderGroup("천간", byType.stem)}
      {renderGroup("지지", byType.branch)}
      {renderGroup("간지", byType.ganzhi)}
    </div>
  );
}

function JournalStatsInner() {
  const displayOn = isPersonalizationEnabled();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storage = await getJournalStorage();
        const [list, prefs] = await Promise.all([
          storage.list(),
          storage.getPreferences(),
        ]);
        if (cancelled) return;
        setEntries(list);
        setEnabledCodes(getEnabledCodesOrdered(prefs));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregates = useMemo(
    () => recomputeD1Aggregates(entries),
    [entries]
  );

  const ridgeRows: CategoryStatsRow[] = useMemo(
    () =>
      displayOn
        ? enabledCodes.map((code) => ({
            categoryKey: code,
            categoryLabel: getCategoryByCode(code)?.name ?? code,
            validSampleCount: entries.filter((e) =>
              e.scores.some(
                (s) =>
                  s.categoryCode === code &&
                  !s.isNotApplicable &&
                  s.finalScore != null
              )
            ).length,
            model: null,
          }))
        : [],
    [displayOn, enabledCodes, entries]
  );

  if (loading) {
    return <p className="ui-hint p-4">불러오는 중…</p>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-8">
      <D1Section
        aggregates={aggregates}
        entries={entries}
        enabledCodes={enabledCodes}
      />

      {displayOn ? (
        <div className="space-y-3">
          <PersonalizationStatsPanel rows={ridgeRows} />
          <p className="text-xs" style={{ color: "var(--px-muted)" }}>
            D-2 Ridge 모델이 학습되면 여기에 채워집니다. 지금은 유효 샘플 수만
            표시합니다.
          </p>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          Ridge 표시는{" "}
          <code className="text-xs">NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY</code>
          를 켜면 활성화됩니다.
        </p>
      )}

      <Link
        href="/journal"
        className="inline-block text-sm font-semibold underline"
        style={{ color: "var(--px-accent)" }}
      >
        일기 이어 쓰기
      </Link>
    </div>
  );
}

export default function JournalStatsPage() {
  return (
    <NewDiaryGate>
      <JournalStatsInner />
    </NewDiaryGate>
  );
}
