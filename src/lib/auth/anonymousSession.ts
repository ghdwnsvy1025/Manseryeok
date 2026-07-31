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
 * Google 로그인.
 * - preferLink + 익명 세션: linkIdentity 시도 (user_id 유지)
 * - 실패하거나 익명 없음: 일반 OAuth (안정적)
 */
export async function startGoogleAuth(opts: {
  redirectTo: string;
  /** true면 익명일 때 linkIdentity 우선 (기본 false — 로그인 화면은 OAuth) */
  preferLink?: boolean;
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

  if (opts.preferLink && user && isAnonymousUser(user)) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: opts.redirectTo,
        queryParams: { hl: "ko" },
      },
    });
    if (!error) return { ok: true };
    // 이미 가입된 Google 등이면 아래 OAuth로 폴백하지 않고 안내
    const msg = error.message ?? "";
    const alreadyLinked =
      /already.*(linked|registered|exists)/i.test(msg) ||
      /identity.*another user/i.test(msg) ||
      error.code === "identity_already_exists";
    if (alreadyLinked) {
      return {
        ok: false,
        code: "identity_already_exists",
        error:
          "이미 가입된 Google 계정이에요. 아래에서 같은 계정으로 다시 로그인해 주세요.",
      };
    }
    // 그 외 link 실패 → OAuth 폴백
  }

  disableGuestMode();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: opts.redirectTo,
      queryParams: { hl: "ko" },
      skipBrowserRedirect: false,
    },
  });
  if (error) {
    return {
      ok: false,
      code: "oauth_failed",
      error: `Google 로그인을 시작하지 못했어요. (${error.message || opts.redirectTo})`,
    };
  }
  return { ok: true };
}
