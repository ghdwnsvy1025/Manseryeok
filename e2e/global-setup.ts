/**
 * Phase 6.1 — create ephemeral E2E user (or reuse TEST_USER_A).
 * Writes e2e/.auth/credentials.json (gitignored).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return {};
  let text = fs.readFileSync(envPath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const env: Record<string, string> = {};
  const headerSafe = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  for (const line of text.split(/\r?\n/)) {
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
    if (headerSafe.has(k)) {
      v = [...v].filter((ch) => ch.charCodeAt(0) < 128).join("").trim();
    }
    env[k] = v;
  }
  return env;
}

async function globalSetup() {
  const fileEnv = loadEnvLocal();
  const env = { ...process.env, ...fileEnv } as Record<string, string>;
  // Prefer ASCII-filtered file values for header-bound keys
  for (const k of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (fileEnv[k]) env[k] = fileEnv[k];
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const service = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const runId = `p61_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const marker = `[P61_E2E ${runId}]`;
  const outDir = path.resolve("e2e/.auth");
  fs.mkdirSync(outDir, { recursive: true });

  const credPath = path.join(outDir, "credentials.json");

  if (env.TEST_USER_A_EMAIL && env.TEST_USER_A_PASSWORD) {
    fs.writeFileSync(
      credPath,
      JSON.stringify(
        {
          mode: "env",
          runId,
          marker,
          email: env.TEST_USER_A_EMAIL,
          password: env.TEST_USER_A_PASSWORD,
          userId: null,
          ephemeral: false,
        },
        null,
        2
      ),
      "utf8"
    );
    return;
  }

  if (!url || !anon || !service) {
    fs.writeFileSync(
      credPath,
      JSON.stringify(
        {
          mode: "skip_auth",
          runId,
          marker,
          reason: "missing supabase env or TEST_USER; auth flows will skip",
        },
        null,
        2
      ),
      "utf8"
    );
    return;
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Use a reserved public suffix; .local can fail Auth email validation in browser.
  const email = `p61.e2e.${runId}@example.com`;
  const password = `P61_${randomBytes(10).toString("base64url")}!aA1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { marker, purpose: "phase61_browser_e2e" },
  });
  if (error || !data.user?.id) {
    throw new Error(`e2e user create failed: ${error?.message}`);
  }

  fs.writeFileSync(
    credPath,
    JSON.stringify(
      {
        mode: "ephemeral",
        runId,
        marker,
        email,
        password,
        userId: data.user.id,
        ephemeral: true,
        url,
        serviceKeyPresent: true,
      },
      null,
      2
    ),
    "utf8"
  );
}

export default globalSetup;
