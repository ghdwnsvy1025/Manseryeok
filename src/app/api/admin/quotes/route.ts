import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  deactivateQuote,
  listQuotesAdmin,
  upsertQuote,
} from "@/lib/journal/quote/repository";
import type {
  QuoteRightsStatus,
  QuoteVerificationStatus,
} from "@/lib/journal/quote/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  try {
    const quotes = await listQuotesAdmin();
    return Response.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "목록 조회 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const quoteTextKo = String(body.quoteTextKo ?? "").trim();
  if (!quoteTextKo) {
    return Response.json({ error: "quoteTextKo가 필요합니다." }, { status: 400 });
  }

  try {
    const quote = await upsertQuote({
      id: typeof body.id === "string" ? body.id : undefined,
      quoteTextKo,
      originalText: (body.originalText as string | null) ?? null,
      authorName: (body.authorName as string | null) ?? null,
      workTitle: (body.workTitle as string | null) ?? null,
      publicationInfo: (body.publicationInfo as string | null) ?? null,
      sourceUrl: (body.sourceUrl as string | null) ?? null,
      sourceType: (body.sourceType as string | null) ?? null,
      translator: (body.translator as string | null) ?? null,
      language: typeof body.language === "string" ? body.language : "ko",
      themes: Array.isArray(body.themes) ? (body.themes as string[]) : [],
      emotionalTone: Array.isArray(body.emotionalTone)
        ? (body.emotionalTone as string[])
        : [],
      suitableStates: Array.isArray(body.suitableStates)
        ? (body.suitableStates as string[])
        : [],
      unsuitableStates: Array.isArray(body.unsuitableStates)
        ? (body.unsuitableStates as string[])
        : [],
      rightsStatus: (body.rightsStatus as QuoteRightsStatus) ?? "review_required",
      verificationStatus:
        (body.verificationStatus as QuoteVerificationStatus) ?? "unverified",
      attributionConfidence: Number(body.attributionConfidence ?? 0),
      active: Boolean(body.active),
      reviewedBy: auth.user.email ?? auth.user.id,
    });
    return Response.json({ success: true, quote });
  } catch (err) {
    const message = err instanceof Error ? err.message : "저장 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id가 필요합니다." }, { status: 400 });
  }
  try {
    await deactivateQuote(id);
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "비활성화 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
