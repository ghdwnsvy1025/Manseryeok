/**
 * C-3 오늘의 운세
 * - v1(레거시): B + RAG, 5영역×2줄
 * - v2: 고정 이론 digest + RAG 보조 · 사주 서술 우선 · 코드 점수는 보조
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
  FortunePresentationMeta,
} from "./insight/types";
import { scoreFortuneDomains, FORTUNE_SCORE_VERSION } from "./fortune/score";
import { FORTUNE_DOMAIN_TITLES } from "./fortune/domains";
import { validateFortuneText } from "./contentSafety";
import {
  mixRatioPayload,
  resolveGatedBlend,
} from "./insight/recordReflectGate";
import { PERSONALIZED_FORTUNE_SYSTEM_PROMPT } from "./fortune/personalizedPrompt";
import {
  buildFortunePresentationMeta,
  buildDataQuality,
  syncDomainCopyFields,
} from "./fortune/labels";
import type { FortuneFlow, FortuneConfidenceLabel } from "./insight/types";
import {
  FORTUNE_THEORY_DIGEST,
  FORTUNE_THEORY_DIGEST_VERSION,
  fortuneTheoryDigestAvailable,
} from "./fortune/theoryDigest";
import { buildFortuneLuckMaterials } from "./fortune/luckMaterials";
import { buildFortuneSpecificityHints } from "./fortune/specificityHints";
import { buildNatalSignatures } from "./fortune/natalSignatures";
import { buildDayStructureBrief } from "./fortune/dayStructureBrief";
import { buildFortuneAnalysisFacts } from "./fortune/analysisFacts";
import type { SajuProfile } from "@/lib/diary/types";

const FLOW_SET = new Set<FortuneFlow>(["원활", "안정", "혼합", "관리"]);
const CONF_SET = new Set<FortuneConfidenceLabel>(["높음", "보통", "낮음"]);

function parseFlow(raw: unknown): FortuneFlow | null {
  return typeof raw === "string" && FLOW_SET.has(raw as FortuneFlow)
    ? (raw as FortuneFlow)
    : null;
}

function parseConfidenceLabel(raw: unknown): FortuneConfidenceLabel | null {
  return typeof raw === "string" &&
    CONF_SET.has(raw as FortuneConfidenceLabel)
    ? (raw as FortuneConfidenceLabel)
    : null;
}

function toneFromFlow(flow: FortuneFlow): FortuneDomainResult["tone"] {
  if (flow === "원활") return "supportive";
  if (flow === "관리") return "caution";
  return "balanced";
}

function parseReasonTags(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const tags = raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, 4);
  return tags.length > 0 ? tags : fallback;
}

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
  presentation: FortunePresentationMeta;
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
): {
  domains: FortuneDomainResult[];
  metaOverrides: Partial<
    Pick<
      FortunePresentationMeta,
      | "dailyTheme"
      | "todayFocus"
      | "todayAvoid"
      | "luckyRoutine"
      | "signatureEcho"
    >
  >;
} {
  if (!raw || typeof raw !== "object") {
    return { domains, metaOverrides: {} };
  }
  const root = raw as Record<string, unknown>;
  const arr = Array.isArray(root.domains) ? root.domains : null;
  if (!arr) return { domains, metaOverrides: {} };

  const patched = domains.map((d) => {
    const found = arr.find(
      (x) =>
        x &&
        typeof x === "object" &&
        (x as { domain?: string }).domain === d.domain
    ) as
      | {
          headline?: string;
          interpretation?: string;
          summary?: string;
          caution?: string;
          action?: string;
          flow?: string;
          confidenceLabel?: string;
          reason_tags?: unknown;
        }
      | undefined;
    if (!found) return d;
    const interpretationRaw =
      (typeof found.interpretation === "string" && found.interpretation.trim()) ||
      (typeof found.summary === "string" && found.summary.trim()) ||
      d.interpretation;
    const flow = parseFlow(found.flow) ?? d.flow;
    const confidenceLabel =
      parseConfidenceLabel(found.confidenceLabel) ?? d.confidenceLabel;
    return syncDomainCopyFields({
      ...d,
      flow,
      tone: toneFromFlow(flow),
      confidenceLabel,
      reasonTags: parseReasonTags(found.reason_tags, d.reasonTags),
      headline:
        typeof found.headline === "string" && found.headline.trim()
          ? found.headline.trim()
          : d.headline,
      interpretation: interpretationRaw,
      summary: interpretationRaw,
      caution:
        typeof found.caution === "string" && found.caution.trim()
          ? found.caution.trim()
          : d.caution,
      action:
        typeof found.action === "string" && found.action.trim()
          ? found.action.trim()
          : d.action,
    });
  });

  const pick = (k: string) =>
    typeof root[k] === "string" && String(root[k]).trim()
      ? String(root[k]).trim()
      : undefined;

  return {
    domains: patched,
    metaOverrides: {
      dailyTheme: pick("daily_theme"),
      todayFocus: pick("today_focus"),
      todayAvoid: pick("today_avoid"),
      luckyRoutine: pick("lucky_routine"),
      signatureEcho: pick("signature_echo"),
    },
  };
}

function sanitizeDomainCopy(
  domain: FortuneDomainResult,
  fallback: FortuneDomainResult
): FortuneDomainResult {
  const fields: Array<
    keyof Pick<
      FortuneDomainResult,
      "headline" | "interpretation" | "summary" | "opportunity" | "caution" | "action"
    >
  > = [
    "headline",
    "interpretation",
    "summary",
    "opportunity",
    "caution",
    "action",
  ];
  const next = { ...domain };
  for (const key of fields) {
    const check = validateFortuneText(String(next[key] ?? ""));
    if (!check.ok) next[key] = fallback[key];
  }
  return syncDomainCopyFields(next);
}

function buildV2Base(
  insight: DailyInsightContext,
  scored: FortuneDomainResult[],
  openAi: OpenAiCallStatus,
  theory: { used: boolean; evidence: TheoryEvidence[] },
  metaOverrides?: Partial<
    Pick<
      FortunePresentationMeta,
      | "dailyTheme"
      | "todayFocus"
      | "todayAvoid"
      | "luckyRoutine"
      | "signatureEcho"
    >
  >
): TodayFortuneV2Result {
  const overall = scored.find((d) => d.domain === "overall")!;
  const domains = scored.filter((d) => d.domain !== "overall");
  const health = scored.find((d) => d.domain === "health");
  return {
    version: "v2",
    overall,
    domains,
    scoringVersion: FORTUNE_SCORE_VERSION,
    openAi,
    theoryUsed: theory.used,
    theoryEvidence: theory.evidence,
    insight: {
      eventDate: insight.eventDate,
      dataCutoffAt: insight.dataCutoffAt,
      primaryKeyword: insight.primaryKeyword,
      tensionKeyword: insight.tensionKeyword,
      overallConfidence: insight.overallConfidence,
      priorUniqueDays: insight.priorUniqueDays,
      engineVersion: insight.engineVersion,
    },
    presentation: buildFortunePresentationMeta(
      insight,
      overall,
      health,
      metaOverrides
    ),
  };
}

/**
 * v2 — 원국 특징 + 오늘 일진 구조 잠금 → 영역별 3~5줄.
 */
export async function generateTodayFortuneV2(
  insight: DailyInsightContext,
  opts?: {
    skipLlm?: boolean;
    onboardingCompleted?: boolean;
    totalXp?: number;
    sajuProfile?: SajuProfile | null;
  }
): Promise<TodayFortuneV2Result> {
  const scored = scoreFortuneDomains(insight, {
    onboardingCompleted: opts?.onboardingCompleted,
    totalXp: opts?.totalXp,
  });

  const digestOn = fortuneTheoryDigestAvailable();
  const natalSignatures = buildNatalSignatures(
    opts?.sajuProfile ?? null,
    insight.natalDay
  );

  if (opts?.skipLlm) {
    return buildV2Base(insight, scored, { kind: "skipped", detail: "skip_llm_preview" }, {
      used: digestOn,
      evidence: [],
    });
  }

  // RAG는 가볍게 (속도·다양성 — 원국·일진 구조가 본체)
  const theory = await loadTheoryContext({
    b: insight.bTheme,
    ganjiKo: insight.ganjiKo,
    purpose: "fortune",
    matchCount: 3,
    extraHints: [
      ...natalSignatures.map((t) => t.title),
      insight.natalDay?.overallTraitPlain ?? "",
      insight.natalDay?.todayStemGod ?? "",
    ].filter(Boolean),
  });

  const luckMaterials = buildFortuneLuckMaterials(
    insight.eventDate,
    opts?.sajuProfile ?? null
  );
  const dayStructureBrief = buildDayStructureBrief(
    insight.eventDate,
    opts?.sajuProfile ?? null,
    insight.natalDay,
    luckMaterials
  );
  const analysisFacts = buildFortuneAnalysisFacts({
    profile: opts?.sajuProfile ?? null,
    natalDay: insight.natalDay,
    luck: luckMaterials,
    dayBrief: dayStructureBrief,
  });
  const specificityHints = buildFortuneSpecificityHints(
    insight.natalDay,
    opts?.sajuProfile ?? null
  );

  const theoryEvidence: TheoryEvidence[] = [
    ...natalSignatures.map((t, i) => ({
      content: `[원국특징] ${t.title}: ${t.body}`,
      similarity: 1,
      chunkIndex: -(i + 1),
    })),
    ...(dayStructureBrief
      ? [
          {
            content: `[오늘구조] ${dayStructureBrief.dayContrast}`,
            similarity: 1,
            chunkIndex: -10,
          },
        ]
      : []),
    ...(analysisFacts
      ? [
          {
            content: `[분석압축] ${analysisFacts.compressed.todaySummary.coreFeatures.join(" · ")}`,
            similarity: 1,
            chunkIndex: -11,
          },
        ]
      : []),
    ...theory.evidence,
  ];
  const theoryUsed = true;

  const blend = resolveGatedBlend({
    totalXp: opts?.totalXp ?? 0,
    onboardingCompleted: opts?.onboardingCompleted,
    priorUniqueDays: insight.priorUniqueDays ?? 0,
  });
  const mixRatio = mixRatioPayload(blend);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildV2Base(
      insight,
      scored,
      { kind: "skipped", detail: "no_api_key" },
      { used: theoryUsed, evidence: theoryEvidence }
    );
  }

  const day = opts?.sajuProfile?.pillars?.day;
  const natalMaterialsLite = {
    dayMaster: day
      ? {
          ganjiKo: day.ganjiKo,
          stemHanja: day.stemHanja,
          branchHanja: day.branchHanja,
        }
      : null,
    natalDay: insight.natalDay
      ? {
          ganjiKo: insight.natalDay.ganjiKo,
          overallTraitPlain: insight.natalDay.overallTraitPlain,
          todayStemGod: insight.natalDay.todayStemGod,
          relationLabels: insight.natalDay.relationLabels,
          natalDominant: insight.natalDay.natalDominant,
          byDomain: Object.fromEntries(
            Object.entries(insight.natalDay.byDomain)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [
                k,
                {
                  natalPlain: v.natalPlain,
                  todayPlain: v.todayPlain,
                  tensionKind: v.tensionKind,
                  tensionPlain: v.tensionPlain,
                },
              ])
          ),
        }
      : null,
  };

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.72,
      max_tokens: 3600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${PERSONALIZED_FORTUNE_SYSTEM_PROMPT}\n${theoryUsageRules("fortune")}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            date: insight.eventDate,
            timezone: insight.timezone,
            today_ganji: insight.ganjiKo,
            titles: FORTUNE_DOMAIN_TITLES,
            data_quality: buildDataQuality(insight),
            /** 사람 잠금 */
            natalSignatures,
            natalSignatureVersion: "natal-signature-v1.1.0",
            /** 날짜 잠금 — 날마다 갈라지는 본체 */
            dayStructureBrief,
            /** 4계층 분석 사실 — 문장 전에 코드로 고정 */
            analysisFacts: analysisFacts
              ? {
                  version: analysisFacts.version,
                  calculationMode: analysisFacts.calculationMode,
                  dayMasterKo: analysisFacts.dayMasterKo,
                  compressed: analysisFacts.compressed,
                  natalFeatures: analysisFacts.natalFeatures,
                  todayFeatures: analysisFacts.todayFeatures,
                  interactions: analysisFacts.interactions,
                  categoryEvidence: analysisFacts.categoryEvidence,
                }
              : null,
            natalMaterials: natalMaterialsLite,
            luckMaterials,
            specificityHints,
            diaryAssist: {
              hasEnoughRecords: (insight.priorUniqueDays ?? 0) >= 7,
              priorUniqueDays: insight.priorUniqueDays,
              contentScoreByCategory: insight.recentState.contentScoreByCategory,
              recentAOverall: insight.recentState.recentAOverall,
              confidence: insight.recentState.confidence,
              primaryKeyword: insight.primaryKeyword,
              tensionKeyword: insight.tensionKeyword,
            },
            auxiliaryScores: scored.map((d) => ({
              domain: d.domain,
              title: d.title,
              codeFlowHint: d.flow,
              codeScore: d.score,
              codeConfidence: d.confidence,
            })),
            mixRatio,
            blendWeights: {
              recent: blend.recent,
              keyword: blend.keyword,
              natal: blend.natal,
              maturity: blend.maturity,
              tier: blend.tier,
            },
            fixedTheoryDigestBrief: digestOn
              ? FORTUNE_THEORY_DIGEST.slice(0, 3500)
              : null,
            fixedTheoryDigestVersion: digestOn
              ? FORTUNE_THEORY_DIGEST_VERSION
              : null,
            theoryAssistChunks: theory.chunks.slice(0, 3),
            instruction:
              "analysisFacts.compressed로 사람·오늘을 잠그고 categoryEvidence로 영역별 근거만 골라, 6영역 각 3~5문장으로 풀어라. domainHooks 반영 필수. 없는 합·충·십신을 만들지 말 것. 만능 문장 금지. 전문용어는 생활어로 번역.",
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return buildV2Base(
        insight,
        scored,
        { kind: "failed", reason: "missing_required" },
        { used: theoryUsed, evidence: theoryEvidence }
      );
    }
    const { domains: patchedDomains, metaOverrides } = applyWordingPatch(
      scored,
      JSON.parse(raw)
    );
    const sanitized = patchedDomains.map((d, i) =>
      sanitizeDomainCopy(d, scored[i]!)
    );
    const withTheoryGuard = digestOn
      ? sanitized
      : sanitized.map((d) =>
          d.confidenceLabel === "높음"
            ? { ...d, confidenceLabel: "낮음" as const }
            : d
        );
    return buildV2Base(
      insight,
      withTheoryGuard,
      { kind: "used" },
      { used: theoryUsed, evidence: theoryEvidence },
      metaOverrides
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return buildV2Base(
      insight,
      scored,
      { kind: "failed", reason: "request_failed", detail: msg },
      { used: theoryUsed, evidence: theoryEvidence }
    );
  }
}
