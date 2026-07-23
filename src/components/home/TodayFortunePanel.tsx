"use client";

import { useEffect, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import type { FortuneSection } from "@/lib/journal/todayFortune";

type Props = {
  todayDate: string;
  sajuProfile: unknown | null;
};

export default function TodayFortunePanel({ todayDate, sajuProfile }: Props) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<FortuneSection[]>([]);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/journal/today-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todayDate, sajuProfile }),
        });
        const data = (await res.json()) as {
          sections?: FortuneSection[];
          openAi?: OpenAiCallStatus;
        };
        if (cancelled) return;
        setSections(data.sections ?? []);
        setOpenAi(data.openAi ?? null);
        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
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
  }, [open, loaded, todayDate, sajuProfile]);

  return (
    <section
      className="border-2 overflow-hidden"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          ■ 오늘의 운세
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {open ? "접기" : "펼치기"}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "var(--px-border)" }}>
          {loading && <p className="ui-hint pt-2">운세를 준비하는 중…</p>}
          {!loading &&
            sections.map((s) => (
              <div key={s.id} className="pt-2 space-y-0.5">
                <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
                  {s.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--px-text)" }}>
                  {s.lines[0]}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
                  {s.lines[1]}
                </p>
              </div>
            ))}
          {shouldShowOpenAiStatus() && openAi && (
            <p className="text-[10px] pt-1" style={{ color: "var(--px-text2)" }}>
              {formatOpenAiStatus(openAi)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
