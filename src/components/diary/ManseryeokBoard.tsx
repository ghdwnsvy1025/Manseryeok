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
  stemHanja: string;
  branchHanja: string;
  ganjiKo: string;
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
    hint: "일기",
    stemHanja: pillar.stem.hanja,
    branchHanja: pillar.branch.hanja,
    ganjiKo: pillar.ganjiKo,
  };
}

function getSizeStyles(totalColumns: number): string {
  if (totalColumns <= 4) return "1.75rem";
  if (totalColumns === 5) return "1.5rem";
  if (totalColumns === 6) return "1.3rem";
  return "1.15rem";
}

function buildColumns(
  birthPillars: UserBirthPillars | null,
  diaryPillars: PartialDiaryPillars,
  pillarVisibility: PillarVisibility
): BoardColumn[] {
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
}: {
  pillar: PillarDisplay;
  totalColumns: number;
}) {
  const stemColor = getStemColor(pillar.stemHanja);
  const branchColor = getBranchColor(pillar.branchHanja);
  const hanjaSize = getSizeStyles(totalColumns);

  return (
    <div
      className="manseryeok-pillar-inner flex flex-col items-center border-2 w-full"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
        padding: 0,
      }}
      title={`${pillar.label} ${pillar.ganjiKo}`}
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
        style={{ borderColor: "var(--px-border)", padding: "3px 2px" }}
      >
        <p className="font-black leading-tight" style={{ fontSize: "7px", color: "var(--px-accent)" }}>
          {pillar.hint ? `${pillar.hint} ` : "내 "}
          {pillar.label}
        </p>
        <p className="font-semibold leading-tight mt-0.5" style={{ fontSize: "6px", color: "var(--px-text2)" }}>
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
}: {
  column: BoardColumn;
  totalColumns: number;
  staggerIndex: number;
}) {
  return (
    <div
      className="manseryeok-pillar-slot"
      data-visible={column.visible ? "true" : "false"}
      style={{ "--pillar-stagger": `${staggerIndex * 30}ms` } as React.CSSProperties}
    >
      <PillarColumn pillar={column.pillar} totalColumns={totalColumns} />
    </div>
  );
}

type Props = {
  birthPillars: UserBirthPillars | null;
  diaryPillars: PartialDiaryPillars;
  pillarVisibility: PillarVisibility;
};

export default function ManseryeokBoard({ birthPillars, diaryPillars, pillarVisibility }: Props) {
  const columns = buildColumns(birthPillars, diaryPillars, pillarVisibility);

  if (columns.length === 0) return null;

  const visibleColumns = columns.filter((col) => col.visible);
  const visibleCount = visibleColumns.length;

  const birthHasVisible = visibleColumns.some((col) => col.group === "birth");
  const diaryHasVisible = visibleColumns.some((col) => col.group === "diary");
  const showDivider = birthHasVisible && diaryHasVisible;

  const birthColumns = columns.filter((col) => col.group === "birth");
  const diaryColumns = columns.filter((col) => col.group === "diary");

  let staggerCounter = 0;

  if (visibleCount === 0) {
    return (
      <p
        className="text-[9px] font-bold transition-opacity duration-300"
        style={{ color: "var(--px-text2)" }}
      >
        표시할 간지를 선택해주세요. (날짜 아래 눈 아이콘 터치)
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 items-stretch min-w-0">
        {birthColumns.map((col) => {
          const staggerIndex = col.visible ? staggerCounter++ : staggerCounter;
          return (
            <AnimatedPillarSlot
              key={col.id}
              column={col}
              totalColumns={visibleCount}
              staggerIndex={staggerIndex}
            />
          );
        })}
        {diaryColumns.length > 0 && (
          <div
            className="manseryeok-divider flex items-center shrink-0 px-0.5 text-xs font-bold self-stretch"
            data-visible={showDivider ? "true" : "false"}
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
            />
          );
        })}
      </div>
    </div>
  );
}
