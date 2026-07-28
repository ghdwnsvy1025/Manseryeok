/**
 * 통계 탭용 인사이트: 주간 총평 · 작성 CTA · 글자별 행복도
 */
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import {
  CORE_STATE_CODES,
  type CoreStateCode,
} from "@/lib/journal/checkin/catalog";
import { dayHappiness } from "@/lib/journal/homeStats";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  BRANCH_META,
  BRANCHES,
  STEM_META,
  STEMS,
  type Element,
} from "@/lib/saju/constants";

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function latestByDate(entries: JournalEntry[]): Map<string, JournalEntry> {
  const byDate = new Map<string, JournalEntry>();
  for (const e of entries) {
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.entryDate, e);
  }
  return byDate;
}

function averageHappiness(
  byDate: Map<string, JournalEntry>,
  from: string,
  to: string
): number | null {
  const vals: number[] = [];
  for (const [date, e] of byDate) {
    if (date < from || date > to) continue;
    const h = dayHappiness(e);
    if (h != null) vals.push(h);
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function categoryAverage(
  byDate: Map<string, JournalEntry>,
  code: CategoryCode,
  from: string,
  to: string
): number | null {
  const vals: number[] = [];
  for (const [date, e] of byDate) {
    if (date < from || date > to) continue;
    const s = e.scores.find((x) => x.categoryCode === code);
    if (!s || s.isNotApplicable || s.finalScore == null) continue;
    vals.push(s.finalScore);
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export type StatsWriteCta = {
  label: string;
  href: string;
  reason: string;
};

export type WeekSummaryInsight = {
  headline: string;
  thisWeekAvg: number | null;
  lastWeekAvg: number | null;
  delta: number | null;
  /** 주간 비교에 쓰인 카테고리 (있으면) */
  moverName: string | null;
  moverDelta: number | null;
  cta: StatsWriteCta | null;
  recordedToday: boolean;
};

function formatDelta(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  return rounded.toFixed(1);
}

function buildWriteCta(
  byDate: Map<string, JournalEntry>,
  today: string
): StatsWriteCta | null {
  const recordedToday = byDate.has(today);
  if (!recordedToday) {
    return {
      label: "오늘 기록하기",
      href: "/journal",
      reason: "오늘 기록이 아직 없어요",
    };
  }

  const recentFrom = shiftDate(today, -2);
  const prevFrom = shiftDate(today, -5);
  const prevTo = shiftDate(today, -3);
  const recentAvg = averageHappiness(byDate, recentFrom, today);
  const prevAvg = averageHappiness(byDate, prevFrom, prevTo);

  if (
    recentAvg != null &&
    prevAvg != null &&
    recentAvg <= prevAvg - 0.5
  ) {
    return {
      label: "오늘 짧게 남겨보기",
      href: "/journal",
      reason: `최근 3일 행복도가 ${formatDelta(recentAvg - prevAvg)} 내려갔어요`,
    };
  }

  let worst: { code: CoreStateCode; avg: number } | null = null;
  const from7 = shiftDate(today, -6);
  for (const code of CORE_STATE_CODES) {
    const avg = categoryAverage(byDate, code, from7, today);
    if (avg == null) continue;
    if (!worst || avg < worst.avg) worst = { code, avg };
  }
  if (worst && worst.avg <= 4.5) {
    const name = getCategoryByCode(worst.code)?.name ?? worst.code;
    return {
      label: `${name} 오늘 체크해보기`,
      href: "/journal",
      reason: `최근 ${name}이 ${worst.avg.toFixed(1)}점으로 낮아요`,
    };
  }

  return null;
}

/** 최근 7일 vs 그 전 7일 총평 + 작성 CTA */
export function buildWeekSummaryInsight(
  entries: JournalEntry[],
  today: string
): WeekSummaryInsight {
  const byDate = latestByDate(entries);
  const thisFrom = shiftDate(today, -6);
  const lastFrom = shiftDate(today, -13);
  const lastTo = shiftDate(today, -7);

  const thisWeekAvg = averageHappiness(byDate, thisFrom, today);
  const lastWeekAvg = averageHappiness(byDate, lastFrom, lastTo);
  const delta =
    thisWeekAvg != null && lastWeekAvg != null
      ? Math.round((thisWeekAvg - lastWeekAvg) * 10) / 10
      : null;

  let moverName: string | null = null;
  let moverDelta: number | null = null;
  let bestAbs = 0;
  for (const code of CORE_STATE_CODES) {
    const a = categoryAverage(byDate, code, thisFrom, today);
    const b = categoryAverage(byDate, code, lastFrom, lastTo);
    if (a == null || b == null) continue;
    const d = Math.round((a - b) * 10) / 10;
    if (Math.abs(d) >= bestAbs && Math.abs(d) >= 0.4) {
      bestAbs = Math.abs(d);
      moverName = getCategoryByCode(code)?.name ?? code;
      moverDelta = d;
    }
  }

  let headline: string;
  if (thisWeekAvg == null && lastWeekAvg == null) {
    headline = "기록이 더 쌓이면 주간 비교가 보여요";
  } else if (lastWeekAvg == null && thisWeekAvg != null) {
    headline = `최근 7일 행복도 ${thisWeekAvg.toFixed(1)}점 · 다음 주면 비교할 수 있어요`;
  } else if (delta == null) {
    headline = "주간 비교를 준비 중이에요";
  } else if (Math.abs(delta) < 0.3) {
    headline = moverName
      ? `지난주와 비슷해요 · ${moverName}이 ${
          (moverDelta ?? 0) >= 0 ? "조금 올랐어요" : "조금 아쉬워요"
        }`
      : "지난주와 비슷한 흐름이에요";
  } else if (delta > 0) {
    headline = moverName
      ? `지난주보다 행복도 ${formatDelta(delta)} · ${moverName}이 같이 올랐어요`
      : `지난주보다 행복도 ${formatDelta(delta)} 올랐어요`;
  } else {
    headline = moverName
      ? `지난주보다 행복도 ${formatDelta(delta)} · ${moverName}이 같이 내려갔어요`
      : `지난주보다 행복도 ${formatDelta(delta)} 내려갔어요`;
  }

  return {
    headline,
    thisWeekAvg,
    lastWeekAvg,
    delta,
    moverName,
    moverDelta,
    cta: buildWriteCta(byDate, today),
    recordedToday: byDate.has(today),
  };
}

export type CollectionMission = {
  ganjiKo: string;
  status: "locked" | "discovered" | "pattern";
  entryCount: number;
  recordedToday: boolean;
  title: string;
  detail: string;
  ctaLabel: string | null;
  href: string;
};

export function buildCollectionMission(
  entries: JournalEntry[],
  today: string,
  collectionStatus: {
    ganjiKo: string;
    status: "locked" | "discovered" | "pattern";
    entryCount: number;
  }[]
): CollectionMission {
  const { dayPillar } = getPillarsForDate(today);
  const ganjiKo = dayPillar.ganjiKo;
  const item = collectionStatus.find((c) => c.ganjiKo === ganjiKo);
  const status = item?.status ?? "locked";
  const entryCount = item?.entryCount ?? 0;
  const recordedToday = latestByDate(entries).has(today);

  let title = `오늘은 ${ganjiKo}일`;
  let detail = "";
  let ctaLabel: string | null = "오늘 기록하고 도감 채우기";

  if (recordedToday) {
    ctaLabel = null;
    if (status === "pattern") {
      detail = `이미 패턴 수집 · ${entryCount}회 기록됨`;
    } else if (status === "discovered") {
      detail = "오늘 기록으로 도감에 열렸어요. 한 번 더면 패턴!";
    } else {
      detail = "오늘 기록이 반영되면 도감이 열려요";
    }
  } else if (status === "locked") {
    detail = "기록하면 도감에 처음 열려요";
  } else if (status === "discovered") {
    detail = `지금 1회 · 한 번 더 기록하면 패턴`;
    ctaLabel = "오늘 기록하고 패턴 만들기";
  } else {
    detail = `이미 패턴 · ${entryCount}회. 오늘도 남기면 더 정확해져요`;
    ctaLabel = "오늘도 짧게 남기기";
  }

  return {
    ganjiKo,
    status,
    entryCount,
    recordedToday,
    title,
    detail,
    ctaLabel,
    href: "/journal",
  };
}

export type CharacterHappiness = {
  key: string;
  average: number | null;
  count: number;
  deltaFromOverall: number | null;
  element?: Element;
};

function overallHappinessAvg(byDate: Map<string, JournalEntry>): number | null {
  const vals: number[] = [];
  for (const e of byDate.values()) {
    const h = dayHappiness(e);
    if (h != null) vals.push(h);
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function bump(
  map: Map<string, { sum: number; count: number }>,
  key: string,
  value: number
) {
  const prev = map.get(key);
  if (prev) {
    prev.sum += value;
    prev.count += 1;
  } else {
    map.set(key, { sum: value, count: 1 });
  }
}

function toRows(
  orderedKeys: string[],
  map: Map<string, { sum: number; count: number }>,
  overall: number | null,
  elementOf: (key: string) => Element | undefined
): CharacterHappiness[] {
  return orderedKeys.map((key) => {
    const acc = map.get(key);
    const average =
      acc && acc.count > 0
        ? Math.round((acc.sum / acc.count) * 10) / 10
        : null;
    const deltaFromOverall =
      average != null && overall != null
        ? Math.round((average - overall) * 10) / 10
        : null;
    return {
      key,
      average,
      count: acc?.count ?? 0,
      deltaFromOverall,
      element: elementOf(key),
    };
  });
}

/** 천간·지지·간지별 하루 행복도 평균 (1~10) */
export function aggregateHappinessByCharacters(entries: JournalEntry[]): {
  stems: CharacterHappiness[];
  branches: CharacterHappiness[];
  ganzhi: CharacterHappiness[];
} {
  const byDate = latestByDate(entries);
  const overall = overallHappinessAvg(byDate);
  const stemMap = new Map<string, { sum: number; count: number }>();
  const branchMap = new Map<string, { sum: number; count: number }>();
  const ganjiMap = new Map<string, { sum: number; count: number }>();

  for (const e of byDate.values()) {
    const h = dayHappiness(e);
    if (h == null) continue;
    const { dayPillar } = getPillarsForDate(e.entryDate);
    bump(stemMap, dayPillar.stem.ko, h);
    bump(branchMap, dayPillar.branch.ko, h);
    bump(ganjiMap, dayPillar.ganjiKo, h);
  }

  const stemKeys = STEMS.map((s) => STEM_META[s].ko);
  const branchKeys = BRANCHES.map((b) => BRANCH_META[b].ko);
  const ganjiKeys = Array.from(ganjiMap.keys()).sort((a, b) => {
    const ca = ganjiMap.get(a)!.count;
    const cb = ganjiMap.get(b)!.count;
    if (cb !== ca) return cb - ca;
    return a.localeCompare(b);
  });

  return {
    stems: toRows(stemKeys, stemMap, overall, (key) => {
      const hanja = STEMS.find((s) => STEM_META[s]?.ko === key);
      return hanja ? STEM_META[hanja].element : undefined;
    }),
    branches: toRows(branchKeys, branchMap, overall, (key) => {
      const hanja = BRANCHES.find((b) => BRANCH_META[b]?.ko === key);
      return hanja ? BRANCH_META[hanja].element : undefined;
    }),
    ganzhi: toRows(ganjiKeys, ganjiMap, overall, () => undefined),
  };
}

/** 간지별 행복도 맵 (도감 타일용) */
export function happinessByGanji(
  entries: JournalEntry[]
): Map<string, { average: number; count: number }> {
  const { ganzhi } = aggregateHappinessByCharacters(entries);
  const map = new Map<string, { average: number; count: number }>();
  for (const row of ganzhi) {
    if (row.average == null || row.count === 0) continue;
    map.set(row.key, { average: row.average, count: row.count });
  }
  return map;
}

/** 히트맵 탭용 한 줄 해석 — 2회 이상 기록된 글자만 비교 */
export type CharacterHappinessInsight = {
  /** 비교 결과일 때만 "평균 대비" */
  label: string | null;
  /** `을 +1.2 · 계 −0.8` 또는 안내 문장 */
  text: string;
};

export function describeCharacterHappiness(
  rows: CharacterHappiness[]
): CharacterHappinessInsight {
  const usable = rows.filter(
    (r) => r.count >= 2 && r.average != null && r.deltaFromOverall != null
  );
  if (usable.length === 0) {
    return {
      label: null,
      text: "같은 글자 2회부터 비교",
    };
  }

  const sorted = [...usable].sort(
    (a, b) => (b.deltaFromOverall ?? 0) - (a.deltaFromOverall ?? 0)
  );
  const top = sorted[0]!;
  const bottom = sorted[sorted.length - 1]!;
  const topDelta = top.deltaFromOverall ?? 0;
  const bottomDelta = bottom.deltaFromOverall ?? 0;

  const parts: string[] = [];
  if (topDelta >= 0.3) {
    parts.push(`${top.key} ${formatDelta(topDelta)}`);
  }
  if (bottomDelta <= -0.3 && bottom.key !== top.key) {
    parts.push(`${bottom.key} ${formatDelta(bottomDelta)}`);
  }
  if (parts.length === 0) {
    return { label: null, text: "글자별 차이 작음" };
  }
  return { label: "평균 대비", text: parts.join(" · ") };
}

export type RecordStreak = {
  /** 오늘(또는 어제)까지 이어진 연속 기록일 */
  current: number;
  longest: number;
  recordedToday: boolean;
};

/** 연속 기록일 계산 — 오늘 미기록이면 어제까지의 연속을 유지 */
export function computeRecordStreak(
  entries: JournalEntry[],
  today: string
): RecordStreak {
  const dates = new Set(entries.map((e) => e.entryDate));
  const recordedToday = dates.has(today);

  let current = 0;
  let cursor = recordedToday ? today : shiftDate(today, -1);
  while (dates.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -1);
  }

  const sorted = Array.from(dates).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    if (prev != null && shiftDate(prev, 1) === date) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = date;
  }

  return { current, longest, recordedToday };
}

export type ReflectWriteCta = {
  reason: string;
  label: string;
  href: string;
};

/**
 * 기록 탭 회고 → 오늘 작성 연결.
 * 홈 CTA와 겹치지 않게, 하락·공백·미기록일 때만.
 */
export function buildReflectWriteCta(
  entries: JournalEntry[],
  today: string,
  opts?: { viewMonthAvg?: number | null; prevMonthAvg?: number | null }
): ReflectWriteCta | null {
  const byDate = latestByDate(entries);
  const recordedToday = byDate.has(today);

  if (!recordedToday) {
    const streak = computeRecordStreak(entries, today);
    if (streak.current > 0) {
      return {
        reason: `연속 ${streak.current}일을 이어가려면 오늘 기록이 필요해요`,
        label: "오늘 기록하기",
        href: "/journal",
      };
    }
    return {
      reason: "오늘 기록이 아직 비어 있어요",
      label: "오늘 짧게 남기기",
      href: "/journal",
    };
  }

  const recentFrom = shiftDate(today, -2);
  const prevFrom = shiftDate(today, -5);
  const prevTo = shiftDate(today, -3);
  const recentAvg = averageHappiness(byDate, recentFrom, today);
  const prevAvg = averageHappiness(byDate, prevFrom, prevTo);
  if (
    recentAvg != null &&
    prevAvg != null &&
    recentAvg <= prevAvg - 0.5
  ) {
    return {
      reason: `최근 3일 행복도가 ${formatDelta(recentAvg - prevAvg)} · 오늘 한 줄로 흐름을 남겨보세요`,
      label: "오늘 기록 보완하기",
      href: "/journal",
    };
  }

  if (
    opts?.viewMonthAvg != null &&
    opts?.prevMonthAvg != null &&
    opts.viewMonthAvg <= opts.prevMonthAvg - 0.5
  ) {
    return {
      reason: "이달이 지난달보다 낮아요 · 오늘 상태를 남겨 두면 비교가 더 정확해져요",
      label: "오늘 기록 확인",
      href: `/journal?date=${today}`,
    };
  }

  return null;
}

export type WeeklyReport = {
  from: string;
  to: string;
  rangeLabel: string;
  recordedDays: number;
  totalDays: number;
  avg: number | null;
  deltaFromPrevWeek: number | null;
  bestDay: { date: string; value: number } | null;
  worstDay: { date: string; value: number } | null;
  bestCategory: { name: string; average: number } | null;
  worstCategory: { name: string; average: number } | null;
  newGanji: string[];
  days: Array<{ date: string; value: number | null }>;
  shareText: string;
};

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  const offset = (d.getDay() + 6) % 7;
  return shiftDate(iso, -offset);
}

function formatMd(iso: string): string {
  return `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return out;
}

/** 이번 주(월~오늘) 리포트 — 공유용 텍스트 포함 */
export function buildWeeklyReport(
  entries: JournalEntry[],
  today: string
): WeeklyReport {
  const byDate = latestByDate(entries);
  const from = mondayOf(today);
  const to = today;
  const range = daysBetween(from, to);

  const days = range.map((date) => {
    const e = byDate.get(date);
    return { date, value: e ? dayHappiness(e) : null };
  });
  const recorded = days.filter((d) => d.value != null) as Array<{
    date: string;
    value: number;
  }>;

  const avg = averageHappiness(byDate, from, to);
  const prevFrom = shiftDate(from, -7);
  const prevTo = shiftDate(from, -1);
  const prevAvg = averageHappiness(byDate, prevFrom, prevTo);
  const deltaFromPrevWeek =
    avg != null && prevAvg != null
      ? Math.round((avg - prevAvg) * 10) / 10
      : null;

  let bestDay: { date: string; value: number } | null = null;
  let worstDay: { date: string; value: number } | null = null;
  for (const d of recorded) {
    if (!bestDay || d.value > bestDay.value) bestDay = d;
    if (!worstDay || d.value < worstDay.value) worstDay = d;
  }
  if (recorded.length < 2) worstDay = null;

  let bestCategory: { name: string; average: number } | null = null;
  let worstCategory: { name: string; average: number } | null = null;
  for (const code of CORE_STATE_CODES) {
    const avgCat = categoryAverage(byDate, code, from, to);
    if (avgCat == null) continue;
    const name = getCategoryByCode(code)?.name ?? code;
    if (!bestCategory || avgCat > bestCategory.average) {
      bestCategory = { name, average: avgCat };
    }
    if (!worstCategory || avgCat < worstCategory.average) {
      worstCategory = { name, average: avgCat };
    }
  }
  if (bestCategory && worstCategory && bestCategory.name === worstCategory.name) {
    worstCategory = null;
  }

  const priorGanji = new Set<string>();
  for (const [date] of byDate) {
    if (date >= from) continue;
    priorGanji.add(getPillarsForDate(date).dayPillar.ganjiKo);
  }
  const newGanji: string[] = [];
  for (const d of recorded) {
    const ganji = getPillarsForDate(d.date).dayPillar.ganjiKo;
    if (priorGanji.has(ganji) || newGanji.includes(ganji)) continue;
    newGanji.push(ganji);
  }

  const rangeLabel = `${formatMd(from)} ~ ${formatMd(to)}`;
  const shareLines = [
    `주간 기록 리포트 (${rangeLabel})`,
    `기록 ${recorded.length}/${range.length}일`,
    avg != null ? `평균 행복도 ${avg.toFixed(1)}/10` : "평균 행복도 -",
  ];
  if (deltaFromPrevWeek != null) {
    shareLines.push(`지난주 대비 ${formatDelta(deltaFromPrevWeek)}`);
  }
  if (bestDay) {
    shareLines.push(
      `가장 좋았던 날 ${formatMd(bestDay.date)} (${bestDay.value.toFixed(1)})`
    );
  }
  if (bestCategory) {
    shareLines.push(
      `잘 지킨 것 ${bestCategory.name} ${bestCategory.average.toFixed(1)}`
    );
  }
  if (worstCategory) {
    shareLines.push(
      `아쉬운 것 ${worstCategory.name} ${worstCategory.average.toFixed(1)}`
    );
  }
  if (newGanji.length > 0) {
    shareLines.push(`새로 채운 간지 ${newGanji.join(", ")}`);
  }

  return {
    from,
    to,
    rangeLabel,
    recordedDays: recorded.length,
    totalDays: range.length,
    avg,
    deltaFromPrevWeek,
    bestDay,
    worstDay,
    bestCategory,
    worstCategory,
    newGanji,
    days,
    shareText: shareLines.join("\n"),
  };
}

export function buildMonthCells(
  year: number,
  month: number
): Array<{ date: string | null; day: number | null }> {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }
  return cells;
}
