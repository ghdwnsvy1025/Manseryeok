import { NextRequest } from "next/server";
import {
  validateContentFeedbackInput,
  type ContentFeedbackInput,
} from "@/lib/journal/contentFeedback";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const input = body as ContentFeedbackInput;
  const check = validateContentFeedbackInput(input);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const sb = getSupabaseServerClient();
  if (!sb) {
    return Response.json({ ok: true, recorded: false, reason: "no_supabase" });
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ ok: true, recorded: false, reason: "anonymous" });
  }

  const { error } = await sb.from("content_feedback").insert({
    user_id: user.id,
    event_date: input.eventDate,
    content_type: input.contentType,
    content_id: input.contentId ?? null,
    rating: input.rating ?? null,
    saved: Boolean(input.saved),
    shared: Boolean(input.shared),
    reopened: Boolean(input.reopened),
  });

  if (error) {
    return Response.json(
      { ok: false, recorded: false, error: error.message },
      { status: 500 }
    );
  }
  return Response.json({ ok: true, recorded: true });
}
