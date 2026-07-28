/**
 * C-3 오늘의 운세
 * - v1(레거시): B + RAG, 5영역×2줄
 * - v2: DailyInsightContext 점수 → LLM은 문장만 (플래그)
 */
import OpenAI from "openai";
import type { BTheme } from "./bTheme";
import type { OpenAiCallStatus } from "./openaiStatus";
import {
  loadTheoryContext,
  theoryUsageRules,
  type TheoryEvidence,
} from "./theoryContext";
import type {
  DailyInsightContext,
  FortuneDomainResult,
} from "./insight/types";
import { scoreFortuneDomains, FORTUNE_SCORE_VERSION } from "./fortune/score";
import { FORTUNE_DOMAIN_TITLES } from "./fortune/domains";
import { validateFortuneText } from "./contentSafety";
import { computeBlendWeights } from "./insight/dynamicWeights";

export type FortuneSection = {
  id: "personality" | "work" | "love" | "health" | "social";
  title: string;
  lines: [string, string];
};

export type TodayFortuneResult = {
  sections: FortuneSection[];
  openAi: OpenAiCallStatus;
  theoryUsed: boolean;
  theoryEvidence: TheoryEvidence[];
};

export type TodayFortuneV2Result = {
  version: "v2";
  overall: FortuneDomainResult;
  domains: FortuneDomainResult[];
  scoringVersion: string;
  openAi: OpenAiCallStatus;
  theoryUsed: boolean;
  theoryEvidence: TheoryEvidence[];
  insight: Pick<
    DailyInsightContext,
    | "eventDate"
    | "dataCutoffAt"
    | "primaryKeyword"
    | "tensionKeyword"
    | "overallConfidence"
    | "priorUniqueDays"
    | "engineVersion"
  >;
};

const TITLES: Record<FortuneSection["id"], string> = {
  personality: "종합 성격",
  work: "직장",
  love: "연애",
  health: "건강",
  social: "대인관계",
};

export function buildFortuneTemplate(b: BTheme): FortuneSection[] {
  const kw = b.keywords.slice(0, 2).join("·") || "균형";
  return [
    {
      id: "personality",
      title: TITLES.personality,
      lines: [
        `오늘은 ${kw} 기운이 성향의 중심에 가깝습니다.`,
        b.plainSummary,
      ],
    },
    {
      id: "work",
      title: TITLES.work,
      lines: [
        "일의 속도를 한 칸만 조절해도 집중이 살아날 수 있어요.",
        "완벽한 결과보다 오늘의 한 걸음 마무리를 우선해보세요.",
      ],
    },
    {
      id: "love",
      title: TITLES.love,
      lines: [
        "마음 거리 조절이 관계의 핵심 키워드입니다.",
        "표현은 짧게, 진심은 분명하게 전해보세요.",
      ],
    },
    {
      id: "health",
      title: TITLES.health,
      lines: [
        "에너지와 회복의 균형을 먼저 살피세요.",
        "무리한 추진보다 호흡과 휴식이 도움이 됩니다.",
      ],
    },
    {
      id: "social",
      title: TITLES.social,
      lines: [
        "사람 사이에서는 비교보다 내 리듬이 중요합니다.",
        `${kw}가 느껴질 때 한 박자 쉬어가도 괜찮아요.`,
      ],
    },
  ];
}

function parseSections(raw: unknown, fallback: FortuneSection[]): FortuneSection[] {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const arr = Array.isArray(obj.sections) ? obj.sections : null;
  if (!arr) return fallback;

  const out: FortuneSection[] = [];
  for (const id of Object.keys(TITLES) as FortuneSection["id"][]) {
    const found = arr.find(
      (s) => s && typeof s === "object" && (s as { id?: string }).id === id
    ) as { lines?: unknown } | undefined;
    const fb = fallback.find((f) => f.id === id)!;
    const lines = Array.isArray(found?.lines)
      ? found!.lines.filter((l): l is string => typeof l === "string").slice(0, 2)
      : [];
    out.push({
      id,
      title: TITLES[id],
      lines: [lines[0] ?? fb.lines[0], lines[1] ?? fb.lines[1]],
    });
  }
  return out.length === 5 ? out : fallback;
}

export async function generateTodayFortune(
  b: BTheme,
  opts?: { ganjiKo?: string | null }
): Promise<TodayFortuneResult> {
  const fallback = buildFortuneTemplate(b);
  const theory = await loadTheoryContext({
    b,
    ganjiKo: opts?.ganjiKo,
    purpose: "fortune",
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      sections: fallback,
      openAi: { kind: "skipped", detail: "no_api_key" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 사주 일기 앱의 '오늘의 운세' 작성자입니다.
규칙:
- 영역 5개: personality, work, love, health, social
- 각 영역 한국어 문장 정확히 2줄
- 건강은 에너지·피로·회복으로만
${theoryUsageRules("fortune")}
JSON: { "sections": [ { "id": "...", "lines": ["...", "..."] } ] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            bTheme: b,
            ganjiKo: opts?.ganjiKo ?? null,
            theoryChunks: theory.chunks,
            requiredIds: Object.keys(TITLES),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        sections: fallback,
        openAi: { kind: "failed", reason: "missing_required" },
        theoryUsed: theory.used,
        theoryEvidence: theory.evidence,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      sections: parseSections(parsed, fallback),
      openAi: { kind: "used" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      sections: fallback,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
    };
  }
}

function applyWordingPatch(
  domains: FortuneDomainResult[],
  raw: unknown
): FortuneDomainResult[] {
  if (!raw || typeof raw !== "object") return domains;
  const arr = Array.isArray((raw as { domains?: unknown }).domains)
    ? ((raw as { domains: unknown[] }).domains)
    : null;
  if (!arr) return domains;

  return domains.map((d) => {
    const found = arr.find(
      (x) =>
        x &&
        typeof x === "object" &&
        (x as { domain?: string }).domain === d.domain
    ) as
      | {
          headline?: string;
          summary?: string;
          opportunity?: string;
          caution?: string;
          action?: string;
        }
      | undefined;
    if (!found) return d;
    return {
      ...d,
      headline:
        typeof found.headline === "string" && found.headline.trim()
          ? found.headline.trim()
          : d.headline,
      summary:
        typeof found.summary === "string" && found.summary.trim()
          ? found.summary.trim()
          : d.summary,
      opportunity:
        typeof found.opportunity === "string" && found.opportunity.trim()
          ? found.opportunity.trim()
          : d.opportunity,
      caution:
        typeof found.caution === "string" && found.caution.trim()
          ? found.caution.trim()
          : d.caution,
      action:
        typeof found.action === "string" && found.action.trim()
          ? found.action.trim()
          : d.action,
    };
  });
}

function sanitizeDomainCopy(
  domain: FortuneDomainResult,
  fallback: FortuneDomainResult
): FortuneDomainResult {
  const fields: Array<keyof Pick<
    FortuneDomainResult,
    "headline" | "summary" | "opportunity" | "caution" | "action"
  >> = ["headline", "summary", "opportunity", "caution", "action"];
  const next = { ...domain };
  for (const key of fields) {
    const check = validateFortuneText(String(next[key] ?? ""));
    if (!check.ok) next[key] = fallback[key];
  }
  return next;
}

/**
 * v2 — 점수·영역·톤은 코드가 결정, LLM은 문장 다듬기만
 */
export async function generateTodayFortuneV2(
  insight: DailyInsightContext,
  opts?: {
    skipLlm?: boolean;
    onboardingCompleted?: boolean;
    totalXp?: number;
  }
): Promise<TodayFortuneV2Result> {
  const scored = scoreFortuneDomains(insight, {
    onboardingCompleted: opts?.onboardingCompleted,
    totalXp: opts?.totalXp,
  });
  const overall = scored.find((d) => d.domain === "overall")!;
  const domains = scored.filter((d) => d.domain !== "overall");

  const insightMeta: TodayFortuneV2Result["insight"] = {
    eventDate: insight.eventDate,
    dataCutoffAt: insight.dataCutoffAt,
    primaryKeyword: insight.primaryKeyword,
    tensionKeyword: insight.tensionKeyword,
    overallConfidence: insight.overallConfidence,
    priorUniqueDays: insight.priorUniqueDays,
    engineVersion: insight.engineVersion,
  };

  if (opts?.skipLlm) {
    return {
      version: "v2",
      overall,
      domains,
      scoringVersion: FORTUNE_SCORE_VERSION,
      openAi: { kind: "skipped", detail: "skip_llm_preview" },
      theoryUsed: false,
      theoryEvidence: [],
      insight: insightMeta,
    };
  }

  const theoryHints = insight.natalDay
    ? [
        ...insight.natalDay.natalDominant,
        insight.natalDay.todayStemGod ?? "",
        insight.natalDay.overallTraitPlain,
        ...Object.values(insight.natalDay.byDomain).flatMap((d) => [
          d.tensionPlain,
          ...d.natalGods,
        ]),
      ].filter(Boolean)
    : [];

  const theory = await loadTheoryContext({
    b: insight.bTheme,
    ganjiKo: insight.ganjiKo,
    purpose: "fortune",
    matchCount: 8,
    extraHints: theoryHints,
  });

  const blend = computeBlendWeights({
    totalXp: opts?.totalXp ?? 0,
    onboardingCompleted: opts?.onboardingCompleted,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      version: "v2",
      overall,
      domains,
      scoringVersion: FORTUNE_SCORE_VERSION,
      openAi: { kind: "skipped", detail: "no_api_key" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
      insight: insightMeta,
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 사주 일기 앱의 '오늘의 운세' 문장 담당입니다.
규칙:
- domain·tone·score·confidence·evidenceCodes는 절대 바꾸지 마세요.
- 영역: overall, work, relationship, finance, health
- overall.summary 는 반드시 쉬운 한국어 문장 3개(각 문장 끝 마침표). 원국의 특유한 성향이 오늘 간지와 만나 어떻게 읽히는지를 학습 이론(theoryChunks)에 근거해 설명.
- 다른 영역: headline 1문장 + summary 1~2문장. 그 테마에 맞는 원국 특징과 오늘 글자를 엮을 것.
- opportunity / caution / action 은 각 1문장, 실천 가능하고 짧게.
- 건강은 에너지·피로·회복으로만. 의료 진단 금지.
- 사용자 문장에 사주 전문용어(십신·재성·인성·원국·대운 등) 금지. 쉬운 말만.
- blendWeights.maturity 가 낮으면 사주×일진 신호를 중심에, 높으면 draft의 개인 키워드·최근 상태를 더 반영.
${theoryUsageRules("fortune")}
JSON: { "domains": [ { "domain": "...", "headline": "...", "summary": "...", "opportunity": "...", "caution": "...", "action": "..." } ] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            titles: FORTUNE_DOMAIN_TITLES,
            blendWeights: {
              recent: blend.recent,
              keyword: blend.keyword,
              natal: blend.natal,
              maturity: blend.maturity,
              tier: blend.tier,
              effectiveXp: blend.effectiveXp,
            },
            natalDay: insight.natalDay
              ? {
                  ganjiKo: insight.natalDay.ganjiKo,
                  overallTraitPlain: insight.natalDay.overallTraitPlain,
                  todayStemGod: insight.natalDay.todayStemGod,
                  relationLabels: insight.natalDay.relationLabels,
                  natalDominant: insight.natalDay.natalDominant,
                  byDomain: Object.fromEntries(
                    Object.entries(insight.natalDay.byDomain).map(([k, v]) => [
                      k,
                      {
                        natalPlain: v.natalPlain,
                        todayPlain: v.todayPlain,
                        tensionKind: v.tensionKind,
                        tensionPlain: v.tensionPlain,
                        keywordLabels: v.keywordLabels,
                      },
                    ])
                  ),
                }
              : null,
            domains: scored.map((d) => ({
              domain: d.domain,
              title: d.title,
              tone: d.tone,
              score: d.score,
              confidence: d.confidence,
              draft: {
                headline: d.headline,
                summary: d.summary,
                opportunity: d.opportunity,
                caution: d.caution,
                action: d.action,
              },
              evidenceCodes: d.evidenceCodes,
            })),
            primaryKeyword: insight.primaryKeyword,
            tensionKeyword: insight.tensionKeyword,
            ganjiKo: insight.ganjiKo,
            priorUniqueDays: insight.priorUniqueDays,
            theoryChunks: theory.chunks,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        version: "v2",
        overall,
        domains,
        scoringVersion: FORTUNE_SCORE_VERSION,
        openAi: { kind: "failed", reason: "missing_required" },
        theoryUsed: theory.used,
        theoryEvidence: theory.evidence,
        insight: insightMeta,
      };
    }
    const patched = applyWordingPatch(scored, JSON.parse(raw)).map((d, i) =>
      sanitizeDomainCopy(d, scored[i]!)
    );
    return {
      version: "v2",
      overall: patched.find((d) => d.domain === "overall")!,
      domains: patched.filter((d) => d.domain !== "overall"),
      scoringVersion: FORTUNE_SCORE_VERSION,
      openAi: { kind: "used" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
      insight: insightMeta,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      version: "v2",
      overall,
      domains,
      scoringVersion: FORTUNE_SCORE_VERSION,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
      insight: insightMeta,
    };
  }
}
