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

export default function SajuProfilesPage() {
  const router = useRouter();
  const { isMobile } = useViewMode();
  const [profiles, setProfiles] = useState<SajuProfile[]>([]);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SajuProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await loadAllSajuProfiles();
      setProfiles(list);
      const local = loadLocalUserProfile();
      const j =
        local?.activeJournalProfileId ??
        local?.activeSajuProfileId ??
        list.find((p) => p.isPrimary)?.id ??
        list[0]?.id ??
        null;
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
      setAdding(false);
      setEditing(null);
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
    () => profiles.find((p) => p.id === journalId) ?? null,
    [profiles, journalId]
  );
  const others = useMemo(
    () => profiles.filter((p) => p.id !== journalId),
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

  const canDeleteEditing =
    Boolean(editing) &&
    editing!.id !== journalId &&
    !editing!.isPrimary;

  const handleDelete = async () => {
    if (!editing || !canDeleteEditing) return;
    const name = profileDisplayName(editing);
    if (
      !window.confirm(
        `「${name}」 프로필을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteSajuProfile(editing.id);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필을 삭제하지 못했어요."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="ui-hint p-4 text-center">불러오는 중...</p>;
  }

  if (adding || editing) {
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
            {isEdit ? "★ 수정하기 ★" : "★ 프로필 추가 ★"}
          </div>
          {isEdit && (
            <p className="mt-2 text-sm font-black" style={{ color: "var(--px-accent)" }}>
              {profileDisplayName(editing!)}
            </p>
          )}
        </div>

        <SajuForm
          key={editing?.id ?? "add"}
          onCalculate={(input, meta) =>
            void (isEdit ? handleEdit(input, meta) : handleAdd(input, meta))
          }
          isLoading={saving || deleting}
          prefillBirth={false}
          seedProfile={editing}
          submitLabel={isEdit ? "저장하기" : undefined}
        />

        {error && (
          <p className="text-sm font-bold text-center" style={{ color: "#f87171" }}>
            {error}
          </p>
        )}

        {canDeleteEditing && (
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => void handleDelete()}
            className="w-full py-3 text-sm font-black border-2"
            style={{
              borderColor: "#f87171",
              color: "#f87171",
              background: "var(--px-bg2)",
            }}
          >
            {deleting ? "삭제 중…" : "프로필 삭제"}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setAdding(false);
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
        <p className="text-sm font-bold text-center" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      {me && (
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
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <p
            className={`font-black tracking-wide px-0.5 ${isMobile ? "text-[11px]" : "text-[10px]"}`}
            style={{ color: "var(--px-text2)", letterSpacing: "0.06em" }}
          >
            다른 사람
          </p>
          <div className="grid gap-2">
            {others.map((profile) => {
              const busy = busyId === profile.id;
              return (
                <div
                  key={profile.id}
                  className="flex items-stretch border-2"
                  style={{
                    borderColor: "var(--px-border)",
                    background: "var(--px-bg2)",
                    boxShadow: "2px 2px 0 #000",
                  }}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openManseryeok(profile)}
                    className="min-w-0 flex-1 flex items-center gap-3 px-3 py-3 text-left disabled:opacity-70"
                  >
                    <span
                      className="shrink-0 w-9 h-9 flex items-center justify-center text-[15px] font-black border"
                      style={{
                        borderColor: "var(--px-border)",
                        color: "var(--px-accent)",
                        background: "var(--px-bg3)",
                      }}
                      aria-hidden
                    >
                      {profileDisplayName(profile).slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-black truncate leading-tight ${isMobile ? "text-[16px]" : "text-[15px]"}`}
                        style={{ color: "var(--px-text-on-panel)" }}
                      >
                        {profileDisplayName(profile)}
                      </p>
                      <p
                        className={`font-bold truncate mt-0.5 ${isMobile ? "text-[14px]" : "text-[13px]"}`}
                        style={{ color: "var(--px-text2)" }}
                      >
                        {birthDateLabel(profile)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(profile)}
                    className="shrink-0 px-3.5 self-stretch flex items-center text-[13px] font-black border-l-2"
                    style={{
                      borderColor: "var(--px-border)",
                      color: "var(--px-text2)",
                      background: "var(--px-bg3)",
                    }}
                  >
                    수정
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!me && profiles.length === 0 && (
        <p className="ui-hint text-center">아직 프로필이 없어요. 나를 먼저 등록해 주세요.</p>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-12 h-12 flex items-center justify-center border-2 text-2xl font-black leading-none"
          style={{
            borderColor: "var(--px-accent)",
            background: "var(--px-bg3)",
            color: "var(--px-accent)",
            boxShadow: "3px 3px 0 #4a3a00",
          }}
          aria-label={profiles.length === 0 ? "내 프로필 등록" : "다른 사람 추가"}
        >
          +
        </button>
      </div>
    </div>
  );
}
