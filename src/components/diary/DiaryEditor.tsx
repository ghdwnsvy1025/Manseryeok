"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CollectionPreviewCard from "@/components/diary/journey/CollectionPreviewCard";
import DiaryValueIntro from "@/components/diary/journey/DiaryValueIntro";
import SaveCelebrationModal from "@/components/diary/journey/SaveCelebrationModal";
import Day7MilestoneModal from "@/components/diary/journey/Day7MilestoneModal";
import TodayMiniReport from "@/components/diary/journey/TodayMiniReport";
import DiaryWriteSheet from "@/components/diary/DiaryWriteSheet";
import MoodChips from "@/components/diary/MoodChips";
import SajuDepthPicker from "@/components/diary/SajuDepthPicker";
import ScoreSlider from "@/components/diary/ScoreSlider";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { getPillarsForDate, resolveDateString } from "@/lib/diary/dayPillar";
import type { DiaryAnalysis, EmotionLabel } from "@/lib/diary/dimensions";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import {
  analysisToWellbeing,
  DEFAULT_WELLBEING,
  wellbeingToAnalysis,
  wellbeingToEmotionLabel,
} from "@/lib/diary/manualScores";
import {
  hasSeenDiaryValueProp,
  hasSeenDay7Milestone,
  markDiaryModeSelected,
  markDiaryValuePropSeen,
  markDay7MilestoneSeen,
  STATS_INSIGHT_MIN_ENTRIES,
} from "@/lib/diary/onboarding";
import { getCollectedGanjiIndices, getCollectionSummary } from "@/lib/diary/collection";
import { getNextSameGanjiDate, getNextUncollectedGanjiDate } from "@/lib/diary/nextGanjiDay";
import { computeSaveCelebration, type SaveCelebration } from "@/lib/diary/saveCelebration";
import { getUniqueEntryDays } from "@/lib/diary/stats";
import {
  computeUserBirthPillars,
  loadSajuSettings,
  resolvePillarVisibility,
  saveSajuSettings,
  type BirthPillarSlot,
  type DiaryPillarSlot,
  type SajuSettings,
} from "@/lib/diary/sajuSettings";
import type { DiaryEntry, DiaryPillar } from "@/lib/diary/types";

type Props = {
  initialDate?: string;
};

const EMPTY_PILLAR: DiaryPillar = {
  ganji: "??",
  ganjiKo: "??",
  stem: { hanja: "?", ko: "?" },
  branch: { hanja: "?", ko: "?" },
};

function isDiaryBody(content: string): boolean {
  return Boolean(content.trim()) && !/^오늘의 행복도:\s*\d+점/.test(content.trim());
}

export default function DiaryEditor({ initialDate }: Props) {
  const [date, setDate] = useState(() => resolveDateString(initialDate));
  const [monthPillar, setMonthPillar] = useState<DiaryPillar>(EMPTY_PILLAR);
  const [yearPillar, setYearPillar] = useState<DiaryPillar>(EMPTY_PILLAR);
  const [content, setContent] = useState("");
  const [wellbeing, setWellbeing] = useState(DEFAULT_WELLBEING);
  const [mood, setMood] = useState<EmotionLabel | null>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [dayPillar, setDayPillar] = useState<DiaryEntry["dayPillar"] | null>(null);
  const [dayPillarKo, setDayPillarKo] = useState("");
  const [sajuSettings, setSajuSettings] = useState<SajuSettings>(() => loadSajuSettings());
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "analyzing">("loading");
  const [message, setMessage] = useState("");
  const [showValueIntro, setShowValueIntro] = useState(false);
  const [showWriteSheet, setShowWriteSheet] = useState(false);
  const [totalEntryDays, setTotalEntryDays] = useState(0);
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([]);
  const [saveCelebration, setSaveCelebration] = useState<SaveCelebration | null>(null);
  const [showDay7Modal, setShowDay7Modal] = useState(false);
  const [lastMiniReport, setLastMiniReport] = useState<{
    ganjiKo: string;
    wellbeing: number | null;
    analysis: DiaryAnalysis | null;
  } | null>(null);

  useEffect(() => {
    setShowValueIntro(!hasSeenDiaryValueProp());
  }, []);

  const refreshAllEntries = useCallback(async () => {
    try {
      const storage = await getDiaryStorage();
      const list = await storage.list();
      setAllEntries(list);
      setTotalEntryDays(getUniqueEntryDays(list));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshAllEntries();
  }, [refreshAllEntries]);

  const loadEntry = useCallback(async (targetDate: string) => {
    setStatus("loading");
    setMessage("");
    try {
      const pillars = getPillarsForDate(targetDate);
      setMonthPillar(pillars.monthPillar);
      setYearPillar(pillars.yearPillar);
      setDayPillar(pillars.dayPillar);
      setDayPillarKo(pillars.dayPillar.ganjiKo);

      const storage = await getDiaryStorage();
      const existing = await storage.getByDate(targetDate);
      if (existing) {
        setEntry(existing);
        setContent(isDiaryBody(existing.content) ? existing.content : "");
        setWellbeing(analysisToWellbeing(existing.analysis));
        setMood(existing.analysis?.emotion_label ?? null);
      } else {
        setEntry(null);
        setContent("");
        setWellbeing(DEFAULT_WELLBEING);
        setMood(null);
      }
      setStatus("idle");
      setLastMiniReport(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "일기를 불러오지 못했습니다.");
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    loadEntry(date);
  }, [date, loadEntry]);

  const buildPayload = (
    base: DiaryEntry,
    analysis: DiaryAnalysis | null,
    now: string,
    entryContent: string
  ): DiaryEntry => {
    const userBirthPillars = sajuSettings.birthDate
      ? computeUserBirthPillars(
          sajuSettings.birthDate,
          sajuSettings.birthHour,
          sajuSettings.birthMinute
        ) ?? undefined
      : undefined;

    return {
      ...base,
      content: entryContent,
      analysis,
      inputMode: "scores",
      sajuDepth: "full",
      monthPillarKo: monthPillar.ganjiKo,
      yearPillarKo: yearPillar.ganjiKo,
      userBirthPillars,
      updatedAt: now,
      createdAt: entry?.createdAt ?? now,
    };
  };

  const handleSave = async () => {
    if (!mood) {
      setMessage("기분을 선택해주세요.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const listBefore = await storage.list();
      const base = entry ?? createDiaryEntry(date, "");
      const analysis = wellbeingToAnalysis(wellbeing, mood);
      const entryContent = content.trim() || `오늘의 행복도: ${analysis.daily_wellbeing_score}점`;
      const updated = buildPayload(base, analysis, now, entryContent);
      await storage.save(updated);
      setEntry(updated);

      const celebration = computeSaveCelebration(listBefore, updated);
      if (celebration) setSaveCelebration(celebration);

      const listAfter = await storage.list();
      setAllEntries(listAfter);
      setTotalEntryDays(getUniqueEntryDays(listAfter));

      const uniqueBefore = getUniqueEntryDays(listBefore);
      const uniqueAfter = getUniqueEntryDays(listAfter);
      if (
        uniqueBefore < STATS_INSIGHT_MIN_ENTRIES &&
        uniqueAfter >= STATS_INSIGHT_MIN_ENTRIES &&
        !hasSeenDay7Milestone()
      ) {
        setShowDay7Modal(true);
        markDay7MilestoneSeen();
      }

      setLastMiniReport({
        ganjiKo: dayPillarKo,
        wellbeing: analysis.daily_wellbeing_score,
        analysis,
      });
      setMessage("저장되었습니다.");
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setStatus("idle");
    }
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setMessage("분석할 일기 내용을 입력해주세요.");
      return;
    }
    setStatus("analyzing");
    setMessage("AI가 감정을 분석 중입니다...");
    try {
      const res = await fetch("/api/diary/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), date, dayPillarKo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석에 실패했습니다.");

      const analysis = data.analysis as DiaryAnalysis;
      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const base = entry ?? createDiaryEntry(date, content.trim());
      const updated = buildPayload(base, analysis, now, content.trim());
      await storage.save(updated);
      setEntry(updated);
      setWellbeing(analysisToWellbeing(analysis));
      setMood(analysis.emotion_label);
      await refreshAllEntries();
      setMessage("AI 분석이 완료되어 저장되었습니다.");
      setStatus("idle");
      setShowWriteSheet(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "분석에 실패했습니다.");
      setStatus("idle");
    }
  };

  const handleDelete = async () => {
    if (!entry || !confirm("이 날짜의 기록을 삭제할까요?")) return;
    try {
      const storage = await getDiaryStorage();
      await storage.delete(entry.id);
      setEntry(null);
      setContent("");
      setWellbeing(DEFAULT_WELLBEING);
      setMood(null);
      setMessage("삭제되었습니다.");
      await refreshAllEntries();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  const handleBirthDateChange = useCallback((birthDate: string) => {
    setSajuSettings((prev) => {
      const next = { ...prev, birthDate };
      saveSajuSettings(next);
      return next;
    });
  }, []);

  const handleBirthHourChange = useCallback((birthHour: number | undefined) => {
    setSajuSettings((prev) => {
      const next = { ...prev, birthHour };
      saveSajuSettings(next);
      return next;
    });
  }, []);

  const handleBirthMinuteChange = useCallback((birthMinute: number | undefined) => {
    setSajuSettings((prev) => {
      const next = { ...prev, birthMinute };
      saveSajuSettings(next);
      return next;
    });
  }, []);

  const handleDiaryDateChange = useCallback((nextDate: string) => {
    setDate(resolveDateString(nextDate));
  }, []);

  const handleToggleBirthPillar = useCallback((slot: BirthPillarSlot) => {
    setSajuSettings((prev) => {
      const visibility = resolvePillarVisibility(prev);
      const next: SajuSettings = {
        ...prev,
        pillarVisibility: {
          ...visibility,
          birth: { ...visibility.birth, [slot]: !visibility.birth[slot] },
        },
      };
      saveSajuSettings(next);
      return next;
    });
  }, []);

  const handleToggleDiaryPillar = useCallback((slot: DiaryPillarSlot) => {
    setSajuSettings((prev) => {
      const visibility = resolvePillarVisibility(prev);
      const next: SajuSettings = {
        ...prev,
        pillarVisibility: {
          ...visibility,
          diary: { ...visibility.diary, [slot]: !visibility.diary[slot] },
        },
      };
      saveSajuSettings(next);
      return next;
    });
  }, []);

  const isBusy = status === "loading" || status === "saving" || status === "analyzing";
  const collectionSummary = getCollectionSummary(allEntries);
  const dayPillarIndex = dayPillar?.ganjiIndex ?? 0;
  const nextSame = dayPillar ? getNextSameGanjiDate(date, dayPillarIndex) : null;
  const nextUncollected = useMemo(() => {
    const collected = getCollectedGanjiIndices(allEntries);
    return getNextUncollectedGanjiDate(date, collected);
  }, [date, allEntries]);

  const yesterdayStr = (() => {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  })();
  const yesterdayEntry = allEntries.find((e) => e.date === yesterdayStr);
  const yesterdayWellbeing = yesterdayEntry?.analysis?.daily_wellbeing_score ?? null;

  if (showValueIntro) {
    return (
      <DiaryValueIntro
        onStart={() => {
          markDiaryValuePropSeen();
          markDiaryModeSelected();
          setShowValueIntro(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <DiaryWriteSheet
        open={showWriteSheet}
        value={content}
        onChange={setContent}
        onClose={() => setShowWriteSheet(false)}
        disabled={isBusy}
        onAnalyze={handleAnalyze}
        analyzing={status === "analyzing"}
      />

      {saveCelebration && dayPillar && (
        <SaveCelebrationModal
          celebration={saveCelebration}
          ganjiIndex={dayPillar.ganjiIndex}
          currentDate={date}
          onClose={() => setSaveCelebration(null)}
        />
      )}
      {showDay7Modal && (
        <Day7MilestoneModal
          summary={collectionSummary}
          onClose={() => setShowDay7Modal(false)}
        />
      )}

      {totalEntryDays >= STATS_INSIGHT_MIN_ENTRIES && (
        <Link
          href="/diary/stats"
          className="block p-3 border-2 text-sm font-bold"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-accent)",
            color: "var(--px-accent)",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          {totalEntryDays}일 기록됨 · 간지별 행복도 패턴 보기 →
        </Link>
      )}

      <SajuDepthPicker
        diaryDate={date}
        onDiaryDateChange={handleDiaryDateChange}
        sajuSettings={sajuSettings}
        onBirthDateChange={handleBirthDateChange}
        onBirthHourChange={handleBirthHourChange}
        onBirthMinuteChange={handleBirthMinuteChange}
        onToggleBirthPillar={handleToggleBirthPillar}
        onToggleDiaryPillar={handleToggleDiaryPillar}
        totalEntryDays={totalEntryDays}
        entries={allEntries}
      />

      <div
        className="p-3 border-2 space-y-3"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <p className="ui-section-title">■ 오늘 기록</p>
        <MoodChips value={mood} onChange={setMood} disabled={isBusy} />
        <ScoreSlider
          label="행복도"
          value={wellbeing}
          onChange={(v) => {
            setWellbeing(v);
            if (!mood) setMood(wellbeingToEmotionLabel(v));
          }}
          color="var(--px-accent)"
          disabled={isBusy}
        />

        <button
          type="button"
          onClick={() => setShowWriteSheet(true)}
          disabled={isBusy}
          className="w-full py-3 border-2 text-sm font-bold text-left px-3"
          style={{
            borderColor: "var(--px-border2)",
            background: "var(--px-bg3)",
            color: "var(--px-text-on-panel)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          {content.trim() ? (
            <span className="line-clamp-2">{content}</span>
          ) : (
            <span style={{ color: "var(--px-text2)" }}>✎ 일기 쓰기 (선택)</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy}
          className="ui-primary-btn w-full py-3 text-sm"
        >
          {status === "saving" ? "저장 중..." : "오늘 기록 저장"}
        </button>

        {entry && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy}
            className="text-xs font-bold underline"
            style={{ color: "#f87171" }}
          >
            삭제
          </button>
        )}
      </div>

      <CollectionPreviewCard
        summary={collectionSummary}
        nextUncollected={
          nextUncollected
            ? { ganjiKo: nextUncollected.ganjiKo, daysUntil: nextUncollected.daysUntil }
            : null
        }
      />

      {lastMiniReport && (
        <TodayMiniReport
          ganjiKo={lastMiniReport.ganjiKo}
          wellbeing={lastMiniReport.wellbeing}
          analysis={lastMiniReport.analysis}
          summary={collectionSummary}
          nextSameGanji={nextSame}
          yesterdayWellbeing={yesterdayWellbeing}
        />
      )}

      {message && <p className="ui-hint font-bold">{message}</p>}

      <Link href="/diary/history" className="ui-hint font-bold underline block">
        과거 기록 보기
      </Link>
    </div>
  );
}
