"use client";

import { useMemo } from "react";
import type { Element } from "@/lib/saju/constants";
import { ELEMENT_LABELS } from "@/lib/saju/constants";
import {
  calculateElementDistribution,
  ELEMENT_EN_TO_KO,
  type ElementDistributionViewMode,
} from "@/lib/saju/elementDistribution";
import type { PartialDiaryPillars } from "@/lib/diary/dayPillar";
import type { CurrentDaeunPillar } from "@/lib/diary/currentDaeun";
import type { PillarVisibility } from "@/lib/diary/sajuSettings";
import type { UserBirthPillars } from "@/lib/diary/types";

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
  birthPillars: UserBirthPillars | null;
  currentDaeun: CurrentDaeunPillar | null;
  pillarVisibility: PillarVisibility;
  viewMode: ElementDistributionViewMode;
};

/** 상세=원국+선택 운, 간단=선택 운끼리의 오행 분포율 */
export default function ElementDistributionBars({
  diaryPillars,
  birthPillars,
  currentDaeun,
  pillarVisibility,
  viewMode,
}: Props) {
  const elemPct = useMemo(() => {
    let stems = "";
    let branches = "";

    if (birthPillars) {
      const nativeOrder = [
        birthPillars.hour,
        birthPillars.day,
        birthPillars.month,
        birthPillars.year,
      ] as const;
      for (const pillar of nativeOrder) {
        if (!pillar) continue;
        stems += pillar.stemKo;
        branches += pillar.branchKo;
      }
    } else {
      // luck_only도 기존 API의 원국 인자를 받지만 최종 분포에는 섞지 않는다.
      const fallbackOrder = [
        diaryPillars.dayPillar,
        diaryPillars.monthPillar,
        diaryPillars.yearPillar,
      ] as const;
      for (const pillar of fallbackOrder) {
        if (!pillar) continue;
        stems += pillar.stem.ko;
        branches += pillar.branch.ko;
      }
    }

    const empty: Record<Element, number> = {
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    };
    if (stems.length === 0 || (viewMode === "diary_detail" && !birthPillars)) {
      return empty;
    }

    const result = calculateElementDistribution({
      stems,
      branches,
      viewMode,
      daewoon:
        pillarVisibility.daeun && currentDaeun
          ? { stem: currentDaeun.stemHanja, branch: currentDaeun.branchHanja }
          : null,
      yearly:
        pillarVisibility.diary.year && diaryPillars.yearPillar
          ? {
              stem: diaryPillars.yearPillar.stem.ko,
              branch: diaryPillars.yearPillar.branch.ko,
            }
          : null,
      monthly:
        pillarVisibility.diary.month && diaryPillars.monthPillar
          ? {
              stem: diaryPillars.monthPillar.stem.ko,
              branch: diaryPillars.monthPillar.branch.ko,
            }
          : null,
      daily:
        pillarVisibility.diary.day && diaryPillars.dayPillar
          ? {
              stem: diaryPillars.dayPillar.stem.ko,
              branch: diaryPillars.dayPillar.branch.ko,
            }
          : null,
    });
    for (const elem of Object.keys(empty) as Element[]) {
      empty[elem] = result.percentage[ELEMENT_EN_TO_KO[elem]];
    }
    return empty;
  }, [
    birthPillars,
    currentDaeun,
    diaryPillars.dayPillar,
    diaryPillars.monthPillar,
    diaryPillars.yearPillar,
    pillarVisibility,
    viewMode,
  ]);

  if (!diaryPillars.dayPillar && !diaryPillars.monthPillar && !diaryPillars.yearPillar) {
    return null;
  }

  return (
    <div
      className="p-3 border-2 space-y-1.5"
      style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      aria-label="오행 분포율"
    >
      <div className="flex items-center gap-2 mb-1">
        <p className="ui-section-title">오행 분포</p>
        <span
          className="px-2 py-1 border text-xs font-black whitespace-nowrap"
          style={{
            color: viewMode === "simple" ? "#60a5fa" : "var(--px-accent)",
            borderColor: viewMode === "simple" ? "#60a5fa" : "var(--px-accent)",
            background:
              viewMode === "simple"
                ? "color-mix(in srgb, #60a5fa 12%, var(--px-bg2))"
                : "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg2))",
          }}
        >
          {viewMode === "simple" ? "운 기준" : "운 + 원국 기준"}
        </span>
      </div>
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
