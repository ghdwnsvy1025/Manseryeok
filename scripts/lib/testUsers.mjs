/**
 * Shared test-user resolution for verify-*.mjs
 * Prefer env password → JWT → service-role ephemeral users (deleted by caller).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { maskToken } from "./supabaseEnv.mjs";

export function clientFor(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

export async function signIn(url, anonKey, email, password, label) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token || !data.user?.id) {
    return { ok: false, label, error: error?.message || "no session" };
  }
  return {
    ok: true,
    label,
    userId: data.user.id,
    accessToken: data.session.access_token,
    email,
    ephemeral: false,
  };
}

function decodeSub(jwt) {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * @returns {{ a, b, ephemeralUserIds: string[], authMode: string, tokenAMasked, tokenBMasked }}
 */
export async function resolveTestUsers(url, anonKey, serviceKey, env, opts = {}) {
  const runId = opts.runId || `tu_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const marker = opts.marker || `[TEST_USER ${runId}]`;
  const emailA = env.TEST_USER_A_EMAIL || "";
  const passA = env.TEST_USER_A_PASSWORD || "";
  const emailB = env.TEST_USER_B_EMAIL || "";
  const passB = env.TEST_USER_B_PASSWORD || "";

  if (emailA && passA && emailB && passB) {
    const a = await signIn(url, anonKey, emailA, passA, "A");
    const b = await signIn(url, anonKey, emailB, passB, "B");
    return {
      a,
      b,
      ephemeralUserIds: [],
      authMode: "env_password",
      tokenAMasked: a.ok ? maskToken(a.accessToken) : null,
      tokenBMasked: b.ok ? maskToken(b.accessToken) : null,
    };
  }

  const jwtA = env.TEST_USER_A_JWT || "";
  const jwtB = env.TEST_USER_B_JWT || "";
  if (jwtA && jwtB) {
    const aId = decodeSub(jwtA);
    const bId = decodeSub(jwtB);
    return {
      a: {
        ok: Boolean(aId),
        label: "A",
        userId: aId,
        accessToken: jwtA,
        error: aId ? null : "invalid JWT A",
        ephemeral: false,
      },
      b: {
        ok: Boolean(bId),
        label: "B",
        userId: bId,
        accessToken: jwtB,
        error: bId ? null : "invalid JWT B",
        ephemeral: false,
      },
      ephemeralUserIds: [],
      authMode: "env_jwt",
      tokenAMasked: maskToken(jwtA),
      tokenBMasked: maskToken(jwtB),
    };
  }

  if (!serviceKey) {
    return {
      a: { ok: false, label: "A", error: "no credentials and no service role" },
      b: { ok: false, label: "B", error: "no credentials and no service role" },
      ephemeralUserIds: [],
      authMode: "none",
      tokenAMasked: null,
      tokenBMasked: null,
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pass = `QA_${randomBytes(12).toString("base64url")}!aA1`;
  const eA = `qa-a-${runId}@manseryeok-test.local`;
  const eB = `qa-b-${runId}@manseryeok-test.local`;
  const createdIds = [];

  for (const email of [eA, eB]) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { marker, purpose: "phase6_qa" },
    });
    if (error || !data.user?.id) {
      return {
        a: { ok: false, label: "A", error: error?.message || "create failed" },
        b: { ok: false, label: "B", error: "create_failed" },
        ephemeralUserIds: createdIds,
        authMode: "ephemeral_admin",
        tokenAMasked: null,
        tokenBMasked: null,
      };
    }
    createdIds.push(data.user.id);
  }

  const a = await signIn(url, anonKey, eA, pass, "A");
  const b = await signIn(url, anonKey, eB, pass, "B");
  a.ephemeral = true;
  b.ephemeral = true;
  return {
    a,
    b,
    ephemeralUserIds: createdIds,
    authMode: "ephemeral_admin",
    tokenAMasked: a.ok ? maskToken(a.accessToken) : null,
    tokenBMasked: b.ok ? maskToken(b.accessToken) : null,
  };
}

export async function deleteEphemeralUsers(url, serviceKey, ids) {
  if (!serviceKey || !ids?.length) return { deleted: 0, errors: [] };
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const errors = [];
  let deleted = 0;
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) errors.push(error.message);
    else deleted += 1;
  }
  return { deleted, errors };
}
