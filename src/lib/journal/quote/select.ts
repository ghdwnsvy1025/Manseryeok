/**
 * 일기·기분에 맞춘 명언 점수 — 조언성·상태 적합을 강화.
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
  /** 0~10 행복도 */
  happiness?: number | null;
  /** 낮은 카테고리 이름들 (예: 에너지, 관계) */
  lowCategories?: string[];
  /** AI 한줄 요약 일부 */
  diaryHint?: string | null;
  asOfDate: string;
  recentDeliveries: QuoteDeliveryWindow[];
  /**
   * 오늘 천간·지지·간지 일기 통계에서 뽑은 일상어 테마
   * (글자 자체는 넣지 않음). off면 빈 배열.
   */
  pillarThemes?: string[];
  /** hint=약하게 / apply=본격 반영 / off=무시 */
  pillarMode?: "off" | "hint" | "apply";
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
  const keys = [
    ctx.primaryKeyword,
    ctx.tensionKeyword,
    ctx.fortuneTheme,
    ...(ctx.lowCategories ?? []),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  const pillarKeys = (ctx.pillarThemes ?? [])
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  const pillarMode = ctx.pillarMode ?? "off";
  const pillarWeight =
    pillarMode === "apply" ? 0.35 : pillarMode === "hint" ? 0.18 : 0;

  if (keys.length === 0 && pillarKeys.length === 0) return 0.45;

  const blob = [...q.themes, q.quoteTextKo].join(" ").toLowerCase();
  const baseHits =
    keys.length === 0
      ? 0
      : keys.filter((k) => blob.includes(k)).length / Math.max(1, keys.length);
  const pillarHits =
    pillarKeys.length === 0
      ? 0
      : pillarKeys.filter((k) => blob.includes(k)).length /
        Math.max(1, pillarKeys.length);

  const base =
    keys.length === 0
      ? 0.4
      : Math.min(1, baseHits + (q.similarity ?? 0) * 0.25);
  return Math.min(1, base * (1 - pillarWeight) + pillarHits * pillarWeight + (q.similarity ?? 0) * 0.08);
}

function stateFit(q: QuoteLibraryItem, ctx: QuoteSelectContext): number {
  const states = [...ctx.moods, ...ctx.tags];
  if (states.length === 0 && ctx.happiness == null) return 0.45;
  const suit = q.suitableStates.filter((s) =>
    states.some((st) => st.includes(s) || s.includes(st))
  ).length;
  const unsuit = q.unsuitableStates.filter((s) => {
    if (s === "hard_day") return false;
    return states.some((st) => st.includes(s) || s.includes(st));
  }).length;
  let score = 0.35 + suit * 0.22 - unsuit * 0.35;
  if (typeof ctx.happiness === "number") {
    if (ctx.happiness <= 3 && /위로|인정|동행|회복|차분/.test(q.emotionalTone.join(" "))) {
      score += 0.15;
    }
    if (ctx.happiness >= 8 && /격려|활기|성장|실행/.test(q.emotionalTone.join(" "))) {
      score += 0.1;
    }
  }
  return Math.max(0, Math.min(1, score));
}

function toneFit(q: QuoteLibraryItem, ctx: QuoteSelectContext): number {
  if (!ctx.hardDay) return 0.55;
  const soft = q.emotionalTone.some((t) =>
    /인정|동행|위로|차분|회복/.test(t)
  );
  return soft ? 0.9 : 0.3;
}

/** 조언으로 쓸 만한지 — 단정·독설보다 성찰·방향 */
function adviceFit(q: QuoteLibraryItem, ctx: QuoteSelectContext): number {
  const text = q.quoteTextKo;
  let score = 0.5;
  if (text.length >= 18 && text.length <= 90) score += 0.12;
  if (/다\.|라\.|니\.|까\?|지다\.|한다\./.test(text)) score += 0.08;
  if (/반드시|무조건|절대|실패|바보|쓸모없/.test(text)) score -= 0.25;
  if (ctx.diaryHint) {
    const hint = ctx.diaryHint.toLowerCase();
    const tokens = hint
      .split(/[\s,·./]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 8);
    const hits = tokens.filter((t) => text.includes(t)).length;
    score += Math.min(0.2, hits * 0.05);
  }
  return Math.max(0, Math.min(1, score));
}

function priorityBoost(q: QuoteLibraryItem): number {
  const st = q.sourceType ?? "";
  if (st.startsWith("verified_classic")) return 0.12;
  if (st === "ai_aphorism_deferred") return -0.08;
  return 0;
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
  const advice = adviceFit(q, ctx);
  const link =
    (ctx.primaryKeyword &&
      q.quoteTextKo.includes(ctx.primaryKeyword)) ||
    (ctx.fortuneTheme && q.quoteTextKo.includes(ctx.fortuneTheme))
      ? 0.75
      : 0.35;
  const trust = Math.max(0, Math.min(1, q.attributionConfidence));

  let score =
    topic * 0.22 +
    state * 0.28 +
    tone * 0.14 +
    advice * 0.16 +
    link * 0.08 +
    trust * 0.08 +
    0.04 +
    priorityBoost(q);

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
  if (!best || best.score < 0.32) return null;
  return best;
}

/** 출처 한 줄만 — 작가 · 작품 (중복 금지) */
export function formatQuoteAttribution(opts: {
  authorName?: string | null;
  workTitle?: string | null;
  fallback?: string;
}): string {
  const author = opts.authorName?.trim() || null;
  const work = opts.workTitle?.trim() || null;
  if (author && work && author !== work) return `${author} · ${work}`;
  if (author) return author;
  if (work) return work;
  return opts.fallback ?? "고전 명언";
}
