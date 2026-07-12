"use client";

import { BRANCH_META, STEM_META } from "@/lib/saju/constants";
import type { Element } from "@/lib/saju/constants";
import type { PartialDiaryPillars } from "@/lib/diary/dayPillar";
import type { PillarVisibility } from "@/lib/diary/sajuSettings";
import type { DiaryDayPillar, DiaryPillar, UserBirthPillars } from "@/lib/diary/types";

const ELEM: Record<Element, { text: string }> = {
  wood: { text: "#4ade80" },
  fire: { text: "#f87171" },
  earth: { text: "#fbbf24" },
  metal: { text: "#cbd5e1" },
  water: { text: "#60a5fa" },
};

function getStemColor(hanja: string): string {
  const el = STEM_META[hanja]?.element;
  return el ? ELEM[el].text : "var(--px-accent)";
}

function getBranchColor(hanja: string): string {
  const el = BRANCH_META[hanja]?.element;
  return el ? ELEM[el].text : "var(--px-accent)";
}

type PillarDisplay = {
  label: string;
  hint?: string;
  /** compact 등에서 표시용 라벨 (예: 내 일주, 오늘의 일주) */
  displayLabel?: string;
  stemHanja: string;
  branchHanja: string;
  ganjiKo: string;
};

const GROUP_BORDER: Record<"birth" | "diary", string> = {
  birth: "var(--px-accent)",
  diary: "#60a5fa",
};

const GROUP_LABEL_COLOR: Record<"birth" | "diary", string> = {
  birth: "var(--px-accent)",
  diary: "#60a5fa",
};

type BoardColumn = {
  id: string;
  group: "birth" | "diary";
  pillar: PillarDisplay;
  visible: boolean;
};

function toDisplayFromBirth(
  label: string,
  detail: { stemHanja: string; branchHanja: string; ganjiKo: string }
): PillarDisplay {
  return {
    label,
    stemHanja: detail.stemHanja,
    branchHanja: detail.branchHanja,
    ganjiKo: detail.ganjiKo,
  };
}

function toDisplayFromDiary(
  label: string,
  pillar: DiaryPillar | DiaryDayPillar
): PillarDisplay {
  return {
    label,
    hint: "오늘",
    stemHanja: pillar.stem.hanja,
    branchHanja: pillar.branch.hanja,
    ganjiKo: pillar.ganjiKo,
  };
}

function getSizeStyles(totalColumns: number, compact: boolean): string {
  if (compact && totalColumns === 3) return "1.65rem";
  if (compact && totalColumns <= 2) return "2.25rem";
  if (totalColumns <= 4) return "1.75rem";
  if (totalColumns === 5) return "1.5rem";
  if (totalColumns === 6) return "1.3rem";
  return "1.15rem";
}

function getLabelText(pillar: PillarDisplay): string {
  if (pillar.displayLabel) return pillar.displayLabel;
  if (pillar.hint) return `${pillar.hint} ${pillar.label}`;
  return `내 ${pillar.label}`;
}

type Props = {
  birthPillars: UserBirthPillars | null;
  diaryPillars: PartialDiaryPillars;
  pillarVisibility: PillarVisibility;
  /** true면 세운·월운·일운(년·월·일) 3기둥 표시 */
  compact?: boolean;
  dateDisplay?: { full: string; short: string; weekday: string } | null;
};

function buildColumns(
  birthPillars: UserBirthPillars | null,
  diaryPillars: PartialDiaryPillars,
  pillarVisibility: PillarVisibility,
  compact: boolean
): BoardColumn[] {
  if (compact) {
    const columns: BoardColumn[] = [];
    if (diaryPillars.yearPillar) {
      columns.push({
        id: "fortune-year",
        group: "diary",
        pillar: {
          ...toDisplayFromDiary("년주", diaryPillars.yearPillar),
          displayLabel: "년",
        },
        visible: true,
      });
    }
    if (diaryPillars.monthPillar) {
      columns.push({
        id: "fortune-month",
        group: "diary",
        pillar: {
          ...toDisplayFromDiary("월주", diaryPillars.monthPillar),
          displayLabel: "월",
        },
        visible: true,
      });
    }
    if (diaryPillars.dayPillar) {
      columns.push({
        id: "fortune-day",
        group: "diary",
        pillar: {
          ...toDisplayFromDiary("일주", diaryPillars.dayPillar),
          displayLabel: "일",
        },
        visible: true,
      });
    }
    return columns;
  }

  const columns: BoardColumn[] = [];

  if (birthPillars) {
    if (birthPillars.hour) {
      columns.push({
        id: "birth-hour",
        group: "birth",
        pillar: toDisplayFromBirth("시주", birthPillars.hour),
        visible: pillarVisibility.birth.hour,
      });
    }
    columns.push(
      {
        id: "birth-day",
        group: "birth",
        pillar: toDisplayFromBirth("일주", birthPillars.day),
        visible: pillarVisibility.birth.day,
      },
      {
        id: "birth-month",
        group: "birth",
        pillar: toDisplayFromBirth("월주", birthPillars.month),
        visible: pillarVisibility.birth.month,
      },
      {
        id: "birth-year",
        group: "birth",
        pillar: toDisplayFromBirth("년주", birthPillars.year),
        visible: pillarVisibility.birth.year,
      }
    );
  }

  if (diaryPillars.yearPillar) {
    columns.push({
      id: "diary-year",
      group: "diary",
      pillar: toDisplayFromDiary("년주", diaryPillars.yearPillar),
      visible: pillarVisibility.diary.year,
    });
  }
  if (diaryPillars.monthPillar) {
    columns.push({
      id: "diary-month",
      group: "diary",
      pillar: toDisplayFromDiary("월주", diaryPillars.monthPillar),
      visible: pillarVisibility.diary.month,
    });
  }
  if (diaryPillars.dayPillar) {
    columns.push({
      id: "diary-day",
      group: "diary",
      pillar: toDisplayFromDiary("일주", diaryPillars.dayPillar),
      visible: pillarVisibility.diary.day,
    });
  }

  return columns;
}

function PillarColumn({
  pillar,
  totalColumns,
  group,
  compact = false,
}: {
  pillar: PillarDisplay;
  totalColumns: number;
  group: "birth" | "diary";
  compact?: boolean;
}) {
  const stemColor = getStemColor(pillar.stemHanja);
  const branchColor = getBranchColor(pillar.branchHanja);
  const hanjaSize = getSizeStyles(totalColumns, compact);
  const borderColor = GROUP_BORDER[group];
  const labelColor = GROUP_LABEL_COLOR[group];
  const labelSize = compact ? "14px" : "11px";
  const ganjiSize = compact ? "13px" : "10px";

  return (
    <div
      className="manseryeok-pillar-inner flex flex-col items-center border-2 w-full"
      style={{
        background: "var(--px-bg2)",
        borderColor,
        boxShadow: `2px 2px 0 ${group === "birth" ? "#4a3a00" : "#1e3a5f"}`,
        padding: 0,
      }}
      title={`${getLabelText(pillar)} ${pillar.ganjiKo}`}
    >
      <div
        className="flex items-center justify-center w-full border-b"
        style={{
          borderColor: "var(--px-border)",
          borderStyle: "dashed",
          padding: "4px 0 2px",
        }}
      >
        <span
          className="pillar-hanja font-black leading-none"
          style={{ fontSize: hanjaSize, color: stemColor, textShadow: `0 0 10px ${stemColor}88` }}
        >
          {pillar.stemHanja}
        </span>
      </div>
      <div
        className="flex items-center justify-center w-full"
        style={{ padding: "2px 0 2px" }}
      >
        <span
          className="pillar-hanja pillar-hanja-branch font-black leading-none"
          style={{ fontSize: hanjaSize, color: branchColor, textShadow: `0 0 10px ${branchColor}88` }}
        >
          {pillar.branchHanja}
        </span>
      </div>
      <div
        className="w-full text-center border-t"
        style={{ borderColor: borderColor, padding: compact ? "6px 4px" : "4px 2px" }}
      >
        <p className="font-black leading-tight" style={{ fontSize: labelSize, color: labelColor }}>
          {getLabelText(pillar)}
        </p>
        <p className="font-bold leading-tight mt-0.5" style={{ fontSize: ganjiSize, color: "var(--px-text-on-panel)" }}>
          {pillar.ganjiKo}
        </p>
      </div>
    </div>
  );
}

function AnimatedPillarSlot({
  column,
  totalColumns,
  staggerIndex,
  compact = false,
}: {
  column: BoardColumn;
  totalColumns: number;
  staggerIndex: number;
  compact?: boolean;
}) {
  return (
    <div
      className="manseryeok-pillar-slot"
      data-visible={column.visible ? "true" : "false"}
      style={{ "--pillar-stagger": `${staggerIndex * 30}ms` } as React.CSSProperties}
    >
      <PillarColumn
        pillar={column.pillar}
        totalColumns={totalColumns}
        group={column.group}
        compact={compact}
      />
    </div>
  );
}

export default function ManseryeokBoard({
  birthPillars,
  diaryPillars,
  pillarVisibility,
  compact = false,
  dateDisplay,
}: Props) {
  const columns = buildColumns(
    birthPillars,
    diaryPillars,
    pillarVisibility,
    compact
  );

  if (columns.length === 0) return null;

  const visibleColumns = columns.filter((col) => col.visible);
  const visibleCount = visibleColumns.length;

  const birthHasVisible = visibleColumns.some((col) => col.group === "birth");
  const diaryHasVisible = visibleColumns.some((col) => col.group === "diary");
  const showDivider = !compact && birthHasVisible && diaryHasVisible;

  const birthColumns = compact ? [] : columns.filter((col) => col.group === "birth");
  const diaryColumns = compact
    ? visibleColumns
    : columns.filter((col) => col.group === "diary");

  let staggerCounter = 0;

  if (visibleCount === 0) {
    return (
      <p className="ui-guide">
        표시할 간지를 선택해주세요. (날짜 아래 눈 아이콘 터치)
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {compact && dateDisplay && (
        <div
          className="text-center p-3 border-2"
          style={{
            borderColor: "#60a5fa",
            background: "color-mix(in srgb, #60a5fa 10%, var(--px-bg2))",
            boxShadow: "2px 2px 0 #1e3a5f",
          }}
        >
          <p className="text-lg font-black leading-snug" style={{ color: "var(--px-text-on-panel)" }}>
            {dateDisplay.full}
          </p>
          {diaryPillars.dayPillar && (
            <p className="mt-1.5 leading-snug">
              <span className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
                오늘의 기운 ·{" "}
              </span>
              <span className="text-lg font-black" style={{ color: "#60a5fa" }}>
                {diaryPillars.dayPillar.ganjiKo}일
              </span>
            </p>
          )}
        </div>
      )}
      <div className="flex gap-1 items-stretch min-w-0">
        {birthColumns.map((col) => {
          const staggerIndex = col.visible ? staggerCounter++ : staggerCounter;
          return (
            <AnimatedPillarSlot
              key={col.id}
              column={col}
              totalColumns={visibleCount}
              staggerIndex={staggerIndex}
              compact={compact}
            />
          );
        })}
        {showDivider && (
          <div
            className="manseryeok-divider flex items-center shrink-0 px-0.5 text-xs font-bold self-stretch"
            data-visible="true"
            style={{ color: "var(--px-border)" }}
          >
            |
          </div>
        )}
        {diaryColumns.map((col) => {
          const staggerIndex = col.visible ? staggerCounter++ : staggerCounter;
          return (
            <AnimatedPillarSlot
              key={col.id}
              column={col}
              totalColumns={visibleCount}
              staggerIndex={staggerIndex}
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
}
