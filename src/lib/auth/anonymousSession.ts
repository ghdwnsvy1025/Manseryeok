import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  enableGuestMode,
  disableGuestMode,
} from "@/lib/auth/guestMode";

/** Supabase 익명 사용자 여부 */
export function isAnonymousUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    (user as User & { is_anonymous?: boolean }).is_anonymous ||
      user.app_metadata?.provider === "anonymous"
  );
}

function isAnonymousDisabledError(message: string | undefined): boolean {
  if (!message) return false;
  return /anonymous.*disabled/i.test(message);
}

/**
 * 세션이 없으면 signInAnonymously로 익명 사용자를 만든다.
 * Anonymous가 대시보드에서 꺼져 있으면 로컬 게스트로 폴백(에러로 막지 않음).
 */
export async function ensureAnonymousSession(): Promise<{
  ok: boolean;
  user: User | null;
  /** 서버에서 익명 로그인이 꺼져 로컬 게스트만 쓰는 경우 */
  localGuestOnly?: boolean;
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    enableGuestMode();
    return { ok: true, user: null, localGuestOnly: true };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    if (isAnonymousUser(session.user)) enableGuestMode();
    else disableGuestMode();
    return { ok: true, user: session.user };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    // Anonymous 미활성 등 — 기기 로컬 게스트로 계속 사용 가능하게
    enableGuestMode();
    return {
      ok: true,
      user: null,
      localGuestOnly: true,
      error: isAnonymousDisabledError(error?.message)
        ? undefined
        : error?.message,
    };
  }

  enableGuestMode();
  return { ok: true, user: data.user };
}

/**
 * 익명 → Google: linkIdentity로 user_id 유지.
 * 익명 세션이 없으면 일반 OAuth (Anonymous 미활성·로그아웃 직후 포함).
 */
export async function startGoogleAuth(opts: {
  redirectTo: string;
}): Promise<{ ok: boolean; error?: string; code?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      ok: false,
      error: "로그인 서버가 설정되지 않았습니다.",
      code: "not_configured",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAnonymousUser(user)) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: opts.redirectTo,
        queryParams: { hl: "ko" },
      },
    });
    if (error) {
      const msg = error.message ?? "";
      const alreadyLinked =
        /already.*(linked|registered|exists)/i.test(msg) ||
        /identity.*another user/i.test(msg) ||
        error.code === "identity_already_exists";
      return {
        ok: false,
        code: alreadyLinked ? "identity_already_exists" : "link_failed",
        error: alreadyLinked
          ? "이미 가입된 Google 계정이에요. 그 계정으로 바로 로그인하면 지금 익명 기록은 이어지지 않아요."
          : `Google 연결에 실패했어요. (${msg})`,
      };
    }
    return { ok: true };
  }

  // 세션 없음·로컬 게스트·이미 Google 아님: 일반 OAuth
  disableGuestMode();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: opts.redirectTo,
      queryParams: { hl: "ko" },
    },
  });
  if (error) {
    return {
      ok: false,
      code: "oauth_failed",
      error: `Google 로그인을 시작하지 못했어요. (${opts.redirectTo})`,
    };
  }
  return { ok: true };
}
