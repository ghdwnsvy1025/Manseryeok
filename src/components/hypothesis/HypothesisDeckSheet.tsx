"use client";

/**
 * 나에게 오는 날들 — 홈에서 띄우는 전체화면 시트.
 *
 * 목록 본문은 HypothesisCardList 가 그린다. 여기는 껍데기(머리말·닫기)만 맡는다.
 * "나" 탭이 같은 목록을 쓰기 때문에 두 벌로 두면 문구가 갈라진다.
 */
import { useEffect } from "react";
import type { SajuProfilePillars } from "@/lib/diary/types";
import type { HypothesisCard } from "@/lib/hypothesis/types";
import type { Day0Answers } from "@/lib/hypothesis/day0Answers";
import HypothesisCardList from "./HypothesisCardList";

type Props = {
  cards: HypothesisCard[];
  percent: number;
  /** 날짜 계산에 필요 — 없으면 날짜 줄을 숨긴다 */
  pillars?: SajuProfilePillars | null;
  /** 첫날 짐작 — 목록에서 대조용으로만 쓴다 */
  day0?: Day0Answers | null;
  onClose: () => void;
};

export default function HypothesisDeckSheet({
  cards,
  percent,
  pillars,
  day0,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const settled = cards.filter((c) => c.status !== "collecting").length;

  return (
    <div
      // 프로필 헤더가 z-60 이라 그보다 위여야 머리말이 안 가린다
      className="fixed inset-0 z-[120] flex flex-col"
      style={{ background: "var(--px-bg)" }}
      role="dialog"
      aria-modal="true"
      aria-label="나에게 오는 날들"
    >
      <header
        // 가로줄 대신 여백으로 나눈다
        className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 shrink-0"
      >
        <div className="min-w-0">
          <p className="ui-section-title">나에게 오는 날들</p>
          <p className="ui-hint">
            {settled}/{cards.length} 확인됨 · 맞춤도 {percent}%
          </p>
        </div>
        <button
          type="button"
          className="px-btn px-3 py-2 text-sm font-bold shrink-0"
          onClick={onClose}
        >
          닫기
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <HypothesisCardList cards={cards} pillars={pillars} day0={day0} />
      </div>
    </div>
  );
}
