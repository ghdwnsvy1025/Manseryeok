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

export default function BeginnerTodayFlowCards({
  flow,
  compact,
  groundingFacts,
}: Props) {
  const [display, setDisplay] = useState(flow);
  const [ragNote, setRagNote] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(flow);
    setRagNote(null);
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
      // stale guard
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
      if (result.usedRag) {
        setRagNote(`등록된 사주 이론 ${result.chunkCount}조각을 참고해 문장을 다듬었어요.`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [flow, groundingFacts]);

  const [openId, setOpenId] = useState<string | null>(null);
  const cards = compact ? display.cards.slice(0, 4) : display.cards;

  return (
    <div className="space-y-3">
      <div
        className="p-3 border-2"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
      >
        <p className="ui-section-title">오늘의 한 문장</p>
        <p className="text-sm font-bold mt-1" style={{ color: "var(--px-text-on-panel)" }}>
          {display.headline}
        </p>
        <p className="ui-hint mt-2">{display.disclaimer}</p>
        <p className="ui-hint mt-1">
          {display.analysisKind === "basic_saju"
            ? "사주와 오늘의 간지를 바탕으로 본 기본 흐름입니다."
            : display.analysisKind === "record_based"
              ? "내 과거 기록에서는 비슷한 날에 이런 경향이 나타났어요."
              : "기본 사주 분석과 내 기록 기반 분석을 함께 보여드려요."}
        </p>
        {ragNote && <p className="ui-hint mt-1">{ragNote}</p>}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {cards.map((card) => {
          const open = openId === card.id;
          return (
            <div
              key={card.id}
              className="p-3 border-2"
              style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
            >
              <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                {card.title}
              </p>
              <p className="text-sm font-black mt-1" style={{ color: "var(--px-accent)" }}>
                {card.status}
              </p>
              {card.observationQuestion && (
                <p className="ui-hint mt-1">관찰: {card.observationQuestion}</p>
              )}
              <button
                type="button"
                className="mt-2 text-xs font-bold underline"
                style={{ color: "#60a5fa" }}
                onClick={() => setOpenId(open ? null : card.id)}
                aria-expanded={open}
              >
                왜 이런 결과가 나왔나요?
              </button>
              {open && (
                <ul className="mt-2 space-y-1">
                  {card.evidence.map((line) => (
                    <li key={line} className="text-[11px]" style={{ color: "var(--px-text2)" }}>
                      · {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
