"use client";

import { useRef, useState } from "react";
import type { SajuInput, SajuOptions, CalendarType, DayChangeRule, TimeCorrection } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";
import { getBirthPrefillForForm } from "@/lib/diary/sajuSettings";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuProfile } from "@/lib/diary/types";

interface SajuFormProps {
  onCalculate: (input: SajuInput, meta: { label?: string }) => void;
  isLoading: boolean;
  /** false면 저장된 생년월일로 채우지 않음 (다른 프로필 조회용) */
  prefillBirth?: boolean;
  /** 이름 입력란 표시 (기본 true, 조회 전용이면 false) */
  showNameField?: boolean;
  /** 기존 프로필 수정 시 초기값 */
  seedProfile?: SajuProfile | null;
  /** 제출 버튼 문구 */
  submitLabel?: string;
}

const LABEL_STYLE = { color: "var(--px-text2)", fontSize: "14px", fontWeight: "700" as const };
const SECTION_STYLE = { color: "var(--px-accent)", fontSize: "16px", fontWeight: "800" as const };

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
    gender: undefined as Gender | undefined,
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

function getInitialDateTimeParts(
  prefillBirth: boolean,
  seedProfile?: SajuProfile | null
) {
  if (seedProfile) {
    const [y, m, d] = seedProfile.birthDate.split("-");
    const hasTime =
      !seedProfile.birthTimeUnknown &&
      seedProfile.birthHour !== undefined &&
      seedProfile.birthMinute !== undefined;
    return {
      year: y ?? "",
      month: m ? String(Number(m)) : "",
      day: d ? String(Number(d)) : "",
      hour: hasTime ? String(seedProfile.birthHour) : "",
      minute: hasTime ? String(seedProfile.birthMinute) : "",
      gender:
        seedProfile.gender === "male" || seedProfile.gender === "female"
          ? seedProfile.gender
          : (undefined as Gender | undefined),
    };
  }
  if (prefillBirth) {
    const prefill = getBirthPrefillForForm();
    if (prefill) return prefill;
  }
  return getCurrentDateTimeParts();
}

export default function SajuForm({
  onCalculate,
  isLoading,
  prefillBirth = true,
  showNameField = true,
  seedProfile = null,
  submitLabel,
}: SajuFormProps) {
  const { isMobile } = useViewMode();
  const [initialDateTime] = useState(() =>
    getInitialDateTimeParts(prefillBirth, seedProfile)
  );
  const [displayName, setDisplayName] = useState(
    () => seedProfile?.label?.trim() ?? ""
  );
  const [year, setYear] = useState(initialDateTime.year);
  const [month, setMonth] = useState(initialDateTime.month);
  const [day, setDay] = useState(initialDateTime.day);
  const [hour, setHour] = useState(initialDateTime.hour);
  const [minute, setMinute] = useState(initialDateTime.minute);
  const [noTime, setNoTime] = useState(() => !initialDateTime.hour);
  const [calendarType, setCalendarType] = useState<CalendarType>(
    () => seedProfile?.calendarType ?? "solar"
  );
  const [gender, setGender] = useState<Gender>(
    () => initialDateTime.gender ?? "male"
  );
  const [isLeapMonth, setIsLeapMonth] = useState(
    () => seedProfile?.isLeapMonth ?? false
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dayChangeRule, setDayChangeRule] = useState<DayChangeRule>(
    () => seedProfile?.dayChangeRule ?? "midnight"
  );
  const [timeCorrection] = useState<TimeCorrection>(
    () => seedProfile?.timeCorrection ?? "none"
  );
  const [locationPresetId, setLocationPresetId] = useState<
    (typeof LOCATION_PRESETS)[number]["id"]
  >(() => {
    if (!seedProfile?.locationName) return "seoul";
    const hit = LOCATION_PRESETS.find((p) => p.name === seedProfile.locationName);
    return hit?.id ?? "custom";
  });
  const [locationName, setLocationName] = useState(
    () => seedProfile?.locationName ?? "대한민국, 서울"
  );
  const [longitude, setLongitude] = useState(
    () => seedProfile?.longitude ?? 126.98
  );
  const [latitude, setLatitude] = useState(
    () => seedProfile?.latitude ?? 37.57
  );
  const [fieldHint, setFieldHint] = useState<string | null>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  /** 칸을 누르면 비운 뒤 바로 입력 (모바일에서 select()는 커서만 움직이는 경우가 많음) */
  const clearFieldOnFocus =
    (setter: (v: string) => void) =>
    (e: React.FocusEvent<HTMLInputElement>) => {
      setter("");
      setFieldHint(null);
      const el = e.currentTarget;
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(0, 0);
        } catch {
          /* ignore */
        }
      });
    };

  const clearFieldOnPointerDown =
    (setter: (v: string) => void) =>
    () => {
      setter("");
      setFieldHint(null);
    };

  const isCompleteMonth = (raw: string) => {
    if (!raw) return false;
    const n = Number(raw);
    if (n < 1 || n > 12) return false;
    return raw.length === 2 || (raw.length === 1 && n >= 2 && n <= 9);
  };

  const isCompleteDay = (raw: string, yearStr: string, monthStr: string) => {
    if (!raw) return false;
    const n = Number(raw);
    const maxDay = getMaxDayInMonth(yearStr, monthStr);
    if (n < 1 || n > maxDay) return false;
    return raw.length === 2 || (raw.length === 1 && n >= 4 && n <= 9);
  };

  const isCompleteHour = (raw: string) => {
    if (!raw) return false;
    const n = Number(raw);
    if (n < 0 || n > 23) return false;
    return raw.length === 2 || (raw.length === 1 && n >= 3 && n <= 9);
  };

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
      setter(digits);
      setFieldHint(null);
      if (isCompleteDay(digits, yearCtx, monthCtx) && !noTime) {
        setHour("");
        setMinute("");
        requestAnimationFrame(() => hourRef.current?.focus());
      }
      return;
    }

    if (field === "hour") {
      if (num > 23) {
        setter("23");
        setFieldHint("시는 0~23까지 입력할 수 있습니다.");
        return;
      }
      setter(digits);
      setFieldHint(null);
      if (isCompleteHour(digits)) {
        setMinute("");
        requestAnimationFrame(() => minuteRef.current?.focus());
      }
      return;
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
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    if (!digits) {
      setFieldHint(null);
      return;
    }
    const clamped = clampDayForMonth(day, digits, month);
    if (clamped.value !== day) {
      setDay(clamped.value);
      setFieldHint(clamped.hint);
    } else {
      setFieldHint(null);
    }
    if (digits.length === 4) {
      const y = parseInt(digits, 10);
      if (y >= 1000 && y <= new Date().getFullYear() + 1) {
        setMonth("");
        requestAnimationFrame(() => monthRef.current?.focus());
      }
    }
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
    setFieldHint(hint);
    if (isCompleteMonth(nextMonth)) {
      setDay("");
      requestAnimationFrame(() => dayRef.current?.focus());
    }
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
    if (showNameField && !displayName.trim()) {
      setFieldHint("이름을 입력해 주세요.");
      return;
    }
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
    onCalculate(input, {
      label: showNameField ? displayName.trim() : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`px-card space-y-5 ${isMobile ? "p-3.5 space-y-5" : "p-5"}`}
      style={{ borderColor: "var(--px-border2)" }}
    >
      {/* 1. 이름 */}
      {showNameField && (
        <div>
          <p className="mb-2" style={SECTION_STYLE}>
            ■ 이름
          </p>
          <label className="flex flex-col gap-1">
            <span style={LABEL_STYLE}>프로필에 보일 이름</span>
            <input
              type="text"
              required
              maxLength={20}
              placeholder="예: 홍길동"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (fieldHint) setFieldHint(null);
              }}
              className="px-input px-3 py-2.5 text-sm w-full max-w-xs"
              autoComplete="nickname"
            />
          </label>
        </div>
      )}

      {/* 2. 성별 */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 성별</p>
        <div className="saju-choice-track" role="radiogroup" aria-label="성별">
          {([
            ["male", "남자"],
            ["female", "여자"],
          ] as [Gender, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={gender === value}
              className={`saju-choice-chip${gender === value ? " is-on" : ""}`}
              onClick={() => setGender(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 생년월일 */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 생년월일</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>년</label>
            <input
              ref={yearRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="next"
              value={year}
              onFocus={clearFieldOnFocus(setYear)}
              onPointerDown={clearFieldOnPointerDown(setYear)}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-input px-3 py-2 text-sm w-24"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>월</label>
            <input
              ref={monthRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="next"
              value={month}
              onFocus={clearFieldOnFocus(setMonth)}
              onPointerDown={clearFieldOnPointerDown(setMonth)}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="px-input px-3 py-2 text-sm w-20"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>일</label>
            <input
              ref={dayRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="next"
              value={day}
              onFocus={clearFieldOnFocus(setDay)}
              onPointerDown={clearFieldOnPointerDown(setDay)}
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

      {/* 4. 시·분 */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 출생 시각 (KST)</p>
        {!noTime && (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label style={LABEL_STYLE}>시 (0-23)</label>
              <input
                ref={hourRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                value={hour}
                onFocus={clearFieldOnFocus(setHour)}
                onPointerDown={clearFieldOnPointerDown(setHour)}
                onChange={(e) => handleDigitChange("hour", e.target.value, setHour)}
                required
                className="px-input px-3 py-2 text-sm w-20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label style={LABEL_STYLE}>분 (0-59)</label>
              <input
                ref={minuteRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                value={minute}
                onFocus={clearFieldOnFocus(setMinute)}
                onPointerDown={clearFieldOnPointerDown(setMinute)}
                onChange={(e) => handleDigitChange("minute", e.target.value, setMinute)}
                required
                className="px-input px-3 py-2 text-sm w-20"
              />
            </div>
          </div>
        )}
        <button
          type="button"
          aria-pressed={noTime}
          onClick={() => setNoTime((v) => !v)}
          className={`saju-choice-chip mt-2${noTime ? " is-on" : ""}`}
          style={{
            display: "inline-block",
            width: "auto",
            maxWidth: "100%",
            border: "2px solid #000",
            boxShadow: "2px 2px 0 #000",
            borderRight: "2px solid #000",
          }}
        >
          {noTime ? "출생 시간 모름 · 적용 중" : "출생 시간 모름"}
        </button>
      </div>

      {/* 5. 달력 종류 */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 달력 종류</p>
        <div className="saju-choice-track" role="radiogroup" aria-label="달력 종류">
          {(["solar", "lunar"] as CalendarType[]).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={calendarType === type}
              className={`saju-choice-chip${calendarType === type ? " is-on" : ""}`}
              onClick={() => setCalendarType(type)}
            >
              {type === "solar" ? "양력" : "음력"}
            </button>
          ))}
        </div>
        {calendarType === "lunar" && (
          <button
            type="button"
            aria-pressed={isLeapMonth}
            onClick={() => setIsLeapMonth((v) => !v)}
            className={`saju-choice-chip mt-2${isLeapMonth ? " is-on" : ""}`}
            style={{
              display: "inline-block",
              width: "auto",
              border: "2px solid #000",
              boxShadow: "2px 2px 0 #000",
              borderRight: "2px solid #000",
            }}
          >
            {isLeapMonth ? "윤달 적용 중" : "윤달 아님"}
          </button>
        )}
      </div>

      {/* 6. 출생 지역 */}
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
              <div className="saju-choice-track" role="radiogroup" aria-label="일주 변경 기준" style={{ maxWidth: "100%", flexDirection: "column" }}>
                {([
                  ["midnight", "자정(00:00) — 일반"],
                  ["ziHour",   "야자시 (23:00부터 다음날)"],
                ] as [DayChangeRule, string][]).map(([val, label], idx, arr) => (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={dayChangeRule === val}
                    className={`saju-choice-chip${dayChangeRule === val ? " is-on" : ""}`}
                    style={{
                      borderRight: "none",
                      borderBottom: idx < arr.length - 1 ? "2px solid #000" : "none",
                      textAlign: "left",
                    }}
                    onClick={() => setDayChangeRule(val)}
                  >
                    {label}
                  </button>
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
        {isLoading
          ? "[ 저장 중... ]"
          : submitLabel
            ? `[ ${submitLabel} ]`
            : "[ 사주 등록하기 ]"}
      </button>
    </form>
  );
}
