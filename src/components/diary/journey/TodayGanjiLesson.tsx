"use client";

import { useState } from "react";
import Link from "next/link";
import { getGanjiLesson } from "@/lib/diary/ganjiLesson";
import type { DiaryDayPillar } from "@/lib/diary/types";

type Props = {
  dayPillar: DiaryDayPillar;
};

export default function TodayGanjiLesson({ dayPillar }: Props) {
  const [open, setOpen] = useState(false);
  const lesson = getGanjiLesson(dayPillar);

  return (
    <div
      className="border-2"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 text-left flex items-center justify-between gap-2"
      >
        <span className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          📖 {lesson.title}
        </span>
        <span className="ui-hint shrink-0">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "var(--px-border)" }}>
          <p className="ui-guide leading-relaxed pt-2">{lesson.body}</p>
          <Link
            href="/saju"
            className="text-xs font-bold"
            style={{ color: "var(--px-accent)" }}
          >
            내 사주에서 더 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
