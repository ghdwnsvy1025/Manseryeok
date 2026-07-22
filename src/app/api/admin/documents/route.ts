import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
} from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

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
    const documents = await listKnowledgeDocuments();
    return Response.json({
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        charCount: d.charCount,
        chunkCount: d.chunkCount,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
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

  let body: { title?: string; text?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const content = (body.text ?? body.content ?? "").trim();
  const title = (body.title ?? "").trim() || "사주 이론";
  if (!content) {
    return Response.json({ error: "텍스트가 없습니다." }, { status: 400 });
  }

  try {
    const doc = await createKnowledgeDocument({
      title,
      content,
      createdBy: auth.user.id,
    });
    return Response.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        charCount: doc.charCount,
        chunkCount: doc.chunkCount,
        status: doc.status,
      },
      totalChars: doc.charCount,
      chunks: doc.chunkCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "문서 등록 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
