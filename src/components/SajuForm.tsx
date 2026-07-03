"use client";

import { useState } from "react";
import type { SajuInput, SajuOptions, CalendarType, DayChangeRule, TimeCorrection } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";

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

export default function SajuForm({ onCalculate, isLoading }: SajuFormProps) {
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
      className="px-card p-5 space-y-5"
      style={{ borderColor: "var(--px-border2)" }}
    >
      {/* ── 생년월일 ── */}
      <div>
        <p className="mb-2" style={SECTION_STYLE}>■ 생년월일</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>년</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1900} max={2100}
              className="px-input px-3 py-2 text-sm w-24"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>월</label>
            <input
              type="number"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              min={1} max={12}
              className="px-input px-3 py-2 text-sm w-20"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>일</label>
            <input
              type="number"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              min={1} max={31}
              className="px-input px-3 py-2 text-sm w-20"
              required
            />
          </div>
        </div>
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
              type="number"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              min={0} max={23}
              disabled={noTime}
              required={!noTime}
              className="px-input px-3 py-2 text-sm w-20 disabled:opacity-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={LABEL_STYLE}>분 (0-59)</label>
            <input
              type="number"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              min={0} max={59}
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
