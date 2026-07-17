"use client";

import { useState } from "react";
import { BRANCH_META, STEM_META } from "@/lib/saju/constants";
import type { Element } from "@/lib/saju/constants";
import type { PartialDiaryPillars } from "@/lib/diary/dayPillar";
import type { CurrentDaeunPillar } from "@/lib/diary/currentDaeun";
import { getPillarTenGods } from "@/lib/diary/currentDaeun";
import type { DiaryPillarSlot, PillarVisibility } from "@/lib/diary/sajuSettings";
import type { DiaryDayPillar, DiaryPillar, UserBirthPillars } from "@/lib/diary/types";
import PillarVisibilityToggle from "@/components/diary/PillarVisibilityToggle";

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
  displayLabel?: string;
  stemHanja: string;
  branchHanja: string;
  ganjiKo: string;
  stemTenGod?: string;
  branchTenGod?: string;
};

type ColumnGroup = "birth" | "diary" | "daeun";

const GROUP_BORDER: Record<ColumnGroup, string> = {
  birth: "var(--px-accent)",
  diary: "#60a5fa",
  daeun: "var(--px-accent)",
};

const GROUP_LABEL_COLOR: Record<ColumnGroup, string> = {
  birth: "var(--px-accent)",
  diary: "#60a5fa",
  daeun: "var(--px-accent)",
};

type BoardColumn = {
  id: string;
  group: ColumnGroup;
  pillar: PillarDisplay;
  visible: boolean;
  toggleSlot?: "daeun" | DiaryPillarSlot;
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

function withTenGods(
  display: PillarDisplay,
  dayStemHanja: string | null | undefined
): PillarDisplay {
  if (!dayStemHanja) return display;
  const gods = getPillarTenGods(dayStemHanja, display.stemHanja, display.branchHanja);
  if (!gods) return display;
  return {
    ...display,
    stemTenGod: gods.stemTenGod,
    branchTenGod: gods.branchTenGod,
  };
}

function getSizeStyles(totalColumns: number, compact: boolean): string {
  if (compact && totalColumns >= 4) return "1.4rem";
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
  /** true면 대운·세운·월운·일운 표시 */
  compact?: boolean;
  currentDaeun?: CurrentDaeunPillar | null;
  dayStemHanja?: string | null;
  onToggleDiaryPillar?: (slot: DiaryPillarSlot) => void;
  onToggleDaeun?: () => void;
};

function buildColumns(
  birthPillars: UserBirthPillars | null,
  diaryPillars: PartialDiaryPillars,
  pillarVisibility: PillarVisibility,
  compact: boolean,
  currentDaeun: CurrentDaeunPillar | null | undefined,
  dayStemHanja: string | null | undefined
): BoardColumn[] {
  if (compact) {
    // 왼쪽부터 일 · 월 · 년 · 대운
    const columns: BoardColumn[] = [];
    if (diaryPillars.dayPillar) {
      columns.push({
        id: "fortune-day",
        group: "diary",
        pillar: withTenGods(
          {
            ...toDisplayFromDiary("일주", diaryPillars.dayPillar),
            displayLabel: "일운",
          },
          dayStemHanja
        ),
        visible: pillarVisibility.diary.day,
        toggleSlot: "day",
      });
    }
    if (diaryPillars.monthPillar) {
      columns.push({
        id: "fortune-month",
        group: "diary",
        pillar: withTenGods(
          {
            ...toDisplayFromDiary("월주", diaryPillars.monthPillar),
            displayLabel: "월운",
          },
          dayStemHanja
        ),
        visible: pillarVisibility.diary.month,
        toggleSlot: "month",
      });
    }
    if (diaryPillars.yearPillar) {
      columns.push({
        id: "fortune-year",
        group: "diary",
        pillar: withTenGods(
          {
            ...toDisplayFromDiary("년주", diaryPillars.yearPillar),
            displayLabel: "세운",
          },
          dayStemHanja
        ),
        visible: pillarVisibility.diary.year,
        toggleSlot: "year",
      });
    }
    if (currentDaeun) {
      columns.push({
        id: "fortune-daeun",
        group: "daeun",
        pillar: {
          label: "대운",
          displayLabel: "대운",
          stemHanja: currentDaeun.stemHanja,
          branchHanja: currentDaeun.branchHanja,
          ganjiKo: currentDaeun.ganjiKo,
          stemTenGod: currentDaeun.stemTenGod,
          branchTenGod: currentDaeun.branchTenGod,
        },
        visible: pillarVisibility.daeun,
        toggleSlot: "daeun",
      });
    }
    return columns;
  }

  const columns: BoardColumn[] = [];

  if (diaryPillars.dayPillar) {
    columns.push({
      id: "diary-day",
      group: "diary",
      pillar: withTenGods(
        {
          ...toDisplayFromDiary("일주", diaryPillars.dayPillar),
          displayLabel: "일운",
        },
        dayStemHanja
      ),
      visible: true,
    });
  }
  if (diaryPillars.monthPillar) {
    columns.push({
      id: "diary-month",
      group: "diary",
      pillar: withTenGods(
        {
          ...toDisplayFromDiary("월주", diaryPillars.monthPillar),
          displayLabel: "월운",
        },
        dayStemHanja
      ),
      visible: true,
    });
  }
  if (diaryPillars.yearPillar) {
    columns.push({
      id: "diary-year",
      group: "diary",
      pillar: withTenGods(
        {
          ...toDisplayFromDiary("년주", diaryPillars.yearPillar),
          displayLabel: "세운",
        },
        dayStemHanja
      ),
      visible: true,
    });
  }
  if (currentDaeun) {
    columns.push({
      id: "diary-daeun",
      group: "daeun",
      pillar: {
        label: "대운",
        displayLabel: "대운",
        stemHanja: currentDaeun.stemHanja,
        branchHanja: currentDaeun.branchHanja,
        ganjiKo: currentDaeun.ganjiKo,
        stemTenGod: currentDaeun.stemTenGod,
        branchTenGod: currentDaeun.branchTenGod,
      },
      visible: true,
    });
  }

  if (birthPillars) {
    if (birthPillars.hour) {
      columns.push({
        id: "birth-hour",
        group: "birth",
        pillar: withTenGods(
          {
            ...toDisplayFromBirth("시주", birthPillars.hour),
            displayLabel: "시주",
          },
          dayStemHanja
        ),
        visible: true,
      });
    }
    columns.push(
      {
        id: "birth-day",
        group: "birth",
        pillar: withTenGods(
          {
            ...toDisplayFromBirth("일주", birthPillars.day),
            displayLabel: "일주",
          },
          dayStemHanja
        ),
        visible: true,
      },
      {
        id: "birth-month",
        group: "birth",
        pillar: withTenGods(
          {
            ...toDisplayFromBirth("월주", birthPillars.month),
            displayLabel: "월주",
          },
          dayStemHanja
        ),
        visible: true,
      },
      {
        id: "birth-year",
        group: "birth",
        pillar: withTenGods(
          {
            ...toDisplayFromBirth("년주", birthPillars.year),
            displayLabel: "년주",
          },
          dayStemHanja
        ),
        visible: true,
      }
    );
  }

  return columns;
}

function PillarColumn({
  pillar,
  totalColumns,
  group,
  compact = false,
  emphasized = false,
  showEyeToggle = false,
  onToggle,
}: {
  pillar: PillarDisplay;
  totalColumns: number;
  group: ColumnGroup;
  compact?: boolean;
  emphasized?: boolean;
  showEyeToggle?: boolean;
  onToggle?: () => void;
}) {
  const [togglePop, setTogglePop] = useState(false);
  const stemColor = getStemColor(pillar.stemHanja);
  const branchColor = getBranchColor(pillar.branchHanja);
  const hanjaSize = getSizeStyles(totalColumns, compact);
  const borderColor = emphasized ? "#60a5fa" : GROUP_BORDER[group];
  const labelColor = GROUP_LABEL_COLOR[group];
  const labelSize = compact ? "14px" : "12px";
  const tenGodSize = "14px";
  const showTenGods = Boolean(pillar.stemTenGod || pillar.branchTenGod);
  const tenGodStyle: React.CSSProperties = {
    fontSize: tenGodSize,
    color: "var(--px-text-on-panel)",
    background: "var(--px-bg3)",
    border: "1px solid var(--px-border)",
    padding: "2px 4px",
  };

  const handleToggle = () => {
    onToggle?.();
    setTogglePop(true);
    window.setTimeout(() => setTogglePop(false), 220);
  };

  return (
    <div
      className="manseryeok-pillar-inner flex flex-col items-center border-2 w-full"
      style={{
        background: emphasized
          ? "color-mix(in srgb, #60a5fa 12%, var(--px-bg2))"
          : "var(--px-bg2)",
        borderColor,
        boxShadow: emphasized
          ? "3px 3px 0 #1e3a5f"
          : `2px 2px 0 ${group === "birth" || group === "daeun" ? "#4a3a00" : "#1e3a5f"}`,
        padding: 0,
      }}
      title={`${getLabelText(pillar)} ${pillar.ganjiKo}`}
    >
      <div
        className="flex flex-col items-center justify-center w-full border-b gap-0.5"
        style={{
          borderColor: "var(--px-border)",
          borderStyle: "dashed",
          padding: "4px 0 2px",
        }}
      >
        {showTenGods && pillar.stemTenGod && (
          <span
            className="font-black leading-none whitespace-nowrap"
            style={tenGodStyle}
          >
            {pillar.stemTenGod}
          </span>
        )}
        <span
          className="pillar-hanja font-black leading-none"
          style={{ fontSize: hanjaSize, color: stemColor, textShadow: `0 0 10px ${stemColor}88` }}
        >
          {pillar.stemHanja}
        </span>
      </div>
      <div
        className="flex flex-col items-center justify-center w-full gap-0.5"
        style={{ padding: "2px 0 2px" }}
      >
        <span
          className="pillar-hanja pillar-hanja-branch font-black leading-none"
          style={{ fontSize: hanjaSize, color: branchColor, textShadow: `0 0 10px ${branchColor}88` }}
        >
          {pillar.branchHanja}
        </span>
        {showTenGods && pillar.branchTenGod && (
          <span
            className="font-black leading-none whitespace-nowrap"
            style={{
              ...tenGodStyle,
              marginTop: "9px",
            }}
          >
            {pillar.branchTenGod}
          </span>
        )}
      </div>
      <div
        className="w-full text-center border-t flex flex-col items-center"
        style={{ borderColor: borderColor, padding: compact ? "6px 4px" : "4px 2px" }}
      >
        {showEyeToggle && onToggle ? (
          <>
            <p
              className="font-black leading-tight whitespace-nowrap mb-1"
              style={{ fontSize: labelSize, color: labelColor }}
            >
              {getLabelText(pillar)}
            </p>
            <div className="h-[18px] flex items-center justify-center">
              <PillarVisibilityToggle
                visible
                onClick={handleToggle}
                popping={togglePop}
              />
            </div>
          </>
        ) : (
          <p
            className="font-black leading-tight whitespace-nowrap"
            style={{ fontSize: labelSize, color: labelColor }}
          >
            {getLabelText(pillar)}
          </p>
        )}
      </div>
    </div>
  );
}

function AnimatedPillarSlot({
  column,
  totalColumns,
  staggerIndex,
  compact = false,
  onToggle,
}: {
  column: BoardColumn;
  totalColumns: number;
  staggerIndex: number;
  compact?: boolean;
  onToggle?: () => void;
}) {
  const emphasized = compact && column.id === "fortune-day";
  const showEyeToggle = compact && Boolean(column.toggleSlot && onToggle);

  return (
    <div
      className="manseryeok-pillar-slot"
      data-visible={column.visible ? "true" : "false"}
      data-compact={compact ? "true" : "false"}
      style={{ "--pillar-stagger": `${staggerIndex * 30}ms` } as React.CSSProperties}
    >
      <PillarColumn
        pillar={column.pillar}
        totalColumns={totalColumns}
        group={column.group}
        compact={compact}
        emphasized={emphasized}
        showEyeToggle={showEyeToggle}
        onToggle={onToggle}
      />
    </div>
  );
}

export default function ManseryeokBoard({
  birthPillars,
  diaryPillars,
  pillarVisibility,
  compact = false,
  currentDaeun = null,
  dayStemHanja = null,
  onToggleDiaryPillar,
  onToggleDaeun,
}: Props) {
  const columns = buildColumns(
    birthPillars,
    diaryPillars,
    pillarVisibility,
    compact,
    currentDaeun,
    dayStemHanja
  );

  if (columns.length === 0) return null;

  const visibleColumns = columns.filter((col) => col.visible);
  const hiddenColumns = compact ? columns.filter((col) => !col.visible) : [];
  const visibleCount = visibleColumns.length;

  const birthHasVisible = visibleColumns.some((col) => col.group === "birth");
  const diaryHasVisible = visibleColumns.some((col) => col.group === "diary");
  const showDivider = !compact && birthHasVisible && diaryHasVisible;

  const birthColumns = compact ? [] : columns.filter((col) => col.group === "birth");
  const fortuneColumns = compact
    ? visibleColumns
    : columns.filter((col) => col.group !== "birth");

  let staggerCounter = 0;

  const resolveToggle = (col: BoardColumn) => {
    if (!col.toggleSlot) return undefined;
    if (col.toggleSlot === "daeun") return onToggleDaeun;
    return onToggleDiaryPillar
      ? () => onToggleDiaryPillar(col.toggleSlot as DiaryPillarSlot)
      : undefined;
  };

  return (
    <div className="space-y-2">
      {visibleCount > 0 ? (
        <div className="flex gap-1 items-stretch min-w-0">
          {fortuneColumns.map((col) => {
            const staggerIndex = col.visible ? staggerCounter++ : staggerCounter;
            return (
              <AnimatedPillarSlot
                key={col.id}
                column={col}
                totalColumns={visibleCount}
                staggerIndex={staggerIndex}
                compact={compact}
                onToggle={resolveToggle(col)}
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
        </div>
      ) : (
        <p className="ui-guide">표시할 운을 아래에서 추가해주세요.</p>
      )}
      {compact && hiddenColumns.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          <span className="ui-hint font-bold">표시 추가</span>
          {hiddenColumns.map((col) => {
            const onAdd = resolveToggle(col);
            const accentColor =
              col.group === "daeun" ? "var(--px-accent)" : "#60a5fa";
            return (
              <button
                key={`add-${col.id}`}
                type="button"
                onClick={onAdd}
                className="px-2.5 py-1.5 border text-xs font-black"
                style={{
                  borderColor: accentColor,
                  color: accentColor,
                  background: `color-mix(in srgb, ${accentColor} 16%, var(--px-bg2))`,
                  boxShadow:
                    col.group === "daeun"
                      ? "2px 2px 0 #4a3a00"
                      : "2px 2px 0 #1e3a5f",
                }}
                aria-label={`${getLabelText(col.pillar)} 표시`}
              >
                + {getLabelText(col.pillar)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
