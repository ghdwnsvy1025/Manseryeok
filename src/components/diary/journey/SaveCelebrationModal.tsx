"use client";

import Link from "next/link";
import type { SaveCelebration } from "@/lib/diary/saveCelebration";
import { getNextSameGanjiDate } from "@/lib/diary/nextGanjiDay";

type Props = {
  celebration: SaveCelebration;
  ganjiIndex: number;
  currentDate: string;
  onClose: () => void;
};

function celebrationMessage(celebration: SaveCelebration): { title: string; body: string } {
  switch (celebration.type) {
    case "first_ever":
      return {
        title: "첫 기록 완료!",
        body: `오늘 ${celebration.ganjiKo}일에 첫 발자국을 남겼어요. 기록이 쌓일수록 간지별 패턴이 선명해져요.`,
      };
    case "new_ganji":
      return {
        title: `새 간지 발견! ${celebration.ganjiKo}일`,
        body: `도감 ${celebration.totalCollected}/60 수집. 같은 ${celebration.ganjiKo}일이 다시 오면 비교할 수 있어요.`,
      };
    case "new_stem":
      return {
        title: `새 천간 발견! ${celebration.stemKo}`,
        body: `${celebration.ganjiKo}일 기록으로 천간 도감이 늘었어요.`,
      };
    case "new_branch":
      return {
        title: `새 지지 발견! ${celebration.branchKo}`,
        body: `${celebration.ganjiKo}일 기록으로 지지 도감이 늘었어요.`,
      };
    case "ganji_repeat":
      return {
        title: `${celebration.ganjiKo}일 ${celebration.count}번째 기록`,
        body: "같은 간지 날이 쌓이면 통계에서 패턴을 볼 수 있어요.",
      };
  }
}

export default function SaveCelebrationModal({
  celebration,
  ganjiIndex,
  currentDate,
  onClose,
}: Props) {
  const { title, body } = celebrationMessage(celebration);
  const next = getNextSameGanjiDate(currentDate, ganjiIndex);
  const wellbeing =
    "wellbeing" in celebration && celebration.wellbeing !== null
      ? celebration.wellbeing
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm p-4 border-2 space-y-3"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-base font-black" style={{ color: "var(--px-accent)" }}>
          {title}
        </p>
        <p className="ui-guide leading-relaxed">{body}</p>
        {wellbeing !== null && (
          <p className="text-lg font-black" style={{ color: "#4ade80" }}>
            행복도 {wellbeing}점
          </p>
        )}
        {next && (
          <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            다음 {next.ganjiKo}일까지 D-{next.daysUntil}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Link
            href="/diary/collection"
            className="flex-1 text-center py-2 text-xs font-bold border-2"
            style={{
              borderColor: "var(--px-accent)",
              color: "var(--px-accent)",
              background: "var(--px-bg3)",
            }}
            onClick={onClose}
          >
            도감 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-bold border-2 ui-primary-btn"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
