/**
 * 질문 피드백 → 키워드 편향 학습 (로컬 + 서버 공통 순수 로직)
 * fit_good / led_to_write → 가산, fit_bad → 감산
 */
import {
  KEYWORD_CATALOG,
  isKeywordCode,
  type KeywordCode,
} from "./catalog";

export type KeywordBiasMap = Partial<Record<KeywordCode, number>>;

export const KEYWORD_BIAS_MIN = -3;
export const KEYWORD_BIAS_MAX = 3;

const WEIGHTS: Record<string, number> = {
  fit_good: 0.8,
  fit_bad: -1.0,
  led_to_write: 0.35,
  shown: 0,
  skipped: -0.15,
  dismissed: -0.25,
};

function clampBias(v: number): number {
  return Math.max(
    KEYWORD_BIAS_MIN,
    Math.min(KEYWORD_BIAS_MAX, Math.round(v * 100) / 100)
  );
}

export function resolveKeywordCodes(
  labelsOrCodes: string[]
): KeywordCode[] {
  const out: KeywordCode[] = [];
  for (const raw of labelsOrCodes) {
    if (isKeywordCode(raw)) {
      out.push(raw);
      continue;
    }
    const byLabel = KEYWORD_CATALOG.find((k) => k.plainLabel === raw);
    if (byLabel) out.push(byLabel.code);
  }
  return Array.from(new Set(out));
}

export function applyFeedbackToKeywordBiases(opts: {
  biases: KeywordBiasMap;
  eventType: string;
  keywords: string[];
}): KeywordBiasMap {
  const delta = WEIGHTS[opts.eventType] ?? 0;
  if (delta === 0) return { ...opts.biases };
  const codes = resolveKeywordCodes(opts.keywords);
  if (codes.length === 0) return { ...opts.biases };

  const next: KeywordBiasMap = { ...opts.biases };
  for (const code of codes) {
    next[code] = clampBias((next[code] ?? 0) + delta);
  }
  return next;
}

/** 여러 이벤트 일괄 집계 */
export function aggregateKeywordBiasesFromEvents(
  events: Array<{
    eventType: string;
    keywords?: string[];
    payload?: { keywords?: string[] };
  }>
): KeywordBiasMap {
  let biases: KeywordBiasMap = {};
  for (const e of events) {
    const keywords =
      e.keywords ??
      (Array.isArray(e.payload?.keywords)
        ? e.payload!.keywords!.map(String)
        : []);
    biases = applyFeedbackToKeywordBiases({
      biases,
      eventType: e.eventType,
      keywords,
    });
  }
  return biases;
}

const LOCAL_BIAS_KEY = "manseryeok:keyword-bias:v1";

export function loadLocalKeywordBiases(): KeywordBiasMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_BIAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as KeywordBiasMap;
    const out: KeywordBiasMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isKeywordCode(k) && typeof v === "number") {
        out[k] = clampBias(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLocalKeywordBiases(biases: KeywordBiasMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_BIAS_KEY, JSON.stringify(biases));
  } catch {
    /* ignore */
  }
}

export function recordLocalFeedbackBias(opts: {
  eventType: string;
  keywords: string[];
}): KeywordBiasMap {
  const next = applyFeedbackToKeywordBiases({
    biases: loadLocalKeywordBiases(),
    eventType: opts.eventType,
    keywords: opts.keywords,
  });
  saveLocalKeywordBiases(next);
  return next;
}
