import { NextRequest } from "next/server";
import {
  validateExposureInput,
  type ContentExposureInput,
} from "@/lib/journal/exposure";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const input = body as ContentExposureInput;
  const check = validateExposureInput(input);
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

  const { error } = await sb.from("content_exposure_events").insert({
    user_id: user.id,
    event_date: input.eventDate,
    content_type: input.contentType,
    content_id: input.contentId ?? null,
    event_type: input.eventType,
    metadata_json: input.metadata ?? {},
  });

  if (error) {
    return Response.json(
      { ok: false, recorded: false, error: error.message },
      { status: 500 }
    );
  }
  return Response.json({ ok: true, recorded: true });
}
