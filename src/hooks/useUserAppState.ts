"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanupDemoEntriesOnce } from "@/lib/diary/dataOrigin";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import {
  loadAllSajuProfiles,
  loadLocalSajuProfiles,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import {
  completeOnboarding,
  loadUserExperienceSettings,
} from "@/lib/app/experienceMode";
import {
  computeUserAppState,
  type UserAppState,
} from "@/lib/app/userAppState";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SajuProfile } from "@/lib/diary/types";

type HookState = {
  state: UserAppState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} 응답이 너무 오래 걸립니다.`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pickProfile(profiles: SajuProfile[]): SajuProfile | null {
  return profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null;
}

function stateFromLocal(): UserAppState {
  const profiles = loadLocalSajuProfiles();
  const sajuProfile = pickProfile(profiles);
  return computeUserAppState({
    experienceMode: null,
    onboardingCompletedAt: sajuProfile ? new Date().toISOString() : null,
    sajuProfile,
    entries: [],
  });
}

export function useUserAppState(): HookState {
  const [state, setState] = useState<UserAppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const hasStateRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const lastAuthRefreshAt = useRef(0);

  const applyState = useCallback((next: UserAppState) => {
    hasStateRef.current = true;
    setState(next);
    setError(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    const seq = ++seqRef.current;

    if (!hasStateRef.current) setLoading(true);
    setError(null);

    // 어떤 경로로든 6초 안에 화면을 푼다
    const hardStop = window.setTimeout(() => {
      if (seq !== seqRef.current) return;
      if (!hasStateRef.current) {
        try {
          applyState(stateFromLocal());
        } catch {
          setLoading(false);
          setError("상태를 불러오지 못했습니다.");
        }
      } else {
        setLoading(false);
      }
      inFlightRef.current = false;
    }, 6000);

    try {
      // getSession이 멈춰도  entires 로딩을 막지 않음
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          await withTimeout(supabase.auth.getSession(), 2000, "세션");
        } catch {
          /* ignore */
        }
      }

      let profiles: SajuProfile[] = [];
      try {
        profiles = await withTimeout(loadAllSajuProfiles(), 4000, "사주 프로필");
      } catch {
        profiles = loadLocalSajuProfiles();
      }
      if (profiles.length === 0) {
        profiles = loadLocalSajuProfiles();
      }

      if (seq !== seqRef.current) return;

      let experienceMode = null as Awaited<
        ReturnType<typeof loadUserExperienceSettings>
      >["experienceMode"];
      let onboardingCompletedAt: string | null = null;
      try {
        const settings = await withTimeout(
          loadUserExperienceSettings(),
          3000,
          "설정"
        );
        experienceMode = settings.experienceMode;
        onboardingCompletedAt = settings.onboardingCompletedAt;
      } catch {
        /* local compute below */
      }

      const sajuProfile = pickProfile(profiles);
      let onboardingAt = onboardingCompletedAt;
      if (sajuProfile && !onboardingAt) {
        onboardingAt = new Date().toISOString();
        void completeOnboarding(experienceMode ?? "balanced").catch(() => {});
      }

      let entries: Awaited<
        ReturnType<Awaited<ReturnType<typeof getDiaryStorage>>["list"]>
      > = [];
      try {
        const storage = await withTimeout(getDiaryStorage(), 2500, "저장소");
        void cleanupDemoEntriesOnce(storage).catch(() => {});
        entries = await withTimeout(storage.list(), 3000, "일기");
      } catch {
        entries = [];
      }

      if (seq !== seqRef.current) return;

      applyState(
        computeUserAppState({
          experienceMode,
          onboardingCompletedAt: onboardingAt,
          sajuProfile,
          entries,
        })
      );
    } catch (err) {
      if (seq !== seqRef.current) return;
      try {
        applyState(stateFromLocal());
      } catch {
        if (!hasStateRef.current) {
          setState(null);
          setError(
            err instanceof Error ? err.message : "상태를 불러오지 못했습니다."
          );
          setLoading(false);
        }
      }
    } finally {
      window.clearTimeout(hardStop);
      if (seq === seqRef.current) setLoading(false);
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void refresh();
      }
    }
  }, [applyState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onProfileChange = () => {
      // reconcile 연속 이벤트로 refresh 폭주 방지
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        resetJournalStorageCache();
        void refresh();
      }, 300);
    };
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onProfileChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onProfileChange);
    };
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      const now = Date.now();
      // 마운트 직후 INITIAL_SESSION + 첫 refresh 중복 방지
      if (now - lastAuthRefreshAt.current < 1500) return;
      lastAuthRefreshAt.current = now;
      resetJournalStorageCache();
      void refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  return { state, loading, error, refresh };
}
