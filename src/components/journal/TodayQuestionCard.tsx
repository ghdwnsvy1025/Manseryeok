"use client";

import { useEffect, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";

type Props = {
  todayDate: string;
  enabledCodes: string[];
  entries: unknown[];
  sajuProfile: unknown | null;
};

export default function TodayQuestionCard({
  todayDate,
  enabledCodes,
  entries,
  sajuProfile,
}: Props) {
  const [question, setQuestion] = useState<string | null>(null);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/journal/today-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            todayDate,
            enabledCodes,
            entries,
            sajuProfile,
          }),
        });
        const data = (await res.json()) as {
          question?: string;
          openAi?: OpenAiCallStatus;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setQuestion("오늘 하루, 마음에 가장 남는 순간은 무엇이었나요?");
          setOpenAi({
            kind: "failed",
            reason: "request_failed",
            detail: data.error,
          });
        } else {
          setQuestion(data.question ?? null);
          setOpenAi(data.openAi ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setQuestion("오늘 하루, 마음에 가장 남는 순간은 무엇이었나요?");
          setOpenAi({
            kind: "failed",
            reason: "network",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [todayDate, enabledCodes.join("|"), entries.length]);

  return (
    <section
      className="p-3 border-2 space-y-1.5"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <p
        className="text-[10px] font-black tracking-wider"
        style={{ color: "var(--px-text2)" }}
      >
        오늘의 질문
      </p>
      {loading ? (
        <p className="ui-hint">질문을 준비하는 중…</p>
      ) : (
        <p
          className="text-sm font-bold leading-relaxed"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {question}
        </p>
      )}
      {shouldShowOpenAiStatus() && openAi && (
        <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
          {formatOpenAiStatus(openAi)}
        </p>
      )}
    </section>
  );
}
