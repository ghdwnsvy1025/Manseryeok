import { NextRequest } from "next/server";
import OpenAI from "openai";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  countReadyDocuments,
  matchKnowledgeChunks,
} from "@/lib/knowledge/store";
import {
  pickTemplateSentence,
  stableHash,
} from "@/lib/journal/quote/templates";
import {
  classifyAndSanitizeError,
  publicErrorDetail,
} from "@/lib/app/publicErrors";

export const runtime = "nodejs";

type Body = {
  ganjiKo?: string;
  stemKo?: string;
  branchKo?: string;
  tenGod?: string | null;
  relationLabels?: string[];
  sameGanjiCount?: number;
  sameGanjiAvgHappiness?: number | null;
  sameGanjiAvgCondition?: number | null;
  totalEntryDays?: number;
  recentWellbeing?: number | null;
};

function isBody(v: unknown): v is Body {
  return typeof v === "object" && v !== null;
}

function homeTemplateSentence(ganjiKo: string): string {
  const themes = [
    "recovery",
    "stability",
    "emotion",
    "relation",
    "action",
    "achievement",
  ] as const;
  const theme = themes[stableHash(ganjiKo) % themes.length]!;
  return pickTemplateSentence(theme, { seed: `home:${ganjiKo}` });
}

/**
 * 홈 「오늘의 한 문장」
 * - no_theory: admin 학습 이론을 알 수 없음
 * - ok: 감성 한 문장 (이론 필수, 일기 통계는 있으면 보강)
 * - LLM 실패 시에도 템플릿으로 ok 응답 (화면이 깨지지 않음)
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  if (!isBody(body) || typeof body.ganjiKo !== "string") {
    return Response.json({ error: "ganjiKo가 필요합니다." }, { status: 400 });
  }

  const sameGanjiCount = Number(body.sameGanjiCount ?? 0);
  const totalEntryDays = Number(body.totalEntryDays ?? 0);
  const hasDiarySignal =
    sameGanjiCount > 0 ||
    body.sameGanjiAvgHappiness != null ||
    body.recentWellbeing != null;

  let theoryReady = 0;
  let evidence: Array<{
    content: string;
    similarity: number;
    chunkIndex: number;
  }> = [];
  if (!isServiceRoleConfigured()) {
    return Response.json({
      status: "no_theory",
      message: "알 수 없다",
      detail: "학습 서버가 설정되지 않아 학습 내용을 알 수 없습니다.",
      chunkCount: 0,
      sameGanjiCount,
      theoryEvidence: [],
      fallback: null,
    });
  }

  try {
    theoryReady = await countReadyDocuments();
  } catch {
    return Response.json({
      status: "no_theory",
      message: "알 수 없다",
      detail: publicErrorDetail("rag"),
      chunkCount: 0,
      sameGanjiCount,
      theoryEvidence: [],
      fallback: null,
    });
  }

  if (theoryReady <= 0) {
    return Response.json({
      status: "no_theory",
      message: "알 수 없다",
      detail: "Admin에서 학습시킨 사주 이론이 아직 없습니다.",
      chunkCount: 0,
      sameGanjiCount,
      theoryEvidence: [],
      fallback: null,
    });
  }

  try {
    const query = [
      body.ganjiKo,
      body.stemKo,
      body.branchKo,
      body.tenGod,
      ...(body.relationLabels ?? []),
      "오늘 일진 흐름 감정 에너지",
    ]
      .filter(Boolean)
      .join(" ");
    const matched = await matchKnowledgeChunks(query, 5);
    evidence = matched.map((m) => ({
      content: m.content,
      similarity: Math.round(m.similarity * 1000) / 1000,
      chunkIndex: m.chunkIndex,
    }));
  } catch {
    return Response.json({
      status: "no_theory",
      message: "알 수 없다",
      detail: publicErrorDetail("rag"),
      chunkCount: 0,
      sameGanjiCount,
      theoryEvidence: [],
      fallback: "rag_failed",
    });
  }

  if (evidence.length === 0) {
    return Response.json({
      status: "no_theory",
      message: "알 수 없다",
      detail: "오늘 일진에 맞는 학습 내용을 찾지 못했습니다.",
      chunkCount: 0,
      sameGanjiCount,
      theoryEvidence: [],
      fallback: null,
    });
  }

  const chunks = evidence.map((e) => e.content);
  const template = homeTemplateSentence(body.ganjiKo);

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({
      status: "ok",
      message: template,
      detail: publicErrorDetail("llm"),
      chunkCount: chunks.length,
      sameGanjiCount,
      theoryEvidence: evidence.map((item, index) => ({
        ...item,
        title: `근거 ${index + 1}`,
        explanation: item.content,
      })),
      fallback: "template_no_api_key",
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 사주·일기 앱의 문장 작가이자 해설가입니다.
규칙:
1) sentence: 한국어 감성 한 문장 (40~90자). 확정·예언·의료 진단 금지.
2) evidenceExplain: theoryChunks 각각을 일반인이 이해할 수 있는 짧은 문장으로 풀어 쓴 배열.
   - theoryChunks와 같은 길이·같은 순서
   - 각 항목: { "title": "짧은 제목(8자 이내)", "explanation": "2~4문장, 쉬운 말, 오늘 일진과 어떻게 연결되는지" }
   - 원문의 난잡한 목록·기호·전문 용어는 풀어쓰되, 없는 내용을 지어내지 말 것
   - 일기 통계가 있으면 근거 설명에 아주 가볍게만 반영 가능
3) tone: "gentle_good" | "mixed" | "careful"
JSON만 출력:
{ "sentence": "...", "tone": "...", "evidenceExplain": [ { "title": "...", "explanation": "..." } ] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            today: {
              ganjiKo: body.ganjiKo,
              stemKo: body.stemKo,
              branchKo: body.branchKo,
              tenGod: body.tenGod ?? null,
              relationLabels: body.relationLabels ?? [],
            },
            diary: hasDiarySignal
              ? {
                  sameGanjiCount,
                  sameGanjiAvgHappiness: body.sameGanjiAvgHappiness ?? null,
                  sameGanjiAvgCondition: body.sameGanjiAvgCondition ?? null,
                  totalEntryDays,
                  recentWellbeing: body.recentWellbeing ?? null,
                }
              : null,
            theoryChunks: chunks.map((content, index) => ({
              index,
              content,
              similarity: evidence[index]?.similarity ?? null,
            })),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as {
      sentence?: string;
      evidenceExplain?: Array<{ title?: string; explanation?: string }>;
    };
    const sentence =
      typeof parsed.sentence === "string" ? parsed.sentence.trim() : "";
    if (!sentence) throw new Error("no sentence");

    const explained = Array.isArray(parsed.evidenceExplain)
      ? parsed.evidenceExplain
      : [];

    const theoryEvidence = evidence.map((item, index) => {
      const exp = explained[index];
      const title =
        typeof exp?.title === "string" && exp.title.trim()
          ? exp.title.trim()
          : `근거 ${index + 1}`;
      const explanation =
        typeof exp?.explanation === "string" && exp.explanation.trim()
          ? exp.explanation.trim()
          : item.content;
      return {
        ...item,
        title,
        explanation,
      };
    });

    return Response.json({
      status: "ok",
      message: sentence,
      detail: hasDiarySignal ? null : "학습 이론 기준으로 작성했어요.",
      chunkCount: chunks.length,
      sameGanjiCount,
      theoryEvidence,
      fallback: null,
    });
  } catch (err) {
    const sanitized = classifyAndSanitizeError(err);
    return Response.json({
      status: "ok",
      message: template,
      detail: sanitized.detail,
      chunkCount: chunks.length,
      sameGanjiCount,
      theoryEvidence: evidence.map((item, index) => ({
        ...item,
        title: `근거 ${index + 1}`,
        explanation: item.content,
      })),
      fallback: "template_llm_failed",
    });
  }
}
