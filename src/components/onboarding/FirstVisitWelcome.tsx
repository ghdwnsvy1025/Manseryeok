"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  hasSeenFirstVisitWelcome,
  isFirstVisitWelcomePath,
  markFirstVisitWelcomeSeen,
} from "@/lib/app/firstVisitWelcome";

/**
 * 앱을 처음 쓸 때 홈에서 한 번만 보이는 소개 팝업.
 */
export default function FirstVisitWelcome() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenFirstVisitWelcome()) return;
    if (!isFirstVisitWelcomePath(pathname)) return;

    const t = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const dismiss = () => {
    markFirstVisitWelcomeSeen();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
    >
      <div
        className="w-full max-w-sm border-2 p-5 space-y-4 motion-modal-card"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "6px 6px 0 #000",
        }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.06em]"
          style={{ color: "var(--px-text2)" }}
        >
          오늘의 사주 일기
        </p>

        <h2
          id="first-visit-title"
          className="text-[1.35rem] font-black leading-[1.35] tracking-tight"
          style={{ color: "var(--px-text)" }}
        >
          하루의 기록에,
          <br />
          <span style={{ color: "var(--px-accent)" }}>사주를 살짝 곁들이다</span>
        </h2>

        <p
          className="text-[13px] font-bold leading-[1.65]"
          style={{ color: "var(--px-text-on-panel, var(--px-text))" }}
        >
          짧게 적어도 괜찮아요. 그날의 기운과 기록이 만나 운세·문장·조언을
          건네고, 마음을 조금 더 따뜻하게 정리해 드려요.
        </p>

        <ul
          className="space-y-2.5 pt-1 pb-1"
          style={{
            borderTop: "1px solid var(--px-border)",
            borderBottom: "1px solid var(--px-border)",
            paddingTop: "0.85rem",
            paddingBottom: "0.85rem",
          }}
        >
          {(
            [
              ["홈", "오늘 마음과 맞는 운세·문장"],
              ["일기", "부담 없이 남기는 하루 기록"],
              ["기록", "쌓인 이야기를 다시 돌아보기"],
            ] as const
          ).map(([tab, desc]) => (
            <li key={tab} className="flex items-baseline gap-3">
              <span
                className="shrink-0 w-8 text-[12px] font-black"
                style={{ color: "var(--px-accent)" }}
              >
                {tab}
              </span>
              <span
                className="text-[12px] font-bold leading-snug"
                style={{ color: "var(--px-text2)" }}
              >
                {desc}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="w-full py-3.5 text-sm font-black border-2"
          style={{
            borderColor: "#000",
            color: "#111",
            background: "var(--px-accent)",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          시작하기
        </button>
        <p
          className="text-center text-[10px] font-bold"
          style={{ color: "var(--px-text2)", opacity: 0.85 }}
        >
          이 안내는 처음 한 번만 보여요
        </p>
      </div>
    </div>
  );
}
