"use client";

import { useMemo } from "react";
import type { Element } from "@/lib/saju/constants";
import { ELEMENT_LABELS } from "@/lib/saju/constants";
import {
  calculateElementDistribution,
  ELEMENT_EN_TO_KO,
} from "@/lib/saju/elementDistribution";
import type { PartialDiaryPillars } from "@/lib/diary/dayPillar";

const ELEM: Record<Element, { text: string }> = {
  wood: { text: "#4ade80" },
  fire: { text: "#f87171" },
  earth: { text: "#fbbf24" },
  metal: { text: "#cbd5e1" },
  water: { text: "#60a5fa" },
};

const ELEM_KO: Record<Element, string> = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

type Props = {
  diaryPillars: PartialDiaryPillars;
};

/** 내 사주와 동일: 시→일→월→년 순 천간·지지로 오행 분포율 계산 */
export default function ElementDistributionBars({ diaryPillars }: Props) {
  const elemPct = useMemo(() => {
    // calculateElementDistribution 입력 순서: 시간 → 일 → 월 → 년 (시주 없으면 일부터)
    let stems = "";
    let branches = "";
    const order = [
      diaryPillars.dayPillar,
      diaryPillars.monthPillar,
      diaryPillars.yearPillar,
    ] as const;

    for (const pillar of order) {
      if (!pillar) continue;
      stems += pillar.stem.ko;
      branches += pillar.branch.ko;
    }

    const empty: Record<Element, number> = {
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    };
    if (stems.length === 0) return empty;

    const result = calculateElementDistribution(stems, branches);
    for (const elem of Object.keys(empty) as Element[]) {
      empty[elem] = result.percentage[ELEMENT_EN_TO_KO[elem]];
    }
    return empty;
  }, [diaryPillars.dayPillar, diaryPillars.monthPillar, diaryPillars.yearPillar]);

  if (!diaryPillars.dayPillar && !diaryPillars.monthPillar && !diaryPillars.yearPillar) {
    return null;
  }

  return (
    <div
      className="p-3 border-2 space-y-1.5"
      style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      aria-label="오행 분포율"
    >
      <p className="ui-section-title mb-1">오행 분포</p>
      {(Object.entries(elemPct) as [Element, number][]).map(([elem, pct]) => {
        const c = ELEM[elem];
        return (
          <div key={elem} className="flex items-center gap-2">
            <span className="text-xs font-black w-6 text-center" style={{ color: c.text }}>
              {ELEMENT_LABELS[elem]}
            </span>
            <span className="text-xs w-8" style={{ color: "var(--px-text2)" }}>
              {ELEM_KO[elem]}
            </span>
            <div
              className="flex-1 h-4 border"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: c.text,
                  boxShadow: `0 0 6px ${c.text}88`,
                }}
              />
            </div>
            <span className="text-xs font-bold w-12 text-right" style={{ color: c.text }}>
              {pct.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
