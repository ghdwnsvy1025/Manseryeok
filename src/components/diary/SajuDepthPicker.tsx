"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ManseryeokBoard from "@/components/diary/ManseryeokBoard";
import PillarVisibilityToggle, { PillarVisibilityToggleSpacer } from "@/components/diary/PillarVisibilityToggle";
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
  background: "var(--px-bg3)",
  borderColor: "var(--px-border)",
  color: "var(--px-text)",
  textAlign: "center",
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontSize: "8px",
  color: "var(--px-text2)",
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
        className="px-1.5 py-1.5 text-xs border-2"
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
      <div className="h-[18px] flex items-center justify-center">
        {onTogglePillar ? (
          <PillarVisibilityToggle visible={pillarEnabled} onClick={handleToggle} popping={togglePop} />
        ) : (
          <PillarVisibilityToggleSpacer />
        )}
      </div>
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
}: {
  birthDate?: string;
  birthHour?: number;
  birthMinute?: number;
  pillarVisibility: PillarVisibility;
  onToggleBirthPillar: (slot: BirthPillarSlot) => void;
  onBirthDateChange: (date: string) => void;
  onBirthHourChange: (hour: number | undefined) => void;
  onBirthMinuteChange: (minute: number | undefined) => void;
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
      <p className="text-[10px] font-black" style={{ color: "var(--px-accent)" }}>
        ■ 내 생년월일 입력
      </p>
      <p className="text-[9px]" style={{ color: "var(--px-text2)" }}>
        사주팔자를 계산해 일진과의 상관관계를 분석합니다. 눈 아이콘으로 간지 표시/숨김을 선택하세요.
      </p>
      <div className="flex items-start gap-1.5 flex-wrap">
        <LabeledDateField
          label="년"
          value={yearStr}
          onChange={setYearStr}
          maxLength={4}
          width="4.2rem"
          placeholder="년도"
          pillarEnabled={pillarVisibility.birth.year}
          onTogglePillar={() => onToggleBirthPillar("year")}
        />
        <LabeledDateField
          label="월"
          value={monthStr}
          onChange={setMonthStr}
          maxLength={2}
          width="2.8rem"
          placeholder="월"
          pillarEnabled={pillarVisibility.birth.month}
          onTogglePillar={() => onToggleBirthPillar("month")}
        />
        <LabeledDateField
          label="일"
          value={dayStr}
          onChange={setDayStr}
          maxLength={2}
          width="2.8rem"
          placeholder="일"
          pillarEnabled={pillarVisibility.birth.day}
          onTogglePillar={() => onToggleBirthPillar("day")}
        />
        <div
          className="flex items-center justify-center text-xs font-bold shrink-0"
          style={{ height: "1.875rem", color: "var(--px-border)" }}
        >
          |
        </div>
        <LabeledDateField
          label="시"
          value={hourStr}
          onChange={setHourStr}
          maxLength={2}
          width="2.8rem"
          placeholder="시"
          pillarEnabled={pillarVisibility.birth.hour}
          onTogglePillar={() => onToggleBirthPillar("hour")}
        />
        <LabeledDateField
          label="분"
          value={minuteStr}
          onChange={setMinuteStr}
          maxLength={2}
          width="2.8rem"
          placeholder="분"
        />
      </div>
      {errorMessage && (
        <p className="text-[10px] font-bold" style={{ color: "#f87171" }}>
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
}: {
  date: string;
  pillarVisibility: PillarVisibility;
  onToggleDiaryPillar: (slot: DiaryPillarSlot) => void;
  onDiaryDateChange: (date: string) => void;
  onFieldsChange: (fields: { year: string; month: string; day: string }) => void;
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
      <p className="text-[10px] font-black" style={{ color: "var(--px-accent)" }}>
        ■ 일기 날짜 입력
      </p>
      <p className="text-[9px]" style={{ color: "var(--px-text2)" }}>
        일기 날짜에 해당하는 간지를 오른쪽에 표시합니다. 눈 아이콘으로 표시 여부를 선택하세요.
      </p>
      <div className="flex items-start gap-1.5 flex-wrap">
        <LabeledDateField
          label="년"
          value={yearStr}
          onChange={setYearStr}
          maxLength={4}
          width="4.2rem"
          placeholder="년"
          pillarEnabled={pillarVisibility.diary.year}
          onTogglePillar={() => onToggleDiaryPillar("year")}
        />
        <LabeledDateField
          label="월"
          value={monthStr}
          onChange={setMonthStr}
          maxLength={2}
          width="2.8rem"
          placeholder="월"
          pillarEnabled={pillarVisibility.diary.month}
          onTogglePillar={() => onToggleDiaryPillar("month")}
        />
        <LabeledDateField
          label="일"
          value={dayStr}
          onChange={setDayStr}
          maxLength={2}
          width="2.8rem"
          placeholder="일"
          pillarEnabled={pillarVisibility.diary.day}
          onTogglePillar={() => onToggleDiaryPillar("day")}
        />
      </div>
      {errorMessage && (
        <p className="text-[10px] font-bold" style={{ color: "#f87171" }}>
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

  return (
    <div className="p-3 border-2 space-y-3" style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}>
      <BirthDateInput
        birthDate={sajuSettings.birthDate}
        birthHour={sajuSettings.birthHour}
        birthMinute={sajuSettings.birthMinute}
        pillarVisibility={pillarVisibility}
        onToggleBirthPillar={onToggleBirthPillar}
        onBirthDateChange={onBirthDateChange}
        onBirthHourChange={onBirthHourChange}
        onBirthMinuteChange={onBirthMinuteChange}
      />

      {(birthPillars || diaryPillars.yearPillar) && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-black" style={{ color: "var(--px-accent)" }}>
            만세력
          </p>
          <ManseryeokBoard
            birthPillars={birthPillars}
            diaryPillars={diaryPillars}
            pillarVisibility={pillarVisibility}
          />
        </div>
      )}

      <DiaryDateInput
        date={diaryDate}
        pillarVisibility={pillarVisibility}
        onToggleDiaryPillar={onToggleDiaryPillar}
        onDiaryDateChange={onDiaryDateChange}
        onFieldsChange={setDiaryFields}
      />
    </div>
  );
}
