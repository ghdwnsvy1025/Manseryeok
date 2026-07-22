"use client";

import { useEffect, useMemo, useState } from "react";
import FeatureCallout from "@/components/FeatureCallout";
import CollectionNavButton from "@/components/diary/CollectionNavButton";
import MissionSection from "@/components/diary/MissionSection";
import FortuneTimeline from "@/components/diary/stats/FortuneTimeline";
import GanjiRanking from "@/components/diary/stats/GanjiRanking";
import MonthFortuneList from "@/components/diary/stats/MonthFortuneList";
import StatsDetailPanel from "@/components/diary/stats/StatsDetailPanel";
import StatsFortuneTabs, {
  type DaySubTab,
  type FortuneTab,
} from "@/components/diary/stats/StatsFortuneTabs";
import StatsSummaryHeader, { StatsEmptyState } from "@/components/diary/stats/StatsSummaryHeader";
import StemBranchHeatmap from "@/components/diary/stats/StemBranchHeatmap";
import HappinessTrendChart from "@/components/diary/stats/HappinessTrendChart";
import PatternOverviewSection from "@/components/diary/stats/PatternOverviewSection";
import {
  hasSeenStatsGuide,
  markStatsGuideSeen,
  STATS_INSIGHT_MIN_ENTRIES,
} from "@/lib/diary/onboarding";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { cleanupDemoEntriesOnce, filterRealEntries } from "@/lib/diary/dataOrigin";
import {
  aggregateByGroup,
  getDaysUntilInsight,
  getEntriesForGroup,
  getOverallAvgWellbeing,
  getRecentAvgWellbeing,
  getStatsForGroup,
  getUniqueEntryDays,
  getWellbeingInsightCards,
} from "@/lib/diary/stats";
import {
  buildRatingTrend,
  monthAverage,
  topEmotions,
  weekendComparison,
  weekdayAverages,
} from "@/lib/diary/trendStats";
import type { DiaryEntry, StatsGroupType } from "@/lib/diary/types";
import { SAMPLE_LEVEL_LABELS, getSampleLevel } from "@/lib/diary/types";

function fortuneTabToGroupType(fortuneTab: FortuneTab, daySubTab: DaySubTab): StatsGroupType {
  if (fortuneTab === "year") return "year";
  if (fortuneTab === "month") return "month";
  if (daySubTab === "stem") return "stem";
  if (daySubTab === "branch") return "branch";
  return "ganji";
}

function pickDefaultKey(groups: ReturnType<typeof aggregateByGroup>): string {
  const withPattern = groups.find((g) => g.entryCount >= 2);
  return withPattern?.key ?? groups[0]?.key ?? "";
}

async function loadRealDiaryEntries(): Promise<DiaryEntry[]> {
  const storage = await getDiaryStorage();
  await cleanupDemoEntriesOnce(storage);
  const list = await storage.list();
  return filterRealEntries(list);
}

export default function DiaryStatsPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fortuneTab, setFortuneTab] = useState<FortuneTab>("day");
  const [daySubTab, setDaySubTab] = useState<DaySubTab>("ganji");
  const [selectedKey, setSelectedKey] = useState("");
  const [showStatsGuide, setShowStatsGuide] = useState(false);

  const groupType = fortuneTabToGroupType(fortuneTab, daySubTab);

  useEffect(() => {
    loadRealDiaryEntries()
      .then((list) => {
        setEntries(list);
        const groups = aggregateByGroup(list, "ganji");
        setSelectedKey(pickDefaultKey(groups));
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!hasSeenStatsGuide()) setShowStatsGuide(true);
  }, []);

  const groups = useMemo(
    () => aggregateByGroup(entries, groupType),
    [entries, groupType]
  );

  const insightCards = useMemo(
    () => (groupType === "ganji" ? getWellbeingInsightCards(entries, 3, "ganji") : []),
    [entries, groupType]
  );

  const uniqueDays = useMemo(() => getUniqueEntryDays(entries), [entries]);
  const daysUntilInsight = useMemo(() => getDaysUntilInsight(entries), [entries]);
  const recentWellbeing = useMemo(() => getRecentAvgWellbeing(entries, 30), [entries]);
  const overallAvg = useMemo(() => getOverallAvgWellbeing(entries), [entries]);
  const trend7 = useMemo(() => buildRatingTrend(entries, 7, "happiness"), [entries]);
  const trend30 = useMemo(() => buildRatingTrend(entries, 30, "happiness"), [entries]);
  const condition7 = useMemo(() => buildRatingTrend(entries, 7, "condition"), [entries]);
  const weekdayStats = useMemo(() => weekdayAverages(entries), [entries]);
  const weekend = useMemo(() => weekendComparison(entries), [entries]);
  const emotions = useMemo(() => topEmotions(entries, 5), [entries]);
  const thisMonth = useMemo(() => {
    const now = new Date();
    return monthAverage(entries, now.getFullYear(), now.getMonth() + 1);
  }, [entries]);

  const selectedStats = useMemo(
    () => (selectedKey ? getStatsForGroup(selectedKey, groupType, entries, overallAvg) : null),
    [selectedKey, groupType, entries, overallAvg]
  );

  const selectedEntries = useMemo(
    () => (selectedKey ? getEntriesForGroup(selectedKey, groupType, entries) : []),
    [selectedKey, groupType, entries]
  );

  const handleFortuneChange = (tab: FortuneTab) => {
    setFortuneTab(tab);
    const nextType = fortuneTabToGroupType(tab, daySubTab);
    const nextGroups = aggregateByGroup(entries, nextType);
    setSelectedKey(pickDefaultKey(nextGroups));
  };

  const handleDaySubChange = (tab: DaySubTab) => {
    setDaySubTab(tab);
    const nextType = fortuneTabToGroupType("day", tab);
    const nextGroups = aggregateByGroup(entries, nextType);
    setSelectedKey(pickDefaultKey(nextGroups));
  };

  const dismissGuide = () => {
    markStatsGuideSeen();
    setShowStatsGuide(false);
  };

  const groupLabel =
    groupType === "year"
      ? "년운"
      : groupType === "month"
        ? "월운"
        : groupType === "stem"
          ? "천간"
          : groupType === "branch"
            ? "지지"
            : "간지";

  return (
    <div className="space-y-6">
      {!loading && <PatternOverviewSection entries={entries} />}

      {!loading && <MissionSection entries={entries} />}

      {!loading && <CollectionNavButton entries={entries} />}

      <section className="space-y-4" aria-label="통계">
        <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          ■ 간지별 행복도
        </h2>

        {loading && (
          <p className="text-xs" style={{ color: "var(--px-text2)" }}>
            불러오는 중...
          </p>
        )}

        {!loading && entries.length === 0 && <StatsEmptyState />}

        {!loading && entries.length > 0 && uniqueDays < STATS_INSIGHT_MIN_ENTRIES && (
          <div
            className="p-3 border-2 space-y-2"
            style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
          >
            <p className="ui-section-title">
              통계 미리보기 {uniqueDays}/{STATS_INSIGHT_MIN_ENTRIES}일
            </p>
            <div
              className="h-2 border overflow-hidden"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.round((uniqueDays / STATS_INSIGHT_MIN_ENTRIES) * 100)}%`,
                  background: "var(--px-accent)",
                }}
              />
            </div>
            <p className="ui-guide">
              아래에서 기록된 항목을 눌러볼 수 있어요. 인사이트 카드는 {STATS_INSIGHT_MIN_ENTRIES}일부터
              열려요.
            </p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            {showStatsGuide && (
              <FeatureCallout
                message="기록이 쌓일수록 타일 색이 진해져요. 2회 이상 기록된 항목을 눌러 세부 점수를 확인하세요."
                onDismiss={dismissGuide}
              />
            )}

            <StatsSummaryHeader
              entries={entries}
              uniqueDays={uniqueDays}
              daysUntilInsight={daysUntilInsight}
              recentWellbeing={recentWellbeing}
              groupLabel={groupLabel}
            />

            <div className="space-y-3">
              <HappinessTrendChart
                trend={trend7}
                title="최근 7일 행복도"
                description="사용자가 직접 남긴 1~5점만 표시합니다. 빈 날은 보간하지 않습니다."
              />
              <HappinessTrendChart
                trend={trend30}
                title="최근 30일 행복도"
                description={
                  weekend.weekdayAvg != null && weekend.weekendAvg != null
                    ? `평일 평균 ${weekend.weekdayAvg}점(n=${weekend.weekdaySample}), 주말 평균 ${weekend.weekendAvg}점(n=${weekend.weekendSample})`
                    : "평일·주말 비교는 표본이 쌓이면 표시됩니다."
                }
              />
              <HappinessTrendChart
                trend={condition7}
                title="최근 7일 생활 컨디션"
                description="의료적 건강 예측이 아니라 내가 기록한 컨디션입니다."
              />
              {thisMonth.sampleSize > 0 && (
                <p className="ui-hint">
                  이번 달 평균 행복도 {thisMonth.avgHappiness ?? "-"} · 컨디션{" "}
                  {thisMonth.avgCondition ?? "-"} (n={thisMonth.sampleSize})
                </p>
              )}
              {emotions.length > 0 && (
                <p className="ui-hint">
                  자주 느낀 감정: {emotions.map((e) => `${e.emotion}(${e.count})`).join(", ")}
                </p>
              )}
              <div className="grid grid-cols-7 gap-1">
                {weekdayStats.map((w) => (
                  <div
                    key={w.weekday}
                    className="p-1 border text-center"
                    style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
                  >
                    <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
                      {w.label}
                    </p>
                    <p className="text-xs font-black" style={{ color: "var(--px-accent)" }}>
                      {w.avgHappiness ?? "-"}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                      n={w.sampleSize}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="ui-section-title mt-2">전문 모드 보완 통계</p>
            <p className="ui-hint">
              아래 간지·천간·지지 통계는 기존 만세력의 대체물이 아니라 보완 기능입니다. 표본 수준:{" "}
              {SAMPLE_LEVEL_LABELS[getSampleLevel(uniqueDays)]}
            </p>

            <StatsFortuneTabs
              fortuneTab={fortuneTab}
              daySubTab={daySubTab}
              onFortuneChange={handleFortuneChange}
              onDaySubChange={handleDaySubChange}
            />

            <div
              className="p-3 border-2 space-y-3"
              style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
            >
              {fortuneTab === "year" && (
                <FortuneTimeline
                  groups={groups}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              )}

              {fortuneTab === "month" && (
                <MonthFortuneList
                  groups={groups}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              )}

              {fortuneTab === "day" && daySubTab === "ganji" && (
                <GanjiRanking
                  groups={groups}
                  insightCards={insightCards}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  uniqueDays={uniqueDays}
                />
              )}

              {fortuneTab === "day" && daySubTab === "stem" && (
                <StemBranchHeatmap
                  type="stem"
                  groups={groups}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              )}

              {fortuneTab === "day" && daySubTab === "branch" && (
                <StemBranchHeatmap
                  type="branch"
                  groups={groups}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              )}
            </div>

            {selectedStats && selectedStats.entryCount > 0 && selectedStats.entryCount >= 2 && (
              <StatsDetailPanel
                stats={selectedStats}
                entries={selectedEntries}
                overallAvg={overallAvg}
              />
            )}

            {selectedStats && selectedStats.entryCount > 0 && selectedStats.entryCount < 2 && (
              <p className="ui-guide text-center">
                {selectedStats.label}은(는) 아직 {selectedStats.entryCount}회만 기록됐어요. 2회 이상
                기록하면 패턴을 볼 수 있어요.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
