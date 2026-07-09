"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnalysisResult from "@/components/diary/AnalysisResult";
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
      const base = entry ?? createDiaryEntry(date, "");
      const analysis =
        inputMode === "scores" ? manualStateToAnalysis(scoreState) : entry?.analysis ?? null;
      const updated = buildPayload(base, analysis, inputMode, now);
      await storage.save(updated);
      setEntry(updated);
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

  return (
    <div className="space-y-4">
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
      />

      {/* ② 기록 방식 토글 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("scores")}
          disabled={isBusy}
          className="flex-1 px-3 py-2.5 text-xs font-bold border-2"
          style={{
            background: inputMode === "scores" ? "var(--px-accent)" : "var(--px-bg2)",
            borderColor: inputMode === "scores" ? "#000" : "var(--px-border)",
            color: inputMode === "scores" ? "#000" : "var(--px-text2)",
            boxShadow: inputMode === "scores" ? "3px 3px 0 #000" : "none",
          }}
        >
          점수로 기록
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("text")}
          disabled={isBusy}
          className="flex-1 px-3 py-2.5 text-xs font-bold border-2"
          style={{
            background: inputMode === "text" ? "var(--px-accent)" : "var(--px-bg2)",
            borderColor: inputMode === "text" ? "#000" : "var(--px-border)",
            color: inputMode === "text" ? "#000" : "var(--px-text2)",
            boxShadow: inputMode === "text" ? "3px 3px 0 #000" : "none",
          }}
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
          className="px-4 py-2 text-xs font-bold border-2"
          style={{
            background: "var(--px-accent)",
            borderColor: "#000",
            color: "#000",
            boxShadow: "3px 3px 0 #000",
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {status === "saving" ? "저장 중..." : "저장"}
        </button>
        {inputMode === "text" && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isBusy}
            className="px-4 py-2 text-xs font-bold border-2"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-border2)",
              color: "var(--px-accent)",
              boxShadow: "3px 3px 0 #000",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {status === "analyzing" ? "분석 중..." : "AI 분석"}
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

      {message && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {message}
        </p>
      )}

      {displayAnalysis && (
        <div
          className="p-3 border-2 space-y-3"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        >
          <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
            ■ AI 감정 분석
          </p>
          <AnalysisResult analysis={displayAnalysis} />
        </div>
      )}
    </div>
  );
}
