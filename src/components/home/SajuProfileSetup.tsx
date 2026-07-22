"use client";

import { useState } from "react";
import type { CalendarType, SajuInput } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";
import { completeOnboarding } from "@/lib/app/experienceMode";
import { registerSajuProfile } from "@/lib/diary/registerSajuProfile";

type Props = {
  onCompleted: () => void;
};

export default function SajuProfileSetup({ onCompleted }: Props) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [noTime, setNoTime] = useState(true);
  const [gender, setGender] = useState<Gender>("male");
  const [calendarType, setCalendarType] = useState<CalendarType>("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const input: SajuInput = {
        year: Number(year),
        month: Number(month),
        day: Number(day),
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
            name: "대한민국, 서울",
            longitude: 126.98,
            latitude: 37.57,
          },
        },
      };
      await registerSajuProfile(input, {
        label: displayName.trim(),
        makePrimary: true,
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필을 만들지 못했어요.");
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

        <div className="flex gap-2">
          {(["solar", "lunar"] as CalendarType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCalendarType(type)}
              className="flex-1 py-2 text-xs font-bold border-2"
              style={{
                borderColor:
                  calendarType === type ? "var(--px-accent)" : "var(--px-border)",
                color:
                  calendarType === type ? "var(--px-accent)" : "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              {type === "solar" ? "양력" : "음력"}
            </button>
          ))}
        </div>

        {calendarType === "lunar" && (
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={isLeapMonth}
              onChange={(e) => setIsLeapMonth(e.target.checked)}
            />
            윤달
          </label>
        )}

        <div className="flex gap-2 items-end">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              년
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={4}
              placeholder="1990"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="px-input px-3 py-2.5 text-sm w-full"
            />
          </label>
          <label className="flex flex-col gap-1 w-16">
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              월
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={2}
              placeholder="1"
              value={month}
              onChange={(e) => setMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="px-input px-3 py-2.5 text-sm w-full"
            />
          </label>
          <label className="flex flex-col gap-1 w-16">
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              일
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={2}
              placeholder="1"
              value={day}
              onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="px-input px-3 py-2.5 text-sm w-full"
            />
          </label>
        </div>

        <div className="flex gap-2">
          {(["male", "female"] as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className="flex-1 py-2 text-xs font-bold border-2"
              style={{
                borderColor: gender === g ? "var(--px-accent)" : "var(--px-border)",
                color: gender === g ? "var(--px-accent)" : "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              {g === "male" ? "남성" : "여성"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={noTime}
            onChange={(e) => setNoTime(e.target.checked)}
          />
          출생 시간 모름
        </label>

        {!noTime && (
          <div className="flex gap-2 items-end">
            <label className="flex flex-col gap-1 w-20">
              <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                시
              </span>
              <input
                type="text"
                inputMode="numeric"
                required={!noTime}
                maxLength={2}
                placeholder="12"
                value={hour}
                onChange={(e) => setHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className="px-input px-3 py-2.5 text-sm w-full"
              />
            </label>
            <label className="flex flex-col gap-1 w-20">
              <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                분
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="0"
                value={minute}
                onChange={(e) => setMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className="px-input px-3 py-2.5 text-sm w-full"
              />
            </label>
          </div>
        )}

        {error && (
          <p className="text-xs font-bold" style={{ color: "#f87171" }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="ui-primary-btn w-full py-4 text-base"
          style={{ boxShadow: "4px 4px 0 #000" }}
        >
          {saving ? "저장 중..." : "프로필 만들고 시작"}
        </button>
      </form>

      <button
        type="button"
        disabled={saving}
        onClick={() => void skip()}
        className="w-full py-2 text-xs font-bold"
        style={{ color: "var(--px-text2)" }}
      >
        나중에 하기
      </button>
    </div>
  );
}
