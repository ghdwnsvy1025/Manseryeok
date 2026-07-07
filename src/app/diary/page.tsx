"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isValidDateString, resolveDateString } from "@/lib/diary/dayPillar";

import DiaryEditor from "@/components/diary/DiaryEditor";

function DiaryPageContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const initialDate = dateParam && isValidDateString(dateParam) ? dateParam : undefined;

  return (
    <div className="space-y-6">
      <div
        className="p-4 border-2"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", boxShadow: "4px 4px 0 #000" }}
      >
        <h2 className="text-lg font-black mb-1" style={{ color: "var(--px-accent)" }}>
          ■ 일기 × 일주
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--px-text2)" }}>
          그날의 일주(日柱)와 함께 일기를 기록하고, AI가 감정을 분류합니다.
        </p>
        <DiaryEditor initialDate={initialDate} />
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
