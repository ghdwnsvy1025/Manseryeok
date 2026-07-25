/**
 * 일기 저장 직후 콘텐츠 선택:
 * 1) 검증 명언 → 2) 앱 오늘의 문장 → 3) 템플릿
 */
import OpenAI from "openai";
import { getTagName } from "./eventTagCatalog";
import type { BTheme } from "./bTheme";
import type { OpenAiCallStatus } from "./openaiStatus";
import type { CategoryCode, JournalEntry } from "./types";
import {
  CONTENT_SAFETY_VERSION,
  validateTodaySentenceText,
} from "./contentSafety";
import { isTooSimilar } from "./contentOverlap";
import {
  inferTemplateTheme,
  pickTemplateSentence,
  SENTENCE_TEMPLATE_VERSION,
} from "./quote/templates";
import { filterSafeQuotes, deriveHardDay } from "./quote/safetyFilter";
import {
  selectBestQuote,
  type QuoteSelectContext,
  type QuoteDeliveryWindow,
} from "./quote/select";
import type { QuoteLibraryItem } from "./quote/types";
import {
  isOriginalDailySentenceEnabled,
  isQuoteRagEnabled,
  isVerifiedQuoteEnabled,
} from "@/lib/app/featureFlags";

export const SENTENCE_PROMPT_VERSION = "today-sentence-prompt-v2.0.0";

export type TodayQuoteInput = {
  b: BTheme;
  entry: JournalEntry;
  recentAOverall: number | null;
  trend: { delta: number | null; direction: "up" | "down" | "flat" | "unknown" };
  aiSummary?: string | null;
  ganjiKo?: string | null;
  primaryKeyword?: string | null;
  tensionKeyword?: string | null;
  fortuneTheme?: string | null;
  recentSentences?: string[];
  quoteCandidates?: QuoteLibraryItem[];
  recentDeliveries?: QuoteDeliveryWindow[];
  /** @deprecated use recentDeliveries */
  recentQuoteIds?: string[];
  /** @deprecated use recentDeliveries */
  recentAuthors?: string[];
};

export type TodayContentDelivery = {
  /** @deprecated */
  quote: string;
  sentence: string;
  contentType:
    | "verified_quote"
    | "app_original_sentence"
    | "fallback_sentence";
  sourceLabel: string;
  authorName: string | null;
  workTitle: string | null;
  attribution: null | {
    authorName: string | null;
    workTitle: string | null;
    sourceLabel: string;
  };
  quoteId: string | null;
  selectionScore: number | null;
  selectionReason: string;
  generationContext: Record<string, unknown>;
  promptVersion: string;
  safetyFilterVersion: string;
  openAi: OpenAiCallStatus;
  theoryUsed: boolean;
  theoryEvidence: [];
};

function moodsOf(entry: JournalEntry): string[] {
  if (entry.moodLabels?.length) return entry.moodLabels;
  return entry.moodLabel ? [entry.moodLabel] : [];
}

function lowestFinal(entry: JournalEntry): {
  code: CategoryCode;
  score: number;
} | null {
  let worst: { code: CategoryCode; score: number } | null = null;
  for (const s of entry.scores) {
    if (s.isNotApplicable || s.finalScore == null) continue;
    if (!worst || s.finalScore < worst.score) {
      worst = { code: s.categoryCode, score: s.finalScore };
    }
  }
  return worst;
}

function detectState(input: TodayQuoteInput) {
  const moods = moodsOf(input.entry);
  const tags = input.entry.tags.map((t) => t.tagCode);
  const low = lowestFinal(input.entry);
  const happiness = input.entry.happinessScore ?? input.entry.overallSatisfaction;
  const energy = input.entry.scores.find((s) => s.categoryCode === "energy");
  const hardDay = deriveHardDay({
    moods,
    eventTags: tags,
    happiness: typeof happiness === "number" ? happiness : null,
    lowEnergyScore: energy?.finalScore ?? low?.score ?? null,
  });
  const goodDay =
    moods.some((m) => ["기쁨", "설렘"].includes(m)) ||
    (typeof happiness === "number" && happiness >= 7);
  const focus = input.entry.scores.find(
    (s) => s.categoryCode === "focus_execution"
  );
  const overload =
    (focus?.finalScore ?? 0) >= 7 && (energy?.finalScore ?? 10) <= 4;
  const discrepancy =
    input.aiSummary &&
    low &&
    typeof happiness === "number" &&
    Math.abs(happiness - low.score) >= 4;
  return { moods, tags, hardDay, goodDay, overload, discrepancy, low, happiness };
}

export function buildTodaySentenceTemplate(input: TodayQuoteInput): string {
  const state = detectState(input);
  const theme = inferTemplateTheme({
    moods: state.moods,
    hardDay: state.hardDay,
    goodDay: state.goodDay,
    overload: state.overload,
    lowEnergy: state.hardDay,
  });
  const seed = [
    input.entry.userId || "anon",
    input.entry.entryDate,
    theme,
    input.primaryKeyword ?? "",
    SENTENCE_TEMPLATE_VERSION,
  ].join("|");
  return pickTemplateSentence(theme, {
    recent: input.recentSentences ?? [],
    seed,
  });
}

function clampSentence(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= 100) return t;
  return t.slice(0, 100).replace(/\s+\S*$/, "").trim();
}

async function generateAppSentence(
  input: TodayQuoteInput,
  state: ReturnType<typeof detectState>,
  fallback: string
): Promise<{ text: string; openAi: OpenAiCallStatus }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: fallback, openAi: { kind: "skipped", detail: "no_api_key" } };
  }

  const tone = state.hardDay
    ? "acknowledge"
    : state.overload
      ? "pace"
      : state.goodDay
        ? "gentle_expand"
        : state.discrepancy
          ? "hold_both"
          : "calm";

  const constraints = [
    "1~2문장, 최대 100자",
    "유명인·책 인용 금지",
    "작가명·출처 표기 금지",
    "사주 전문용어 금지",
    "운명·진단·억지긍정·힘내 금지",
    "명령형 반복 금지",
    "일기 원문 복사 금지",
  ];

  try {
    const client = new OpenAI({ apiKey });
    const attempt = async () => {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `당신은 일기 앱의 '오늘의 문장' 작성자입니다.
역할: 하루를 따뜻하게 닫는 짧은 문장. 조언·훈계 금지.
JSON만: { "sentence": "...", "tone": "...", "themes": ["..."] }`,
          },
          {
            role: "user",
            content: JSON.stringify({
              primary_theme: input.primaryKeyword ?? input.b.keywords[0] ?? null,
              secondary_theme: input.tensionKeyword ?? null,
              fortune_theme: input.fortuneTheme ?? null,
              emotions: state.moods,
              state_summary: {
                happiness: state.happiness,
                hardDay: state.hardDay,
                goodDay: state.goodDay,
                overload: state.overload,
                discrepancy: Boolean(state.discrepancy),
                trend: input.trend.direction,
              },
              event_tags: state.tags.map((t) => getTagName(t)),
              diary_features: (input.aiSummary ?? "").slice(0, 180),
              tone,
              recent_sentences: (input.recentSentences ?? []).slice(0, 5),
              constraints,
              templateHint: fallback,
            }),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { sentence?: string };
      if (typeof parsed.sentence !== "string" || !parsed.sentence.trim()) {
        return null;
      }
      return clampSentence(parsed.sentence);
    };

    let text = await attempt();
    const recent = input.recentSentences ?? [];
    if (
      text &&
      (!validateTodaySentenceText(text).ok || isTooSimilar(text, recent))
    ) {
      text = await attempt();
    }
    if (
      !text ||
      !validateTodaySentenceText(text).ok ||
      isTooSimilar(text, recent)
    ) {
      return {
        text: fallback,
        openAi: { kind: "failed", reason: "quality_rejected" },
      };
    }
    return { text, openAi: { kind: "used" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      text: fallback,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
    };
  }
}

export async function generateTodayQuote(
  input: TodayQuoteInput
): Promise<TodayContentDelivery> {
  const state = detectState(input);
  const generationContext = {
    primaryKeyword: input.primaryKeyword ?? null,
    secondaryKeyword: input.tensionKeyword ?? null,
    fortuneTheme: input.fortuneTheme ?? null,
    dominantEmotions: state.moods,
    eventTags: state.tags,
    stateSummary: {
      happiness: state.happiness,
      hardDay: state.hardDay,
      goodDay: state.goodDay,
      overload: state.overload,
      discrepancy: Boolean(state.discrepancy),
      recentAOverall: input.recentAOverall,
      trend: input.trend.direction,
    },
  };

  const baseMeta = {
    promptVersion: SENTENCE_PROMPT_VERSION,
    safetyFilterVersion: CONTENT_SAFETY_VERSION,
    theoryUsed: false as const,
    theoryEvidence: [] as [],
  };

  // 1) 검증 명언
  if (isVerifiedQuoteEnabled() && isQuoteRagEnabled()) {
    const safe = filterSafeQuotes(input.quoteCandidates ?? [], {
      hardDay: state.hardDay,
      moods: state.moods,
      eventTags: state.tags,
      dominantStates: state.moods,
    });
    const legacyDeliveries: QuoteDeliveryWindow[] = [
      ...(input.recentDeliveries ?? []),
      ...(input.recentQuoteIds ?? []).map((id) => ({
        quoteId: id,
        authorName: null,
        sourceKey: null,
        deliveredAt: input.entry.entryDate,
        eventDate: input.entry.entryDate,
      })),
      ...(input.recentAuthors ?? []).map((author) => ({
        quoteId: null,
        authorName: author,
        sourceKey: null,
        deliveredAt: input.entry.entryDate,
        eventDate: input.entry.entryDate,
      })),
    ];
    const ctx: QuoteSelectContext = {
      primaryKeyword: input.primaryKeyword,
      tensionKeyword: input.tensionKeyword,
      fortuneTheme: input.fortuneTheme,
      moods: state.moods,
      tags: state.tags,
      hardDay: state.hardDay,
      asOfDate: input.entry.entryDate,
      recentDeliveries: legacyDeliveries,
    };
    const best = selectBestQuote(safe, ctx);
    if (best) {
      const q = best.quote;
      const sourceLabel = [q.authorName, q.workTitle].filter(Boolean).join(" · ") ||
        "검증된 명언";
      return {
        quote: q.quoteTextKo,
        sentence: q.quoteTextKo,
        contentType: "verified_quote",
        sourceLabel,
        authorName: q.authorName,
        workTitle: q.workTitle,
        attribution: {
          authorName: q.authorName,
          workTitle: q.workTitle,
          sourceLabel,
        },
        quoteId: q.id,
        selectionScore: best.score,
        selectionReason: "verified_quote_selected",
        generationContext,
        openAi: { kind: "skipped", detail: "quote_library" },
        ...baseMeta,
      };
    }
  }

  // 2) 앱 오늘의 문장
  const fallback = buildTodaySentenceTemplate(input);
  if (isOriginalDailySentenceEnabled()) {
    const gen = await generateAppSentence(input, state, fallback);
    const usedFallback = gen.text === fallback;
    return {
      quote: gen.text,
      sentence: gen.text,
      contentType: usedFallback ? "fallback_sentence" : "app_original_sentence",
      sourceLabel: usedFallback
        ? "검수된 템플릿"
        : "앱이 건넨 문장",
      authorName: null,
      workTitle: null,
      attribution: null,
      quoteId: null,
      selectionScore: null,
      selectionReason: usedFallback
        ? `template:${SENTENCE_TEMPLATE_VERSION}`
        : "app_original_sentence",
      generationContext,
      openAi: gen.openAi,
      ...baseMeta,
    };
  }

  // 3) 템플릿만
  return {
    quote: fallback,
    sentence: fallback,
    contentType: "fallback_sentence",
    sourceLabel: "검수된 템플릿",
    authorName: null,
    workTitle: null,
    attribution: null,
    quoteId: null,
    selectionScore: null,
    selectionReason: `template:${SENTENCE_TEMPLATE_VERSION}`,
    generationContext,
    openAi: { kind: "skipped", detail: "flag_off" },
    ...baseMeta,
  };
}

/** @deprecated buildTodaySentenceTemplate 사용 */
export const buildQuoteTemplate = buildTodaySentenceTemplate;
