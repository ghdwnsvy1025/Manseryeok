"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ManseryeokBoard from "@/components/diary/ManseryeokBoard";
import PillarVisibilityToggle from "@/components/diary/PillarVisibilityToggle";
import FeatureCallout from "@/components/FeatureCallout";
import {
  hasSeenBoardExpandHint,
  hasSeenJourneyHint,
  isBoardExpanded,
  markBoardExpandHintSeen,
  markJourneyHintSeen,
  setBoardExpanded,
  STATS_INSIGHT_MIN_ENTRIES,
} from "@/lib/diary/onboarding";
import SameGanjiHint from "@/components/diary/stats/SameGanjiHint";
import TodayVibeLine from "@/components/diary/journey/TodayVibeLine";
import QuestProgressBar from "@/components/diary/journey/QuestProgressBar";
import NextGanjiCountdown from "@/components/diary/journey/NextGanjiCountdown";
import CollectionPreviewCard from "@/components/diary/journey/CollectionPreviewCard";
import TodayGanjiLesson from "@/components/diary/journey/TodayGanjiLesson";
import BirthDateNudge from "@/components/diary/journey/BirthDateNudge";
import {
  getCollectedGanjiIndices,
  getCollectionSummary,
} from "@/lib/diary/collection";
import { getNextSameGanjiDate, getNextUncollectedGanjiDate } from "@/lib/diary/nextGanjiDay";
import { getSeason1Quests, getStreakDays } from "@/lib/diary/quests";
import { getTodayVibe } from "@/lib/diary/todayVibe";
import type { DiaryEntry } from "@/lib/diary/types";
import {
  getPartialPillarsForFields,
  formatDiaryDateDisplay,
  isValidDateString,
} from "@/lib/diary/dayPillar";
import {
  computeUserBirthPillars,
  resolvePillarVisibility,
  splitBirthDate,
  validateBirthDateTimeFields,
  type BirthPillarSlot,
  type DiaryPillarSlot,
  type PillarVisibility,
  type SajuSettings,
} from "@/lib/diary/sajuSettings";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--px-bg3)",
  borderColor: "var(--px-border)",
  color: "var(--px-text)",
  textAlign: "center",
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--px-text-on-panel)",
};

function LabeledDateField({
  label,
  value,
  onChange,
  maxLength,
  width,
  placeholder,
  pillarEnabled = true,
  onTogglePillar,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  width: string;
  placeholder?: string;
  pillarEnabled?: boolean;
  onTogglePillar?: () => void;
}) {
  const [togglePop, setTogglePop] = useState(false);

  const handleToggle = () => {
    if (!onTogglePillar) return;
    setTogglePop(true);
    onTogglePillar();
    window.setTimeout(() => setTogglePop(false), 280);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        type="text"
        inputMode="numeric"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength))}
        placeholder={placeholder}
        className="px-2 py-2 text-sm border-2"
        style={{
          ...INPUT_STYLE,
          width,
          borderColor: pillarEnabled ? "var(--px-accent)" : "var(--px-border)",
          opacity: pillarEnabled ? 1 : 0.55,
          boxShadow: pillarEnabled ? "0 0 8px color-mix(in srgb, var(--px-accent) 35%, transparent)" : "none",
          transition: "border-color 0.2s ease, opacity 0.2s ease, box-shadow 0.22s ease",
        }}
      />
      <span className="font-bold" style={FIELD_LABEL_STYLE}>
        {label}
      </span>
      {onTogglePillar && (
        <div className="h-[18px] flex items-center justify-center">
          <PillarVisibilityToggle visible={pillarEnabled} onClick={handleToggle} popping={togglePop} />
        </div>
      )}
    </div>
  );
}

function parseDiaryDateFields(year: string, month: string, day: string): string | null {
  if (year.length !== 4 || !month || !day) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const candidate = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidDateString(candidate) ? candidate : null;
}

function BirthDateInput({
  birthDate,
  birthHour,
  birthMinute,
  pillarVisibility,
  onToggleBirthPillar,
  onBirthDateChange,
  onBirthHourChange,
  onBirthMinuteChange,
  showPillarToggles = true,
  compact = false,
}: {
  birthDate?: string;
  birthHour?: number;
  birthMinute?: number;
  pillarVisibility: PillarVisibility;
  onToggleBirthPillar: (slot: BirthPillarSlot) => void;
  onBirthDateChange: (date: string) => void;
  onBirthHourChange: (hour: number | undefined) => void;
  onBirthMinuteChange: (minute: number | undefined) => void;
  showPillarToggles?: boolean;
  compact?: boolean;
}) {
  const initParts = splitBirthDate(birthDate);

  const [yearStr, setYearStr] = useState(initParts.year);
  const [monthStr, setMonthStr] = useState(initParts.month);
  const [dayStr, setDayStr] = useState(initParts.day);
  const [hourStr, setHourStr] = useState(birthHour !== undefined ? String(birthHour) : "");
  const [minuteStr, setMinuteStr] = useState(birthMinute !== undefined ? String(birthMinute) : "");
  const [errorMessage, setErrorMessage] = useState("");
  const lastAppliedRef = useRef("");

  useEffect(() => {
    const validation = validateBirthDateTimeFields({
      year: yearStr,
      month: monthStr,
      day: dayStr,
      hour: hourStr,
      minute: minuteStr,
    });

    if (!validation.ok) {
      setErrorMessage(validation.reason === "invalid" ? validation.message : "");
      return;
    }

    setErrorMessage("");
    const signature = `${validation.birthDate}|${validation.birthHour ?? ""}|${validation.birthMinute ?? ""}`;
    if (signature === lastAppliedRef.current) return;

    lastAppliedRef.current = signature;
    onBirthDateChange(validation.birthDate);
    onBirthHourChange(validation.birthHour);
    onBirthMinuteChange(validation.birthMinute);
  }, [
    yearStr,
    monthStr,
    dayStr,
    hourStr,
    minuteStr,
    onBirthDateChange,
    onBirthHourChange,
    onBirthMinuteChange,
  ]);

  useEffect(() => {
    const parts = splitBirthDate(birthDate);
    const nextSignature = `${birthDate ?? ""}|${birthHour ?? ""}|${birthMinute ?? ""}`;
    if (nextSignature === lastAppliedRef.current) return;

    lastAppliedRef.current = nextSignature;
    setYearStr(parts.year);
    setMonthStr(parts.month);
    setDayStr(parts.day);
    setHourStr(birthHour !== undefined ? String(birthHour) : "");
    setMinuteStr(birthMinute !== undefined ? String(birthMinute) : "");
    setErrorMessage("");
  }, [birthDate, birthHour, birthMinute]);

  return (
    <div className="space-y-2">
      <p className="ui-section-title">
        {compact ? "내 생년월일·시간" : "■ 내 생년월일"}
      </p>
      {compact ? (
        <p className="ui-hint text-center">
          시간을 모르면 비워두셔도 돼요.
        </p>
      ) : (
        <p className="ui-guide">
          입력하면 내 일주와 오늘 일주를 비교할 수 있어요.
        </p>
      )}
      <div className="flex items-start gap-2 flex-wrap justify-center sm:justify-start">
        <LabeledDateField
          label="년"
          value={yearStr}
          onChange={setYearStr}
          maxLength={4}
          width="4.5rem"
          placeholder="년도"
          pillarEnabled={pillarVisibility.birth.year}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("year") : undefined}
        />
        <LabeledDateField
          label="월"
          value={monthStr}
          onChange={setMonthStr}
          maxLength={2}
          width="3rem"
          placeholder="월"
          pillarEnabled={pillarVisibility.birth.month}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("month") : undefined}
        />
        <LabeledDateField
          label="일"
          value={dayStr}
          onChange={setDayStr}
          maxLength={2}
          width="3rem"
          placeholder="일"
          pillarEnabled={pillarVisibility.birth.day}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("day") : undefined}
        />
        <div
          className="flex items-center justify-center text-xs font-bold shrink-0"
          style={{ height: "2.125rem", color: "var(--px-border)" }}
        >
          |
        </div>
        <LabeledDateField
          label="시"
          value={hourStr}
          onChange={setHourStr}
          maxLength={2}
          width="3rem"
          placeholder="시"
          pillarEnabled={pillarVisibility.birth.hour}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("hour") : undefined}
        />
        <LabeledDateField
          label="분"
          value={minuteStr}
          onChange={setMinuteStr}
          maxLength={2}
          width="3rem"
          placeholder="분"
        />
      </div>
      {errorMessage && (
        <p className="ui-error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function DiaryDateInput({
  date,
  pillarVisibility,
  onToggleDiaryPillar,
  onDiaryDateChange,
  onFieldsChange,
  showPillarToggles = true,
}: {
  date: string;
  pillarVisibility: PillarVisibility;
  onToggleDiaryPillar: (slot: DiaryPillarSlot) => void;
  onDiaryDateChange: (date: string) => void;
  onFieldsChange: (fields: { year: string; month: string; day: string }) => void;
  showPillarToggles?: boolean;
}) {
  const initParts = splitBirthDate(date);
  const [yearStr, setYearStr] = useState(initParts.year);
  const [monthStr, setMonthStr] = useState(initParts.month);
  const [dayStr, setDayStr] = useState(initParts.day);
  const [errorMessage, setErrorMessage] = useState("");
  const lastEmittedRef = useRef(date);

  useEffect(() => {
    onFieldsChange({ year: yearStr, month: monthStr, day: dayStr });

    const dateComplete = yearStr.length === 4 && monthStr !== "" && dayStr !== "";
    if (!dateComplete) {
      setErrorMessage("");
      return;
    }

    const validDate = parseDiaryDateFields(yearStr, monthStr, dayStr);
    if (!validDate) {
      setErrorMessage("일기 날짜를 다시 입력해주세요.");
      return;
    }

    setErrorMessage("");
    if (validDate === lastEmittedRef.current) return;
    lastEmittedRef.current = validDate;
    onDiaryDateChange(validDate);
  }, [yearStr, monthStr, dayStr, onDiaryDateChange, onFieldsChange]);

  useEffect(() => {
    if (date === lastEmittedRef.current) return;
    const parts = splitBirthDate(date);
    lastEmittedRef.current = date;
    setYearStr(parts.year);
    setMonthStr(parts.month);
    setDayStr(parts.day);
    setErrorMessage("");
  }, [date]);

  return (
    <div className="space-y-2">
      <p className="ui-section-title">
        ■ 일기 날짜
      </p>
      {showPillarToggles && (
        <p className="ui-hint">
          눈 아이콘으로 간지 표시/숨김을 선택하세요.
        </p>
      )}
      <div className="flex items-start gap-1.5 flex-wrap">
        <LabeledDateField
          label="년"
          value={yearStr}
          onChange={setYearStr}
          maxLength={4}
          width="4.2rem"
          placeholder="년"
          pillarEnabled={pillarVisibility.diary.year}
          onTogglePillar={showPillarToggles ? () => onToggleDiaryPillar("year") : undefined}
        />
        <LabeledDateField
          label="월"
          value={monthStr}
          onChange={setMonthStr}
          maxLength={2}
          width="2.8rem"
          placeholder="월"
          pillarEnabled={pillarVisibility.diary.month}
          onTogglePillar={showPillarToggles ? () => onToggleDiaryPillar("month") : undefined}
        />
        <LabeledDateField
          label="일"
          value={dayStr}
          onChange={setDayStr}
          maxLength={2}
          width="2.8rem"
          placeholder="일"
          pillarEnabled={pillarVisibility.diary.day}
          onTogglePillar={showPillarToggles ? () => onToggleDiaryPillar("day") : undefined}
        />
      </div>
      {errorMessage && (
        <p className="ui-error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

type Props = {
  diaryDate: string;
  onDiaryDateChange: (date: string) => void;
  sajuSettings: SajuSettings;
  onBirthDateChange: (date: string) => void;
  onBirthHourChange: (hour: number | undefined) => void;
  onBirthMinuteChange: (minute: number | undefined) => void;
  onToggleBirthPillar: (slot: BirthPillarSlot) => void;
  onToggleDiaryPillar: (slot: DiaryPillarSlot) => void;
  totalEntryDays?: number;
  entries?: DiaryEntry[];
};

export default function SajuDepthPicker({
  diaryDate,
  onDiaryDateChange,
  sajuSettings,
  onBirthDateChange,
  onBirthHourChange,
  onBirthMinuteChange,
  onToggleBirthPillar,
  onToggleDiaryPillar,
  totalEntryDays = 0,
  entries = [],
}: Props) {
  const [diaryFields, setDiaryFields] = useState(() => {
    const parts = splitBirthDate(diaryDate);
    return { year: parts.year, month: parts.month, day: parts.day };
  });

  useEffect(() => {
    const parts = splitBirthDate(diaryDate);
    setDiaryFields({ year: parts.year, month: parts.month, day: parts.day });
  }, [diaryDate]);

  const birthPillars = useMemo(() => {
    if (!sajuSettings.birthDate) return null;
    return computeUserBirthPillars(
      sajuSettings.birthDate,
      sajuSettings.birthHour,
      sajuSettings.birthMinute
    );
  }, [sajuSettings.birthDate, sajuSettings.birthHour, sajuSettings.birthMinute]);

  const diaryPillars = useMemo(
    () => getPartialPillarsForFields(diaryFields),
    [diaryFields]
  );

  const pillarVisibility = resolvePillarVisibility(sajuSettings);
  const [boardExpanded, setBoardExpandedState] = useState(false);
  const [showBoardExpandHint, setShowBoardExpandHint] = useState(false);
  const [showJourneyHint, setShowJourneyHint] = useState(false);
  const [dismissBirthNudge, setDismissBirthNudge] = useState(false);

  useEffect(() => {
    setBoardExpandedState(isBoardExpanded());
    setShowBoardExpandHint(!hasSeenBoardExpandHint());
    setShowJourneyHint(!hasSeenJourneyHint());
  }, []);

  const userBirthPillars = birthPillars;
  const todayVibe = useMemo(() => {
    if (!diaryPillars.dayPillar) return null;
    return getTodayVibe(diaryPillars.dayPillar, userBirthPillars);
  }, [diaryPillars.dayPillar, userBirthPillars]);

  const questSeason = useMemo(() => getSeason1Quests(entries), [entries]);
  const streakDays = useMemo(() => getStreakDays(entries), [entries]);
  const collectionSummary = useMemo(() => getCollectionSummary(entries), [entries]);

  const nextSameGanji = useMemo(() => {
    if (!diaryPillars.dayPillar) return null;
    return getNextSameGanjiDate(diaryDate, diaryPillars.dayPillar.ganjiIndex);
  }, [diaryDate, diaryPillars.dayPillar]);

  const nextUncollected = useMemo(() => {
    const collected = getCollectedGanjiIndices(entries);
    return getNextUncollectedGanjiDate(diaryDate, collected);
  }, [diaryDate, entries]);

  const showBirthNudge =
    !boardExpanded &&
    !sajuSettings.birthDate &&
    totalEntryDays >= 4 &&
    !dismissBirthNudge;

  const dismissJourneyHint = () => {
    markJourneyHintSeen();
    setShowJourneyHint(false);
  };

  const dismissBoardExpandHint = () => {
    markBoardExpandHintSeen();
    setShowBoardExpandHint(false);
  };

  const toggleBoardExpanded = () => {
    setBoardExpandedState((prev) => {
      const next = !prev;
      setBoardExpanded(next);
      if (next) dismissBoardExpandHint();
      return next;
    });
  };

  const showBoard = birthPillars || diaryPillars.dayPillar || diaryPillars.yearPillar;

  const dateDisplay = formatDiaryDateDisplay(diaryDate);

  const statsLink =
    totalEntryDays >= STATS_INSIGHT_MIN_ENTRIES ? (
      <Link href="/diary/stats" className="font-bold" style={{ color: "var(--px-accent)" }}>
        간지별 행복도 통계
      </Link>
    ) : (
      <strong style={{ color: "var(--px-accent)" }}>간지별 행복도 통계</strong>
    );

  const introHint = (
    <p className="ui-hint">
      매일 기록하면 {statsLink}를 볼 수 있어요.
    </p>
  );

  const boardSection = showBoard ? (
    <div className="space-y-3">
      {!boardExpanded && (
        <div className="text-center space-y-1.5 px-1">
          <h2 className="ui-page-title text-base sm:text-lg">■ 오늘의 사주</h2>
          {introHint}
        </div>
      )}
      {boardExpanded && (
        <div className="flex items-center justify-between gap-2">
          <p className="ui-section-title">만세력</p>
          <button
            type="button"
            onClick={toggleBoardExpanded}
            className="ui-action-btn ui-action-btn-muted"
          >
            간단히
          </button>
        </div>
      )}
      {showBoardExpandHint && !boardExpanded && (
        <FeatureCallout
          message="상세 보기에서 생년월일·전체 만세력·다른 날짜 기록을 설정할 수 있어요."
          onDismiss={dismissBoardExpandHint}
        />
      )}
      {showJourneyHint && !boardExpanded && entries.length === 0 && (
        <FeatureCallout
          message="기록이 쌓일수록 간지 도감이 채워지고, 7일이면 간지별 행복도가 열려요."
          onDismiss={dismissJourneyHint}
        />
      )}
      {todayVibe && !boardExpanded && <TodayVibeLine vibe={todayVibe} />}
      <ManseryeokBoard
        birthPillars={birthPillars}
        diaryPillars={diaryPillars}
        pillarVisibility={pillarVisibility}
        compact={!boardExpanded}
        dateDisplay={dateDisplay}
      />
      {!boardExpanded && nextSameGanji && diaryPillars.dayPillar && (
        <NextGanjiCountdown
          ganjiKo={nextSameGanji.ganjiKo}
          daysUntil={nextSameGanji.daysUntil}
          nextDate={nextSameGanji.date}
        />
      )}
      {!boardExpanded && diaryPillars.dayPillar && (
        <SameGanjiHint
          ganjiKo={diaryPillars.dayPillar.ganjiKo}
          currentDate={diaryDate}
        />
      )}
      {!boardExpanded && !questSeason.allComplete && (
        <QuestProgressBar season={questSeason} streakDays={streakDays} />
      )}
      {!boardExpanded && showBirthNudge && (
        <BirthDateNudge onDismiss={() => setDismissBirthNudge(true)} />
      )}
      {!boardExpanded && diaryPillars.dayPillar && totalEntryDays >= 1 && (
        <TodayGanjiLesson dayPillar={diaryPillars.dayPillar} />
      )}
      {!boardExpanded && entries.length > 0 && (
        <CollectionPreviewCard
          summary={collectionSummary}
          nextUncollected={
            nextUncollected
              ? { ganjiKo: nextUncollected.ganjiKo, daysUntil: nextUncollected.daysUntil }
              : null
          }
        />
      )}
      {!boardExpanded && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggleBoardExpanded}
            className={`ui-action-btn${showBoardExpandHint ? " ui-action-btn-pulse" : ""}`}
          >
            상세 보기
          </button>
        </div>
      )}
    </div>
  ) : !boardExpanded ? (
    <div className="space-y-3">
      <div className="text-center space-y-1.5 px-1">
        <h2 className="ui-page-title text-base sm:text-lg">■ 오늘의 사주</h2>
        {introHint}
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={toggleBoardExpanded}
          className={`ui-action-btn${showBoardExpandHint ? " ui-action-btn-pulse" : ""}`}
        >
          상세 보기
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div
      className="p-2 sm:p-3 border-2 space-y-3 sm:space-y-4"
      style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
    >
      {boardExpanded ? (
        <>
          <BirthDateInput
            birthDate={sajuSettings.birthDate}
            birthHour={sajuSettings.birthHour}
            birthMinute={sajuSettings.birthMinute}
            pillarVisibility={pillarVisibility}
            onToggleBirthPillar={onToggleBirthPillar}
            onBirthDateChange={onBirthDateChange}
            onBirthHourChange={onBirthHourChange}
            onBirthMinuteChange={onBirthMinuteChange}
            showPillarToggles={boardExpanded}
          />
          {boardSection}
          <DiaryDateInput
            date={diaryDate}
            pillarVisibility={pillarVisibility}
            onToggleDiaryPillar={onToggleDiaryPillar}
            onDiaryDateChange={onDiaryDateChange}
            onFieldsChange={setDiaryFields}
            showPillarToggles={boardExpanded}
          />
        </>
      ) : (
        boardSection
      )}
    </div>
  );
}
