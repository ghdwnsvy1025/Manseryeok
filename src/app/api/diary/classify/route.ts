import { NextRequest } from "next/server";
import OpenAI from "openai";
import {
  buildClassifyPrompt,
  buildClassifySystemPrompt,
  parseClassifyResponse,
} from "@/lib/diary/classify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      content?: string;
      date?: string;
      dayPillarKo?: string;
    };

    const content = body.content?.trim();
    if (!content) {
      return Response.json({ error: "일기 내용이 없습니다." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "여기에_API_키를_입력하세요") {
      return Response.json(
        { error: ".env.local 파일에 OPENAI_API_KEY를 입력해주세요." },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });
    const prompt = buildClassifyPrompt({
      content,
      date: body.date,
      dayPillarKo: body.dayPillarKo,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildClassifySystemPrompt() },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return Response.json({ error: "AI 응답이 비어 있습니다." }, { status: 500 });
    }

    const analysis = parseClassifyResponse(raw);
    return Response.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
