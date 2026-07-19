"use client";

import { useState } from "react";
import type { BeginnerTodayFlow } from "@/lib/saju/interpretation";

type Props = {
  flow: BeginnerTodayFlow;
  compact?: boolean;
};

export default function BeginnerTodayFlowCards({ flow, compact }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cards = compact ? flow.cards.slice(0, 4) : flow.cards;

  return (
    <div className="space-y-3">
      <div
        className="p-3 border-2"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
      >
        <p className="ui-section-title">오늘의 한 문장</p>
        <p className="text-sm font-bold mt-1" style={{ color: "var(--px-text-on-panel)" }}>
          {flow.headline}
        </p>
        <p className="ui-hint mt-2">{flow.disclaimer}</p>
        <p className="ui-hint mt-1">
          {flow.analysisKind === "basic_saju"
            ? "사주와 오늘의 간지를 바탕으로 본 기본 흐름입니다."
            : flow.analysisKind === "record_based"
              ? "내 과거 기록에서는 비슷한 날에 이런 경향이 나타났어요."
              : "기본 사주 분석과 내 기록 기반 분석을 함께 보여드려요."}
        </p>
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
