"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isValidDateString } from "@/lib/diary/dayPillar";
import DiaryEditor from "@/components/diary/DiaryEditor";

function DiaryPageContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const initialDate = dateParam && isValidDateString(dateParam) ? dateParam : undefined;

  return (
    <div
      className="p-2 sm:p-4 border-2"
      style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", boxShadow: "4px 4px 0 #000" }}
    >
      <DiaryEditor initialDate={initialDate} />
    </div>
  );
}

export default function DiaryPage() {
  return (
    <Suspense fallback={<p className="text-xs" style={{ color: "var(--px-text2)" }}>불러오는 중...</p>}>
      <DiaryPageContent />
    </Suspense>
  );
}
