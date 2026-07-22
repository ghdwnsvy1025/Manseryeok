import { getSupabaseServerClient } from "@/lib/supabase/server";

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false; // fail-closed
  return admins.includes(email.trim().toLowerCase());
}

export type AdminUser = {
  id: string;
  email: string;
};

/**
 * 서버 라우트/페이지에서 관리자만 통과.
 * ADMIN_EMAILS가 비어 있으면 전원 거부.
 */
export async function requireAdmin(): Promise<
  | { ok: true; user: AdminUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const admins = getAdminEmails();
  if (admins.length === 0) {
    return {
      ok: false,
      status: 403,
      error: "ADMIN_EMAILS가 설정되지 않아 관리자 접근이 차단됩니다.",
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      status: 401,
      error: "Supabase가 설정되지 않았습니다.",
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return { ok: false, status: 401, error: "로그인이 필요합니다." };
  }

  if (!isAdminEmail(user.email)) {
    return { ok: false, status: 403, error: "관리자 권한이 없습니다." };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}
