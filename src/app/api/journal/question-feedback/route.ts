import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateQuestionFeedbackInput,
  type QuestionFeedbackInput,
} from "@/lib/journal/questionFeedback";

export const runtime = "nodejs";

/**
 * POST /api/journal/question-feedback
 * — 로그인 시 Supabase에 저장. 비로그인이면 200 + stored:local 힌트.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const b = body as QuestionFeedbackInput & {
    questionText?: string | null;
  };
  const input: QuestionFeedbackInput = {
    questionDate: b.questionDate,
    eventType: b.eventType,
    questionText: b.questionText ?? null,
    questionId: b.questionId ?? null,
    rating: b.rating ?? null,
    payload: b.payload ?? {},
  };

  const check = validateQuestionFeedbackInput(input);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const sb = getSupabaseServerClient();
  if (!sb) {
    return Response.json({
      ok: true,
      stored: "none",
      detail: "supabase_not_configured",
    });
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({
      ok: true,
      stored: "client_local",
      detail: "not_authenticated",
    });
  }

  let questionId = input.questionId ?? null;

  // 질문이 있으면 당일 daily_questions upsert 후 id 연결
  if (input.questionText && input.questionText.trim()) {
    const now = new Date().toISOString();
    const { data: existing } = await sb
      .from("daily_questions")
      .select("id")
      .eq("user_id", user.id)
      .eq("question_date", input.questionDate)
      .maybeSingle();

    if (existing?.id) {
      questionId = existing.id;
      await sb
        .from("daily_questions")
        .update({
          question_text: input.questionText.trim().slice(0, 500),
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      const { data: inserted } = await sb
        .from("daily_questions")
        .insert({
          user_id: user.id,
          question_date: input.questionDate,
          question_text: input.questionText.trim().slice(0, 500),
          keyword_codes: input.payload?.keywords ?? [],
          evidence: input.payload?.evidence ?? {},
          updated_at: now,
        })
        .select("id")
        .maybeSingle();
      if (inserted?.id) questionId = inserted.id;
    }
  }

  const { error } = await sb.from("question_feedback_events").insert({
    user_id: user.id,
    question_id: questionId,
    question_date: input.questionDate,
    event_type: input.eventType,
    rating: input.rating ?? null,
    payload: {
      ...(input.payload ?? {}),
      questionText: input.questionText ?? null,
    },
  });

  if (error) {
    // 014 미적용 등
    return Response.json({
      ok: true,
      stored: "client_local",
      detail: error.message,
    });
  }

  return Response.json({
    ok: true,
    stored: "supabase",
    questionId,
  });
}
