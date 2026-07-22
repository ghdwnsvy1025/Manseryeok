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
import RatingPicker from "@/components/diary/RatingPicker";
import EnergyRatingPicker from "@/components/diary/EnergyRatingPicker";
import PrimaryAreaPicker from "@/components/diary/PrimaryAreaPicker";
import LifestyleOptionalInputs from "@/components/diary/LifestyleOptionalInputs";
import NightTomorrowReport from "@/components/forecast/NightTomorrowReport";
import DiaryWriteModePicker from "@/components/diary/DiaryWriteModePicker";
import DiarySaveResultPanel from "@/components/diary/DiarySaveResultPanel";
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
import { happinessRankInRecentDays } from "@/lib/diary/trendStats";
import { filterRealEntries } from "@/lib/diary/dataOrigin";
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
import type {
  ActivityLevel,
  ConditionRating,
  DiaryEntry,
  DiaryPillar,
  EnergyRating,
  SleepSatisfaction,
  SocialMet,
  WorkIntensity,
} from "@/lib/diary/types";
import {
  applyAiWording,
  getForecastStorage,
  type DailyForecast,
} from "@/lib/forecast";
import {
  buildForecastAiInput,
  requestAiWording,
} from "@/lib/forecast/requestAiWording";
import { MATURITY_LABELS } from "@/lib/forecast/maturity";
import { DIARY_SCHEMA_VERSION } from "@/lib/diary/types";
import { getDiaryAnalysisService } from "@/services/analysis";
import type { DiaryAnalysisResult } from "@/services/analysis";
import {
  DEFAULT_CHECKIN_TAGS,
  FOCUS_RATING_LABELS,
  type DiaryWriteMode,
  type FocusRating,
} from "@/lib/product/lifeAreas";
import { loadExperienceModeLocal } from "@/lib/app/experienceMode";
import {
  DEFAULT_EXPERIENCE_MODE,
  prefersPlainLanguage,
} from "@/lib/product/modes";
import {
  buildDailySajuContext,
  formatBLinkCopy,
} from "@/lib/product/dailySajuContext";
import { getForecastService } from "@/services/analysis";

const CONDITION_LABELS: Record<ConditionRating, string> = {
  1: "매우 지침",
  2: "지침",
  3: "보통",
  4: "괜찮음",
  5: "가뿐함",
};

const DEFAULT_CONDITION: ConditionRating = 3;

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
  const [conditionRating, setConditionRating] = useState<ConditionRating>(
    DEFAULT_CONDITION
  );
  const [energyRating, setEnergyRating] = useState<EnergyRating | null>(null);
  const [primaryArea, setPrimaryArea] = useState<string | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [sleepSatisfaction, setSleepSatisfaction] = useState<SleepSatisfaction | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [socialMet, setSocialMet] = useState<SocialMet | null>(null);
  const [workIntensity, setWorkIntensity] = useState<WorkIntensity | null>(null);
  const [sajuProfile, setSajuProfile] = useState<Awaited<ReturnType<typeof loadPrimarySajuProfile>>>(null);
  const [sajuProfileId, setSajuProfileId] = useState<string | null>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [dayPillar, setDayPillar] = useState<DiaryEntry["dayPillar"] | null>(null);
  const [dayPillarKo, setDayPillarKo] = useState("");
  const [sajuSettings, setSajuSettings] = useState<SajuSettings>(
    loadDiarySettingsWithDefaultFortunes
  );
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [message, setMessage] = useState("");
  const [showValueIntro, setShowValueIntro] = useState(false);
  const [showWriteSheet, setShowWriteSheet] = useState(false);
  const [showManualScoreSheet, setShowManualScoreSheet] = useState(false);
  const [totalEntryDays, setTotalEntryDays] = useState(0);
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([]);
  const [saveCelebration, setSaveCelebration] = useState<SaveCelebration | null>(null);
  const [showDay7Modal, setShowDay7Modal] = useState(false);
  const [showCreateSajuPrompt, setShowCreateSajuPrompt] = useState(false);
  const [nightReport, setNightReport] = useState<{
    forecast: DailyForecast;
    maturityLabel: string;
  } | null>(null);
  const [writeMode, setWriteMode] = useState<DiaryWriteMode>("oneline");
  const [focusRating, setFocusRating] = useState<FocusRating | null>(null);
  const [saveAnalysis, setSaveAnalysis] = useState<DiaryAnalysisResult | null>(null);
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
      if (profile) {
        setSajuProfile(profile);
        setSajuProfileId(profile.id);
      }
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
          existing.happinessRating ?? DEFAULT_HAPPINESS_RATING
        );
        setConditionRating(existing.conditionRating ?? DEFAULT_CONDITION);
        setEnergyRating(existing.energyRating ?? null);
        setFocusRating(existing.focusRating ?? null);
        setPrimaryArea(existing.primaryArea ?? null);
        setEmotions(existing.emotions ?? []);
        setTags(existing.tags ?? []);
        setSleepSatisfaction(existing.sleepSatisfaction ?? null);
        setActivityLevel(existing.activityLevel ?? null);
        setSocialMet(existing.socialMet ?? null);
        setWorkIntensity(existing.workIntensity ?? null);
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
        setConditionRating(DEFAULT_CONDITION);
        setEnergyRating(null);
        setFocusRating(null);
        setPrimaryArea(null);
        setEmotions([]);
        setTags([]);
        setSleepSatisfaction(null);
        setActivityLevel(null);
        setSocialMet(null);
        setWorkIntensity(null);
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
      happinessSource: "selected",
      conditionRating,
      energyRating,
      focusRating,
      tenGod: (() => {
        try {
          return buildDailySajuContext(date, sajuProfile).tenGod;
        } catch {
          return base.tenGod ?? null;
        }
      })(),
      primaryArea,
      emotions,
      tags,
      sleepSatisfaction,
      activityLevel,
      socialMet,
      workIntensity,
      weatherMetadata: {
        ...(base.weatherMetadata ?? {}),
        focusRating: focusRating ?? undefined,
        tenGod: (() => {
          try {
            return buildDailySajuContext(date, sajuProfile).tenGod ?? undefined;
          } catch {
            return undefined;
          }
        })(),
      },
      dataOrigin: "user",
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
      schemaVersion: DIARY_SCHEMA_VERSION,
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
      const realAfter = filterRealEntries(listAfter);
      const uniqueAfterReal = getUniqueEntryDays(realAfter);
      const remaining = Math.max(0, STATS_INSIGHT_MIN_ENTRIES - uniqueAfterReal);
      const rank = happinessRankInRecentDays(realAfter, date, 7);
      if (rank && rank.total >= 2) {
        setMessage(
          `오늘 기록이 분석에 반영됐어요. 최근 ${rank.total}일 중 오늘의 행복도는 ${rank.rank}번째로 높아요.`
        );
      } else if (remaining > 0) {
        setMessage(
          `오늘 기록이 분석에 반영됐어요. ${remaining}일을 더 기록하면 요일별 행복도 변화를 확인할 수 있어요.`
        );
      } else {
        setMessage("오늘 기록이 분석에 반영됐어요. 기록이 쌓일수록 패턴을 비교할 수 있어요.");
      }

      // 저장 성공 후 내일 준비 리포트 (AI 실패해도 로컬/목업 예보 유지)
      try {
        const forecastSvc = getForecastService();
        const forecastResult = await forecastSvc.createForecast({
          todayDate: date,
          todayEntry: reloaded ?? updated,
          entries: listAfter,
          sajuProfile,
          mode: loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE,
        });
        if (forecastResult.forecast) {
          let finalForecast = forecastResult.forecast;
          try {
            const aiInput = buildForecastAiInput({
              forecast: finalForecast,
              todayEntry: reloaded ?? updated,
              entries: listAfter,
            });
            const wording = await requestAiWording(aiInput);
            if (wording) {
              finalForecast = applyAiWording(finalForecast, wording);
            }
          } catch {
            /* AI 선택 — 실패해도 로컬 유지 */
          }
          const forecastStorage = await getForecastStorage();
          await forecastStorage.saveForecast(finalForecast);
          setNightReport({
            forecast: finalForecast,
            maturityLabel:
              MATURITY_LABELS[finalForecast.maturity] ??
              MATURITY_LABELS[finalForecast.maturity],
          });
        }
      } catch {
        setMessage(
          "저장은 완료됐어요. 내일 예보는 잠시 후 홈에서 다시 확인할 수 있어요."
        );
      }

      try {
        const analysisSvc = getDiaryAnalysisService();
        const result = await analysisSvc.analyzeDiary({
          entry: reloaded ?? updated,
          entries: listAfter,
          sajuProfile,
          mode: loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE,
        });
        setSaveAnalysis(result);
      } catch {
        /* 분석 실패해도 저장은 유지 */
      }

      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setStatus("idle");
    }
  };

  const handleSaveLongDiary = async () => {
    const text = content.trim() || memo.trim();
    if (!text) {
      setMessage("긴 일기 내용을 입력해주세요.");
      return;
    }
    setMemo(text);
    setContent(text);
    setShowAdvancedWrite(true);
    setShowWriteSheet(false);
    setMessage("긴 일기가 반영되었습니다. 저장 버튼을 눌러 주세요. 원문은 기기에만 저장됩니다.");
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
      setConditionRating(DEFAULT_CONDITION);
      setEmotions([]);
      setTags([]);
      setSleepSatisfaction(null);
      setActivityLevel(null);
      setSocialMet(null);
      setWorkIntensity(null);
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

  const isBusy = status === "loading" || status === "saving";
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
        onAnalyze={handleSaveLongDiary}
        analyzing={false}
        analyzeLabel="긴 일기 반영"
      />
      <ManualScoreSheet
        open={showManualScoreSheet}
        state={manualScores}
        onChange={(next) => {
          setManualScores(next);
          setHasCustomScores(true);
        }}
        onClose={() => setShowManualScoreSheet(false)}
        disabled={isBusy}
      />

      {nightReport && (
        <NightTomorrowReport
          forecast={nightReport.forecast}
          maturityLabel={nightReport.maturityLabel}
          onClose={() => setNightReport(null)}
        />
      )}
      {!nightReport && saveCelebration && dayPillar && (
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

      {saveAnalysis && (
        <DiarySaveResultPanel
          result={saveAnalysis}
          bLinkCopy={(() => {
            try {
              return formatBLinkCopy(
                buildDailySajuContext(date, sajuProfile),
                prefersPlainLanguage(
                  loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE
                )
              );
            } catch {
              return null;
            }
          })()}
          onClose={() => setSaveAnalysis(null)}
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

        <DiaryWriteModePicker
          value={writeMode}
          onChange={(mode) => {
            setWriteMode(mode);
            if (mode === "free") {
              setShowAdvancedWrite(true);
              setShowWriteSheet(true);
            }
          }}
        />

        <p className="ui-hint">
          {(() => {
            try {
              const ctx = buildDailySajuContext(date, sajuProfile);
              return formatBLinkCopy(
                ctx,
                prefersPlainLanguage(
                  loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE
                )
              );
            } catch {
              return dayPillarKo
                ? `이 기록은 오늘의 ${dayPillarKo}일 흐름 정보와 자동으로 연결됩니다.`
                : "이 기록은 오늘의 흐름 정보와 자동으로 연결됩니다.";
            }
          })()}
        </p>
        <p className="ui-hint">기분만 선택해도 저장할 수 있어요. 나머지는 모두 선택 사항입니다.</p>

        <HappinessRatingPicker
          value={happinessRating}
          onChange={(rating) => {
            setHappinessRating(rating);
            setHasCustomScores(false);
          }}
          disabled={isBusy}
        />
        {(writeMode === "quick" || writeMode === "oneline") && (
          <>
            <EnergyRatingPicker
              value={energyRating}
              onChange={setEnergyRating}
              disabled={isBusy}
            />
            <RatingPicker
              title="집중"
              value={focusRating ?? 3}
              onChange={(v) => setFocusRating(v as FocusRating)}
              labels={FOCUS_RATING_LABELS}
              disabled={isBusy}
            />
            <RatingPicker
              title="생활 컨디션"
              value={conditionRating}
              onChange={setConditionRating}
              labels={CONDITION_LABELS}
              disabled={isBusy}
            />
          </>
        )}
        {writeMode !== "quick" && (
          <PrimaryAreaPicker
            value={primaryArea}
            onChange={setPrimaryArea}
            disabled={isBusy}
          />
        )}
        {writeMode === "quick" && (
          <EventTagPicker
            value={tags.length ? tags : []}
            onChange={setTags}
            disabled={isBusy}
          />
        )}
        {writeMode !== "quick" && (
          <>
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
                placeholder={
                  writeMode === "oneline"
                    ? "오늘 마음에 가장 오래 남은 장면은 무엇인가요?"
                    : "오늘을 한두 문장으로 남겨보세요."
                }
                className="w-full px-3 py-2 border-2 text-sm resize-none"
                style={{
                  background: "var(--px-bg3)",
                  borderColor: "var(--px-border)",
                  color: "var(--px-text-on-panel)",
                }}
              />
            </div>
            <EventTagPicker value={tags} onChange={setTags} disabled={isBusy} />
            <LifestyleOptionalInputs
              sleepSatisfaction={sleepSatisfaction}
              activityLevel={activityLevel}
              socialMet={socialMet}
              workIntensity={workIntensity}
              disabled={isBusy}
              onChange={(next) => {
                setSleepSatisfaction(next.sleepSatisfaction);
                setActivityLevel(next.activityLevel);
                setSocialMet(next.socialMet);
                setWorkIntensity(next.workIntensity);
              }}
            />
          </>
        )}

        {writeMode === "quick" && tags.length === 0 && (
          <p className="ui-hint">
            추천 태그: {DEFAULT_CHECKIN_TAGS.slice(0, 4).join(" · ")}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy}
          className="ui-primary-btn w-full py-3 text-sm"
        >
          {status === "saving" ? "저장 중..." : "오늘을 기록하고 내일 보기"}
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
            긴 일기 쓰기
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

      <Link
        href="/diary/history"
        className="block w-full px-3 py-3 text-center text-sm font-bold border-2"
        style={{
          borderColor: "var(--px-border)",
          background: "var(--px-bg2)",
          color: "var(--px-accent)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        과거 기록 보기 →
      </Link>
    </div>
  );
}
