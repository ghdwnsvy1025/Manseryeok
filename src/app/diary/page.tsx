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
    <div className="space-y-4">
      <div
        className="p-4 border-2"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", boxShadow: "4px 4px 0 #000" }}
      >
        <h2 className="text-lg font-black mb-4" style={{ color: "var(--px-accent)" }}>
          ■ 일기 × 간지 통계
        </h2>

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
          href="/diary/stats"
          className="px-3 py-1.5 border-2"
          style={{ borderColor: "var(--px-accent)", color: "var(--px-accent)", background: "var(--px-bg3)" }}
        >
          일주별 통계
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
