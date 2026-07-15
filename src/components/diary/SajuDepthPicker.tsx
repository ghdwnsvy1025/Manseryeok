"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ManseryeokBoard from "@/components/diary/ManseryeokBoard";
import PillarVisibilityToggle, {
  PillarVisibilityToggleSpacer,
} from "@/components/diary/PillarVisibilityToggle";
import FeatureCallout from "@/components/FeatureCallout";
import {
  hasSeenBoardExpandHint,
  hasSeenJourneyHint,
  isBoardExpanded,
  markBoardExpandHintSeen,
  markJourneyHintSeen,
  setBoardExpanded,
} from "@/lib/diary/onboarding";
import SameGanjiHint from "@/components/diary/stats/SameGanjiHint";
import BirthDateNudge from "@/components/diary/journey/BirthDateNudge";
import ElementDistributionBars from "@/components/diary/ElementDistributionBars";
import type { DiaryEntry } from "@/lib/diary/types";
import {
  getPartialPillarsForFields,
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
  textAlign: "center",
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--px-text-on-panel)",
};

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function LabeledDateField({
  label,
  value,
  onChange,
  maxLength,
  width,
  placeholder,
  pillarEnabled = true,
  onTogglePillar,
  reserveToggleSpace = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  width: string;
  placeholder?: string;
  pillarEnabled?: boolean;
  onTogglePillar?: () => void;
  /** 눈 없는 칸도 높이 맞춤 (분 등) */
  reserveToggleSpace?: boolean;
}) {
  const [togglePop, setTogglePop] = useState(false);

  const handleToggle = () => {
    if (!onTogglePillar) return;
    setTogglePop(true);
    onTogglePillar();
    window.setTimeout(() => setTogglePop(false), 280);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <input
        type="text"
        inputMode="numeric"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength))}
        placeholder={placeholder}
        className="px-input px-1 py-2 text-sm"
        style={{
          ...INPUT_STYLE,
          width,
          opacity: pillarEnabled ? 1 : 0.45,
          transition: "opacity 0.2s ease",
        }}
      />
      <span className="font-bold" style={FIELD_LABEL_STYLE}>
        {label}
      </span>
      {onTogglePillar ? (
        <div className="h-[18px] flex items-center justify-center">
          <PillarVisibilityToggle visible={pillarEnabled} onClick={handleToggle} popping={togglePop} />
        </div>
      ) : reserveToggleSpace ? (
        <div className="h-[18px] flex items-center justify-center">
          <PillarVisibilityToggleSpacer />
        </div>
      ) : null}
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
      {compact && (
        <p className="ui-hint text-center">
          시간을 모르면 비워두셔도 돼요.
        </p>
      )}
      <div className="flex flex-nowrap items-start gap-1 w-full justify-between">
        <LabeledDateField
          label="년"
          value={yearStr}
          onChange={setYearStr}
          maxLength={4}
          width="3.4rem"
          placeholder="년도"
          pillarEnabled={pillarVisibility.birth.year}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("year") : undefined}
        />
        <LabeledDateField
          label="월"
          value={monthStr}
          onChange={setMonthStr}
          maxLength={2}
          width="2.35rem"
          placeholder="월"
          pillarEnabled={pillarVisibility.birth.month}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("month") : undefined}
        />
        <LabeledDateField
          label="일"
          value={dayStr}
          onChange={setDayStr}
          maxLength={2}
          width="2.35rem"
          placeholder="일"
          pillarEnabled={pillarVisibility.birth.day}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("day") : undefined}
        />
        <div
          className="flex items-center justify-center text-xs font-bold shrink-0 self-start"
          style={{ height: "2.125rem", color: "var(--px-border)" }}
        >
          |
        </div>
        <LabeledDateField
          label="시"
          value={hourStr}
          onChange={setHourStr}
          maxLength={2}
          width="2.35rem"
          placeholder="시"
          pillarEnabled={pillarVisibility.birth.hour}
          onTogglePillar={showPillarToggles ? () => onToggleBirthPillar("hour") : undefined}
        />
        <LabeledDateField
          label="분"
          value={minuteStr}
          onChange={setMinuteStr}
          maxLength={2}
          width="2.35rem"
          placeholder="분"
          reserveToggleSpace={showPillarToggles}
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
  hideTitle = false,
}: {
  date: string;
  pillarVisibility: PillarVisibility;
  onToggleDiaryPillar: (slot: DiaryPillarSlot) => void;
  onDiaryDateChange: (date: string) => void;
  onFieldsChange: (fields: { year: string; month: string; day: string }) => void;
  showPillarToggles?: boolean;
  hideTitle?: boolean;
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
      {!hideTitle && (
        <p className="ui-section-title">
          ■ 일기 날짜
        </p>
      )}
      <div className={`flex items-start gap-1.5 flex-wrap ${hideTitle ? "justify-center" : ""}`}>
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
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const cardHeightBeforeRef = useRef<number | null>(null);

  useEffect(() => {
    setBoardExpandedState(isBoardExpanded());
    setShowBoardExpandHint(!hasSeenBoardExpandHint());
    setShowJourneyHint(!hasSeenJourneyHint());
  }, []);

  useLayoutEffect(() => {
    if (cardHeightBeforeRef.current === null || !scrollAnchorRef.current) return;
    const heightAfter = scrollAnchorRef.current.offsetHeight;
    const delta = heightAfter - cardHeightBeforeRef.current;
    cardHeightBeforeRef.current = null;
    if (Math.abs(delta) <= 0.5) return;

    // 칸 높이가 변한 만큼 스크롤을 보정 → 아래 내용(카메라)이 튀지 않음
    const scrollParent = findScrollParent(scrollAnchorRef.current);
    if (scrollParent) {
      scrollParent.scrollTop += delta;
    } else {
      window.scrollBy(0, delta);
    }
  }, [boardExpanded]);

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
    if (scrollAnchorRef.current) {
      cardHeightBeforeRef.current = scrollAnchorRef.current.offsetHeight;
    }
    setBoardExpandedState((prev) => {
      const next = !prev;
      setBoardExpanded(next);
      if (next) dismissBoardExpandHint();
      return next;
    });
  };

  const showBoard = birthPillars || diaryPillars.dayPillar || diaryPillars.yearPillar;

  const boardSection = showBoard ? (
    <div className="space-y-3">
      {!boardExpanded && (
        <div className="text-center px-1">
          <h2 className="ui-page-title text-base sm:text-lg">■ 날짜</h2>
        </div>
      )}
      {boardExpanded && (
        <p className="ui-section-title">만세력</p>
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
      {!boardExpanded && (
        <DiaryDateInput
          date={diaryDate}
          pillarVisibility={pillarVisibility}
          onToggleDiaryPillar={onToggleDiaryPillar}
          onDiaryDateChange={onDiaryDateChange}
          onFieldsChange={setDiaryFields}
          showPillarToggles={false}
          hideTitle
        />
      )}
      <ManseryeokBoard
        birthPillars={birthPillars}
        diaryPillars={diaryPillars}
        pillarVisibility={pillarVisibility}
        compact={!boardExpanded}
      />
      {!boardExpanded && <ElementDistributionBars diaryPillars={diaryPillars} />}
      {!boardExpanded && diaryPillars.dayPillar && (
        <SameGanjiHint
          ganjiKo={diaryPillars.dayPillar.ganjiKo}
          currentDate={diaryDate}
        />
      )}
      {!boardExpanded && showBirthNudge && (
        <BirthDateNudge onDismiss={() => setDismissBirthNudge(true)} />
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
      <div className="text-center px-1">
        <h2 className="ui-page-title text-base sm:text-lg">■ 날짜</h2>
      </div>
      <DiaryDateInput
        date={diaryDate}
        pillarVisibility={pillarVisibility}
        onToggleDiaryPillar={onToggleDiaryPillar}
        onDiaryDateChange={onDiaryDateChange}
        onFieldsChange={setDiaryFields}
        showPillarToggles={false}
        hideTitle
      />
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
      ref={scrollAnchorRef}
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
          <div className="space-y-2 pt-1">
            <p className="ui-hint text-center">
              눈 아이콘으로 간지 표시/숨김을 선택하세요.
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleBoardExpanded}
                className="ui-action-btn ui-action-btn-muted"
              >
                간단히
              </button>
            </div>
          </div>
        </>
      ) : (
        boardSection
      )}
    </div>
  );
}
