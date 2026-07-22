import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT || 3456);
const BASE = `http://127.0.0.1:${PORT}`;

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

const envFile = loadEnvLocal();

/** Conservative release flags (Phase 6.1) */
const CONSERVATIVE_FLAGS = {
  NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS: "true",
  NEXT_PUBLIC_FF_LEGACY_MENU: "false",
  NEXT_PUBLIC_FF_NEW_DIARY: "true",
  NEXT_PUBLIC_FF_SAJU_SNAPSHOT: "true",
  NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN: "false",
  NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY: "false",
  NEXT_PUBLIC_FF_PERSONALIZATION: "false",
  NEXT_PUBLIC_FF_NEW_ANALYSIS: "true",
  NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM: "false",
  FF_ANALYSIS_NARRATIVE_LLM: "false",
  NEXT_PUBLIC_FF_ANALYSIS_CACHE: "false",
};

export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "e2e/results.json" }]],
  globalSetup: require.resolve("./e2e/global-setup"),
  globalTeardown: require.resolve("./e2e/global-teardown"),
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "ko-KR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node e2e/write-flags.mjs && npx next dev -H 127.0.0.1 -p ${PORT}`,
    url: `${BASE}/diary/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...envFile,
      ...CONSERVATIVE_FLAGS,
      PORT: String(PORT),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
