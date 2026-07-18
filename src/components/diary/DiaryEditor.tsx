"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CollectionPreviewCard from "@/components/diary/journey/CollectionPreviewCard";
import DiaryValueIntro from "@/components/diary/journey/DiaryValueIntro";
import SaveCelebrationModal from "@/components/diary/journey/SaveCelebrationModal";
import Day7MilestoneModal from "@/components/diary/journey/Day7MilestoneModal";
import TodayMiniReport from "@/components/diary/journey/TodayMiniReport";
import DiaryWriteSheet from "@/components/diary/DiaryWriteSheet";
import ManualScoreSheet from "@/components/diary/ManualScoreSheet";
import HappinessRatingPicker from "@/components/diary/HappinessRatingPicker";
import {
  EmotionMultiSelect,
  EventTagPicker,
} from "@/components/diary/EmotionTagPickers";
import SajuDepthPicker from "@/components/diary/SajuDepthPicker";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { getPillarsForDate, resolveDateString } from "@/lib/diary/dayPillar";
import type { DiaryAnalysis } from "@/lib/diary/dimensions";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import {
  DEFAULT_HAPPINESS_RATING,
  happinessRatingToScore,
  scoreToHappinessRating,
  type HappinessRating,
} from "@/lib/diary/happiness";
import {
  analysisToManualState,
  createManualScoreState,
  createManualScoreStateFromWellbeing,
  manualStateToAnalysis,
  wellbeingToAnalysis,
  type ManualScoreState,
} from "@/lib/diary/manualScores";
import {
  hasSeenDiaryValueProp,
  hasSeenDay7Milestone,
  markDiaryValuePropSeen,
  markDay7MilestoneSeen,
  STATS_INSIGHT_MIN_ENTRIES,
} from "@/lib/diary/onboarding";
import { getCollectedGanjiIndices, getCollectionSummary } from "@/lib/diary/collection";
import { getNextSameGanjiDate, getNextUncollectedGanjiDate } from "@/lib/diary/nextGanjiDay";
import { computeSaveCelebration, type SaveCelebration } from "@/lib/diary/saveCelebration";
import { getUniqueEntryDays } from "@/lib/diary/stats";
import {
  loadSajuSettings,
  resolvePillarVisibility,
  saveSajuSettings,
  hasDiarySajuProfile,
  type BirthPillarSlot,
  type DiaryPillarSlot,
  type SajuSettings,
} from "@/lib/diary/sajuSettings";
import { loadPrimarySajuProfile } from "@/lib/diary/profileStorage";
import CreateSajuPromptModal from "@/components/diary/CreateSajuPromptModal";
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

function loadDiarySettingsWithDefaultFortunes(): SajuSettings {
  const settings = loadSajuSettings();
  const visibility = resolvePillarVisibility(settings);
  const next: SajuSettings = {
    ...settings,
    pillarVisibility: {
      ...visibility,
      diary: { ...visibility.diary, day: true, month: true, year: false },
      daeun: false,
    },
  };
  saveSajuSettings(next);
  return next;
}

export default function DiaryEditor({ initialDate }: Props) {
  const [date, setDate] = useState(() => resolveDateString(initialDate));
  const [monthPillar, setMonthPillar] = useState<DiaryPillar>(EMPTY_PILLAR);
  const [yearPillar, setYearPillar] = useState<DiaryPillar>(EMPTY_PILLAR);
  const [content, setContent] = useState("");
  const [memo, setMemo] = useState("");
  const [showAdvancedWrite, setShowAdvancedWrite] = useState(false);
  const [manualScores, setManualScores] = useState<ManualScoreState>(
    createManualScoreState
  );
  const [hasCustomScores, setHasCustomScores] = useState(false);
  const [happinessRating, setHappinessRating] = useState<HappinessRating>(
    DEFAULT_HAPPINESS_RATING
  );
  const [emotions, setEmotions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [sajuProfileId, setSajuProfileId] = useState<string | null>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [dayPillar, setDayPillar] = useState<DiaryEntry["dayPillar"] | null>(null);
  const [dayPillarKo, setDayPillarKo] = useState("");
  const [sajuSettings, setSajuSettings] = useState<SajuSettings>(
    loadDiarySettingsWithDefaultFortunes
  );
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "analyzing">("loading");
  const [message, setMessage] = useState("");
  const [showValueIntro, setShowValueIntro] = useState(false);
  const [showWriteSheet, setShowWriteSheet] = useState(false);
  const [showManualScoreSheet, setShowManualScoreSheet] = useState(false);
  const [totalEntryDays, setTotalEntryDays] = useState(0);
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([]);
  const [saveCelebration, setSaveCelebration] = useState<SaveCelebration | null>(null);
  const [showDay7Modal, setShowDay7Modal] = useState(false);
  const [showCreateSajuPrompt, setShowCreateSajuPrompt] = useState(false);
  const [lastMiniReport, setLastMiniReport] = useState<{
    ganjiKo: string;
    wellbeing: number | null;
    analysis: DiaryAnalysis | null;
  } | null>(null);

  useEffect(() => {
    setShowValueIntro(!hasSeenDiaryValueProp());
  }, []);

  useEffect(() => {
    if (showValueIntro) return;
    if (!hasDiarySajuProfile(loadSajuSettings())) {
      setShowCreateSajuPrompt(true);
    }
    // 일기 진입 시 1회만 (값 소개 닫힌 뒤)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showValueIntro]);

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

  useEffect(() => {
    void loadPrimarySajuProfile().then((profile) => {
      if (profile) setSajuProfileId(profile.id);
    });
  }, []);

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
        const body = isDiaryBody(existing.content) ? existing.content : "";
        setContent(body);
        setMemo(body);
        setShowAdvancedWrite(false);
        setHappinessRating(
          existing.happinessRating ??
            scoreToHappinessRating(
              existing.analysis?.daily_wellbeing_score ??
                happinessRatingToScore(DEFAULT_HAPPINESS_RATING)
            )
        );
        setEmotions(existing.emotions ?? []);
        setTags(existing.tags ?? []);
        setSajuProfileId(existing.sajuProfileId ?? sajuProfileId);
        setManualScores(
          existing.analysis
            ? analysisToManualState(existing.analysis)
            : createManualScoreState()
        );
        setHasCustomScores(existing.analysis !== null && existing.inputMode !== "scores");
      } else {
        setEntry(null);
        setContent("");
        setMemo("");
        setShowAdvancedWrite(false);
        setHappinessRating(DEFAULT_HAPPINESS_RATING);
        setEmotions([]);
        setTags([]);
        setManualScores(createManualScoreState());
        setHasCustomScores(false);
      }
      setStatus("idle");
      setLastMiniReport(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "일기를 불러오지 못했습니다.");
      setStatus("idle");
    }
  }, [sajuProfileId]);

  useEffect(() => {
    loadEntry(date);
  }, [date, loadEntry]);

  const buildPayload = (
    base: DiaryEntry,
    analysis: DiaryAnalysis | null,
    now: string,
    entryContent: string,
    nextEmotionSource: NonNullable<DiaryEntry["emotionSource"]>
  ): DiaryEntry => {
    return {
      ...base,
      content: entryContent,
      analysis,
      happinessRating,
      emotions,
      tags,
      heavenlyStem: dayPillar?.stem.ko ?? base.heavenlyStem,
      earthlyBranch: dayPillar?.branch.ko ?? base.earthlyBranch,
      weekday: dayPillar
        ? new Date(`${date}T12:00:00`).getDay()
        : base.weekday,
      isWeekend: (() => {
        const wd = new Date(`${date}T12:00:00`).getDay();
        return wd === 0 || wd === 6;
      })(),
      inputMode: showAdvancedWrite ? "text" : "scores",
      emotionSource: nextEmotionSource,
      sajuDepth: "day",
      sajuProfileId,
      monthPillarKo: monthPillar.ganjiKo,
      yearPillarKo: yearPillar.ganjiKo,
      schemaVersion: 2,
      updatedAt: now,
      createdAt: entry?.createdAt ?? now,
    };
  };

  const handleSave = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const listBefore = await storage.list();
      const base = entry ?? createDiaryEntry(date, "");
      const score = happinessRatingToScore(happinessRating);
      const analysis = hasCustomScores
        ? {
            ...manualStateToAnalysis(manualScores),
            daily_wellbeing_score: score,
            happiness_score: score,
          }
        : wellbeingToAnalysis(score);
      const entryContent =
        memo.trim() ||
        content.trim() ||
        `오늘의 행복도: ${happinessRating}점`;
      const updated = buildPayload(
        base,
        analysis,
        now,
        entryContent,
        emotions.length > 0 ? "selected" : "inferred"
      );
      await storage.save(updated);
      const reloaded = await storage.getByDate(date);
      setEntry(reloaded ?? updated);
      setContent(isDiaryBody(updated.content) ? updated.content : "");
      setMemo(isDiaryBody(updated.content) ? updated.content : memo.trim());

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
      setMessage("저장되었습니다. 기록이 쌓일수록 패턴을 비교할 수 있어요.");
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setStatus("idle");
    }
  };

  const handleAnalyze = async () => {
    const text = content.trim() || memo.trim();
    if (!text) {
      setMessage("분석할 일기 내용을 입력해주세요.");
      return;
    }
    setStatus("analyzing");
    setMessage("AI가 감정을 분석 중입니다...");
    try {
      const res = await fetch("/api/diary/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, date, dayPillarKo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석에 실패했습니다.");

      const analysis = data.analysis as DiaryAnalysis;
      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const base = entry ?? createDiaryEntry(date, text);
      setHappinessRating(scoreToHappinessRating(analysis.daily_wellbeing_score));
      if (analysis.dominant_emotions?.length) {
        setEmotions(analysis.dominant_emotions.slice(0, 5));
      }
      const updated = buildPayload(base, analysis, now, text, "ai");
      await storage.save(updated);
      const reloaded = await storage.getByDate(date);
      setEntry(reloaded ?? updated);
      setContent(text);
      setMemo(text);
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
      setMemo("");
      setHappinessRating(DEFAULT_HAPPINESS_RATING);
      setEmotions([]);
      setTags([]);
      setManualScores(createManualScoreState());
      setHasCustomScores(false);
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

  const handleToggleDaeun = useCallback(() => {
    setSajuSettings((prev) => {
      const visibility = resolvePillarVisibility(prev);
      const next: SajuSettings = {
        ...prev,
        pillarVisibility: {
          ...visibility,
          daeun: !visibility.daeun,
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
      <ManualScoreSheet
        open={showManualScoreSheet}
        state={manualScores}
        onChange={(next) => {
          const analysis = manualStateToAnalysis(next);
          setManualScores(next);
          setHasCustomScores(true);
          setHappinessRating(scoreToHappinessRating(analysis.daily_wellbeing_score));
        }}
        onClose={() => setShowManualScoreSheet(false)}
        disabled={isBusy}
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
      {showCreateSajuPrompt && (
        <CreateSajuPromptModal onClose={() => setShowCreateSajuPrompt(false)} />
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

      <div
        className="p-3 border-2 space-y-3"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="ui-section-title">■ 오늘 기록</p>
          <span
            className="px-2 py-1 border text-xs font-black tabular-nums"
            style={{
              color: "var(--px-text2)",
              borderColor: "var(--px-border)",
              background: "var(--px-bg3)",
            }}
          >
            {date.replaceAll("-", ".")}.{" "}
            {`${
              ["일", "월", "화", "수", "목", "금", "토"][
                new Date(`${date}T12:00:00+09:00`).getDay()
              ]
            }.`}
            {dayPillarKo && ` ${dayPillarKo}일`}
          </span>
        </div>

        <HappinessRatingPicker
          value={happinessRating}
          onChange={(rating) => {
            setHappinessRating(rating);
            setHasCustomScores(false);
          }}
          disabled={isBusy}
        />
        <EmotionMultiSelect
          value={emotions}
          onChange={setEmotions}
          disabled={isBusy}
        />
        <div className="space-y-1.5">
          <p className="ui-section-title">짧은 메모</p>
          <textarea
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value);
              setContent(e.target.value);
            }}
            disabled={isBusy}
            rows={3}
            placeholder="오늘을 한두 문장으로 남겨보세요."
            className="w-full px-3 py-2 border-2 text-sm resize-none"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-border)",
              color: "var(--px-text-on-panel)",
            }}
          />
        </div>
        <EventTagPicker value={tags} onChange={setTags} disabled={isBusy} />

        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy}
          className="ui-primary-btn w-full py-3 text-sm"
        >
          {status === "saving"
            ? "저장 중..."
            : entry
              ? "기록 수정 저장"
              : "오늘 기록 저장"}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (!hasCustomScores) {
                setManualScores(
                  createManualScoreStateFromWellbeing(
                    happinessRatingToScore(happinessRating)
                  )
                );
              }
              setShowManualScoreSheet(true);
            }}
            disabled={isBusy}
            className="text-xs font-bold underline"
            style={{ color: "#60a5fa" }}
          >
            세부 감정 조절
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdvancedWrite(true);
              setShowWriteSheet(true);
            }}
            disabled={isBusy}
            className="text-xs font-bold underline"
            style={{ color: "var(--px-text2)" }}
          >
            긴 일기·AI 분석
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
      </div>

      <details
        className="border-2 p-2"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <summary className="cursor-pointer text-sm font-bold px-1 py-1" style={{ color: "var(--px-text2)" }}>
          날짜·만세력 자세히 보기
        </summary>
        <div className="pt-2">
          <SajuDepthPicker
            diaryDate={date}
            onDiaryDateChange={handleDiaryDateChange}
            sajuSettings={sajuSettings}
            onBirthDateChange={handleBirthDateChange}
            onBirthHourChange={handleBirthHourChange}
            onBirthMinuteChange={handleBirthMinuteChange}
            onToggleBirthPillar={handleToggleBirthPillar}
            onToggleDiaryPillar={handleToggleDiaryPillar}
            onToggleDaeun={handleToggleDaeun}
            totalEntryDays={totalEntryDays}
            entries={allEntries}
          />
        </div>
      </details>

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
