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
      setError(err instanceof Error ? err.message : "상태를 불러오지 못했습니다.");
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
