import OpenAI from "openai";
import {
  buildRetrievalQuery,
  parseNarrativeWording,
  sanitizeNarrativeWording,
  type NarrativeFacts,
  type NarrativeSurface,
} from "./schema";
import { matchKnowledgeChunks } from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

function expectedKeys(surface: NarrativeSurface, facts: NarrativeFacts): string[] {
  if (surface === "forecast") {
    return [
      "todaySummary",
      "possibleInnerSignal",
      "neededCondition",
      "emotionForecast",
      "focusForecast",
      "conditionForecast",
      "oneAction",
      "reflectionSentence",
    ];
  }
  if (surface === "today_beginner") {
    return ["headline", ...((facts.sectionDrafts ?? []).map((s) => s.id))];
  }
  // saju_expert / today_expert
  return (facts.sectionDrafts ?? []).map((s) => s.id);
}

function buildSystemPrompt(surface: NarrativeSurface): string {
  return `당신은 사주 해설 문장 작성 도우미입니다.
규칙:
- 사주 계산·통계·십신·합충을 새로 만들지 마세요. 입력 facts와 이론 청크만 사용하세요.
- 심리 진단, 의료 판단, 확정적 미래 예측, 정확도 수치를 쓰지 마세요.
- 건강은 에너지·피로·회복으로만 표현하세요.
- surface=${surface}
- 반드시 JSON 객체만 출력하세요. 키는 요청된 필드만 사용합니다.
- 이론 청크가 있으면 그 관점을 쉬운 말로 반영하되, 청크에 없는 주장을 추가하지 마세요.`;
}

function buildUserPrompt(
  surface: NarrativeSurface,
  facts: NarrativeFacts,
  chunks: string[]
): string {
  const keys = expectedKeys(surface, facts);
  return `다음 구조화 사실과 학습된 사주 이론 청크를 바탕으로 쉬운 한국어 문장 JSON을 만드세요.
필수 키: ${keys.join(", ")}

facts:
${JSON.stringify(facts)}

theoryChunks:
${JSON.stringify(chunks)}

localDraft(참고용 초안, 수치·근거는 유지하고 문장만 다듬으세요):
${JSON.stringify(facts.localDraft ?? facts.sectionDrafts ?? {})}`;
}

export type GroundedResult = {
  wording: Record<string, string>;
  usedRag: boolean;
  chunkCount: number;
};

/**
 * RAG + LLM 해설. 실패 시 null (호출측에서 로컬 템플릿 유지).
 */
export async function generateGroundedWording(input: {
  surface: NarrativeSurface;
  facts: NarrativeFacts;
}): Promise<GroundedResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let chunks: string[] = [];
  let usedRag = false;
  if (isServiceRoleConfigured()) {
    try {
      const query = buildRetrievalQuery(input.facts);
      const matched = await matchKnowledgeChunks(query, 5);
      chunks = matched.map((m) => m.content);
      usedRag = chunks.length > 0;
    } catch {
      chunks = [];
    }
  }

  // 이론이 없어도 localDraft 다듬기는 가능
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(input.surface) },
      {
        role: "user",
        content: buildUserPrompt(input.surface, input.facts, chunks),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const wording = parseNarrativeWording(parsed);
  if (!wording) return null;
  const safe = sanitizeNarrativeWording(wording);
  if (!safe) return null;

  return { wording: safe, usedRag, chunkCount: chunks.length };
}
