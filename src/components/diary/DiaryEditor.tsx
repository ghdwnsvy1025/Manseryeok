"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AnalysisResult from "@/components/diary/AnalysisResult";
import DiaryModeSelect from "@/components/diary/DiaryModeSelect";
import DiaryValueIntro from "@/components/diary/journey/DiaryValueIntro";
import SaveCelebrationModal from "@/components/diary/journey/SaveCelebrationModal";
import Day7MilestoneModal from "@/components/diary/journey/Day7MilestoneModal";
import TodayMiniReport from "@/components/diary/journey/TodayMiniReport";
import ManualScoreInput from "@/components/diary/ManualScoreInput";
import SajuDepthPicker from "@/components/diary/SajuDepthPicker";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { getPillarsForDate, resolveDateString } from "@/lib/diary/dayPillar";
import type { DiaryAnalysis } from "@/lib/diary/dimensions";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import {
  analysisToManualState,
  createManualScoreState,
  formatManualDiaryContent,
  inferInputMode,
  manualStateToAnalysis,
  type DiaryInputMode,
  type ManualScoreState,
} from "@/lib/diary/manualScores";
import {
  hasSelectedDiaryMode,
  hasSeenDiaryValueProp,
  hasSeenDay7Milestone,
  markDiaryModeSelected,
  markDiaryValuePropSeen,
  markDay7MilestoneSeen,
  STATS_INSIGHT_MIN_ENTRIES,
} from "@/lib/diary/onboarding";
import { getCollectionSummary } from "@/lib/diary/collection";
import { getNextSameGanjiDate } from "@/lib/diary/nextGanjiDay";
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
  initialInputMode?: DiaryInputMode;
  onChangeMode?: () => void;
};

const EMPTY_PILLAR: DiaryPillar = {
  ganji: "??",
  ganjiKo: "??",
  stem: { hanja: "?", ko: "?" },
  branch: { hanja: "?", ko: "?" },
};

export default function DiaryEditor({ initialDate, initialInputMode = "text", onChangeMode }: Props) {
  const [date, setDate] = useState(() => resolveDateString(initialDate));

  // 현재 날짜의 사주 기둥 정보
  const [monthPillar, setMonthPillar] = useState<DiaryPillar>(EMPTY_PILLAR);
  const [yearPillar, setYearPillar] = useState<DiaryPillar>(EMPTY_PILLAR);

  // 기록 모드 – ref로 최신값 추적해 날짜 이동 시 모드 유지
  const [inputMode, setInputMode] = useState<DiaryInputMode>(initialInputMode);
  const inputModeRef = useRef<DiaryInputMode>(initialInputMode);

  const [content, setContent] = useState("");
  const [scoreState, setScoreState] = useState<ManualScoreState>(() => createManualScoreState());
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [dayPillar, setDayPillar] = useState<DiaryEntry["dayPillar"] | null>(null);
  const [dayPillarKo, setDayPillarKo] = useState<string>("");

  // 사주 기록 범위 설정
  const [sajuSettings, setSajuSettings] = useState<SajuSettings>(() => loadSajuSettings());

  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "analyzing">("loading");
  const [message, setMessage] = useState("");
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showValueIntro, setShowValueIntro] = useState(false);
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
    if (!hasSeenDiaryValueProp()) {
      setShowValueIntro(true);
      setShowModeSelect(false);
    } else {
      setShowValueIntro(false);
      setShowModeSelect(!hasSelectedDiaryMode());
    }
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

  // ── 날짜 로드 ────────────────────────────────────────────
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
        const mode = inferInputMode(existing);
        setEntry(existing);
        setInputMode(mode);
        inputModeRef.current = mode;
        setContent(existing.content);
        setScoreState(
          existing.analysis && mode === "scores"
            ? analysisToManualState(existing.analysis)
            : createManualScoreState()
        );
      } else {
        setEntry(null);
        setContent("");
        setInputMode(inputModeRef.current);
        setScoreState(createManualScoreState());
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

  // ── 저장 페이로드 빌더 ────────────────────────────────────
  const buildPayload = (
    base: DiaryEntry,
    analysis: DiaryAnalysis | null,
    mode: DiaryInputMode,
    now: string
  ): DiaryEntry => {
    const entryContent =
      mode === "scores" ? formatManualDiaryContent(scoreState) : content.trim();
    const userBirthPillars = sajuSettings.birthDate
      ? computeUserBirthPillars(sajuSettings.birthDate, sajuSettings.birthHour, sajuSettings.birthMinute) ?? undefined
      : undefined;

    return {
      ...base,
      content: entryContent,
      analysis,
      inputMode: mode,
      sajuDepth: "full",
      monthPillarKo: monthPillar.ganjiKo,
      yearPillarKo: yearPillar.ganjiKo,
      userBirthPillars,
      updatedAt: now,
      createdAt: entry?.createdAt ?? now,
    };
  };

  // ── 저장 ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (inputMode === "text" && !content.trim()) {
      setMessage("일기 내용을 입력해주세요.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const listBefore = await storage.list();
      const base = entry ?? createDiaryEntry(date, "");
      const analysis =
        inputMode === "scores" ? manualStateToAnalysis(scoreState) : entry?.analysis ?? null;
      const updated = buildPayload(base, analysis, inputMode, now);
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

      const wellbeing =
        inputMode === "scores"
          ? manualStateToAnalysis(scoreState).daily_wellbeing_score
          : updated.analysis?.daily_wellbeing_score ?? null;

      setLastMiniReport({
        ganjiKo: dayPillarKo,
        wellbeing,
        analysis: updated.analysis,
      });

      setMessage(inputMode === "scores" ? "점수가 저장되었습니다." : "저장되었습니다.");
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setStatus("idle");
    }
  };

  // ── AI 분석 ───────────────────────────────────────────────
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

      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const base = entry ?? createDiaryEntry(date, content.trim());
      const updated = buildPayload(base, data.analysis as DiaryAnalysis, "text", now);
      await storage.save(updated);
      setEntry(updated);
      await refreshAllEntries();
      setMessage("AI 분석이 완료되어 저장되었습니다.");
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "분석에 실패했습니다.");
      setStatus("idle");
    }
  };

  // ── 삭제 ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!entry || !confirm("이 날짜의 일기를 삭제할까요?")) return;
    try {
      const storage = await getDiaryStorage();
      await storage.delete(entry.id);
      setEntry(null);
      setContent("");
      setScoreState(createManualScoreState());
      setInputMode(inputModeRef.current);
      setMessage("삭제되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  const handleModeChange = (mode: DiaryInputMode) => {
    setInputMode(mode);
    inputModeRef.current = mode;
    setMessage("");
    markDiaryModeSelected();
    setShowModeSelect(false);
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
  const displayAnalysis = inputMode === "text" ? entry?.analysis ?? null : null;

  if (showValueIntro) {
    return (
      <DiaryValueIntro
        onStart={() => {
          markDiaryValuePropSeen();
          setShowValueIntro(false);
          setShowModeSelect(!hasSelectedDiaryMode());
        }}
      />
    );
  }

  if (showModeSelect) {
    return (
      <DiaryModeSelect
        onSelect={(mode) => {
          handleModeChange(mode);
        }}
      />
    );
  }

  const collectionSummary = getCollectionSummary(allEntries);
  const dayPillarIndex = dayPillar?.ganjiIndex ?? 0;
  const nextSame = dayPillar
    ? getNextSameGanjiDate(date, dayPillarIndex)
    : null;

  const yesterdayStr = (() => {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  })();
  const yesterdayEntry = allEntries.find((e) => e.date === yesterdayStr);
  const yesterdayWellbeing = yesterdayEntry?.analysis?.daily_wellbeing_score ?? null;

  return (
    <div className="space-y-4">
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
      {/* ① 만세력 + 일기 날짜 */}
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

      {/* ② 기록 방식 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("scores")}
          disabled={isBusy}
          className={`ui-mode-btn${inputMode === "scores" ? " ui-mode-btn-selected" : ""}`}
        >
          점수로 기록
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("text")}
          disabled={isBusy}
          className={`ui-mode-btn${inputMode === "text" ? " ui-mode-btn-selected" : ""}`}
        >
          글로 기록
        </button>
      </div>

      {inputMode === "scores" ? (
        <ManualScoreInput state={scoreState} onChange={setScoreState} disabled={isBusy} />
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘 하루는 어땠나요? 자유롭게 적어주세요."
          rows={10}
          disabled={isBusy}
          className="w-full px-3 py-2 text-sm border-2 resize-y"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border)",
            color: "var(--px-text)",
          }}
        />
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy}
          className="ui-primary-btn"
        >
          {status === "saving" ? "저장 중..." : "저장"}
        </button>
        {inputMode === "text" && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isBusy}
            className="ui-action-btn"
            style={{ opacity: isBusy ? 0.6 : 1 }}
          >
            {status === "analyzing" ? "분석 중..." : "마음 AI 분석"}
          </button>
        )}
        {entry && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy}
            className="px-4 py-2 text-xs font-bold border-2"
            style={{
              background: "var(--px-bg2)",
              borderColor: "#f87171",
              color: "#f87171",
            }}
          >
            삭제
          </button>
        )}
      </div>

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

      {message && (
        <p className="ui-hint font-bold">
          {message}
        </p>
      )}

      {displayAnalysis && (
        <div
          className="p-3 border-2 space-y-3"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        >
          <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
            ■ 마음 AI 분석
          </p>
          <AnalysisResult analysis={displayAnalysis} />
        </div>
      )}
    </div>
  );
}
