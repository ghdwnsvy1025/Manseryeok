"use client";

import { useCallback, useEffect, useState } from "react";
import { cleanupDemoEntriesOnce } from "@/lib/diary/dataOrigin";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { loadPrimarySajuProfile } from "@/lib/diary/profileStorage";
import { loadUserExperienceSettings } from "@/lib/app/experienceMode";
import {
  computeUserAppState,
  type UserAppState,
} from "@/lib/app/userAppState";

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
    try {
      const [{ experienceMode, onboardingCompletedAt }, sajuProfile, storage] =
        await Promise.all([
          loadUserExperienceSettings(),
          loadPrimarySajuProfile(),
          getDiaryStorage(),
        ]);
      await cleanupDemoEntriesOnce(storage);
      const entries = await storage.list();
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
      setError(
        missingTable
          ? "Supabase에 diary_entries 테이블이 없습니다. SQL Editor에서 supabase/migrations/001_diary_entries.sql 부터 006까지 순서대로 실행한 뒤 다시 시도하세요."
          : raw
      );
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, loading, error, refresh };
}
