/**
 * AI 일기 점수 추출 (활성 카테고리만)
 * 사주 이론은 섞지 않음 — 일기 글만 근거
 */
import OpenAI from "openai";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { EVENT_TAG_CATALOG } from "@/lib/journal/eventTagCatalog";
import { MOOD_OPTIONS, type CategoryCode } from "@/lib/journal/types";
import { isValidAiScore } from "@/lib/journal/finalScore";
import type {
  OpenAiCallStatus,
  OpenAiFailureReason,
} from "@/lib/journal/openaiStatus";

export type AiCategoryScore = {
  score: number | null;
  confidence: number | null;
};

export type AiExtractResult = {
  scores: Partial<Record<CategoryCode, AiCategoryScore>>;
  moodCandidates: string[];
  eventTagCandidates: string[];
  summary: string | null;
  openAi: OpenAiCallStatus;
};

function fail(
  reason: OpenAiFailureReason,
  detail?: string
): AiExtractResult {
  return {
    scores: {},
    moodCandidates: [],
    eventTagCandidates: [],
    summary: null,
    openAi: { kind: "failed", reason, detail },
  };
}

export async function extractJournalScoresWithAi(input: {
  content: string;
  enabledCodes: CategoryCode[];
  moodLabel?: string | null;
  mainEventText?: string | null;
}): Promise<AiExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail("no_api_key", "OPENAI_API_KEY 없음");
  }

  const text = input.content.trim();
  if (!text) {
    return {
      scores: {},
      moodCandidates: [],
      eventTagCandidates: [],
      summary: null,
      openAi: { kind: "skipped", detail: "일기 본문 없음 — AI 추출 생략" },
    };
  }

  const categoryLines = input.enabledCodes
    .map((code) => {
      const c = getCategoryByCode(code);
      return `- ${code}: ${c?.name ?? code} — ${c?.question ?? ""}`;
    })
    .join("\n");

  const tagNames = EVENT_TAG_CATALOG.map((t) => t.name).join(", ");
  const moods = MOOD_OPTIONS.join(", ");

  const system = `당신은 일기 텍스트만으로 사용자의 하루 상태를 1~10점으로 추정합니다.
규칙:
- 활성화된 카테고리에만 점수를 매깁니다.
- 점수는 정수 1~10. 근거가 부족하면 score를 null로 둡니다.
- 사주·운세·미래 예측을 점수에 섞지 마세요. 일기 문장에 드러난 정보만 사용하세요.
- 높을수록 해당 상태가 긍정적인 것으로 정의합니다.
- 반드시 JSON만 출력하세요.`;

  const user = `활성 카테고리:
${categoryLines}

기분 후보: ${moods}
사건 태그 후보(이름): ${tagNames}

${input.moodLabel ? `사용자가 고른 기분 라벨: ${input.moodLabel}\n` : ""}${
    input.mainEventText ? `주요 사건 메모: ${input.mainEventText}\n` : ""
  }
일기:
"""
${text.slice(0, 6000)}
"""

응답 JSON 형식:
{
  "scores": {
    "<category_code>": { "score": 1-10 or null, "confidence": 0-1 }
  },
  "moodCandidates": ["기분라벨", ...],
  "eventTagCandidates": ["태그이름", ...],
  "summary": "한 문장 요약"
}`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("missing_required", "빈 응답");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail("json_parse", raw.slice(0, 200));
    }

    if (!parsed || typeof parsed !== "object") {
      return fail("format_mismatch", "객체가 아님");
    }

    const obj = parsed as Record<string, unknown>;
    const scoresIn =
      obj.scores && typeof obj.scores === "object"
        ? (obj.scores as Record<string, unknown>)
        : {};

    const scores: AiExtractResult["scores"] = {};
    for (const code of input.enabledCodes) {
      const row = scoresIn[code];
      if (!row || typeof row !== "object") {
        scores[code] = { score: null, confidence: null };
        continue;
      }
      const r = row as Record<string, unknown>;
      const score =
        r.score == null ? null : isValidAiScore(Number(r.score)) ? Number(r.score) : null;
      const confidence =
        typeof r.confidence === "number" && Number.isFinite(r.confidence)
          ? Math.max(0, Math.min(1, r.confidence))
          : null;
      scores[code] = { score, confidence };
    }

    const moodCandidates = Array.isArray(obj.moodCandidates)
      ? obj.moodCandidates.filter(
          (m): m is string =>
            typeof m === "string" && (MOOD_OPTIONS as readonly string[]).includes(m)
        )
      : [];

    const nameToCode = new Map(
      EVENT_TAG_CATALOG.map((t) => [t.name, t.tagCode] as const)
    );
    const eventTagCandidates = Array.isArray(obj.eventTagCandidates)
      ? obj.eventTagCandidates
          .filter((n): n is string => typeof n === "string")
          .map((n) => nameToCode.get(n) ?? n)
          .filter((c) => EVENT_TAG_CATALOG.some((t) => t.tagCode === c))
      : [];

    const summary =
      typeof obj.summary === "string" && obj.summary.trim()
        ? obj.summary.trim().slice(0, 280)
        : null;

    return {
      scores,
      moodCandidates,
      eventTagCandidates,
      summary,
      openAi: { kind: "used" },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|ETIMEDOUT|AbortError/i.test(msg)) {
      return fail("timeout", msg);
    }
    if (/network|fetch|ECONN/i.test(msg)) {
      return fail("network", msg);
    }
    if (/safety|content.?filter|refus/i.test(msg)) {
      return fail("safety_filter", msg);
    }
    return fail("request_failed", msg);
  }
}
