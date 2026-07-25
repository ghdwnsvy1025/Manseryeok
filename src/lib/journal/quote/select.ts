/**
 * QuoteScore — 내부 라이브러리 후보 선택
 * 반복 제한: 동일 명언 180일 / 동일 작가 7일 / 동일 출처 14일
 */
import type { QuoteLibraryItem } from "./types";

export const QUOTE_REPEAT_POLICY = {
  sameQuoteDays: 180,
  sameAuthorDays: 7,
  sameSourceDays: 14,
} as const;

export type QuoteDeliveryWindow = {
  quoteId: string | null;
  authorName: string | null;
  sourceKey: string | null;
  deliveredAt: string;
  eventDate?: string | null;
};

export type QuoteSelectContext = {
  primaryKeyword?: string | null;
  tensionKeyword?: string | null;
  fortuneTheme?: string | null;
  moods: string[];
  tags: string[];
  hardDay: boolean;
  asOfDate: string;
  recentDeliveries: QuoteDeliveryWindow[];
};

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(
    fromIso.length <= 10 ? `${fromIso}T12:00:00+09:00` : fromIso
  );
  const b = Date.parse(
    toIso.length <= 10 ? `${toIso}T12:00:00+09:00` : toIso
  );
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 9999;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function sourceKeyOf(q: QuoteLibraryItem): string | null {
  if (q.sourceUrl) return `url:${q.sourceUrl}`;
  if (q.workTitle) return `work:${q.workTitle}`;
  if (q.publicationInfo) return `pub:${q.publicationInfo}`;
  return null;
}

export function isQuoteBlockedByRepeatPolicy(
  q: QuoteLibraryItem,
  ctx: QuoteSelectContext
): { blocked: boolean; reason?: string } {
  const sourceKey = sourceKeyOf(q);
  for (const d of ctx.recentDeliveries) {
    const day = d.eventDate ?? d.deliveredAt.slice(0, 10);
    const age = daysBetween(day, ctx.asOfDate);
    if (q.id && d.quoteId === q.id && age < QUOTE_REPEAT_POLICY.sameQuoteDays) {
      return { blocked: true, reason: "same_quote_180d" };
    }
    if (
      q.authorName &&
      d.authorName === q.authorName &&
      age < QUOTE_REPEAT_POLICY.sameAuthorDays
    ) {
      return { blocked: true, reason: "same_author_7d" };
    }
    if (
      sourceKey &&
      d.sourceKey === sourceKey &&
      age < QUOTE_REPEAT_POLICY.sameSourceDays
    ) {
      return { blocked: true, reason: "same_source_14d" };
    }
  }
  return { blocked: false };
}

function themeFit(q: QuoteLibraryItem, ctx: QuoteSelectContext): number {
  const keys = [ctx.primaryKeyword, ctx.tensionKeyword, ctx.fortuneTheme]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  if (keys.length === 0) return 0.5;
  const blob = [...q.themes, q.quoteTextKo].join(" ").toLowerCase();
  const hits = keys.filter((k) => blob.includes(k)).length;
  return Math.min(1, hits / keys.length + (q.similarity ?? 0) * 0.3);
}

function stateFit(q: QuoteLibraryItem, ctx: QuoteSelectContext): number {
  const states = [...ctx.moods, ...ctx.tags];
  if (states.length === 0) return 0.5;
  const suit = q.suitableStates.filter((s) =>
    states.some((st) => st.includes(s) || s.includes(st))
  ).length;
  const unsuit = q.unsuitableStates.filter((s) => {
    if (s === "hard_day") return false;
    return states.some((st) => st.includes(s) || s.includes(st));
  }).length;
  return Math.max(0, Math.min(1, 0.4 + suit * 0.2 - unsuit * 0.35));
}

function toneFit(q: QuoteLibraryItem, ctx: QuoteSelectContext): number {
  if (!ctx.hardDay) return 0.6;
  const soft = q.emotionalTone.some((t) =>
    /인정|동행|위로|차분|회복/.test(t)
  );
  return soft ? 0.85 : 0.35;
}

export function scoreQuote(
  q: QuoteLibraryItem,
  ctx: QuoteSelectContext
): number {
  const blocked = isQuoteBlockedByRepeatPolicy(q, ctx);
  if (blocked.blocked) return -1;

  const topic = themeFit(q, ctx);
  const state = stateFit(q, ctx);
  const tone = toneFit(q, ctx);
  const link =
    (ctx.primaryKeyword &&
      q.quoteTextKo.includes(ctx.primaryKeyword)) ||
    (ctx.fortuneTheme && q.quoteTextKo.includes(ctx.fortuneTheme))
      ? 0.8
      : 0.4;
  const trust = Math.max(0, Math.min(1, q.attributionConfidence));

  let score =
    topic * 0.3 +
    state * 0.25 +
    tone * 0.15 +
    link * 0.1 +
    trust * 0.1 +
    0.1;

  if (ctx.hardDay && /모든\s*것|마음먹기|긍정/.test(q.quoteTextKo)) {
    score -= 0.35;
  }
  return Math.round(score * 1000) / 1000;
}

export function selectBestQuote(
  candidates: QuoteLibraryItem[],
  ctx: QuoteSelectContext
): { quote: QuoteLibraryItem; score: number } | null {
  if (candidates.length === 0) return null;
  let best: { quote: QuoteLibraryItem; score: number } | null = null;
  for (const q of candidates) {
    const score = scoreQuote(q, ctx);
    if (score < 0) continue;
    if (!best || score > best.score) best = { quote: q, score };
  }
  if (!best || best.score < 0.35) return null;
  return best;
}
