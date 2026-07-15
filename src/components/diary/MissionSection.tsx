"use client";

import { useMemo } from "react";
import QuestProgressBar from "@/components/diary/journey/QuestProgressBar";
import { getSeason1Quests, getStreakDays } from "@/lib/diary/quests";
import type { DiaryEntry } from "@/lib/diary/types";

type Props = {
  entries: DiaryEntry[];
};

export default function MissionSection({ entries }: Props) {
  const season = useMemo(() => getSeason1Quests(entries), [entries]);
  const streakDays = useMemo(() => getStreakDays(entries), [entries]);

  return (
    <section className="space-y-2" aria-label="미션">
      <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
        ■ 미션
      </h2>
      {season.allComplete ? (
        <div
          className="p-3 border-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
        >
          <p className="ui-guide">이번 주 여정을 모두 완료했어요.</p>
        </div>
      ) : (
        <QuestProgressBar season={season} streakDays={streakDays} />
      )}
    </section>
  );
}
