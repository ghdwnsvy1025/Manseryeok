"use client";

import { useState } from "react";
import type { SajuInput, SajuOptions, CalendarType, DayChangeRule, TimeCorrection } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";
import { useViewMode } from "@/contexts/ViewModeContext";

interface SajuFormProps {
  onCalculate: (input: SajuInput) => void;
  isLoading: boolean;
}

const LABEL_STYLE = { color: "var(--px-text2)", fontSize: "11px", fontWeight: "700" as const };
const SECTION_STYLE = { color: "var(--px-accent)", fontSize: "12px", fontWeight: "700" as const };

const LOCATION_PRESETS = [
  { id: "seoul", name: "대한민국, 서울", longitude: 126.98, latitude: 37.57 },
  { id: "busan", name: "대한민국, 부산", longitude: 129.08, latitude: 35.18 },
  { id: "daegu", name: "대한민국, 대구", longitude: 128.60, latitude: 35.87 },
  { id: "incheon", name: "대한민국, 인천", longitude: 126.71, latitude: 37.46 },
  { id: "gwangju", name: "대한민국, 광주", longitude: 126.85, latitude: 35.16 },
  { id: "daejeon", name: "대한민국, 대전", longitude: 127.38, latitude: 36.35 },
  { id: "ulsan", name: "대한민국, 울산", longitude: 129.31, latitude: 35.54 },
  { id: "jeju", name: "대한민국, 제주", longitude: 126.53, latitude: 33.50 },
  { id: "custom", name: "직접 입력", longitude: 126.98, latitude: 37.57 },
] as const;

function getCurrentDateTimeParts() {
  const now = new Date();

  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate()),
    hour: String(now.getHours()),
    minute: String(now.getMinutes()),
  };
}

function toNumber(value: string): number {
  return Number(value);
}

type DigitField = "year" | "month" | "day" | "hour" | "minute";

const DIGIT_LIMITS: Record<DigitField, { max: number; label: string }> = {
  year: { max: 4, label: "년" },
  month: { max: 2, label: "월" },
  day: { max: 2, label: "일" },
  hour: { max: 2, label: "시" },
  minute: { max: 2, label: "분" },
};

function getMaxDayInMonth(yearStr: string, monthStr: string): number {
  const month = parseInt(monthStr, 10);
  if (!month || month < 1 || month > 12) return 31;

  const year = parseInt(yearStr, 10);
  if (!yearStr || yearStr.length < 4 || !year) {
    if ([4, 6, 9, 11].includes(month)) return 30;
    if (month === 2) return 29;
    return 31;
  }

  return new Date(year, month, 0).getDate();
}

function clampDayForMonth(dayStr: string, yearStr: string, monthStr: string): { value: string; hint: string | null } {
  if (!dayStr) return { value: dayStr, hint: null };
  const day = parseInt(dayStr, 10);
  const maxDay = getMaxDayInMonth(yearStr, monthStr);
  if (day > maxDay) {
    return { value: String(maxDay), hint: `일은 1~${maxDay}까지 입력할 수 있습니다.` };
  }
  if (dayStr.length >= 1 && day < 1) {
    return { value: "1", hint: "일은 1~31까지 입력할 수 있습니다." };
  }
  return { value: dayStr, hint: null };
}

export default function SajuForm({ onCalculate, isLoading }: SajuFormProps) {
  const { isMobile } = useViewMode();
  const [initialDateTime] = useState(getCurrentDateTimeParts);
  const [year, setYear] = useState(initialDateTime.year);
  const [month, setMonth] = useState(initialDateTime.month);
  const [day, setDay] = useState(initialDateTime.day);
  const [hour, setHour] = useState(initialDateTime.hour);
  const [minute, setMinute] = useState(initialDateTime.minute);
  const [noTime, setNoTime] = useState(false);
  const [calendarType, setCalendarType] = useState<CalendarType>("solar");
  const [gender, setGender] = useState<Gender>("male");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dayChangeRule, setDayChangeRule] = useState<DayChangeRule>("midnight");
  const [timeCorrection, setTimeCorrection] = useState<TimeCorrection>("none");
  const [locationPresetId, setLocationPresetId] = useState<(typeof LOCATION_PRESETS)[number]["id"]>("seoul");
  const [locationName, setLocationName] = useState("대한민국, 서울");
  const [longitude, setLongitude] = useState(126.98);
  const [latitude, setLatitude] = useState(37.57);
  const [fieldHint, setFieldHint] = useState<string | null>(null);

  const handleDigitChange = (
    field: DigitField,
    raw: string,
    setter: (v: string) => void,
    context?: { year?: string; month?: string },
  ) => {
    const { max, label } = DIGIT_LIMITS[field];
    const digits = raw.replace(/\D/g, "");
    if (digits.length > max) {
      setter(digits.slice(0, max));
      setFieldHint(`${label}은(는) 최대 ${max}자리까지 입력할 수 있습니다.`);
      return;
    }

    if (!digits) {
      setter("");
      setFieldHint(null);
      return;
    }

    const num = parseInt(digits, 10);

    if (field === "month") {
      if (num > 12) {
        setter("12");
        setFieldHint("월은 1~12까지 입력할 수 있습니다.");
        return;
      }
      if (digits.length === 2 && num < 1) {
        setter("1");
        setFieldHint("월은 1~12까지 입력할 수 있습니다.");
        return;
      }
    }

    if (field === "day") {
      const yearCtx = context?.year ?? year;
      const monthCtx = context?.month ?? month;
      const maxDay = getMaxDayInMonth(yearCtx, monthCtx);
      if (num > maxDay) {
        setter(String(maxDay));
        setFieldHint(`일은 1~${maxDay}까지 입력할 수 있습니다.`);
        return;
      }
      if (digits.length === 2 && num < 1) {
        setter("1");
        setFieldHint(`일은 1~${maxDay}까지 입력할 수 있습니다.`);
        return;
      }
    }

    if (field === "hour") {
      if (num > 23) {
        setter("23");
        setFieldHint("시는 0~23까지 입력할 수 있습니다.");
        return;
      }
    }

    if (field === "minute") {
      if (num > 59) {
        setter("59");
        setFieldHint("분은 0~59까지 입력할 수 있습니다.");
        return;
      }
    }

    setter(digits);
    setFieldHint(null);
  };

  const handleYearChange = (raw: string) => {
    const { max, label } = DIGIT_LIMITS.year;
    const digits = raw.replace(/\D/g, "");
    if (digits.length > max) {
      setYear(digits.slice(0, max));
      setFieldHint(`${label}은(는) 최대 ${max}자리까지 입력할 수 있습니다.`);
      return;
    }

    const nextYear = digits;
    setYear(nextYear);
    const clamped = clampDayForMonth(day, nextYear, month);
    if (clamped.value !== day) {
      setDay(clamped.value);
      setFieldHint(clamped.hint);
      return;
    }
    setFieldHint(null);
  };

  const handleMonthChange = (raw: string) => {
    const { max, label } = DIGIT_LIMITS.month;
    const digits = raw.replace(/\D/g, "");
    if (digits.length > max) {
      setMonth(digits.slice(0, max));
      setFieldHint(`${label}은(는) 최대 ${max}자리까지 입력할 수 있습니다.`);
      return;
    }

    let nextMonth = digits;
    let hint: string | null = null;

    if (nextMonth) {
      const num = parseInt(nextMonth, 10);
      if (num > 12) {
        nextMonth = "12";
        hint = "월은 1~12까지 입력할 수 있습니다.";
      } else if (nextMonth.length === 2 && num < 1) {
        nextMonth = "1";
        hint = "월은 1~12까지 입력할 수 있습니다.";
      }
    }

    setMonth(nextMonth);
    const clamped = clampDayForMonth(day, year, nextMonth);
    if (clamped.value !== day) {
      setDay(clamped.value);
      setFieldHint(clamped.hint ?? hint);
      return;
    }
    setFieldHint(hint);
  };

  const handleLocationPresetChange = (presetId: (typeof LOCATION_PRESETS)[number]["id"]) => {
    const preset = LOCATION_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setLocationPresetId(presetId);
    setLocationName(preset.name);
    setLongitude(preset.longitude);
    setLatitude(preset.latitude);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options: SajuOptions = {
      calendarType,
      isLeapMonth,
      timezone: "Asia/Seoul",
      dayChangeRule,
      timeCorrection,
      location: { name: locationName, longitude, latitude },
    };
    const input: SajuInput = {
      year: toNumber(year),
      month: toNumber(month),
      day: toNumber(day),
      hour: noTime ? undefined : toNumber(hour),
      minute: noTime ? undefined : toNumber(minute),
      gender,
      options,
    };
    onCalculate(input);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`px-card space-y-5 ${isMobile ? "p-3.5 space-y-5" : "p-5"}`}
      style={{ borderColor: "var(--px-border2)" }}
    >
      {/* ── 생년월일 ── */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 생년월일</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>년</label>
            <input
              type="text"
              inputMode="numeric"
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-input px-3 py-2 text-sm w-24"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>월</label>
            <input
              type="text"
              inputMode="numeric"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="px-input px-3 py-2 text-sm w-20"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>일</label>
            <input
              type="text"
              inputMode="numeric"
              value={day}
              onChange={(e) => handleDigitChange("day", e.target.value, setDay, { year, month })}
              className="px-input px-3 py-2 text-sm w-20"
              required
            />
          </div>
        </div>
        {fieldHint && (
          <p className="mt-1.5 text-xs font-bold" style={{ color: "#fbbf24" }}>
            ⚠ {fieldHint}
          </p>
        )}
      </div>

      {/* ── 달력 종류 ── */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 달력 종류</p>
        <div className="flex gap-4 flex-wrap">
          {(["solar", "lunar"] as CalendarType[]).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="calendarType"
                value={type}
                checked={calendarType === type}
                onChange={() => setCalendarType(type)}
                className="px-radio"
              />
              <span className="text-sm" style={{ color: "var(--px-text)" }}>
                {type === "solar" ? "양력" : "음력"}
              </span>
            </label>
          ))}
          {calendarType === "lunar" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLeapMonth}
                onChange={(e) => setIsLeapMonth(e.target.checked)}
                className="px-radio"
              />
              <span className="text-sm" style={{ color: "var(--px-text)" }}>윤달</span>
            </label>
          )}
        </div>
      </div>

      {/* ── 성별 ── */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 성별 (대운 방향 계산)</p>
        <div className="flex gap-4 flex-wrap">
          {([
            ["male", "남자"],
            ["female", "여자"],
          ] as [Gender, string][]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={value}
                checked={gender === value}
                onChange={() => setGender(value)}
                className="px-radio"
              />
              <span className="text-sm" style={{ color: "var(--px-text)" }}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ── 출생 시각 ── */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 출생 시각 (KST)</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>시 (0-23)</label>
            <input
              type="text"
              inputMode="numeric"
              value={hour}
              onChange={(e) => handleDigitChange("hour", e.target.value, setHour)}
              disabled={noTime}
              required={!noTime}
              className="px-input px-3 py-2 text-sm w-20 disabled:opacity-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>분 (0-59)</label>
            <input
              type="text"
              inputMode="numeric"
              value={minute}
              onChange={(e) => handleDigitChange("minute", e.target.value, setMinute)}
              disabled={noTime}
              required={!noTime}
              className="px-input px-3 py-2 text-sm w-20 disabled:opacity-40"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-0.5">
            <input
              type="checkbox"
              checked={noTime}
              onChange={(e) => setNoTime(e.target.checked)}
              className="px-radio"
            />
            <span className="text-sm" style={{ color: "var(--px-text2)" }}>
              시간 모름 (시주 생략)
            </span>
          </label>
        </div>
      </div>

      {/* ── 출생 지역 ── */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 출생 지역</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label style={LABEL_STYLE}>지역</label>
            <select
              value={locationPresetId}
              onChange={(e) => handleLocationPresetChange(e.target.value as (typeof LOCATION_PRESETS)[number]["id"])}
              className="px-select px-3 py-2 text-sm"
            >
              {LOCATION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs pb-2" style={{ color: "var(--px-text2)" }}>
            {locationName}: 동경 {longitude}°, 북위 {latitude}°
          </p>
        </div>
      </div>

      {/* ── 고급 옵션 ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-bold transition-colors"
          style={{ color: "var(--px-text2)" }}
        >
          {showAdvanced ? "▲" : "▼"} 고급 옵션
        </button>

        {showAdvanced && (
          <div
            className="mt-4 space-y-4 pl-4 border-l-2"
            style={{ borderColor: "var(--px-border2)" }}
          >
            {/* 야자시 */}
            <div>
              <p className="mb-2 text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                ◆ 일주 변경 기준
              </p>
              <div className="flex flex-col gap-2">
                {([
                  ["midnight", "자정(00:00) — 일반"],
                  ["ziHour",   "야자시 (23:00부터 다음날)"],
                ] as [DayChangeRule, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dayChangeRule"
                      value={val}
                      checked={dayChangeRule === val}
                      onChange={() => setDayChangeRule(val)}
                      className="px-radio"
                    />
                    <span className="text-sm" style={{ color: "var(--px-text)" }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 시간 보정 */}
            <div>
              <p className="mb-2 text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                ◆ 시간 보정
              </p>
              <div className="flex flex-col gap-2">
                {([
                  ["none",               "없음 (병원 기록 KST 기준)"],
                  ["localMeanSolarTime", "평균태양시 (LMT)"],
                  ["trueSolarTime",      "진태양시 (균시차 포함)"],
                ] as [TimeCorrection, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="timeCorrection"
                      value={val}
                      checked={timeCorrection === val}
                      onChange={() => setTimeCorrection(val)}
                      className="px-radio"
                    />
                    <span className="text-sm" style={{ color: "var(--px-text)" }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 출생지 */}
            {locationPresetId === "custom" && (
              <div>
                <p className="mb-2 text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                  ◆ 출생지 직접 입력
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                    <label style={LABEL_STYLE}>지역명</label>
                    <input
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      className="px-input px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-28">
                    <label style={LABEL_STYLE}>경도 (동경°)</label>
                    <input
                      type="number"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      step={0.01}
                      className="px-input px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-28">
                    <label style={LABEL_STYLE}>위도 (북위°)</label>
                    <input
                      type="number"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      step={0.01}
                      className="px-input px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--px-text2)" }}>
                  시간 보정 옵션을 사용할 때 이 좌표를 기준으로 계산합니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 제출 ── */}
      <button
        type="submit"
        disabled={isLoading}
        className="px-btn w-full py-3 text-base"
      >
        {isLoading ? "[ 계산 중... ]" : "[ 사주 계산하기 ]"}
      </button>
    </form>
  );
}
