/**
 * 운세 영역 점수 — 키워드/콘텐츠/사주 prior 결합 (LLM 전 결정)
 *
 * ## 표시 점수 (UI 1.0~10.0)
 * 내부 NormalizedScore(0~1) × 10. 길흉·예언이 아니라 **오늘 흐름의 원활도**.
 * 예: 내부 0.72 → UI 7.2
 *
 * ## 영역 점수 공식 (클램프 0~1)
 * ```
 * score =
 *   recentPart * w.recent   // 최근 일기·체크인 카테고리 평균(1~10→0~1). 없으면 kw
 * + kw.score   * w.keyword  // 키워드 현저성→valence (결핍 키워드는 점수↓)
 * + natal      * w.natal    // 원국×오늘 일진 natalScore (없으면 합성 prior)
 * - uncertaintyPenalty      // (1−confidence)×0.08 + (기록일<3 → 0.04)
 * - repetitionPenalty       // 영역·키워드 단일 반복 시 0.03
 * ```
 *
 * ## 가중치 w (resolveGatedBlend)
 * XP·온보딩으로 기본 비중 후, **유일 기록 일수**로 기록(recent+keyword) 상한:
 * - 0~6일 시동: 기록 ≤15% (사주 ~85%)
 * - 7~13일: ≤35% · 14~27일: ≤55% · 28일+: XP 곡선 그대로
 * → 초반엔 사주(또는 합성 prior)가 크고, 일기가 쌓일수록 기록 반영↑.
 *
 * ## natalScore
 * - **원국 있음** (0.18~0.88): 십신 가족 support≈0.66 / tension≈0.40~0.46 / neutral≈0.50
 *   + 합+0.055 · 충−0.07 · 해−0.05 · 형−0.04 · 파−0.03 · 영역 천간 정렬 +0.02~0.06
 * - **원국 없음**: 최근 카테고리를 약하게 따라가는 합성 prior (0.36~0.64, 중심 0.5)
 *   — 시동 구간 natal 비중이 커도 점수가 전부 0.5 근처로 평탄화되지 않게 함
 *
 * ## 흐름 라벨 (flow) / 톤 (tone)
 * - flow: 최고≥0.80 · 좋음≥0.64 · 무난≥0.48 · 아쉬움≥0.34 · 그 외 주의
 * - tone: supportive≥0.60 · caution≤0.45 · 그 외 balanced
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
  type BlendWeights,
} from "@/lib/journal/insight/dynamicWeights";
import { resolveGatedBlend } from "@/lib/journal/insight/recordReflectGate";
import { JOURNAL_SCORE_CENTER } from "@/lib/journal/scoreScale";
import {
  confidenceLabelFromScore,
  flowFromScore,
  reasonTagsFromCodes,
} from "./labels";

export const FORTUNE_SCORE_VERSION = "fortune-score-v2.4.1";

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
  domain: FortuneDomainCode,
  maturity: number
): {
  score: NormalizedScore;
  salience: NormalizedScore;
  codes: string[];
  confidence: number;
} {
  const map = DOMAIN_KEYWORD_MAP[domain];
  const ranked = ctx.topKeywords;
  const natalSig = ctx.natalDay?.byDomain[domain];

  // 개인 키워드 점수 (기존)
  let personalScore: NormalizedScore;
  let personalCodes: string[];
  let personalConf: number;
  let salience: NormalizedScore;

  if (domain === "overall") {
    const top = ranked.slice(0, 3);
    personalCodes = top.map((k) => k.code);
    const raw = avg(top.map((k) => k.score)) ?? 1.5;
    salience = normalizeKeywordStrength(raw);
    personalScore = keywordValence(salience, deficitRatioOf(ctx, top));
    personalConf = top.length ? 0.55 + top.length * 0.05 : 0.25;
  } else {
    const matched = ranked.filter((k) => map.includes(k.code as never));
    if (matched.length === 0) {
      personalScore = 0.5;
      salience = 0.5;
      personalCodes = [];
      personalConf = 0.25;
    } else {
      const raw = avg(matched.map((k) => k.score)) ?? 1.5;
      salience = normalizeKeywordStrength(raw);
      personalScore = keywordValence(salience, deficitRatioOf(ctx, matched));
      personalCodes = matched.map((k) => k.code);
      personalConf = clamp(0.4 + matched.length * 0.08, 0.3, 0.85);
    }
  }

  // 원국×일진 키워드 — 콜드스타트에서 주 신호
  const natalCodes = natalSig?.keywordCodes ?? [];
  const natalScore = natalSig?.natalScore ?? 0.5;
  const t = clamp(maturity, 0, 1);
  const score = clamp(natalScore * (1 - t) + personalScore * t, 0.05, 0.95);

  // 키워드 칩: 사주 비중 높을수록 natal 우선, 데이터 쌓이면 개인 우선
  const codes =
    t < 0.45
      ? [
          ...natalCodes,
          ...personalCodes.filter((c) => !natalCodes.includes(c as never)),
        ].slice(0, 4)
      : [
          ...personalCodes,
          ...natalCodes.filter((c) => !personalCodes.includes(c)),
        ].slice(0, 4);

  // natal만 있고 personal 비면 natal로 채움
  const finalCodes =
    codes.length > 0
      ? codes
      : natalCodes.length > 0
        ? natalCodes.slice(0, 4)
        : domain === "overall"
          ? ranked.slice(0, 3).map((k) => k.code)
          : (DOMAIN_KEYWORD_MAP[domain] ?? []).slice(0, 3);

  return {
    score,
    salience,
    codes: finalCodes,
    confidence: clamp(
      personalConf * t + (natalSig ? 0.7 : 0.3) * (1 - t),
      0.25,
      0.9
    ),
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
  const sig = ctx.natalDay?.byDomain[domain];
  if (sig) return sig.natalScore;

  // 원국 없음: 시동 구간 natal 비중(~85%)이어도 점수가 한곳에 몰리지 않도록
  // 최근 카테고리를 약하게 따라가는 합성 prior (중심 0.5, 폭 ±0.14)
  const recent = categoryScoreForDomain(ctx, domain);
  const base = recent != null ? clamp(0.5 + (recent - 0.5) * 0.4, 0.36, 0.64) : 0.5;

  const hints = ctx.natalPrior.focusHints.map((h) => h.toLowerCase());
  const w = ctx.natalPrior.sajuWeight;
  if (domain === "overall") return base;
  if (domain === "work" && hints.some((h) => h.includes("work") || h.includes("focus"))) {
    return clamp(base + 0.02 + w * 0.06, 0.36, 0.68);
  }
  if (
    (domain === "relationships" || domain === "love") &&
    hints.some((h) => h.includes("relation") || h.includes("social"))
  ) {
    return clamp(base + 0.02 + w * 0.06, 0.36, 0.68);
  }
  if (domain === "health" && hints.some((h) => h.includes("recover") || h.includes("energy"))) {
    return clamp(base + 0.02 + w * 0.06, 0.36, 0.68);
  }
  if (domain === "money" && hints.some((h) => h.includes("change") || h.includes("money"))) {
    return clamp(base + w * 0.05, 0.36, 0.66);
  }
  return base;
}

function toneFromScore(score: number): FortuneDomainResult["tone"] {
  if (score >= 0.6) return "supportive";
  if (score <= 0.45) return "caution";
  return "balanced";
}

function packCopy(
  headline: string,
  interpretation: string,
  opportunity: string,
  caution: string,
  action: string
): Pick<
  FortuneDomainResult,
  "headline" | "interpretation" | "summary" | "opportunity" | "caution" | "action"
> {
  return {
    headline,
    interpretation,
    summary: interpretation,
    opportunity,
    caution,
    action,
  };
}

function templateCopy(
  domain: FortuneDomainCode,
  tone: FortuneDomainResult["tone"],
  ctx: DailyInsightContext
): Pick<
  FortuneDomainResult,
  "headline" | "interpretation" | "summary" | "opportunity" | "caution" | "action"
> {
  const sig = ctx.natalDay?.byDomain[domain];
  const pk = ctx.primaryKeyword ?? sig?.keywordLabels[0] ?? "균형";
  const tk = ctx.tensionKeyword ?? sig?.keywordLabels[1] ?? "리듬";
  const titles = FORTUNE_DOMAIN_TITLES;
  const tension = sig?.tensionPlain;

  if (domain === "overall") {
    const trait =
      ctx.natalDay?.overallTraitPlain ??
      ctx.bTheme.plainSummary ??
      "오늘의 흐름을 차분히 읽어 보세요.";
    const dayLine = tension
      ? tension
      : `오늘은 ${pk}와 ${tk} 사이, 중간 속도가 핵심입니다.`;
    if (tone === "supportive") {
      return packCopy(
        `${pk} 흐름이 오늘의 중심입니다`,
        `${trait} ${dayLine} 작은 선택을 밀고 나가기 좋은 날입니다.`,
        `${pk}를 하루의 기준으로 두면 선택이 가벼워집니다.`,
        `${tk}와 충돌할 때는 속도를 한 칸만 낮추세요.`,
        "오늘 할 일 중 하나를 짧게 마무리해보세요."
      );
    }
    if (tone === "caution") {
      return packCopy(
        `${tk} 신호를 살피며 리듬을 조절할 날`,
        `${trait} ${dayLine} 무리한 확장보다 정리가 유리합니다.`,
        "작은 정리가 다음날 여유를 만듭니다.",
        "감정·피로가 겹치면 결정은 내일로 미뤄도 됩니다.",
        "오늘은 목록을 줄이고 한 가지만 끝내보세요."
      );
    }
    return packCopy(
      `${pk}와 ${tk} 사이, 균형이 핵심`,
      `${trait} ${dayLine}`,
      "중간 속도가 가장 오래 갑니다.",
      "한쪽으로 치우치면 피로가 먼저 옵니다.",
      "오전·오후 리듬을 짧게 나눠 보세요."
    );
  }

  if (domain === "love") {
    if (tone === "supportive") {
      return packCopy(
        "친밀한 거리에서 표현이 부드러워질 수 있어요",
        `오늘은 마음을 나누기 쉬운 흐름이 있습니다. ${pk} 신호를 짧게라도 전하면 관계가 한결 편해질 수 있습니다.`,
        "짧은 안부나 고마움 표현이 도움이 됩니다.",
        "기대를 한꺼번에 키우기보다 상대의 리듬을 함께 보세요.",
        "오늘은 짧은 진심 한마디를 전해보세요."
      );
    }
    if (tone === "caution") {
      return packCopy(
        "감정 속도와 거리를 조절할 날",
        `친밀한 관계에서는 ${tk} 신호가 먼저 느껴질 수 있습니다. 확정적 결정보다 속도 조절이 도움이 됩니다.`,
        "오해를 줄이려면 한 번 정리한 뒤 말해보세요.",
        "이별·만남을 단정하지 말고, 표현의 톤만 조절하세요.",
        "오늘은 답장·대화를 서두르지 말고 호흡을 맞춰보세요."
      );
    }
    return packCopy(
      "친밀감과 자기 경계의 균형을 살피세요",
      `연애·친밀 관계에서는 ${pk}와 ${tk}를 함께 보는 편이 좋습니다. 상태를 가정하지 않고 오늘의 태도에 집중하세요.`,
      "개방성과 경계를 함께 챙기세요.",
      "상대의 반응을 과하게 해석하지 마세요.",
      "오늘은 듣고 싶은 말 대신, 전하고 싶은 말 하나만 고르세요."
    );
  }

  if (domain === "relationships") {
    if (tone === "supportive") {
      return packCopy(
        "말투와 협력이 하루의 관계를 가볍게 만듭니다",
        `대인관계에서는 ${pk} 신호가 비교적 유리합니다. 경청과 역할 분담이 오늘 특히 도움이 될 수 있습니다.`,
        "짧은 확인 대화가 협업을 매끄럽게 합니다.",
        "비교나 과한 자기주장은 피하세요.",
        "오늘은 상대 말을 한 번 더 확인하고 답해보세요."
      );
    }
    if (tone === "caution") {
      return packCopy(
        "거리 조절과 반응 속도가 중요한 날",
        `관계 피로가 쌓이기 쉬운 흐름입니다. ${tk} 신호를 살피며 말의 속도와 거리를 조절하세요.`,
        "혼자 쉬는 짧은 틈이 관계를 지켜줍니다.",
        "싸움이나 절교를 예단하지 말고, 반응만 늦춰보세요.",
        "오늘은 즉답 대신 한 호흡 뒤 답장을 해보세요."
      );
    }
    return packCopy(
      "경청과 자기주장의 중간을 고르세요",
      `대인관계에서는 ${pk}와 ${tk}가 함께 나타납니다. 역할과 예의를 지키면서도 필요한 말은 분명히 하세요.`,
      "중간 거리의 대화가 가장 오래 갑니다.",
      "감정적으로 밀어붙이면 소모가 큽니다.",
      "오늘은 할 말 하나를 짧게 정리해 전하세요."
    );
  }

  const label = titles[domain];
  if (sig && tension) {
    const kw = sig.keywordLabels.slice(0, 2).join("·") || pk;
    if (sig.tensionKind === "support") {
      return packCopy(
        `${label}, ${kw} 쪽이 힘을 받습니다`,
        tension,
        "작은 진전을 쌓기 좋은 타이밍입니다.",
        "과신은 피하고 페이스를 지키세요.",
        `${label}에서 오늘 끝낼 한 가지를 고르세요.`
      );
    }
    if (sig.tensionKind === "tension") {
      return packCopy(
        `${label}, ${kw} 사이에서 속도를 고르세요`,
        tension,
        "정리와 점검이 기회를 만듭니다.",
        "한쪽으로만 밀면 소모가 큽니다.",
        `${label}에서 부담 하나를 줄여보세요.`
      );
    }
    return packCopy(
      `${label}, ${kw}를 함께 보세요`,
      tension,
      "중간 선택이 결과를 안정시킵니다.",
      "극단적 결정은 피하세요.",
      `${label}에서 오늘 할 일을 하나만 정하세요.`
    );
  }

  if (tone === "supportive") {
    return packCopy(
      `${label}, ${pk}가 힘을 보탭니다`,
      `${label}에서는 ${pk} 신호가 비교적 유리합니다.`,
      "작은 진전을 쌓기 좋은 타이밍입니다.",
      "과신은 피하고 페이스를 지키세요.",
      `${label}에서 오늘 끝낼 한 가지를 고르세요.`
    );
  }
  if (tone === "caution") {
    return packCopy(
      `${label}, 속도를 낮추면 더 안전합니다`,
      `${label}에서는 ${tk} 신호를 먼저 살피는 편이 낫습니다.`,
      "정리와 점검이 기회를 만듭니다.",
      "감정적으로 밀어붙이면 소모가 큽니다.",
      `${label}에서 부담 하나를 줄여보세요.`
    );
  }
  return packCopy(
    `${label}, 균형 잡힌 접근이 유리합니다`,
    `${label}에서는 ${pk}와 ${tk}를 함께 보세요.`,
    "중간 선택이 결과를 안정시킵니다.",
    "극단적 결정은 피하세요.",
    `${label}에서 오늘 할 일을 하나만 정하세요.`
  );
}

export type FortuneScoreOptions = {
  /** 온보딩 6문항 완료 여부 — 콜드스타트 개인 신호 보정 */
  onboardingCompleted?: boolean;
  /** 누적 journal XP — 맞춤도(운세 비중) 계산 */
  totalXp?: number;
  /** 테스트·실험용 가중치 강제 지정 */
  weights?: BlendWeights;
};

export function scoreFortuneDomains(
  ctx: DailyInsightContext,
  opts: FortuneScoreOptions = {}
): FortuneDomainResult[] {
  // XP 비중 + 유일 기록 일수 게이트
  const w =
    opts.weights ??
    resolveGatedBlend({
      totalXp: opts.totalXp ?? 0,
      onboardingCompleted: opts.onboardingCompleted,
      priorUniqueDays: ctx.priorUniqueDays ?? 0,
    });

  const scored = FORTUNE_DOMAIN_ORDER.map((domain) => {
    const kw = keywordScoreForDomain(ctx, domain, w.maturity);
    const cat = categoryScoreForDomain(ctx, domain);
    const natal = natalBoost(ctx, domain);

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
    const rounded = Math.round(score * 100) / 100;
    const conf = Math.round(confidence * 100) / 100;

    return {
      domain,
      title: FORTUNE_DOMAIN_TITLES[domain],
      tone,
      flow: flowFromScore(rounded),
      score: rounded,
      confidence: conf,
      confidenceLabel: confidenceLabelFromScore(conf),
      ...copy,
      evidenceCodes: kw.codes.slice(0, 4),
      reasonTags: reasonTagsFromCodes(kw.codes),
    };
  });

  // Phase A: 연애 점수는 대인관계와 동일 축(문장만 분리)
  const rel = scored.find((d) => d.domain === "relationships");
  const loveIdx = scored.findIndex((d) => d.domain === "love");
  if (rel && loveIdx >= 0) {
    const love = scored[loveIdx]!;
    scored[loveIdx] = {
      ...love,
      score: rel.score,
      tone: rel.tone,
      flow: rel.flow,
      confidence: rel.confidence,
      confidenceLabel: rel.confidenceLabel,
    };
  }

  return scored;
}
