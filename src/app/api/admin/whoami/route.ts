import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

/**
 * GET /api/admin/whoami
 * 관리자 여부만 반환 (일반 사용자에게도 401/403 대신 admin:false)
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ admin: false });
  }
  return NextResponse.json({ admin: true, email: auth.user.email });
}
