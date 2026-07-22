/**
 * Shared .env.local reader for verify-*.mjs scripts.
 * Header-bound values (URL, keys, JWTs) are ASCII-filtered; passwords are not.
 */
import fs from "node:fs";
import path from "node:path";

const HEADER_SAFE_KEYS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_USER_A_JWT",
  "TEST_USER_B_JWT",
]);

export function loadEnvLocal() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) {
    return { ok: false, reason: "missing_.env.local", env: {} };
  }
  let envText = fs.readFileSync(envPath, "utf8");
  if (envText.charCodeAt(0) === 0xfeff) envText = envText.slice(1);

  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    const hash = v.search(/\s#/);
    if (hash >= 0) v = v.slice(0, hash).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (HEADER_SAFE_KEYS.has(k)) {
      v = [...v].filter((ch) => ch.charCodeAt(0) < 128).join("").trim();
    }
    env[k] = v;
  }
  return { ok: true, env };
}

export function getSupabaseEnv() {
  const loaded = loadEnvLocal();
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const url = loaded.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = loaded.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = loaded.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) {
    return {
      ok: false,
      reason: "missing_supabase_env",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      hasServiceKey: Boolean(serviceKey),
    };
  }
  return { ok: true, url, serviceKey, anonKey, env: loaded.env };
}

export function maskToken(token) {
  if (!token || typeof token !== "string") return "(empty)";
  if (token.length < 16) return "***";
  return `${token.slice(0, 8)}…${token.slice(-6)} (len=${token.length})`;
}

export async function restCount(url, key, table, select = "*") {
  const r = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const cr = r.headers.get("content-range");
  const count = cr && cr.includes("/") ? Number(cr.split("/")[1]) : null;
  const body = r.ok ? null : (await r.text()).slice(0, 400);
  return { status: r.status, ok: r.ok, count, body };
}
