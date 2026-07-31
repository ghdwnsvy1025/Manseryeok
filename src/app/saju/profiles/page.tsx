"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SajuForm from "@/components/SajuForm";
import {
  registerSajuProfileFromResult,
  updateSajuProfileFromResult,
} from "@/lib/diary/registerSajuProfile";
import {
  loadAllSajuProfiles,
  loadLocalUserProfile,
  profileDisplayName,
  deleteSajuProfile,
  setLocalViewProfileId,
  setViewSajuProfile,
  PROFILES_LIST_EVENT,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuProfile } from "@/lib/diary/types";
import type { SajuInput } from "@/lib/saju/types";
import { calculateSaju } from "@/lib/saju/calculator";

function birthDateLabel(profile: SajuProfile): string {
  return profile.birthDate.replaceAll("-", ".");
}

/**
 * 프로필은 1개만 유지. 예전에 쌓인 추가 프로필은 정리한다.
 */
export default function SajuProfilesPage() {
  const router = useRouter();
  const { isMobile } = useViewMode();
  const [profiles, setProfiles] = useState<SajuProfile[]>([]);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SajuProfile | null>(null);
  const [registering, setRegistering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      let list = await loadAllSajuProfiles();
      const local = loadLocalUserProfile();
      const j =
        local?.activeJournalProfileId ??
        local?.activeSajuProfileId ??
        list.find((p) => p.isPrimary)?.id ??
        list[0]?.id ??
        null;

      // 수정 전·추가 버전 정리: 일기용 1개만 남김
      if (j && list.length > 1) {
        const extras = list.filter((p) => p.id !== j);
        for (const extra of extras) {
          try {
            await deleteSajuProfile(extra.id);
          } catch {
            /* ignore one-off */
          }
        }
        list = await loadAllSajuProfiles();
      }

      setProfiles(list);
      setJournalId(j);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필 목록을 불러오지 못했어요."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    const toList = () => {
      setEditing(null);
      setRegistering(false);
      setError(null);
    };
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onChange);
    window.addEventListener(PROFILES_LIST_EVENT, toList);
    return () => {
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onChange);
      window.removeEventListener(PROFILES_LIST_EVENT, toList);
    };
  }, [refresh]);

  const me = useMemo(
    () => profiles.find((p) => p.id === journalId) ?? profiles[0] ?? null,
    [profiles, journalId]
  );

  const openManseryeok = (profile: SajuProfile) => {
    setBusyId(profile.id);
    setError(null);
    setLocalViewProfileId(profile.id);
    void setViewSajuProfile(profile.id, { notify: false });
    router.push(`/saju?profile=${encodeURIComponent(profile.id)}`);
    setBusyId(null);
  };

  const handleRegister = async (
    input: SajuInput,
    meta: { label?: string }
  ) => {
    setSaving(true);
    setError(null);
    try {
      const res = calculateSaju(input);
      await registerSajuProfileFromResult(res, {
        label: meta.label,
        makePrimary: true,
      });
      setRegistering(false);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필을 등록하지 못했어요."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (
    input: SajuInput,
    meta: { label?: string }
  ) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = calculateSaju(input);
      await updateSajuProfileFromResult(editing, res, { label: meta.label });
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필을 수정하지 못했어요."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="ui-hint p-4 text-center">불러오는 중...</p>;
  }

  if (registering || editing) {
    const isEdit = Boolean(editing);
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
            {isEdit ? "★ 수정하기 ★" : "★ 프로필 등록 ★"}
          </div>
          {isEdit && (
            <p
              className="mt-2 text-sm font-black"
              style={{ color: "var(--px-accent)" }}
            >
              {profileDisplayName(editing!)}
            </p>
          )}
        </div>

        <SajuForm
          key={editing?.id ?? "register"}
          onCalculate={(input, meta) =>
            void (isEdit ? handleEdit(input, meta) : handleRegister(input, meta))
          }
          isLoading={saving}
          prefillBirth={false}
          seedProfile={editing}
          submitLabel={isEdit ? "저장하기" : undefined}
        />

        {error && (
          <p
            className="text-sm font-bold text-center"
            style={{ color: "#f87171" }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setRegistering(false);
            setEditing(null);
          }}
          className="w-full py-2 text-xs font-bold underline"
          style={{ color: "var(--px-text2)" }}
        >
          목록으로
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isMobile ? "space-y-3" : ""}`}>
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
          ★ 프로필 관리 ★
        </div>
      </div>

      {error && (
        <p
          className="text-sm font-bold text-center"
          style={{ color: "#f87171" }}
        >
          {error}
        </p>
      )}

      {me ? (
        <div
          className="border-2 overflow-hidden"
          style={{
            borderColor: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "4px 4px 0 #4a3a00",
          }}
        >
          <button
            type="button"
            disabled={busyId === me.id}
            onClick={() => openManseryeok(me)}
            className="w-full text-left p-4 space-y-1.5 disabled:opacity-70"
          >
            <p
              className={`font-black tracking-wide ${isMobile ? "text-[11px]" : "text-[10px]"}`}
              style={{ color: "var(--px-accent)", letterSpacing: "0.06em" }}
            >
              내 프로필
            </p>
            <p
              className={`font-black truncate leading-tight ${isMobile ? "text-[22px]" : "text-xl"}`}
              style={{ color: "var(--px-text-on-panel)" }}
            >
              {profileDisplayName(me)}
            </p>
            <p
              className={`font-bold ${isMobile ? "text-[15px]" : "text-[14px]"}`}
              style={{ color: "var(--px-text2)" }}
            >
              {birthDateLabel(me)}
              {me.gender === "male"
                ? " · 남성"
                : me.gender === "female"
                  ? " · 여성"
                  : ""}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setEditing(me)}
            className="w-full py-2.5 text-sm font-black border-t-2"
            style={{
              borderColor: "var(--px-border)",
              color: "var(--px-accent)",
              background: "var(--px-bg2)",
            }}
          >
            수정하기
          </button>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <p className="ui-hint">아직 프로필이 없어요. 나를 먼저 등록해 주세요.</p>
          <button
            type="button"
            onClick={() => setRegistering(true)}
            className="ui-primary-btn px-4 py-3 text-sm font-black"
          >
            프로필 등록
          </button>
        </div>
      )}
    </div>
  );
}
