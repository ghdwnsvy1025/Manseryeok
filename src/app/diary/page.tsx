"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isValidDateString } from "@/lib/diary/dayPillar";
import DiaryEditor from "@/components/diary/DiaryEditor";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { inferInputMode, type DiaryInputMode } from "@/lib/diary/manualScores";

function DiaryPageContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const initialDate = dateParam && isValidDateString(dateParam) ? dateParam : undefined;
  const [initialInputMode, setInitialInputMode] = useState<DiaryInputMode>("scores");

  useEffect(() => {
    if (!initialDate) return;
    getDiaryStorage()
      .then((s) => s.getByDate(initialDate))
      .then((entry) => { if (entry) setInitialInputMode(inferInputMode(entry)); })
      .catch(() => {});
  }, [initialDate]);

  return (
    <div className="space-y-3">
      <div
        className="p-2 sm:p-4 border-2"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", boxShadow: "4px 4px 0 #000" }}
      >
        <DiaryEditor initialDate={initialDate} initialInputMode={initialInputMode} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <Link
          href="/diary/history"
          className="px-3 py-1.5 border-2"
          style={{ borderColor: "var(--px-border)", color: "var(--px-text2)", background: "var(--px-bg2)" }}
        >
          과거 일기
        </Link>
        <Link
          href="/diary/collection"
          className="px-3 py-1.5 border-2"
          style={{ borderColor: "var(--px-border)", color: "var(--px-text2)", background: "var(--px-bg2)" }}
        >
          간지 도감
        </Link>
        <Link
          href="/diary/stats"
          className="px-3 py-1.5 border-2"
          style={{ borderColor: "var(--px-accent)", color: "var(--px-text-on-panel)", background: "var(--px-bg2)" }}
        >
          간지별 행복도
        </Link>
      </div>
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
