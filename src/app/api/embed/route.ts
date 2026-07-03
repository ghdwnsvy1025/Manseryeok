import { NextRequest } from "next/server";
import OpenAI from "openai";
import { chunkText, saveKnowledge, saveEmbeddings, loadKnowledge } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json() as { text?: string };

    // 새 텍스트가 전달된 경우 저장, 없으면 기존 파일 사용
    const knowledgeText = text?.trim() || loadKnowledge();
    if (!knowledgeText) {
      return Response.json(
        { error: "텍스트가 없습니다. 사주 해석 텍스트를 입력해주세요." },
        { status: 400 }
      );
    }

    if (text?.trim()) {
      saveKnowledge(text.trim());
    }

    const chunks = chunkText(knowledgeText);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "여기에_API_키를_입력하세요") {
      return Response.json(
        { error: ".env.local 파일에 OPENAI_API_KEY를 입력해주세요." },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });

    // 100개씩 배치 처리 (API 한도 초과 방지)
    const BATCH_SIZE = 100;
    const allVectors: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const resp = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
      });
      allVectors.push(...resp.data.map((d) => d.embedding));
    }

    const embeddings = chunks.map((chunk, i) => ({
      chunk,
      vector: allVectors[i],
    }));

    saveEmbeddings(embeddings);

    return Response.json({
      success: true,
      totalChars: knowledgeText.length,
      chunks: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const knowledge = loadKnowledge();
  return Response.json({
    hasKnowledge: !!knowledge,
    chars: knowledge?.length ?? 0,
  });
}
