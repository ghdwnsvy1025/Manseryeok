"use client";

import { useCallback, useEffect, useState } from "react";
import SajuForm from "@/components/SajuForm";
import { registerSajuProfileFromResult } from "@/lib/diary/registerSajuProfile";
import {
  loadAllSajuProfiles,
  notifySajuProfileChanged,
  profileDisplayName,
  setActiveSajuProfile,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuProfile } from "@/lib/diary/types";
import type { SajuInput } from "@/lib/saju/types";
import { calculateSaju } from "@/lib/saju/calculator";
import { loadSajuSettings, saveSajuSettings } from "@/lib/diary/sajuSettings";

const DIARY_LINES = [
  "적어 두면, 하루가 나를 기억해 준다.",
  "작은 감정일수록, 글로 남기면 커진다.",
  "오늘의 한 줄이, 내일의 나를 다독인다.",
  "흐린 마음도, 쓰면 조금 맑아진다.",
  "기록은 과거가 아니라, 나를 위한 등불이다.",
  "말 못 한 하루를, 종이 위에 쉬게 하자.",
  "감정은 스쳐 가도, 글은 나를 기다려 준다.",
  "완벽하지 않아도, 오늘의 나는 충분하다.",
  "조용히 적은 마음이, 가장 솔직하다.",
  "하루를 닫는 문장 하나면 충분하다.",
  "남겨 둔 말은, 언젠가 나를 안아 준다.",
  "일기 속에는, 내가 나를 이해하려는 시간이 있다.",
];

function birthDateLabel(profile: SajuProfile): string {
  return profile.birthDate.replaceAll("-", ".");
}

function pickDiaryLine(): string {
  return DIARY_LINES[Math.floor(Math.random() * DIARY_LINES.length)]!;
}

function applyProfileToSettings(profile: SajuProfile): void {
  const current = loadSajuSettings();
  saveSajuSettings({
    ...current,
    birthDate: profile.birthDate,
    birthHour: profile.birthTimeUnknown ? undefined : profile.birthHour,
    birthMinute: profile.birthTimeUnknown ? undefined : profile.birthMinute,
    gender:
      profile.gender === "male" || profile.gender === "female"
        ? profile.gender
        : current.gender,
  });
}

export default function SajuProfilesPage() {
  const { isMobile } = useViewMode();
  const [profiles, setProfiles] = useState<SajuProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [diaryLine, setDiaryLine] = useState(DIARY_LINES[0]!);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await loadAllSajuProfiles();
      setProfiles(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필 목록을 불러오지 못했어요."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDiaryLine(pickDiaryLine());
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onChange);
  }, [refresh]);

  const handleSelect = async (profileId: string) => {
    setSwitchingId(profileId);
    setError(null);
    try {
      const activated = await setActiveSajuProfile(profileId);
      if (activated) {
        applyProfileToSettings(activated);
        notifySajuProfileChanged();
      }
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필을 바꾸지 못했어요."
      );
    } finally {
      setSwitchingId(null);
    }
  };

  const handleAdd = async (
    input: SajuInput,
    meta: { label?: string }
  ) => {
    setSaving(true);
    setError(null);
    try {
      const res = calculateSaju(input);
      await registerSajuProfileFromResult(res, {
        label: meta.label,
        makePrimary: profiles.length === 0,
      });
      setAdding(false);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필을 추가하지 못했어요."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="ui-hint p-4 text-center">불러오는 중...</p>;
  }

  if (adding) {
    return (
      <div className={`space-y-6 ${isMobile ? "space-y-5" : ""}`}>
        <div className="text-center">
          <div
            className="inline-block px-3 py-2 border-2 text-[15px] font-bold display-font"
            style={{
              color: "var(--px-accent)",
              borderColor: "var(--px-accent)",
              background: "var(--px-bg3)",
              boxShadow: "4px 4px 0 #4a3a00",
            }}
          >
            ★ 프로필 추가 ★
          </div>
        </div>

        <SajuForm
          onCalculate={(input, meta) => void handleAdd(input, meta)}
          isLoading={saving}
          prefillBirth={false}
        />

        {error && (
          <p className="text-sm font-bold text-center" style={{ color: "#f87171" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${isMobile ? "space-y-4" : ""}`}>
      <div className="text-center space-y-3">
        <div
          className="inline-block px-3 py-2 border-2 text-[15px] font-bold display-font"
          style={{
            color: "var(--px-accent)",
            borderColor: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "4px 4px 0 #4a3a00",
          }}
        >
          ★ 프로필 관리 ★
        </div>
        <p
          className="max-w-xs mx-auto text-sm leading-relaxed"
          style={{ color: "var(--px-text)" }}
        >
          {diaryLine}
        </p>
      </div>

      {error && (
        <p className="text-sm font-bold text-center" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {profiles.map((profile) => {
          const active = profile.isPrimary;
          const busy = switchingId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              disabled={busy || active}
              onClick={() => void handleSelect(profile.id)}
              className="text-left p-4 border-2 space-y-1 transition-opacity disabled:opacity-100"
              style={{
                borderColor: active ? "var(--px-accent)" : "var(--px-border)",
                background: active ? "var(--px-bg3)" : "var(--px-bg2)",
                boxShadow: active ? "4px 4px 0 #4a3a00" : "3px 3px 0 #000",
                cursor: active ? "default" : "pointer",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-base font-black truncate"
                  style={{ color: "var(--px-accent)" }}
                >
                  {profileDisplayName(profile)}
                </p>
                {active && (
                  <span
                    className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 border"
                    style={{
                      borderColor: "var(--px-accent)",
                      color: "var(--px-accent)",
                    }}
                  >
                    적용 중
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: "var(--px-text2)" }}>
                {birthDateLabel(profile)}
              </p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-[110px] p-4 border-2 border-dashed flex flex-col items-center justify-center gap-1"
          style={{
            borderColor: "var(--px-accent)",
            background: "var(--px-bg2)",
            color: "var(--px-accent)",
          }}
        >
          <span className="text-2xl font-black leading-none" aria-hidden>
            +
          </span>
          <span className="text-sm font-black">프로필 추가</span>
        </button>
      </div>
    </div>
  );
}
