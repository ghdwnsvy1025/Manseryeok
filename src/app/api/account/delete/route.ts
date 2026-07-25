import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSupabaseServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import {
  ACCOUNT_CASCADE_TABLES,
  summarizeCascadeProbes,
  validateAccountDeleteConfirmation,
} from "@/lib/account/deleteAccount";

export const runtime = "nodejs";

/**
 * 로그인 사용자 본인 계정 삭제.
 * body: { confirmation: "DELETE MY ACCOUNT" }
 * 파생 데이터는 FK cascade. 삭제 후 잔존 행을 점검한다.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const confirmation =
    body && typeof body === "object"
      ? (body as { confirmation?: unknown }).confirmation
      : undefined;
  const check = validateAccountDeleteConfirmation(confirmation);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "계정 삭제를 위한 서버 설정이 없습니다." },
      { status: 503 }
    );
  }

  const userSb = getSupabaseServerClient();
  if (!userSb) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const {
    data: { user },
    error: userErr,
  } = await userSb.auth.getUser();
  if (userErr || !user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseServiceClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return Response.json(
      { error: "계정 삭제에 실패했습니다." },
      { status: 500 }
    );
  }

  // cascade 잔존 점검 — count만, 원문 없음
  const probes = [];
  for (const table of ACCOUNT_CASCADE_TABLES) {
    try {
      const { count, error } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) {
        // 테이블 미존재는 스킵 (마이그레이션 전 환경)
        continue;
      }
      probes.push({ table, remaining: count ?? 0 });
    } catch {
      /* ignore missing tables */
    }
  }

  const summary = summarizeCascadeProbes(probes);

  return Response.json({
    ok: true,
    deletedUserId: user.id,
    cascade: summary,
    probed: probes.length,
  });
}
