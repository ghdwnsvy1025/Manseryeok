"use client";

import NewDiaryGate from "@/components/journal/NewDiaryGate";
import JournalEditor from "@/components/journal/JournalEditor";

export default function JournalPage() {
  return (
    <NewDiaryGate>
      <JournalEditor />
    </NewDiaryGate>
  );
}
