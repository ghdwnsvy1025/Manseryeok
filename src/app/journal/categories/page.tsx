"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NewDiaryGate from "@/components/journal/NewDiaryGate";
import CategoryPreferenceEditor from "@/components/journal/CategoryPreferenceEditor";
import { getJournalStorage } from "@/lib/journal/getStorage";
import {
  buildPreferencesFromSelection,
  getEnabledCodesOrdered,
} from "@/lib/journal/preferences";
import type { CategoryCode, UserCategoryPreference } from "@/lib/journal/types";

export default function JournalCategoriesPage() {
  const router = useRouter();
  const [initial, setInitial] = useState<CategoryCode[] | null>(null);
  const [previous, setPrevious] = useState<UserCategoryPreference[]>([]);
  const [doneMsg, setDoneMsg] = useState("");

  useEffect(() => {
    void (async () => {
      const storage = await getJournalStorage();
      const prefs = await storage.getPreferences();
      setPrevious(prefs);
      setInitial(getEnabledCodesOrdered(prefs));
    })();
  }, []);

  if (!initial) {
    return (
      <NewDiaryGate>
        <p className="ui-hint">불러오는 중…</p>
      </NewDiaryGate>
    );
  }

  return (
    <NewDiaryGate>
      <div className="space-y-4 max-w-lg mx-auto pb-8">
        <header>
          <h1 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
            ■ 기록 카테고리
          </h1>
          <p className="ui-hint mt-1">
            최소 4 · 권장 6 · 최대 9. 꺼도 과거 점수는 삭제되지 않아요.
          </p>
        </header>
        <CategoryPreferenceEditor
          initialEnabled={initial}
          submitLabel="카테고리 저장"
          onSave={async (enabled) => {
            const storage = await getJournalStorage();
            const next = buildPreferencesFromSelection(enabled, previous, null);
            await storage.savePreferences(next);
            setPrevious(next);
            setInitial(enabled);
            setDoneMsg("저장됐어요. 과거 점수는 그대로 남아 있어요.");
            router.push("/journal");
          }}
        />
        {doneMsg && <p className="ui-hint">{doneMsg}</p>}
      </div>
    </NewDiaryGate>
  );
}
