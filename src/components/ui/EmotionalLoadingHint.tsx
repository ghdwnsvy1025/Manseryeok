"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createLoadingPhraseDeck,
  fetchQuoteLoadingPhrases,
  type LoadingPhrase,
} from "@/lib/ui/loadingPhrases";

type Props = {
  /** 하단 작은 상태 문구 */
  status?: string;
  compact?: boolean;
  intervalMs?: number;
};

function PoeticSpinner({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-5 h-5" : "w-10 h-10";
  return (
    <div className={`emotion-loader ${dim}`} aria-hidden>
      <span className="emotion-loader__ring" />
      <span className="emotion-loader__core" />
      <span className="emotion-loader__mote emotion-loader__mote--1" />
      <span className="emotion-loader__mote emotion-loader__mote--2" />
      <span className="emotion-loader__mote emotion-loader__mote--3" />
    </div>
  );
}

/**
 * 운세·질문·명언 공통 감성 로딩.
 * 마운트마다 문구 순서를 섞고, 가능하면 명언 DB 문장으로 보강.
 */
export default function EmotionalLoadingHint({
  status,
  compact = false,
  intervalMs = 4200,
}: Props) {
  const [extra, setExtra] = useState<LoadingPhrase[]>([]);
  const deck = useMemo(() => createLoadingPhraseDeck(extra), [extra]);
  const [idx, setIdx] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  const statusDeck = useMemo(() => {
    if (!status?.trim()) return [] as string[];
    const base = status.trim();
    return [
      base,
      "조금만 기다려 주세요…",
      "거의 다 왔어요…",
      base.replace(/중…$/, "중이에요…") === base
        ? "잠시만요, 고르고 있어요…"
        : base.replace(/중…$/, "중이에요…"),
    ].filter((s, i, arr) => arr.indexOf(s) === i);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    void fetchQuoteLoadingPhrases().then((phrases) => {
      if (!cancelled && phrases.length > 0) setExtra(phrases);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (compact || deck.length === 0) return;
    setIdx(Math.floor(Math.random() * deck.length));
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % deck.length);
      setStatusIdx((i) => i + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [compact, deck, intervalMs]);

  if (compact) {
    return (
      <div
        className="px-3 py-2.5 flex items-center justify-center gap-2.5 min-h-[4.75rem]"
        aria-live="polite"
        aria-busy="true"
      >
        <PoeticSpinner size="sm" />
        <p
          className="text-[12px] font-bold leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          {status ?? "준비하는 중…"}
        </p>
      </div>
    );
  }

  const phrase = deck[idx % Math.max(deck.length, 1)] ?? {
    kind: "healing" as const,
    line: "잠시만요. 오늘의 결을 고르고 있어요.",
  };

  return (
    <div
      className="fortune-loading py-7 px-3 flex flex-col items-center text-center gap-5"
      aria-live="polite"
      aria-busy="true"
    >
      <PoeticSpinner size="md" />
      <div className="fortune-loading-stage max-w-[20rem] min-h-[4.5rem] flex items-center justify-center">
        <p
          key={`${idx}-${phrase.line.slice(0, 16)}`}
          className="fortune-loading-phrase text-[14px] font-medium leading-[1.75] tracking-tight"
          data-kind={phrase.kind}
        >
          {phrase.line}
        </p>
      </div>
      {statusDeck.length > 0 && (
        <p
          className="text-[11px] font-bold tracking-wide"
          style={{ color: "var(--px-text2)", opacity: 0.85 }}
        >
          {statusDeck[statusIdx % statusDeck.length]}
        </p>
      )}
    </div>
  );
}
