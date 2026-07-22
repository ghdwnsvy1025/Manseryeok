import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export type E2ECredentials = {
  mode: "env" | "ephemeral" | "skip_auth";
  runId: string;
  marker: string;
  email?: string;
  password?: string;
  userId?: string | null;
  ephemeral?: boolean;
  reason?: string;
};

function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return {};
  let text = fs.readFileSync(envPath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const env: Record<string, string> = {};
  const headerSafe = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
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

export function loadCredentials(): E2ECredentials {
  const p = path.resolve("e2e/.auth/credentials.json");
  if (!fs.existsSync(p)) {
    return {
      mode: "skip_auth",
      runId: "none",
      marker: "",
      reason: "missing credentials file",
    };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as E2ECredentials;
}

/**
 * Sign in via Node (validates credentials), then establish browser session
 * through the login form (writes @supabase/ssr cookies correctly).
 */
export async function loginIfPossible(
  page: import("@playwright/test").Page,
  cred: E2ECredentials
): Promise<boolean> {
  if (cred.mode === "skip_auth" || !cred.email || !cred.password) {
    return false;
  }

  const fileEnv = loadEnvLocal();
  const url =
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const anon =
    fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (url && anon) {
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await sb.auth.signInWithPassword({
      email: cred.email,
      password: cred.password,
    });
    if (error) {
      console.warn("[e2e] signInWithPassword failed:", error.message);
      return false;
    }
  }

  await page.goto("/diary/login");
  // Ensure login mode (toggle shows the *other* mode label)
  const modeBtn = page.locator("form button[type='button']").first();
  const modeLabel = ((await modeBtn.textContent()) || "").trim();
  if (modeLabel === "로그인") {
    await modeBtn.click();
  }

  await page.getByPlaceholder("이메일").fill(cred.email);
  await page.getByPlaceholder("비밀번호").fill(cred.password);
  await page.locator("form").getByRole("button", { name: "로그인", exact: true }).click();

  // Success: redirect home, or stay with logout (import prompt path)
  try {
    await Promise.race([
      page.waitForURL((u) => !u.pathname.startsWith("/diary/login"), {
        timeout: 40_000,
      }),
      page.getByRole("button", { name: "로그아웃" }).waitFor({
        state: "visible",
        timeout: 40_000,
      }),
    ]);
  } catch {
    const msg = await page
      .locator("form")
      .locator("..")
      .innerText()
      .catch(() => "");
    console.warn("[e2e] UI login timeout. page snippet:", msg.slice(0, 400));
    return false;
  }

  if (page.url().includes("/diary/login")) {
    return page
      .getByRole("button", { name: "로그아웃" })
      .isVisible()
      .catch(() => false);
  }
  return true;
}

export async function logoutFromLoginPage(
  page: import("@playwright/test").Page
) {
  await page.goto("/diary/login");
  const btn = page.getByRole("button", { name: "로그아웃" });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.getByText("로그아웃되었습니다.").waitFor({ timeout: 10_000 });
  }
}
