import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { validateBetaFeedbackInput } from "@/lib/feedback/betaFeedback";
import {
  getSupabaseServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const check = validateBetaFeedbackInput(
    body as { category: string; message: string; path?: string }
  );
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const sb = getSupabaseServerClient();
  if (!sb) {
    return Response.json(
      { error: "서버가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { error } = await sb.from("beta_feedback").insert({
    user_id: user.id,
    category: check.category,
    message: check.message,
    path: check.path,
  });

  if (error) {
    return Response.json(
      { error: error.message || "저장에 실패했습니다." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "Service role이 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 50;

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("beta_feedback")
    .select("id, user_id, category, message, path, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    items: (data ?? []).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      category: row.category as string,
      message: row.message as string,
      path: row.path as string,
      createdAt: row.created_at as string,
    })),
  });
}
