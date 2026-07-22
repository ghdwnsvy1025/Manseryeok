"use client";

import { useEffect, useState } from "react";
import type { ExpertInsightSection } from "@/lib/saju/interpretation";
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

  useEffect(() => {
    setDisplay(sections);
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
      </div>

      {display.map((section) => (
        <article
          key={section.id}
          className="p-3 border"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        >
          <h4 className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
            {section.title}
          </h4>
          <p className="text-xs mt-2" style={{ color: "var(--px-text)" }}>
            {section.summary}
          </p>
        </article>
      ))}
    </section>
  );
}
