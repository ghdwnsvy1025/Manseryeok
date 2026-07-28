/**
 * 월 단위 순차 저널 시드 — 테스트용.
 * 예: 7월에 10개 → 7/1~7/10, 이어서 3개 → 7/11~7/13.
 * 삭제는 끝에서부터 시드만 제거.
 */
import {
  CORE_STATE_CODES,
  DOMAIN_POOL_CODES,
  MAX_CHECKIN_TAGS,
  MAX_MOODS,
  ordinalToJournalScore,
  type DomainCode,
  type OrdinalScore,
} from "@/lib/journal/checkin/catalog";
import {
  buildCheckInScoreRows,
  buildCoreStatesPayload,
  buildDomainScoresPayload,
} from "@/lib/journal/checkin/mapToScores";
import type { CoreStateUi, DomainStateUi } from "@/lib/journal/checkin/validation";
import type { JournalSaveInput } from "@/lib/journal/storage";
import {
  CHECKIN_VERSION_V2,
  MOOD_OPTIONS,
  type CategoryCode,
  type JournalEntry,
} from "@/lib/journal/types";
import type { HappinessScore } from "@/lib/journal/happinessScale";

export const MONTH_SEED_MARKER = "[admin_month_seed]";

/**
 * supabase/migrations/008 에 실제로 insert 된 태그만.
 * 클라이언트 EVENT_TAG_CATALOG의 none_special/other 는 DB에 없어 FK 위반을 낸다.
 */
const DB_SEEDED_TAG_CODES = [
  "new_start",
  "achievement",
  "conflict",
  "meeting",
  "income",
  "big_spend",
  "exercise",
  "illness",
  "travel",
  "mistake",
  "decision",
  "rest",
  "learning",
  "work_pressure",
  "family",
] as const;

/** 오늘의 기록(자유 일기) 샘플 — 시드마다 랜덤 선택 */
const CONTENTS = [
  "회의가 길었지만 끝나고 산책하니 숨이 트였다.",
  "일이 조금 밀렸지만 하나씩 마무리했다.",
  "쉬고 나니 머리가 맑아졌다. 저녁엔 가볍게 운동했다.",
  "사람과 대화하며 기운을 얻었다. 덕분에 하루가 덜 무거웠다.",
  "집중과 분산이 오갔다. 할 일을 짧게 나눠 보니 나았다.",
  "몸 컨디션을 살피며 속도를 조절했다.",
  "작은 실수가 있었지만 바로 고쳤다. 생각보다 괜찮았다.",
  "가족이랑 잠깐 통화하고 마음이 풀렸다.",
  "업무 압박이 컸지만 우선순위를 다시 잡았다.",
  "특별한 일은 많지 않았고, 루틴을 지킨 하루였다.",
];

const MAIN_EVENT_SNIPPETS = [
  "팀 미팅",
  "마감 처리",
  "가벼운 운동",
  "친구와 저녁",
  "휴식",
  "공부 진도",
  "집안일",
  "의사 결정",
];

export function isMonthSeedEntry(
  entry: Pick<JournalEntry, "mainEventText" | "content">
): boolean {
  const main = entry.mainEventText ?? "";
  return (
    main === MONTH_SEED_MARKER ||
    main.startsWith(`${MONTH_SEED_MARKER} `) ||
    (typeof entry.content === "string" &&
      entry.content.includes(MONTH_SEED_MARKER))
  );
}

export function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { year, month };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function dateInMonth(
  year: number,
  month: number,
  day: number
): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 해당 월에서 시드가 1일부터 연속으로 채워진 마지막 일자 (없으면 0) */
export function contiguousSeedEndDay(
  yearMonth: string,
  entries: JournalEntry[]
): number {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return 0;
  const { year, month } = parsed;
  const max = daysInMonth(year, month);
  const seedDays = new Set<number>();
  for (const e of entries) {
    if (!isMonthSeedEntry(e)) continue;
    if (!e.entryDate.startsWith(yearMonth)) continue;
    const day = Number(e.entryDate.slice(8, 10));
    if (Number.isInteger(day) && day >= 1 && day <= max) seedDays.add(day);
  }
  let end = 0;
  for (let d = 1; d <= max; d += 1) {
    if (!seedDays.has(d)) break;
    end = d;
  }
  return end;
}

export type MonthSeedPlan = {
  yearMonth: string;
  daysInMonth: number;
  contiguousEnd: number;
  /** 실행 후 연속 시드 마지막 일자 */
  resultingEnd: number;
  /** 요청 개수보다 적게 처리되면 true (월말/시드 소진으로 잘림) */
  clamped: boolean;
  /** 추가할 날짜 목록 */
  addDates: string[];
  /** 삭제할 날짜 목록 (끝에서부터) */
  deleteDates: string[];
  /** 추가 불가·부분 처리 사유 */
  addBlockedReason: string | null;
  /** 삭제 불가·부분 처리 사유 */
  deleteBlockedReason: string | null;
};

export function planMonthSeed(opts: {
  yearMonth: string;
  count: number;
  action: "add" | "delete";
  entries: JournalEntry[];
}): MonthSeedPlan | { error: string } {
  const parsed = parseYearMonth(opts.yearMonth);
  if (!parsed) return { error: "yearMonth는 YYYY-MM 형식이어야 합니다." };
  const count = Math.floor(opts.count);
  if (!Number.isFinite(count) || count < 1) {
    return { error: "개수는 1 이상의 정수여야 합니다." };
  }
  if (count > 31) return { error: "한 번에 최대 31개까지 가능합니다." };

  const { year, month } = parsed;
  const dim = daysInMonth(year, month);
  const end = contiguousSeedEndDay(opts.yearMonth, opts.entries);
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  if (opts.action === "add") {
    // 월말을 넘기면 그 달 마지막 날까지만 채우고 멈춘다.
    const addDates: string[] = [];
    for (let i = 1; i <= count; i += 1) {
      const day = end + i;
      if (day > dim) break;
      addDates.push(dateInMonth(year, month, day));
    }
    const resultingEnd = end + addDates.length;
    let addBlockedReason: string | null = null;
    if (addDates.length === 0) {
      addBlockedReason = `${yearMonth}은 이미 ${dim}일(월 마지막 날)까지 시드가 가득 찼습니다. 더 추가하지 않았습니다.`;
    } else if (addDates.length < count) {
      addBlockedReason = `${yearMonth}은 ${dim}일까지만 있어 요청 ${count}개 중 ${addDates.length}개만 추가하고 멈췄습니다. 이제 ${dim}일까지 가득 찼습니다.`;
    }
    return {
      yearMonth,
      daysInMonth: dim,
      contiguousEnd: end,
      resultingEnd,
      clamped: addDates.length < count,
      addDates,
      deleteDates: [],
      addBlockedReason,
      deleteBlockedReason: null,
    };
  }

  // delete — 남은 시드보다 많이 요청하면 있는 만큼만 지우고 0으로 만든다.
  const deleteDates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const day = end - i;
    if (day < 1) break;
    deleteDates.push(dateInMonth(year, month, day));
  }
  const resultingEnd = Math.max(0, end - deleteDates.length);
  let deleteBlockedReason: string | null = null;
  if (end < 1 || deleteDates.length === 0) {
    deleteBlockedReason = `${yearMonth}에 삭제할 시드가 없습니다. (현재 시드 0개) 아무것도 삭제하지 않았습니다.`;
  } else if (deleteDates.length < count) {
    deleteBlockedReason = `${yearMonth} 시드가 ${end}개뿐이라 요청 ${count}개 중 ${deleteDates.length}개만 삭제했습니다. 이제 ${yearMonth} 시드는 0개입니다.`;
  }
  return {
    yearMonth,
    daysInMonth: dim,
    contiguousEnd: end,
    resultingEnd,
    clamped: deleteDates.length < count,
    addDates: [],
    deleteDates,
    addBlockedReason: null,
    deleteBlockedReason,
  };
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)]!;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function randomOrdinal(): OrdinalScore {
  return randInt(1, 5) as OrdinalScore;
}

function randomHappiness(): HappinessScore {
  return randInt(0, 10) as HappinessScore;
}

/**
 * 체크인 v2 형태로 시드 — 오늘의 기록·필수·선택을 랜덤으로 채운다.
 * - 필수: 행복도, 기분(1~3), 핵심 상태 4개(1~5)
 * - 선택: 사건 태그·생활영역·한마디 (확률적으로 비우기도 함)
 */
export function buildRandomMonthSeedInput(
  entryDate: string,
  opts?: { sajuProfileId?: string | null; enabledCodes?: CategoryCode[] }
): JournalSaveInput {
  const happiness = randomHappiness();

  const moodCount = randInt(1, MAX_MOODS);
  const moods: string[] = [];
  const moodPool = shuffleInPlace([...MOOD_OPTIONS]);
  for (let i = 0; i < moodCount; i += 1) {
    moods.push(moodPool[i]!);
  }

  const core = {} as Record<(typeof CORE_STATE_CODES)[number], CoreStateUi>;
  for (const code of CORE_STATE_CODES) {
    core[code] = { ordinal: randomOrdinal(), isNotApplicable: false };
  }

  // 선택: 사건 태그 (약 70% 확률로 1~3개)
  const tagCodes: string[] = [];
  if (Math.random() < 0.7) {
    const tagPool = shuffleInPlace([...DB_SEEDED_TAG_CODES]);
    const tagCount = randInt(1, Math.min(MAX_CHECKIN_TAGS, tagPool.length));
    for (let i = 0; i < tagCount; i += 1) tagCodes.push(tagPool[i]!);
  }

  // 선택: 생활영역 (태그가 있거나 50% 확률이면 1~2개 점수)
  const domains: DomainStateUi[] = [];
  const fillDomains =
    tagCodes.length > 0 ? Math.random() < 0.85 : Math.random() < 0.5;
  if (fillDomains) {
    const domainPool = shuffleInPlace([...DOMAIN_POOL_CODES]);
    const domainCount = randInt(1, Math.min(2, domainPool.length));
    for (let i = 0; i < domainCount; i += 1) {
      domains.push({
        code: domainPool[i]! as DomainCode,
        ordinal: randomOrdinal(),
        isNotApplicable: false,
      });
    }
  }

  const contentBody = pickRandom(CONTENTS);
  // 선택: 한마디 — 시드 식별은 content 마커로 유지
  const mainEventText =
    Math.random() < 0.55
      ? `${MONTH_SEED_MARKER} ${pickRandom(MAIN_EVENT_SNIPPETS)}`
      : MONTH_SEED_MARKER;

  const scoreRows = buildCheckInScoreRows({ core, domains });
  const prefsCodes =
    opts?.enabledCodes && opts.enabledCodes.length > 0
      ? opts.enabledCodes.filter(Boolean)
      : [];

  // 체크인 핵심 4항목은 prefs 활성 여부와 무관하게 항상 포함.
  // (기본 추천 목록에 physical_condition이 없어도 시드가 실패하지 않게)
  const enabledCodes = Array.from(
    new Set<CategoryCode>([
      ...CORE_STATE_CODES,
      ...domains.map((d) => d.code as CategoryCode),
      ...prefsCodes,
    ])
  );

  // prefs에만 있는 카테고리도 점수를 채워 검증(활성 전부 입력) 통과
  const scores = [
    ...scoreRows,
    ...prefsCodes
      .filter((code) => !scoreRows.some((s) => s.categoryCode === code))
      .map((categoryCode) => {
        const ord = randomOrdinal();
        const s = ordinalToJournalScore(ord);
        return {
          categoryCode,
          userScore: s,
          rawScore: s,
          finalScore: s,
          isNotApplicable: false,
        };
      }),
  ];

  return {
    entryDate,
    sajuProfileId: opts?.sajuProfileId ?? null,
    userTimezone: "Asia/Seoul",
    content: `${MONTH_SEED_MARKER} ${contentBody} (${entryDate})`,
    overallSatisfaction: happiness,
    happinessScore: happiness,
    moodLabel: moods[0] ?? null,
    moodLabels: moods,
    mainEventText,
    scores,
    tagCodes,
    coreStates: buildCoreStatesPayload(core),
    domainScores: buildDomainScoresPayload(domains),
    checkinVersion: CHECKIN_VERSION_V2,
    enabledCodes,
    relaxEnabledCount: true,
  };
}

export function monthSeedStatusSummary(
  yearMonth: string,
  entries: JournalEntry[]
): {
  yearMonth: string;
  daysInMonth: number;
  contiguousEnd: number;
  seededDates: string[];
  nextAddDate: string | null;
} {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) {
    return {
      yearMonth,
      daysInMonth: 0,
      contiguousEnd: 0,
      seededDates: [],
      nextAddDate: null,
    };
  }
  const { year, month } = parsed;
  const dim = daysInMonth(year, month);
  const end = contiguousSeedEndDay(yearMonth, entries);
  const seededDates: string[] = [];
  for (let d = 1; d <= end; d += 1) {
    seededDates.push(dateInMonth(year, month, d));
  }
  const next = end + 1;
  return {
    yearMonth: `${year}-${String(month).padStart(2, "0")}`,
    daysInMonth: dim,
    contiguousEnd: end,
    seededDates,
    nextAddDate: next <= dim ? dateInMonth(year, month, next) : null,
  };
}
