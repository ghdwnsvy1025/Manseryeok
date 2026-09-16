"use client";

/**
 * 저장 직후 보상 — "오늘 기록으로 운세가 21% → 23%가 됐어요"
 *
 * 원래 이 자리에는 오늘의 명언이 있었다. 명언은 좋은 보상이지만
 * 남의 말이고, 어느 앱에서나 볼 수 있고, 우리 컨셉과 무관하다.
 *
 * 같은 자리에 "당신의 기록이 방금 무엇을 바꿨는지"를 넣으면
 * 보상 역할은 그대로 하면서 컨셉을 매일 증명한다.
 *
 * 맞춤도가 오르지 않은 날(이미 기록한 날을 수정한 경우 등)에도
 * 거짓말하지 않는다. 오르지 않았으면 오르지 않았다고 말한다.
 */
import { useEffect, useState } from "react";
import { completionHeadline } from "@/lib/hypothesis/completion";

type Props = {
  /** 저장 전 맞춤도 */
  before: number;
  /** 저장 후 맞춤도 */
  after: number;
  /** 다음에 뭘 하면 되는지 */
  nextStep: string;
  /** 확인을 기다리는 날의 수 */
  waitingCount: number;
};

export default function FortuneFitGain({
  before,
  after,
  nextStep,
  waitingCount,
}: Props) {
  const gained = Math.max(0, after - before);
  const [shown, setShown] = useState(before);

  // 숫자가 차오르는 연출 — 보상감은 여기서 나온다
  useEffect(() => {
    if (gained === 0) {
      setShown(after);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(after);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(before + gained * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [before, after, gained]);

  return (
    <section
      className="p-3 border-2 space-y-2"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg3)",
      }}
    >
      <p
        className="text-xs font-black"
        style={{ color: "var(--px-accent)" }}
      >
        오늘 기록이 바꾼 것
      </p>

      <div className="flex items-baseline gap-2">
        <span
          className="text-[28px] font-black tabular-nums leading-none"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {shown}%
        </span>
        {gained > 0 && (
          <span
            className="text-sm font-black tabular-nums"
            style={{ color: "var(--px-accent)" }}
          >
            +{gained}
          </span>
        )}
      </div>

      <p
        className="text-[13px] font-bold leading-relaxed"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {gained > 0
          ? completionHeadline(after)
          : "오늘 기록은 이미 반영돼 있어요."}
      </p>

      <div
        className="h-2.5 overflow-hidden"
        style={{
          border: "2px solid var(--px-border)",
          background: "var(--px-bg)",
        }}
      >
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${shown}%`, background: "var(--px-accent)" }}
        />
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
        {waitingCount > 0
          ? `${nextStep} ${waitingCount}가지 날이 확인을 기다리고 있어요.`
          : nextStep}
      </p>
    </section>
  );
}
