/**
 * QuoteScore — 내부 라이브러리 후보 선택
 */
import type { QuoteLibraryItem } from "./types";

export type QuoteSelectContext = {
  primaryKeyword?: string | null;
  tensionKeyword?: string | null;
  fortuneTheme?: string | null;
  moods: string[];
  tags: string[];
  hardDay: boolean;
  recentQuoteIds: string[];
  recentAuthors: string[];
};

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
  const unsuit = q.unsuitableStates.filter((s) =>
    states.some((st) => st.includes(s) || s.includes(st))
  ).length;
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
  const novelty = ctx.recentQuoteIds.includes(q.id)
    ? 0.05
    : ctx.recentAuthors.includes(q.authorName ?? "")
      ? 0.25
      : 0.9;

  let score =
    topic * 0.3 +
    state * 0.25 +
    tone * 0.15 +
    link * 0.1 +
    trust * 0.1 +
    novelty * 0.1;

  if (ctx.hardDay && /모든\s*것|마음먹기|긍정/.test(q.quoteTextKo)) {
    score -= 0.35;
  }
  if (ctx.recentQuoteIds.includes(q.id)) score -= 0.5;
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
    if (!best || score > best.score) best = { quote: q, score };
  }
  if (!best || best.score < 0.35) return null;
  return best;
}
