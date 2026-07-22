import { requireAdmin } from "@/lib/auth/admin";
import { reindexKnowledgeDocument } from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
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
    const doc = await reindexKnowledgeDocument(params.id);
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
    const message = err instanceof Error ? err.message : "재학습 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
