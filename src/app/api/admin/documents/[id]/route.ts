import { requireAdmin } from "@/lib/auth/admin";
import { deleteKnowledgeDocument } from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function DELETE(_req: Request, { params }: Params) {
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
    await deleteKnowledgeDocument(params.id);
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "삭제 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
