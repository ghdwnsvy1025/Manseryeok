import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
} from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

/**
 * 레거시 엔드포인트 — 관리자만 허용하며 documents API와 동일하게 동작합니다.
 */
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

  let body: { text?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const content = (body.text ?? "").trim();
  if (!content) {
    return Response.json({ error: "텍스트가 없습니다." }, { status: 400 });
  }

  try {
    const doc = await createKnowledgeDocument({
      title: body.title?.trim() || "레거시 업로드",
      content,
      createdBy: auth.user.id,
    });
    return Response.json({
      success: true,
      totalChars: doc.charCount,
      chunks: doc.chunkCount,
      documentId: doc.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "학습 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (!isServiceRoleConfigured()) {
    return Response.json({ hasEmbeddings: false, documents: 0, totalChunks: 0 });
  }
  try {
    const documents = await listKnowledgeDocuments();
    const ready = documents.filter((d) => d.status === "ready");
    return Response.json({
      hasEmbeddings: ready.length > 0,
      documents: ready.length,
      totalChunks: ready.reduce((s, d) => s + d.chunkCount, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "조회 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
