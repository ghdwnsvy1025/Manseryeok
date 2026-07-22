"use client";

import { useEffect, useState } from "react";
import type { ExpertInsightSection } from "@/lib/saju/interpretation";
import { getSampleLevel, SAMPLE_LEVEL_LABELS } from "@/lib/diary/types";
import { requestGroundedWording } from "@/lib/narrative/requestGroundedWording";

type GroundingFacts = {
  ganjiKo?: string;
  heavenlyStem?: string;
  earthlyBranch?: string;
  tenGod?: string | null;
  relationLabels?: string[];
  surface?: "saju_expert" | "today_expert";
};

type Props = {
  sections: ExpertInsightSection[];
  groundingFacts?: GroundingFacts;
};

export default function ExpertInsightPanel({ sections, groundingFacts }: Props) {
  const [display, setDisplay] = useState(sections);
  const [ragNote, setRagNote] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(sections);
    setRagNote(null);
    if (!groundingFacts || sections.length === 0) return;

    let cancelled = false;
    void (async () => {
      const result = await requestGroundedWording({
        surface: groundingFacts.surface ?? "today_expert",
        facts: {
          ganjiKo: groundingFacts.ganjiKo,
          heavenlyStem: groundingFacts.heavenlyStem,
          earthlyBranch: groundingFacts.earthlyBranch,
          tenGod: groundingFacts.tenGod,
          relationLabels: groundingFacts.relationLabels,
          languageLevel: "expert",
          localDraft: Object.fromEntries(sections.map((s) => [s.id, s.summary])),
          sectionDrafts: sections.map((s) => ({
            id: s.id,
            title: s.title,
            summary: s.summary,
          })),
        },
      });
      if (cancelled || !result) return;
      setDisplay(
        sections.map((section) => ({
          ...section,
          summary: result.wording[section.id] ?? section.summary,
        }))
      );
      if (result.usedRag) {
        setRagNote(
          `등록된 사주 이론 ${result.chunkCount}조각을 참고해 해설 문장을 다듬었어요.`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sections, groundingFacts]);

  if (display.length === 0) return null;

  return (
    <section
      className="mt-4 space-y-3 p-3 border-2"
      style={{ background: "var(--px-bg2)", borderColor: "var(--px-border2)" }}
      aria-label="해석 및 참고 의견"
    >
      <div>
        <h3 className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          ■ 해석 및 참고 의견
        </h3>
        <p className="ui-hint mt-1">
          아래 내용은 현재 만세력 정보와 사용자의 과거 기록을 바탕으로 제공하는 참고 해석입니다.
          미래의 사건이나 결과를 확정하지 않습니다. 기존 만세력 계산 결과는 변경되지 않습니다.
        </p>
        {ragNote && <p className="ui-hint mt-1">{ragNote}</p>}
      </div>

      {display.map((section) => (
        <article
          key={section.id}
          className="p-3 border"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
              {section.title}
            </h4>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 border"
              style={{
                borderColor: "var(--px-border)",
                color: section.recordBased ? "var(--px-accent)" : "var(--px-text2)",
              }}
            >
              {section.recordBased ? "기록 기반" : "기본 사주"}
            </span>
            {typeof section.sampleSize === "number" && (
              <span className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                n={section.sampleSize} · {SAMPLE_LEVEL_LABELS[getSampleLevel(section.sampleSize)]}
              </span>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--px-text)" }}>
            {section.summary}
          </p>
          <ul className="mt-2 space-y-1">
            {section.evidence.map((line) => (
              <li key={line} className="text-[11px]" style={{ color: "var(--px-text2)" }}>
                · {line}
              </li>
            ))}
          </ul>
          {section.caution && (
            <p className="ui-hint mt-2" style={{ color: "#fbbf24" }}>
              {section.caution}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
