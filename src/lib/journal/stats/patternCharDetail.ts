/**
 * 사주 패턴 천간/지지 시트용 집계 · 초보 카피 · 다음 출현
 */
import { getPillarsForDate, todayDateString } from "@/lib/diary/dayPillar";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import { dayHappiness } from "@/lib/journal/homeStats";
import type { CharacterHappiness } from "@/lib/journal/statsInsight";
import type { JournalEntry } from "@/lib/journal/types";
import {
  BRANCH_META,
  BRANCHES,
  ELEMENT_LABELS,
  STEM_META,
  STEMS,
  type Element,
} from "@/lib/saju/constants";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";

export type PatternCharKind = "stem" | "branch";

export type PatternTopItem = { label: string; count: number };

export type PatternRecentDay = {
  entryDate: string;
  happiness: number | null;
  entry: JournalEntry;
};

export type PatternCharIdentity = {
  key: string;
  hanja: string;
  kind: PatternCharKind;
  element: Element | undefined;
  elementLabel: string | null;
  /** @deprecated use meaningSentence */
  blurb: string;
  meaningSentence: string;
  zodiacKo?: string;
};

export type PatternCharDetail = {
  identity: PatternCharIdentity;
  row: CharacterHappiness;
  observationLine: string | null;
  topMoods: PatternTopItem[];
  topEvents: PatternTopItem[];
  recentDays: PatternRecentDay[];
  nextDate: string | null;
  tenGod: TenGod | null;
  /** 나에게 이 십신이 하는 역할 문장 */
  tenGodSentence: string | null;
};

/** 초보용 한 줄 — 관찰·일상 톤 */
const STEM_MEANING: Record<string, string> = {
  갑: "큰 나무처럼 시작과 추진을 나타내는 천간이에요.",
  을: "풀·덩굴처럼 유연하게 맞춰 가는 천간이에요.",
  병: "태양처럼 밝히고 넓히는 기운의 천간이에요.",
  정: "촛불처럼 세밀한 온기를 담은 천간이에요.",
  무: "산처럼 중심을 잡는 천간이에요.",
  기: "논밭처럼 돌보고 가꾸는 천간이에요.",
  경: "쇠처럼 결단하고 정리하는 천간이에요.",
  신: "보석처럼 섬세하게 다듬는 천간이에요.",
  임: "큰 물처럼 흘러가고 확장하는 천간이에요.",
  계: "이슬처럼 스며드는 섬세한 천간이에요.",
};

const BRANCH_MEANING: Record<string, string> = {
  자: "밤의 휴식·재정비를 담은 지지예요.",
  축: "묵묵히 쌓아 올리는 리듬의 지지예요.",
  인: "새싹처럼 움직임이 커지는 지지예요.",
  묘: "피어나고 표현하는 기운의 지지예요.",
  진: "정리와 전환이 일어나는 지지예요.",
  사: "불씨처럼 집중이 모이는 지지예요.",
  오: "한낮처럼 드러나고 활동하는 지지예요.",
  미: "익어가며 돌보는 기운의 지지예요.",
  신: "손질·실무가 앞서는 지지예요.",
  유: "결실을 정리하는 기운의 지지예요.",
  술: "저장하고 경계를 두는 지지예요.",
  해: "물결처럼 쉬고 상상하는 지지예요.",
};

/** 나에게 이 십신이 하는 역할 — 짧은 문장 */
const TEN_GOD_ROLE: Record<string, string> = {
  비견: "나와 비슷한 기운이라, 자립·동료·내 페이스와 연결돼요.",
  겁재: "경쟁·추진이 커지는 역할이라, 속도는 내되 과욕만 조심하면 좋아요.",
  식신: "표현·여유·창작을 풀어내는 역할이에요.",
  상관: "날카로운 말·돌파의 역할이라, 톤만 다듬으면 힘이 돼요.",
  편재: "기회와 흐름을 잡는 역할이에요. 한곳에 모으면 더 좋아요.",
  정재: "안정·저축·현실 성과를 쌓는 역할이에요.",
  편관: "압박·책임·규율의 역할이라, 기준을 세우기 좋아요.",
  정관: "질서·신뢰·역할을 지키는 기운이에요.",
  편인: "직관·색다른 공부의 힌트를 주는 역할이에요.",
  정인: "배움·휴식·돌봄으로 기초를 다지는 역할이에요.",
};

const ELEMENT_KO: Record<Element, string> = {
  wood: "나무",
  fire: "불",
  earth: "흙",
  metal: "쇠",
  water: "물",
};

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

function topCounted(map: Map<string, number>, limit: number): PatternTopItem[] {
  return [...map.entries()]
    .filter(([label]) => label.trim().length > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function resolvePatternCharIdentity(
  kind: PatternCharKind,
  key: string
): PatternCharIdentity {
  if (kind === "stem") {
    const hanja = STEMS.find((s) => STEM_META[s]?.ko === key) ?? key;
    const meta = STEM_META[hanja];
    const element = meta?.element;
    const meaningSentence =
      STEM_MEANING[key] ?? `${key}(${hanja})은 하루의 하늘 기운을 나타내는 천간이에요.`;
    return {
      key,
      hanja,
      kind,
      element,
      elementLabel: element
        ? `${ELEMENT_KO[element]}(${ELEMENT_LABELS[element]})`
        : null,
      blurb: meaningSentence,
      meaningSentence,
    };
  }
  const hanja = BRANCHES.find((b) => BRANCH_META[b]?.ko === key) ?? key;
  const meta = BRANCH_META[hanja];
  const element = meta?.element;
  const meaningSentence =
    BRANCH_MEANING[key] ?? `${key}(${hanja})은 하루의 땅 기운을 나타내는 지지예요.`;
  return {
    key,
    hanja,
    kind,
    element,
    elementLabel: element
      ? `${ELEMENT_KO[element]}(${ELEMENT_LABELS[element]})`
      : null,
    blurb: meaningSentence,
    meaningSentence,
    zodiacKo: meta?.zodiacKo,
  };
}

export function tenGodRoleSentence(tenGod: TenGod | null): string | null {
  if (!tenGod) return null;
  const role = TEN_GOD_ROLE[tenGod];
  if (!role) return `나에게는 「${tenGod}」으로 읽혀요.`;
  return `나에게는 「${tenGod}」이에요. ${role}`;
}

export function observationLineFromDelta(
  delta: number | null | undefined
): string | null {
  if (delta == null) return null;
  if (delta >= 0.5) return "평소보다 밝았어요";
  if (delta <= -0.5) return "평소보다 무거웠어요";
  return "평소와 비슷해요";
}

/** 오늘 제외, 앞으로 horizonDays 안 같은 천간/지지 첫 날짜 */
export function findNextPatternCharDate(
  kind: PatternCharKind,
  key: string,
  fromDate = todayDateString(),
  horizonDays = 14
): string | null {
  for (let i = 1; i <= horizonDays; i++) {
    const date = shiftDate(fromDate, i);
    try {
      const { dayPillar } = getPillarsForDate(date);
      const match =
        kind === "stem"
          ? dayPillar.stem.ko === key
          : dayPillar.branch.ko === key;
      if (match) return date;
    } catch {
      /* skip invalid */
    }
  }
  return null;
}

export function tenGodForPatternChar(
  kind: PatternCharKind,
  key: string,
  natalDayStemHanja: string | null | undefined
): TenGod | null {
  if (!natalDayStemHanja || !(natalDayStemHanja in STEM_META)) return null;
  const dayStem = natalDayStemHanja as StemHanja;
  try {
    if (kind === "stem") {
      const hanja = STEMS.find((s) => STEM_META[s]?.ko === key);
      if (!hanja) return null;
      return getTenGod(dayStem, hanja);
    }
    const hanja = BRANCHES.find((b) => BRANCH_META[b]?.ko === key);
    if (!hanja) return null;
    const hidden = getHiddenStemsByBranch(hanja);
    const main =
      hidden.find((s) => s.role === "main") ?? hidden[hidden.length - 1];
    if (!main) return null;
    return getTenGod(dayStem, main.stem);
  } catch {
    return null;
  }
}

export function buildPatternCharDetail(opts: {
  kind: PatternCharKind;
  row: CharacterHappiness;
  entries: JournalEntry[];
  natalDayStemHanja?: string | null;
  recentLimit?: number;
}): PatternCharDetail {
  const {
    kind,
    row,
    entries,
    natalDayStemHanja,
    recentLimit = 5,
  } = opts;
  const identity = resolvePatternCharIdentity(kind, row.key);
  const byDate = latestByDate(entries);
  const matched: JournalEntry[] = [];

  for (const e of byDate.values()) {
    try {
      const { dayPillar } = getPillarsForDate(e.entryDate);
      const ok =
        kind === "stem"
          ? dayPillar.stem.ko === row.key
          : dayPillar.branch.ko === row.key;
      if (ok) matched.push(e);
    } catch {
      /* skip */
    }
  }

  matched.sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  const moodMap = new Map<string, number>();
  const eventMap = new Map<string, number>();
  for (const e of matched) {
    const moods =
      e.moodLabels?.length > 0
        ? e.moodLabels
        : e.moodLabel
          ? [e.moodLabel]
          : [];
    for (const m of moods) {
      moodMap.set(m, (moodMap.get(m) ?? 0) + 1);
    }
    for (const t of e.tags ?? []) {
      const name = getTagName(t.tagCode);
      if (name === "특별한 일 없음") continue;
      eventMap.set(name, (eventMap.get(name) ?? 0) + 1);
    }
  }

  const recentDays: PatternRecentDay[] = matched
    .slice(0, recentLimit)
    .map((entry) => ({
      entryDate: entry.entryDate,
      happiness: dayHappiness(entry),
      entry,
    }));

  const tenGod = tenGodForPatternChar(kind, row.key, natalDayStemHanja);

  return {
    identity,
    row,
    observationLine: observationLineFromDelta(row.deltaFromOverall),
    topMoods: topCounted(moodMap, 3),
    topEvents: topCounted(eventMap, 3),
    recentDays,
    nextDate: findNextPatternCharDate(kind, row.key),
    tenGod,
    tenGodSentence: tenGodRoleSentence(tenGod),
  };
}

export function formatShortDateKo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}/${Number(m[3])}`;
}
