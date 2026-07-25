import {
  DOMAIN_POOL_CODES,
  MAX_DAILY_DOMAINS,
  TAG_DOMAIN_HINTS,
  type DomainCode,
} from "./catalog";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

export type DomainSelectionContext = {
  tagCodes: string[];
  /** 최근 일기 (이상 징후·텍스트·미질문 경과일) */
  recentEntries?: JournalEntry[];
  /** 도메인별 마지막 질문/입력일 YYYY-MM-DD */
  lastAskedByDomain?: Partial<Record<DomainCode, string>>;
  /** 사용자 개인 중요도 0~1 */
  personalImportance?: Partial<Record<DomainCode, number>>;
  /** 모델 불확실성 0~1 */
  modelUncertainty?: Partial<Record<DomainCode, number>>;
  /** 기준일 (기본: 오늘 로컬) */
  asOfDate?: string;
  /** 일기 본문에서 추출한 언급 힌트 */
  diaryMentionCodes?: DomainCode[];
};

export type DomainPriorityBreakdown = {
  domain: DomainCode;
  total: number;
  anomaly: number;
  eventLink: number;
  diaryMention: number;
  daysSinceAsked: number;
  uncertainty: number;
  personalImportance: number;
};

const EVENT_WEIGHT = 40;
const ANOMALY_WEIGHT = 35;
const DIARY_WEIGHT = 25;
const DAYS_SINCE_WEIGHT = 20;
const UNCERTAINTY_WEIGHT = 15;
const PERSONAL_WEIGHT = 10;

const DIARY_KEYWORDS: Array<{ domain: DomainCode; patterns: RegExp[] }> = [
  {
    domain: "recovery_sleep",
    patterns: [/수면/, /잠/, /피곤/, /지침/, /회복/, /불면/],
  },
  {
    domain: "relationship",
    patterns: [/관계/, /연애/, /갈등/, /친구/, /가족/, /사람/],
  },
  {
    domain: "finance_resource",
    patterns: [/돈/, /지출/, /소비/, /월급/, /재정/, /카드/],
  },
  {
    domain: "work_study",
    patterns: [/일/, /업무/, /공부/, /야근/, /프로젝트/, /시험/],
  },
  {
    domain: "change_opportunity",
    patterns: [/변화/, /이사/, /이직/, /시작/, /기회/],
  },
];

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T12:00:00+09:00`);
  const b = Date.parse(`${toIso}T12:00:00+09:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function recentAnomalyScore(
  domain: DomainCode,
  entries: JournalEntry[]
): number {
  const categoryHint: Partial<Record<DomainCode, CategoryCode>> = {
    recovery_sleep: "recovery_sleep",
    work_study: "work_study",
    relationship: "relationship",
    finance_resource: "finance_resource",
    change_opportunity: "change_opportunity",
  };
  const code = categoryHint[domain];
  if (!code || entries.length === 0) return 0;

  const recent = entries.slice(0, 14);
  let lowCount = 0;
  let samples = 0;
  for (const e of recent) {
    const row = e.scores.find((s) => s.categoryCode === code);
    const v = row?.finalScore ?? row?.userScore;
    if (typeof v !== "number") continue;
    samples += 1;
    if (v <= 4) lowCount += 1;
  }
  if (samples === 0) return 0;
  return (lowCount / samples) * ANOMALY_WEIGHT;
}

function eventLinkScore(domain: DomainCode, tagCodes: string[]): number {
  let hits = 0;
  for (const tag of tagCodes) {
    const hints = TAG_DOMAIN_HINTS[tag] ?? [];
    if (hints.includes(domain)) hits += 1;
  }
  if (hits === 0) return 0;
  return Math.min(EVENT_WEIGHT, hits * (EVENT_WEIGHT / 2));
}

function diaryMentionScore(
  domain: DomainCode,
  entries: JournalEntry[],
  explicit?: DomainCode[]
): number {
  if (explicit?.includes(domain)) return DIARY_WEIGHT;
  const texts = entries
    .slice(0, 7)
    .map((e) => `${e.content ?? ""} ${e.mainEventText ?? ""}`)
    .join("\n");
  if (!texts.trim()) return 0;
  const rule = DIARY_KEYWORDS.find((d) => d.domain === domain);
  if (!rule) return 0;
  const hit = rule.patterns.some((p) => p.test(texts));
  return hit ? DIARY_WEIGHT * 0.8 : 0;
}

function daysSinceAskedScore(
  domain: DomainCode,
  asOfDate: string,
  lastAsked?: Partial<Record<DomainCode, string>>,
  entries?: JournalEntry[]
): number {
  let last = lastAsked?.[domain] ?? null;
  if (!last && entries) {
    for (const e of entries) {
      const hit = e.scores.some(
        (s) =>
          s.categoryCode === domain &&
          !s.isNotApplicable &&
          (s.userScore != null || s.finalScore != null)
      );
      if (hit) {
        last = e.entryDate;
        break;
      }
    }
  }
  if (!last) return DAYS_SINCE_WEIGHT; // 한 번도 안 물음 → 순환 노출
  const days = daysBetween(last, asOfDate);
  if (days >= 21) return DAYS_SINCE_WEIGHT;
  if (days >= 14) return DAYS_SINCE_WEIGHT * 0.75;
  if (days >= 7) return DAYS_SINCE_WEIGHT * 0.5;
  return DAYS_SINCE_WEIGHT * Math.min(1, days / 14);
}

export function scoreDomainPriority(
  domain: DomainCode,
  ctx: DomainSelectionContext
): DomainPriorityBreakdown {
  const entries = ctx.recentEntries ?? [];
  const asOf = ctx.asOfDate ?? new Date().toISOString().slice(0, 10);
  const anomaly = recentAnomalyScore(domain, entries);
  const eventLink = eventLinkScore(domain, ctx.tagCodes);
  const diaryMention = diaryMentionScore(
    domain,
    entries,
    ctx.diaryMentionCodes
  );
  const daysSinceAsked = daysSinceAskedScore(
    domain,
    asOf,
    ctx.lastAskedByDomain,
    entries
  );
  const uncertainty =
    (ctx.modelUncertainty?.[domain] ?? 0) * UNCERTAINTY_WEIGHT;
  const personalImportance =
    (ctx.personalImportance?.[domain] ?? 0) * PERSONAL_WEIGHT;

  const total =
    anomaly +
    eventLink +
    diaryMention +
    daysSinceAsked +
    uncertainty +
    personalImportance;

  return {
    domain,
    total,
    anomaly,
    eventLink,
    diaryMention,
    daysSinceAsked,
    uncertainty,
    personalImportance,
  };
}

/**
 * domainPriority 상위 2개.
 * 동점 시: 1) daysSinceAsked 큰 쪽 2) DOMAIN_POOL_CODES 고정 순서
 * Math.random 사용 금지.
 */
export function selectDailyDomains(
  input: string[] | DomainSelectionContext
): DomainCode[] {
  const ctx: DomainSelectionContext = Array.isArray(input)
    ? { tagCodes: input }
    : input;

  const scored = DOMAIN_POOL_CODES.map((domain) =>
    scoreDomainPriority(domain, ctx)
  );

  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.daysSinceAsked !== a.daysSinceAsked) {
      return b.daysSinceAsked - a.daysSinceAsked;
    }
    return (
      DOMAIN_POOL_CODES.indexOf(a.domain) - DOMAIN_POOL_CODES.indexOf(b.domain)
    );
  });

  return scored.slice(0, MAX_DAILY_DOMAINS).map((s) => s.domain);
}
