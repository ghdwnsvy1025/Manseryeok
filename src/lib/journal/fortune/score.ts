/**
 * 운세 영역 점수 — 키워드/콘텐츠/사주 prior 결합 (LLM 전 결정)
 *
 * 스케일 계약:
 * - TenPointScore: 사용자/최근 상태 1~10 (또는 0~10 호환)
 * - NormalizedScore: 운세 결합용 0~1
 * - 키워드 rank 점수는 상대 강도로 soft-normalize 후 사용
 */
import type { DailyInsightContext, FortuneDomainResult } from "@/lib/journal/insight/types";
import type { FortuneDomainCode } from "@/lib/journal/insight/types";
import type { CategoryCode } from "@/lib/journal/types";
import {
  DOMAIN_CATEGORY_HINTS,
  DOMAIN_KEYWORD_MAP,
  FORTUNE_DOMAIN_ORDER,
  FORTUNE_DOMAIN_TITLES,
} from "./domains";
import {
  computeBlendWeights,
  type BlendWeights,
} from "@/lib/journal/insight/dynamicWeights";
import { JOURNAL_SCORE_CENTER } from "@/lib/journal/scoreScale";

export const FORTUNE_SCORE_VERSION = "fortune-score-v1.2.0";

/** 1~10(또는 0~10) 사용자/최근 상태 점수 */
export type TenPointScore = number;
/** 운세 엔진 내부·출력용 0~1 */
export type NormalizedScore = number;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** TenPointScore → NormalizedScore (종합운·영역 동일 계약) */
export function normalizeTenPointScore(value: TenPointScore): NormalizedScore {
  return clamp(value / 10, 0, 1);
}

/**
 * 키워드 rank 누적 점수를 0~1로 안정화.
 * 절대 clamp(≥1→1)만 쓰면 대부분 포화되므로 soft normalize.
 */
export function normalizeKeywordStrength(raw: number): NormalizedScore {
  if (!Number.isFinite(raw) || raw <= 0) return 0.35;
  // 대략 0~6+ 범위의 bump 합을 0.25~0.95로 매핑
  return clamp(0.25 + (1 - Math.exp(-raw / 3)) * 0.7, 0.2, 0.95);
}

/**
 * 키워드 랭킹 점수는 "지금 다뤄야 할 주제"의 현저성(salience)이지 긍정도가 아니다.
 * 최근 상태가 낮아 올라온 키워드(low_recent)는 결핍 신호이므로 운세 점수에
 * 그대로 더하면 안 되고 뒤집어서 반영해야 한다.
 */
function keywordValence(
  strength: NormalizedScore,
  deficitRatio: number
): NormalizedScore {
  const d = clamp(deficitRatio, 0, 1);
  return clamp(strength * (1 - d) + (1 - strength) * d, 0.05, 0.95);
}

/**
 * 결핍 강도 0~1 — 단순히 "낮음"으로 잡혔는지가 아니라 얼마나 낮은지로 계산.
 * 중립점(JOURNAL_SCORE_CENTER=5.5)에서 1점까지를 0→1로 매핑한다.
 */
function deficitRatioOf(
  ctx: DailyInsightContext,
  scores: Array<{ reasons: string[] }>
): number {
  if (scores.length === 0) return 0;
  const span = JOURNAL_SCORE_CENTER - 1;
  let total = 0;
  for (const k of scores) {
    const cats = k.reasons
      .filter((r) => r.startsWith("low_recent:"))
      .map((r) => r.slice("low_recent:".length) as CategoryCode);
    if (cats.length === 0) continue;
    const depths: number[] = [];
    for (const c of cats) {
      const v = ctx.recentState.contentScoreByCategory[c];
      if (typeof v !== "number") continue;
      depths.push(clamp((JOURNAL_SCORE_CENTER - v) / span, 0, 1));
    }
    total += avg(depths) ?? 0;
  }
  return clamp(total / scores.length, 0, 1);
}

function keywordScoreForDomain(
  ctx: DailyInsightContext,
  domain: FortuneDomainCode
): {
  score: NormalizedScore;
  salience: NormalizedScore;
  codes: string[];
  confidence: number;
} {
  const map = DOMAIN_KEYWORD_MAP[domain];
  const ranked = ctx.topKeywords;
  if (domain === "overall") {
    const top = ranked.slice(0, 3);
    const codes = top.map((k) => k.code);
    const raw = avg(top.map((k) => k.score)) ?? 1.5;
    const salience = normalizeKeywordStrength(raw);
    return {
      score: keywordValence(salience, deficitRatioOf(ctx, top)),
      salience,
      codes,
      confidence: top.length ? 0.55 + top.length * 0.05 : 0.25,
    };
  }
  const matched = ranked.filter((k) => map.includes(k.code as never));
  if (matched.length === 0) {
    return { score: 0.5, salience: 0.5, codes: [], confidence: 0.25 };
  }
  const raw = avg(matched.map((k) => k.score)) ?? 1.5;
  const salience = normalizeKeywordStrength(raw);
  return {
    score: keywordValence(salience, deficitRatioOf(ctx, matched)),
    salience,
    codes: matched.map((k) => k.code),
    confidence: clamp(0.4 + matched.length * 0.08, 0.3, 0.85),
  };
}

function categoryScoreForDomain(
  ctx: DailyInsightContext,
  domain: FortuneDomainCode
): NormalizedScore | null {
  const hints = DOMAIN_CATEGORY_HINTS[domain] as CategoryCode[];
  if (hints.length === 0) {
    const overall = ctx.recentState.recentAOverall;
    return typeof overall === "number" ? normalizeTenPointScore(overall) : null;
  }
  const vals: number[] = [];
  for (const h of hints) {
    const v = ctx.recentState.contentScoreByCategory[h];
    if (typeof v === "number") vals.push(normalizeTenPointScore(v));
  }
  return avg(vals);
}

function natalBoost(ctx: DailyInsightContext, domain: FortuneDomainCode): number {
  const hints = ctx.natalPrior.focusHints.map((h) => h.toLowerCase());
  const w = ctx.natalPrior.sajuWeight;
  if (domain === "overall") return 0.5 + w * 0.1;
  if (domain === "work" && hints.some((h) => h.includes("work") || h.includes("focus"))) {
    return 0.55 + w * 0.15;
  }
  if (
    domain === "relationship" &&
    hints.some((h) => h.includes("relation") || h.includes("social"))
  ) {
    return 0.55 + w * 0.15;
  }
  if (domain === "health" && hints.some((h) => h.includes("recover") || h.includes("energy"))) {
    return 0.55 + w * 0.15;
  }
  if (domain === "finance" && hints.some((h) => h.includes("change") || h.includes("money"))) {
    return 0.52 + w * 0.12;
  }
  return 0.5;
}

function toneFromScore(score: number): FortuneDomainResult["tone"] {
  if (score >= 0.62) return "supportive";
  if (score <= 0.42) return "caution";
  return "balanced";
}

function templateCopy(
  domain: FortuneDomainCode,
  tone: FortuneDomainResult["tone"],
  ctx: DailyInsightContext
): Pick<
  FortuneDomainResult,
  "headline" | "summary" | "opportunity" | "caution" | "action"
> {
  const pk = ctx.primaryKeyword ?? "균형";
  const tk = ctx.tensionKeyword ?? "리듬";
  const titles = FORTUNE_DOMAIN_TITLES;

  if (domain === "overall") {
    if (tone === "supportive") {
      return {
        headline: `${pk} 흐름이 오늘의 중심입니다`,
        summary: `최근 ${pk} 신호가 비교적 안정적입니다. ${ctx.bTheme.plainSummary}`,
        opportunity: `${pk}를 하루의 기준으로 두면 선택이 가벼워집니다.`,
        caution: `${tk}와 충돌할 때는 속도를 한 칸만 낮추세요.`,
        action: "오늘 할 일 중 하나를 짧게 마무리해보세요.",
      };
    }
    if (tone === "caution") {
      return {
        headline: `${tk} 신호를 살피며 리듬을 조절할 날`,
        summary: `최근 ${pk}와 ${tk}가 함께 보입니다. 무리한 확장보다 정리가 유리합니다.`,
        opportunity: "작은 정리가 다음날 여유를 만듭니다.",
        caution: "감정·피로가 겹치면 결정은 내일로 미뤄도 됩니다.",
        action: "오늘은 목록을 줄이고 한 가지만 끝내보세요.",
      };
    }
    return {
      headline: `${pk}와 ${tk} 사이, 균형이 핵심`,
      summary: `오늘은 ${pk}를 중심에 두고 ${tk}를 보조 신호로 보세요. ${ctx.bTheme.plainSummary}`,
      opportunity: "중간 속도가 가장 오래 갑니다.",
      caution: "한쪽으로 치우치면 피로가 먼저 옵니다.",
      action: "오전·오후 리듬을 짧게 나눠 보세요.",
    };
  }

  const label = titles[domain];
  if (tone === "supportive") {
    return {
      headline: `${label}, ${pk}가 힘을 보탭니다`,
      summary: `${label}에서는 ${pk} 신호가 비교적 유리합니다.`,
      opportunity: "작은 진전을 쌓기 좋은 타이밍입니다.",
      caution: "과신은 피하고 페이스를 지키세요.",
      action: `${label}에서 오늘 끝낼 한 가지를 고르세요.`,
    };
  }
  if (tone === "caution") {
    return {
      headline: `${label}, 속도를 낮추면 더 안전합니다`,
      summary: `${label}에서는 ${tk} 신호를 먼저 살피는 편이 낫습니다.`,
      opportunity: "정리와 점검이 기회를 만듭니다.",
      caution: "감정적으로 밀어붙이면 소모가 큽니다.",
      action: `${label}에서 부담 하나를 줄여보세요.`,
    };
  }
  return {
    headline: `${label}, 균형 잡힌 접근이 유리합니다`,
    summary: `${label}에서는 ${pk}와 ${tk}를 함께 보세요.`,
    opportunity: "중간 선택이 결과를 안정시킵니다.",
    caution: "극단적 결정은 피하세요.",
    action: `${label}에서 오늘 할 일을 하나만 정하세요.`,
  };
}

export type FortuneScoreOptions = {
  /** 온보딩 6문항 완료 여부 — 콜드스타트 개인 신호 보정 */
  onboardingCompleted?: boolean;
  /** 테스트·실험용 가중치 강제 지정 */
  weights?: BlendWeights;
};

export function scoreFortuneDomains(
  ctx: DailyInsightContext,
  opts: FortuneScoreOptions = {}
): FortuneDomainResult[] {
  // 데이터량 기반 동적 가중치: 기록이 없으면 사주 prior 비중이 크고,
  // 기록이 쌓일수록 최근 상태(개인 데이터) 비중이 커진다.
  const w =
    opts.weights ??
    computeBlendWeights({
      priorUniqueDays: ctx.priorUniqueDays,
      onboardingCompleted: opts.onboardingCompleted,
    });

  return FORTUNE_DOMAIN_ORDER.map((domain) => {
    const kw = keywordScoreForDomain(ctx, domain);
    const cat = categoryScoreForDomain(ctx, domain);
    const natal = natalBoost(ctx, domain);

    // - 불확실성 패널티: 표본/신뢰도 낮으면 감점
    // - 반복 패널티: 동일 primary 키워드만 반복되면 소폭 감점(다양성)
    const recentPart = cat ?? kw.score;
    const confidence = clamp(
      (kw.confidence + ctx.overallConfidence + (cat != null ? 0.1 : 0)) / 2,
      0.2,
      0.9
    );
    const uncertaintyPenalty =
      (1 - confidence) * 0.08 + (ctx.priorUniqueDays < 3 ? 0.04 : 0);
    const repetitionPenalty =
      domain !== "overall" &&
      ctx.primaryKeyword &&
      kw.codes.length === 1 &&
      ctx.topKeywords[0]?.code === kw.codes[0]
        ? 0.03
        : 0;
    const score = clamp(
      recentPart * w.recent +
        kw.score * w.keyword +
        natal * w.natal -
        uncertaintyPenalty -
        repetitionPenalty,
      0,
      1
    );
    const tone = toneFromScore(score);
    const copy = templateCopy(domain, tone, ctx);

    return {
      domain,
      title: FORTUNE_DOMAIN_TITLES[domain],
      tone,
      score: Math.round(score * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      ...copy,
      evidenceCodes: kw.codes.slice(0, 4),
    };
  });
}
