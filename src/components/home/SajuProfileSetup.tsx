"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarType, SajuInput } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";
import { completeOnboarding } from "@/lib/app/experienceMode";
import { registerSajuProfile } from "@/lib/diary/registerSajuProfile";
import {
  ANALYTICS_EVENTS,
  captureEvent,
  captureFlowError,
} from "@/lib/analytics/posthog";

type Props = {
  onCompleted: () => void;
};

const LOCATION_PRESETS = [
  { id: "seoul", name: "대한민국, 서울", longitude: 126.98, latitude: 37.57 },
  { id: "busan", name: "대한민국, 부산", longitude: 129.08, latitude: 35.18 },
  { id: "daegu", name: "대한민국, 대구", longitude: 128.6, latitude: 35.87 },
  { id: "incheon", name: "대한민국, 인천", longitude: 126.71, latitude: 37.46 },
  { id: "gwangju", name: "대한민국, 광주", longitude: 126.85, latitude: 35.16 },
  { id: "daejeon", name: "대한민국, 대전", longitude: 127.38, latitude: 36.35 },
  { id: "ulsan", name: "대한민국, 울산", longitude: 129.31, latitude: 35.54 },
  { id: "jeju", name: "대한민국, 제주", longitude: 126.53, latitude: 33.5 },
] as const;

function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

function isValidYear(raw: string): boolean {
  if (raw.length !== 4) return false;
  const n = Number(raw);
  return n >= 1900 && n <= 2100;
}

function isCompleteMonth(raw: string): boolean {
  if (!raw) return false;
  const n = Number(raw);
  if (n < 1 || n > 12) return false;
  return raw.length === 2 || (raw.length === 1 && n >= 2 && n <= 9);
}

function isCompleteDay(raw: string): boolean {
  if (!raw) return false;
  const n = Number(raw);
  if (n < 1 || n > 31) return false;
  return raw.length === 2 || (raw.length === 1 && n >= 4 && n <= 9);
}

function isCompleteHour(raw: string): boolean {
  if (!raw) return false;
  const n = Number(raw);
  if (n < 0 || n > 23) return false;
  return raw.length === 2 || (raw.length === 1 && n >= 3 && n <= 9);
}

export default function SajuProfileSetup({ onCompleted }: Props) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [noTime, setNoTime] = useState(false);
  const [gender, setGender] = useState<Gender>("male");
  const [calendarType, setCalendarType] = useState<CalendarType>("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [locationId, setLocationId] = useState<(typeof LOCATION_PRESETS)[number]["id"]>("seoul");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const profileStartedAtRef = useRef(Date.now());
  const profileStartedSentRef = useRef(false);

  /** 칸 누르면 비운 뒤 입력 (모바일에서 커서만 움직이는 문제 방지) */
  const clearOnFocus =
    (setter: (v: string) => void) =>
    (_e: React.FocusEvent<HTMLInputElement>) => {
      setter("");
      setError(null);
    };
  const clearOnPointerDown =
    (setter: (v: string) => void) =>
    () => {
      setter("");
      setError(null);
    };

  useEffect(() => {
    if (profileStartedSentRef.current) return;
    profileStartedSentRef.current = true;
    profileStartedAtRef.current = Date.now();
    captureEvent(ANALYTICS_EVENTS.profileStarted, {
      source: "onboarding",
    });
  }, []);

  const location =
    LOCATION_PRESETS.find((p) => p.id === locationId) ?? LOCATION_PRESETS[0];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!isValidYear(year) || m < 1 || m > 12 || d < 1 || d > 31) {
      setError("생년월일을 확인해 주세요.");
      return;
    }
    if (!noTime) {
      const h = Number(hour);
      const min = Number(minute || "0");
      if (hour === "" || h < 0 || h > 23 || min < 0 || min > 59) {
        setError("출생 시간을 확인해 주세요.");
        return;
      }
    }
    setSaving(true);
    try {
      const input: SajuInput = {
        year: y,
        month: m,
        day: d,
        hour: noTime ? undefined : Number(hour),
        minute: noTime ? undefined : Number(minute || "0"),
        gender,
        options: {
          calendarType,
          isLeapMonth: calendarType === "lunar" ? isLeapMonth : false,
          timezone: "Asia/Seoul",
          dayChangeRule: "midnight",
          timeCorrection: "trueSolarTime",
          location: {
            name: location.name,
            longitude: location.longitude,
            latitude: location.latitude,
          },
        },
      };
      await registerSajuProfile(input, {
        label: displayName.trim(),
        makePrimary: true,
        analyticsSource: "onboarding",
        analyticsStartedAt: profileStartedAtRef.current,
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필을 만들지 못했어요.");
      captureFlowError({
        step: "profile_create",
        errorCode: "UNKNOWN",
        recoverable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      await completeOnboarding("balanced");
      onCompleted();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      <header className="space-y-1 text-center pt-2">
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          오늘의 사주 일기
        </p>
        <h1 className="text-xl font-black" style={{ color: "var(--px-accent)" }}>
          내 사주 등록
        </h1>
        <p className="text-sm" style={{ color: "var(--px-text)" }}>
          생년월일만 있으면 바로 시작할 수 있어요.
        </p>
      </header>

      <form
        onSubmit={(e) => void submit(e)}
        className="p-4 border-2 space-y-4"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
      >
        {/* 1. 이름 */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            이름
          </span>
          <input
            type="text"
            required
            maxLength={20}
            placeholder="예: 홍길동"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="px-input px-3 py-2.5 text-sm w-full"
            autoComplete="nickname"
          />
        </label>

        {/* 2. 성별 */}
        <div className="space-y-1">
          <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            성별
          </span>
          <div className="saju-choice-track" role="radiogroup" aria-label="성별">
            {(["male", "female"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={gender === g}
                className={`saju-choice-chip${gender === g ? " is-on" : ""}`}
                onClick={() => setGender(g)}
              >
                {g === "male" ? "남성" : "여성"}
              </button>
            ))}
          </div>
        </div>

        {/* 3. 생년월일 */}
        <div className="flex gap-2 items-end">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              년
            </span>
            <input
              ref={yearRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={4}
              placeholder="1990"
              value={year}
              onFocus={clearOnFocus(setYear)}
              onPointerDown={clearOnPointerDown(setYear)}
              onChange={(e) => {
                const next = digitsOnly(e.target.value, 4);
                setYear(next);
                if (isValidYear(next)) {
                  setMonth("");
                  setDay("");
                  requestAnimationFrame(() => monthRef.current?.focus());
                }
              }}
              className="px-input px-3 py-2.5 text-sm w-full"
            />
          </label>
          <label className="flex flex-col gap-1 w-16">
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              월
            </span>
            <input
              ref={monthRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={2}
              placeholder="1"
              value={month}
              onFocus={clearOnFocus(setMonth)}
              onPointerDown={clearOnPointerDown(setMonth)}
              onChange={(e) => {
                const next = digitsOnly(e.target.value, 2);
                if (next && Number(next) > 12) return;
                setMonth(next);
                if (isCompleteMonth(next)) {
                  setDay("");
                  requestAnimationFrame(() => dayRef.current?.focus());
                }
              }}
              className="px-input px-3 py-2.5 text-sm w-full"
            />
          </label>
          <label className="flex flex-col gap-1 w-16">
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              일
            </span>
            <input
              ref={dayRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={2}
              placeholder="1"
              value={day}
              onFocus={clearOnFocus(setDay)}
              onPointerDown={clearOnPointerDown(setDay)}
              onChange={(e) => {
                const next = digitsOnly(e.target.value, 2);
                if (next && Number(next) > 31) return;
                setDay(next);
                if (isCompleteDay(next) && !noTime) {
                  setHour("");
                  setMinute("");
                  requestAnimationFrame(() => hourRef.current?.focus());
                }
              }}
              className="px-input px-3 py-2.5 text-sm w-full"
            />
          </label>
        </div>

        {/* 4. 시·분 */}
        {!noTime && (
          <div className="flex gap-2 items-end">
            <label className="flex flex-col gap-1 w-20">
              <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                시
              </span>
              <input
                ref={hourRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={2}
                placeholder="12"
                value={hour}
                onFocus={clearOnFocus(setHour)}
                onPointerDown={clearOnPointerDown(setHour)}
                onChange={(e) => {
                  const next = digitsOnly(e.target.value, 2);
                  if (next && Number(next) > 23) return;
                  setHour(next);
                  if (isCompleteHour(next)) {
                    setMinute("");
                    requestAnimationFrame(() => minuteRef.current?.focus());
                  }
                }}
                className="px-input px-3 py-2.5 text-sm w-full"
              />
            </label>
            <label className="flex flex-col gap-1 w-20">
              <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                분
              </span>
              <input
                ref={minuteRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                placeholder="0"
                value={minute}
                onFocus={clearOnFocus(setMinute)}
                onPointerDown={clearOnPointerDown(setMinute)}
                onChange={(e) => {
                  const next = digitsOnly(e.target.value, 2);
                  if (next && Number(next) > 59) return;
                  setMinute(next);
                }}
                className="px-input px-3 py-2.5 text-sm w-full"
              />
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={noTime}
            onChange={(e) => setNoTime(e.target.checked)}
          />
          출생 시간 모름
        </label>

        {/* 5. 달력 종류 */}
        <div className="space-y-1">
          <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            달력 종류
          </span>
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

        {/* 6. 출생지역 */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            출생지역
          </span>
          <select
            value={locationId}
            onChange={(e) =>
              setLocationId(e.target.value as (typeof LOCATION_PRESETS)[number]["id"])
            }
            className="px-input px-3 py-2.5 text-sm w-full"
          >
            {LOCATION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="text-xs font-bold" style={{ color: "#f87171" }} role="alert">
            {error}
          </p>
        )}

        {/* 7. 저장하기 */}
        <button
          type="submit"
          disabled={saving}
          className="ui-primary-btn w-full py-4 text-base"
          style={{ boxShadow: "4px 4px 0 #000" }}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </form>

      <button
        type="button"
        disabled={saving}
        onClick={() => void skip()}
        className="w-full py-2 text-xs font-bold"
        style={{ color: "var(--px-text2)" }}
      >
        나중에 하기 — 운세·문장 품질이 낮아질 수 있어요
      </button>
    </div>
  );
}
