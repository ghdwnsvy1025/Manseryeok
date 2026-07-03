import { NextRequest } from "next/server";
import OpenAI from "openai";
import { loadEmbeddings, findTopChunks } from "@/lib/rag";
import type { SajuResult } from "@/lib/saju/types";

export async function POST(req: NextRequest) {
  try {
    const { sajuResult, question } = await req.json() as {
      sajuResult: SajuResult;
      question?: string;
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "여기에_API_키를_입력하세요") {
      return Response.json(
        { error: ".env.local 파일에 OPENAI_API_KEY를 입력해주세요." },
        { status: 400 }
      );
    }

    const embeddings = loadEmbeddings();
    if (!embeddings || embeddings.length === 0) {
      return Response.json(
        { error: "학습된 텍스트가 없습니다. 관리자 페이지(/admin)에서 먼저 텍스트를 학습시켜주세요." },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });

    // 사주 요약 텍스트 생성 (질문 임베딩용)
    const sajuSummary = formatSajuSummary(sajuResult);
    const queryText = question
      ? `${question} (사주: ${sajuSummary})`
      : `사주 분석: ${sajuSummary}`;

    // 질문을 벡터로 변환
    const qResp = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: queryText,
    });
    const queryVector = qResp.data[0].embedding;

    // 가장 관련 있는 참고 자료 5개 검색
    const topChunks = findTopChunks(queryVector, embeddings, 5);

    // GPT 호출
    const response = await client.chat.completions.create({
      model: "gpt-4o",  // 모델 변경 원하면 여기 수정 (예: "gpt-4o-mini")
      messages: [
        {
          role: "system",
          content: [
            "당신은 따뜻하고 친절한 사주 상담가입니다.",
            "아래 참고 자료를 바탕으로 사주를 해석해주세요.",
            "",
            "반드시 다음 형식을 지켜주세요:",
            "- 전문 용어 없이 누구나 알아듣기 쉬운 일상적인 말로 설명하세요.",
            "- 목록(•, -, 번호)을 사용하지 말고, 자연스럽게 이어지는 문장과 단락으로 작성하세요.",
            "- 마치 친한 선생님이 직접 이야기해주듯 다정하게 설명해주세요.",
            "- 각 항목(성격, 적성, 운세 등)은 별도 문단으로 구분하되, 첫 문장에 주제를 자연스럽게 녹여주세요.",
            "- 참고 자료에 없는 내용은 추측하지 말고, 자료에 근거한 해석만 해주세요.",
            "",
            "=== 참고 자료 ===",
            topChunks.join("\n\n---\n\n"),
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "아래 사주를 분석해주세요.",
            "",
            sajuSummary,
            "",
            question ? `특히 이 부분을 중심으로 설명해주세요: ${question}` : "성격과 기질, 잘 맞는 직업이나 적성, 그리고 전체적인 운의 흐름을 편안한 문체로 알려주세요.",
          ].join("\n"),
        },
      ],
      max_tokens: 1800,
      temperature: 0.75,
    });

    return Response.json({
      analysis: response.choices[0].message.content,
      chunksUsed: topChunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

function formatSajuSummary(result: SajuResult): string {
  const { pillars } = result;
  const parts: string[] = [];

  if (pillars.year) {
    parts.push(`년주 ${pillars.year.stem.hanja}${pillars.year.branch.hanja}(${pillars.year.stem.ko}${pillars.year.branch.ko})`);
  }
  if (pillars.month) {
    parts.push(`월주 ${pillars.month.stem.hanja}${pillars.month.branch.hanja}(${pillars.month.stem.ko}${pillars.month.branch.ko})`);
  }
  if (pillars.day) {
    parts.push(`일주 ${pillars.day.stem.hanja}${pillars.day.branch.hanja}(${pillars.day.stem.ko}${pillars.day.branch.ko})`);
  }
  if (pillars.hour) {
    parts.push(`시주 ${pillars.hour.stem.hanja}${pillars.hour.branch.hanja}(${pillars.hour.stem.ko}${pillars.hour.branch.ko})`);
  }

  const input = result.input.original;
  const gender = input.gender === "male" ? "남자" : "여자";
  const birth = `${input.year}년 ${input.month}월 ${input.day}일`;

  return `${birth} ${gender} / ${parts.join(", ")}`;
}
