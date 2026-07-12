"use client";

import { STEM_META, BRANCH_META, STEMS, BRANCHES } from "@/lib/saju/constants";
import type { Element } from "@/lib/saju/constants";
import type { GroupStats } from "@/lib/diary/types";
import WellbeingTile from "./WellbeingTile";

type Props = {
  type: "stem" | "branch";
  groups: GroupStats[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

function getElementForKey(key: string, type: "stem" | "branch"): Element | undefined {
  if (type === "stem") {
    const hanja = STEMS.find((s) => STEM_META[s]?.ko === key);
    return hanja ? STEM_META[hanja].element : undefined;
  }
  const hanja = BRANCHES.find((b) => BRANCH_META[b]?.ko === key);
  return hanja ? BRANCH_META[hanja].element : undefined;
}

function getOrderedKeys(type: "stem" | "branch"): string[] {
  if (type === "stem") {
    return STEMS.map((s) => STEM_META[s].ko);
  }
  return BRANCHES.map((b) => BRANCH_META[b].ko);
}

export default function StemBranchHeatmap({ type, groups, selectedKey, onSelect }: Props) {
  const groupMap = new Map(groups.map((g) => [g.key, g]));
  const keys = getOrderedKeys(type);
  const cols = type === "stem" ? "grid-cols-5" : "grid-cols-4";

  return (
    <div className={`grid gap-1.5 ${cols}`}>
      {keys.map((key) => {
        const stats = groupMap.get(key);
        const element = getElementForKey(key, type);
        return (
          <WellbeingTile
            key={key}
            label={key}
            wellbeing={stats?.avgDailyWellbeing ?? 0}
            entryCount={stats?.entryCount ?? 0}
            deltaFromOverall={stats?.deltaFromOverall}
            selected={selectedKey === key}
            onClick={() => stats && onSelect(key)}
            element={element}
            compact
          />
        );
      })}
    </div>
  );
}
