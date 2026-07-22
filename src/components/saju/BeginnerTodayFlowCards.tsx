"use client";

import { useEffect, useState } from "react";
import type { BeginnerTodayFlow } from "@/lib/saju/interpretation";
import { requestGroundedWording } from "@/lib/narrative/requestGroundedWording";

type GroundingFacts = {
  ganjiKo?: string;
  heavenlyStem?: string;
  earthlyBranch?: string;
  tenGod?: string | null;
  relationLabels?: string[];
};

type Props = {
  flow: BeginnerTodayFlow;
  compact?: boolean;
  /** 있으면 학습 이론 기반 문장 보강 시도 (실패 시 로컬 유지) */
  groundingFacts?: GroundingFacts;
};

type CardTone = {
  accent: string;
  soft: string;
  mark: string;
};

const CARD_TONES: Record<string, CardTone> = {
  emotion: {
    accent: "var(--signal-emotion)",
    soft: "color-mix(in srgb, var(--signal-emotion) 14%, var(--px-bg3))",
    mark: "情",
  },
  energy: {
    accent: "var(--signal-energy)",
    soft: "color-mix(in srgb, var(--signal-energy) 14%, var(--px-bg3))",
    mark: "動",
  },
  relation: {
    accent: "#fb923c",
    soft: "color-mix(in srgb, #fb923c 14%, var(--px-bg3))",
    mark: "緣",
  },
  focus: {
    accent: "var(--signal-focus)",
    soft: "color-mix(in srgb, var(--signal-focus) 14%, var(--px-bg3))",
    mark: "專",
  },
  condition: {
    accent: "var(--signal-condition)",
    soft: "color-mix(in srgb, var(--signal-condition) 14%, var(--px-bg3))",
    mark: "體",
  },
  record: {
    accent: "var(--signal-saju)",
    soft: "color-mix(in srgb, var(--signal-saju) 14%, var(--px-bg3))",
    mark: "記",
  },
};

const FALLBACK_TONE: CardTone = {
  accent: "var(--px-accent)",
  soft: "var(--px-bg3)",
  mark: "流",
};

export default function BeginnerTodayFlowCards({
  flow,
  compact,
  groundingFacts,
}: Props) {
  const [display, setDisplay] = useState(flow);

  useEffect(() => {
    setDisplay(flow);
    if (!groundingFacts) return;

    let cancelled = false;
    const key = [
      flow.headline,
      ...flow.cards.map((c) => `${c.id}:${c.status}`),
      groundingFacts.ganjiKo,
      groundingFacts.tenGod,
      groundingFacts.heavenlyStem,
      groundingFacts.earthlyBranch,
      ...(groundingFacts.relationLabels ?? []),
    ].join("|");

    void (async () => {
      const result = await requestGroundedWording({
        surface: "today_beginner",
        facts: {
          ganjiKo: groundingFacts.ganjiKo,
          heavenlyStem: groundingFacts.heavenlyStem,
          earthlyBranch: groundingFacts.earthlyBranch,
          tenGod: groundingFacts.tenGod,
          relationLabels: groundingFacts.relationLabels,
          languageLevel: "beginner",
          localDraft: {
            headline: flow.headline,
            ...Object.fromEntries(flow.cards.map((c) => [c.id, c.status])),
          },
          sectionDrafts: flow.cards.map((c) => ({
            id: c.id,
            title: c.title,
            summary: c.status,
          })),
        },
      });
      if (cancelled || !result) return;
      void key;
      setDisplay({
        ...flow,
        headline: result.wording.headline ?? flow.headline,
        cards: flow.cards.map((card) => ({
          ...card,
          status: result.wording[card.id] ?? card.status,
        })),
        analysisKind:
          result.usedRag && flow.analysisKind === "basic_saju"
            ? "mixed"
            : flow.analysisKind,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [flow, groundingFacts]);

  const cards = compact ? display.cards.slice(0, 4) : display.cards;
  const lead = cards[0];
  const rest = cards.slice(1);

  return (
    <div className="space-y-3">
      <div
        className="p-4 border-2 space-y-2"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "3px 3px 0 #000",
        }}
      >
        <p
          className="text-[11px] font-black tracking-wide"
          style={{ color: "var(--px-accent)" }}
        >
          ■ 오늘의 한 문장
        </p>
        <p
          className="text-base font-black leading-snug"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {display.headline}
        </p>
        {display.disclaimer && (
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
            {display.disclaimer}
          </p>
        )}
      </div>

      {lead && (
        <FlowCard
          id={lead.id}
          title={lead.title}
          status={lead.status}
          observation={lead.observationQuestion}
          featured
        />
      )}

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {rest.map((card) => (
            <FlowCard
              key={card.id}
              id={card.id}
              title={card.title}
              status={card.status}
              observation={card.observationQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({
  id,
  title,
  status,
  observation,
  featured = false,
}: {
  id: string;
  title: string;
  status: string;
  observation?: string;
  featured?: boolean;
}) {
  const tone = CARD_TONES[id] ?? FALLBACK_TONE;

  return (
    <article
      className={`border-2 flex flex-col ${featured ? "p-4 gap-2.5" : "p-3 gap-2 min-h-[7.5rem]"}`}
      style={{
        background: tone.soft,
        borderColor: tone.accent,
        boxShadow: featured ? `4px 4px 0 color-mix(in srgb, ${tone.accent} 55%, #000)` : "2px 2px 0 #000",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 flex items-center justify-center font-black pixel-font"
          style={{
            width: featured ? 28 : 22,
            height: featured ? 28 : 22,
            fontSize: featured ? 11 : 9,
            color: "#0a0a12",
            background: tone.accent,
            border: "2px solid #000",
          }}
          aria-hidden
        >
          {tone.mark}
        </span>
        <p
          className={`font-black leading-none ${featured ? "text-sm" : "text-[11px]"}`}
          style={{ color: tone.accent }}
        >
          {title}
        </p>
      </div>

      <p
        className={`font-black leading-snug ${featured ? "text-lg" : "text-sm"}`}
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {status}
      </p>

      {observation && (
        <p
          className={`leading-relaxed ${featured ? "text-xs" : "text-[10px]"}`}
          style={{ color: "var(--px-text2)" }}
        >
          {observation}
        </p>
      )}
    </article>
  );
}
