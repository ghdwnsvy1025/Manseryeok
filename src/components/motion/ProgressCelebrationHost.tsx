"use client";

import { useEffect, useState } from "react";
import {
  LEVEL_MILESTONE_COPY,
  PROGRESS_CELEBRATION_EVENT,
  hasSeenHomeMotionTip,
  hasSeenMilestone,
  markHomeMotionTipSeen,
  markMilestoneSeen,
  notifyHeaderBadgePulse,
  type ProgressCelebrationDetail,
} from "@/lib/ui/motionEvents";
import { formatPersonalizationLevel } from "@/lib/product/personalizationLevel";

type ModalState =
  | { kind: "levelup"; level: number; previousLevel: number }
  | { kind: "milestone"; level: number; title: string; body: string }
  | { kind: "homeTip" }
  | null;

/**
 * 저장 후 XP 토스트 · 레벨업 팝업 · 마일스톤/홈 팁 팝업
 */
export default function ProgressCelebrationHost() {
  const [toast, setToast] = useState<{
    xp: number;
    key: number;
  } | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    const onCelebrate = (ev: Event) => {
      const detail = (ev as CustomEvent<ProgressCelebrationDetail>).detail;
      if (!detail) return;

      if (detail.gainedXp > 0) {
        if (!detail.suppressXpToast) {
          setToast({
            xp: detail.gainedXp,
            key: Date.now(),
          });
          window.setTimeout(() => setToast(null), 1600);
        }
        notifyHeaderBadgePulse({ streak: true, ring: true });
      }

      if (detail.leveledUp) {
        setModal({
          kind: "levelup",
          level: detail.level,
          previousLevel: detail.previousLevel,
        });
        const copy = LEVEL_MILESTONE_COPY[detail.level];
        if (copy && !hasSeenMilestone(detail.level)) {
          // 레벨업 닫은 뒤 마일스톤을 보여주기 위해 잠시 보관
          window.setTimeout(() => {
            /* handled on close */
          }, 0);
        }
      }
    };

    window.addEventListener(PROGRESS_CELEBRATION_EVENT, onCelebrate);
    return () =>
      window.removeEventListener(PROGRESS_CELEBRATION_EVENT, onCelebrate);
  }, []);

  useEffect(() => {
    if (hasSeenHomeMotionTip()) return;
    const t = window.setTimeout(() => {
      if (!hasSeenHomeMotionTip()) setModal({ kind: "homeTip" });
    }, 900);
    return () => window.clearTimeout(t);
  }, []);

  const closeModal = () => {
    setModal((prev) => {
      if (prev?.kind === "levelup") {
        const copy = LEVEL_MILESTONE_COPY[prev.level];
        if (copy && !hasSeenMilestone(prev.level)) {
          markMilestoneSeen(prev.level);
          return {
            kind: "milestone",
            level: prev.level,
            title: copy.title,
            body: copy.body,
          };
        }
      }
      if (prev?.kind === "homeTip") markHomeMotionTipSeen();
      if (prev?.kind === "milestone") markMilestoneSeen(prev.level);
      return null;
    });
  };

  return (
    <>
      {toast && (
        <div
          key={toast.key}
          className="motion-xp-toast pointer-events-none fixed z-[90] right-4 top-16 px-3 py-1.5 border-2 text-sm font-black"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-accent)",
            color: "var(--px-accent)",
            boxShadow: "3px 3px 0 #000",
          }}
          aria-live="polite"
        >
          +{toast.xp} XP
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 motion-modal-backdrop"
          style={{ background: "rgba(0,0,0,0.65)" }}
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xs p-4 border-2 space-y-3 motion-modal-card"
            style={{
              background: "var(--px-bg2)",
              borderColor: "var(--px-accent)",
              boxShadow: "4px 4px 0 #000",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {modal.kind === "levelup" && (
              <>
                <p
                  className="text-center text-[11px] font-bold tracking-wide"
                  style={{ color: "var(--px-text2)" }}
                >
                  LEVEL UP
                </p>
                <p
                  className="text-center text-2xl font-black motion-level-burst"
                  style={{ color: "var(--px-accent)" }}
                >
                  {formatPersonalizationLevel(modal.level)}
                </p>
                <p
                  className="text-center text-xs font-bold"
                  style={{ color: "var(--px-text-on-panel)" }}
                >
                  {formatPersonalizationLevel(modal.previousLevel)} →{" "}
                  {formatPersonalizationLevel(modal.level)} 달성!
                </p>
                <div className="motion-sparkles" aria-hidden />
              </>
            )}

            {modal.kind === "milestone" && (
              <>
                <p
                  className="text-base font-black"
                  style={{ color: "var(--px-accent)" }}
                >
                  {modal.title}
                </p>
                <p
                  className="text-xs leading-relaxed font-bold"
                  style={{ color: "var(--px-text)" }}
                >
                  {modal.body}
                </p>
              </>
            )}

            {modal.kind === "homeTip" && (
              <>
                <p
                  className="text-base font-black"
                  style={{ color: "var(--px-accent)" }}
                >
                  성장이 상단에 보여요
                </p>
                <p
                  className="text-xs leading-relaxed font-bold"
                  style={{ color: "var(--px-text)" }}
                >
                  오른쪽 위 배지에서 레벨과 연속 기록을 확인할 수 있어요. 기록을
                  저장하면 XP가 쌓이고, 레벨이 오르면 축하 팝업이 뜹니다.
                </p>
              </>
            )}

            <button
              type="button"
              className="ui-primary-btn w-full py-2.5 text-sm"
              onClick={closeModal}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
