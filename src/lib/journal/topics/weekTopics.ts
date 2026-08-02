/**
 * 일기 본문에서 화제(토픽) 추출·주간 집계
 * — 점수/상태값과 독립. content + mainEventText(+태그명)만 사용.
 * — withSupport 시 화제 등장일의 행복도·핵심·선택으로 응원 문구 부착
 */
import type { JournalEntry } from "@/lib/journal/types";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import { TOPIC_LEXICON, type TopicDefinition } from "./lexicon";
import {
  enrichTopicsWithSupport,
  type TopicStateSnapshot,
} from "./topicSupport";

export type TopicMention = {
  topicId: string;
  label: string;
  /** 해당 일 본문에서 맞은 별칭 */
  matchedAliases: string[];
};

export type WeekTopicHit = {
  topicId: string;
  label: string;
  /** 등장한 날짜 수 */
  dayCount: number;
  /** 총 매칭 횟수(별칭 합) */
  mentionCount: number;
  dates: string[];
  /** 정렬용 */
  weight: number;
  /** withSupport일 때 채워짐 */
  supportLine?: string;
  state?: TopicStateSnapshot;
};

export type WeekTopicSummary = {
  from: string;
  to: string;
  entryDays: number;
  topics: WeekTopicHit[];
  /** 한 줄 요약 */
  plainLine: string;
};

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** 한 텍스트에서 토픽별 매칭 */
export function extractTopicsFromText(
  text: string,
  lexicon: TopicDefinition[] = TOPIC_LEXICON
): TopicMention[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const hits: TopicMention[] = [];
  for (const def of lexicon) {
    const matched = def.aliases.filter((a) =>
      normalized.includes(normalizeText(a))
    );
    if (matched.length === 0) continue;
    hits.push({
      topicId: def.id,
      label: def.label,
      matchedAliases: matched,
    });
  }
  return hits;
}

function entryBlob(entry: JournalEntry): string {
  const tagBits = (entry.tags ?? [])
    .map((t) => getTagName(t.tagCode))
    .filter(Boolean)
    .join(" ");
  return [entry.content, entry.mainEventText ?? "", tagBits]
    .filter(Boolean)
    .join("\n");
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * 기준일 포함 최근 `windowDays`일 일기에서 화제 순위.
 * weight = dayCount * 3 + mentionCount (여러 날 반복이 더 중요)
 */
export function buildWeekTopicSummary(
  entries: JournalEntry[],
  opts: {
    asOf: string;
    windowDays?: number;
    topN?: number;
    /** 홈용: 화제 날 상태값으로 응원 문구 생성 */
    withSupport?: boolean;
  }
): WeekTopicSummary {
  const windowDays = opts.windowDays ?? 30;
  const topN = opts.topN ?? 5;
  const to = opts.asOf;
  const from = addDaysIso(to, -(windowDays - 1));

  const inRange = entries.filter(
    (e) => e.entryDate >= from && e.entryDate <= to
  );

  type Acc = {
    label: string;
    dates: Set<string>;
    mentionCount: number;
  };
  const map = new Map<string, Acc>();

  for (const entry of inRange) {
    const mentions = extractTopicsFromText(entryBlob(entry));
    for (const m of mentions) {
      const prev = map.get(m.topicId);
      const bump = m.matchedAliases.length;
      if (prev) {
        prev.dates.add(entry.entryDate);
        prev.mentionCount += bump;
      } else {
        map.set(m.topicId, {
          label: m.label,
          dates: new Set([entry.entryDate]),
          mentionCount: bump,
        });
      }
    }
  }

  let topics: WeekTopicHit[] = [...map.entries()]
    .map(([topicId, acc]) => {
      const dayCount = acc.dates.size;
      const mentionCount = acc.mentionCount;
      return {
        topicId,
        label: acc.label,
        dayCount,
        mentionCount,
        dates: [...acc.dates].sort(),
        weight: dayCount * 3 + mentionCount,
      };
    })
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        b.dayCount - a.dayCount ||
        a.label.localeCompare(b.label, "ko")
    )
    .slice(0, topN);

  if (opts.withSupport && topics.length > 0) {
    topics = enrichTopicsWithSupport(topics, inRange);
  }

  const entryDays = new Set(inRange.map((e) => e.entryDate)).size;
  const plainLine = buildPlainLine(topics, entryDays, windowDays);

  return { from, to, entryDays, topics, plainLine };
}

function buildPlainLine(
  topics: WeekTopicHit[],
  entryDays: number,
  windowDays: number
): string {
  const period =
    windowDays >= 30 ? "지난 30일" : windowDays === 7 ? "이번 주" : `최근 ${windowDays}일`;
  if (entryDays === 0) {
    return `${period} 기록이 아직 없어, 화제를 읽기 어려워요.`;
  }
  if (topics.length === 0) {
    return `${period} 일기에서 반복된 화제는 아직 잘 안 보여요.`;
  }
  const top = topics[0]!;
  if (topics.length === 1) {
    return `${period}에는 「${top.label}」이(가) 등장했어요 (${top.dayCount}일).`;
  }
  const second = topics[1]!;
  return `${period} 화제는 「${top.label}」, 그다음 「${second.label}」이었어요.`;
}
