/**
 * Sign in test users and print masked access tokens.
 * Prefer using verify-rls-cross-user.mjs directly (password auth).
 *
 * node scripts/get-test-user-jwts.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, maskToken } from "./lib/supabaseEnv.mjs";

async function signIn(url, anonKey, email, password, label) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    return { label, ok: false, error: error?.message || "no session" };
  }
  return {
    label,
    ok: true,
    userId: data.user.id,
    tokenMasked: maskToken(data.session.access_token),
    // Full token only to stdout as separate lines for optional copy — user asked not to log full token.
    // We intentionally omit full token from JSON; print hint to use password mode in verify script.
  };
}

async function main() {
  const env = getSupabaseEnv();
  if (!env.ok) {
    console.log(JSON.stringify({ ok: false, reason: env.reason }, null, 2));
    process.exitCode = 1;
    return;
  }
  const emailA = env.env.TEST_USER_A_EMAIL || "";
  const passA = env.env.TEST_USER_A_PASSWORD || "";
  const emailB = env.env.TEST_USER_B_EMAIL || "";
  const passB = env.env.TEST_USER_B_PASSWORD || "";
  if (!emailA || !passA || !emailB || !passB) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "missing_test_user_passwords",
          message:
            "TEST_USER_A_EMAIL/PASSWORD 와 TEST_USER_B_EMAIL/PASSWORD 를 .env.local에 설정하세요.",
          hint: "전체 JWT를 파일에 저장할 필요 없이 node scripts/verify-rls-cross-user.mjs 를 직접 실행하세요.",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  const a = await signIn(env.url, env.anonKey, emailA, passA, "A");
  const b = await signIn(env.url, env.anonKey, emailB, passB, "B");
  console.log(
    JSON.stringify(
      {
        ok: a.ok && b.ok,
        a: { ok: a.ok, userId: a.userId, tokenMasked: a.tokenMasked, error: a.error },
        b: { ok: b.ok, userId: b.userId, tokenMasked: b.tokenMasked, error: b.error },
        userIdsDistinct: a.ok && b.ok ? a.userId !== b.userId : null,
        next: "node scripts/verify-rls-cross-user.mjs",
      },
      null,
      2
    )
  );
  if (!a.ok || !b.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
