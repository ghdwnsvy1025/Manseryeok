"use client";

import { useEffect, useState } from "react";
import { markLinkPromptedAction } from "@/app/actions";
import { LinkGoogleButton } from "./LinkGoogleButton";

/**
 * 첫 저장 직후(그리고 기록 7건째) 오늘 화면의 기록 카드 아래 한 번 (docs/ANON_START.md 2절 ①②).
 * 보이는 순간 서버에 "보여 줬다"를 기록해 한 번만 나온다. "나중에"는 그 자리에서 접는다.
 * 모양(톤 v3.2): 한지 카드, 제목 송명, 금색 면 버튼은 이 카드의 Google 버튼 하나(기록 뒤 화면엔 다른 금색 버튼이 없다).
 */
export function LinkPromptCard({ nextCount }: { nextCount: number }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    markLinkPromptedAction(nextCount).catch((e) => console.error("연결 안내 기록", e));
  }, [nextCount]);

  if (hidden) return null;
  return (
    <section className="link-prompt card-frame card-paper p-5">
      <h2 className="font-serif text-[22px] leading-snug">기기를 바꿔도 남게 Google로 연결해요</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">지금 기록은 이 기기에만 묶여 있어요. 연결하면 어디서든 이어서 써요.</p>
      <div className="mt-5 flex flex-col gap-3">
        <LinkGoogleButton next="/" />
        <button type="button" onClick={() => setHidden(true)} className="text-sm text-faint underline underline-offset-4">
          나중에
        </button>
      </div>
    </section>
  );
}
