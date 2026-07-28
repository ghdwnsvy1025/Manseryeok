"use client";

import { useCallback, useEffect, useState } from "react";
import { cleanupDemoEntriesOnce } from "@/lib/diary/dataOrigin";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import {
  loadPrimarySajuProfile,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import { loadUserExperienceSettings } from "@/lib/app/experienceMode";
import {
  computeUserAppState,
  type UserAppState,
} from "@/lib/app/userAppState";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";

type HookState = {
  state: UserAppState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useUserAppState(): HookState {
  const [state, setState] = useState<UserAppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const withTimeout = async <T,>(
      p: Promise<T>,
      ms: number,
      label: string
    ): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          p,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(new Error(`${label} 응답이 너무 오래 걸립니다.`)),
              ms
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    try {
      const [{ experienceMode, onboardingCompletedAt }, sajuProfile, storage] =
        await withTimeout(
          Promise.all([
            loadUserExperienceSettings(),
            loadPrimarySajuProfile(),
            getDiaryStorage(),
          ]),
          6000,
          "초기 상태"
        );
      await cleanupDemoEntriesOnce(storage);
      let entries: Awaited<ReturnType<typeof storage.list>> = [];
      try {
        entries = await withTimeout(storage.list(), 5000, "일기 목록");
      } catch {
        entries = [];
      }
      setState(
        computeUserAppState({
          experienceMode,
          onboardingCompletedAt,
          sajuProfile,
          entries,
        })
      );
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "상태를 불러오지 못했습니다.";
      const missingTable =
        /diary_entries/i.test(raw) &&
        /schema cache|does not exist|Could not find the table/i.test(raw);
      try {
        const [{ experienceMode, onboardingCompletedAt }, sajuProfile] =
          await Promise.all([
            loadUserExperienceSettings(),
            loadPrimarySajuProfile(),
          ]);
        setState(
          computeUserAppState({
            experienceMode,
            onboardingCompletedAt,
            sajuProfile,
            entries: [],
          })
        );
        setError(null);
      } catch {
        setError(
          missingTable
            ? "Supabase에 diary_entries 테이블이 없습니다. SQL Editor에서 supabase/migrations/001_diary_entries.sql 부터 006까지 순서대로 실행한 뒤 다시 시도하세요."
            : raw
        );
        setState(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onProfileChange = () => {
      resetJournalStorageCache();
      void refresh();
    };
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onProfileChange);
    return () =>
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onProfileChange);
  }, [refresh]);

  return { state, loading, error, refresh };
}
