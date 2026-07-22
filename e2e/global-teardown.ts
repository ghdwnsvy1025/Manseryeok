/**
 * Phase 6.1 — cleanup E2E journal rows + ephemeral user.
 * Never touches diary_entries.
 */
import { createClient } from "@supabase/supabase-js";
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

async function globalTeardown() {
  const credPath = path.resolve("e2e/.auth/credentials.json");
  if (!fs.existsSync(credPath)) return;
  const cred = JSON.parse(fs.readFileSync(credPath, "utf8")) as {
    mode: string;
    runId?: string;
    marker?: string;
    userId?: string;
    ephemeral?: boolean;
  };
  const env = { ...loadEnvLocal(), ...process.env } as Record<string, string>;
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !service) return;

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (cred.runId) {
    await admin
      .from("journal_entries")
      .delete()
      .like("content", `%${cred.runId}%`);
  }

  if (cred.ephemeral && cred.userId) {
    // cascade cleans user-owned journal/prefs
    await admin.auth.admin.deleteUser(cred.userId);
  }
}

export default globalTeardown;
