"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import NewDiaryGate from "@/components/journal/NewDiaryGate";
import JournalEditor from "@/components/journal/JournalEditor";
import CheckInEditor from "@/components/journal/CheckInEditor";
import { isCheckinV2Enabled } from "@/lib/app/featureFlags";

function JournalPageInner() {
  const params = useSearchParams();
  const forceLegacy = params.get("legacy") === "1";
  const useCheckin = isCheckinV2Enabled() && !forceLegacy;

  return (
    <NewDiaryGate>
      {useCheckin ? <CheckInEditor /> : <JournalEditor />}
    </NewDiaryGate>
  );
}

export default function JournalPage() {
  return (
    <Suspense
      fallback={
        <NewDiaryGate>
          <p className="ui-hint p-4">불러오는 중…</p>
        </NewDiaryGate>
      }
    >
      <JournalPageInner />
    </Suspense>
  );
}
