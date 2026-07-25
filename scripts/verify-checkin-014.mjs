/**
 * Probe check-in v2 migration 014 columns/tables.
 * Usage: node scripts/verify-checkin-014.mjs
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");
if (!fs.existsSync(envPath)) {
  console.log(JSON.stringify({ ok: false, reason: "missing_.env.local" }));
  process.exit(0);
}

let env = fs.readFileSync(envPath, "utf8");
if (env.charCodeAt(0) === 0xfeff) env = env.slice(1);

function get(key) {
  const lines = env.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) continue;
    let v = trimmed.slice(eq + 1).trim();
    const hash = v.search(/\s#/);
    if (hash >= 0) v = v.slice(0, hash).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    v = [...v].filter((ch) => ch.charCodeAt(0) < 128).join("").trim();
    return v;
  }
  return "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: "missing_supabase_env" }));
  process.exit(0);
}

async function probe(select, table = "journal_entries") {
  const r = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const body = r.ok ? null : (await r.text()).slice(0, 400);
  return { status: r.status, ok: r.ok, body };
}

async function main() {
  const checks = {
    happiness_score: await probe("happiness_score"),
    mood_labels: await probe("mood_labels"),
    core_states: await probe("core_states"),
    domain_scores: await probe("domain_scores"),
    checkin_version: await probe("checkin_version"),
    daily_questions: await probe("id", "daily_questions"),
    question_feedback_events: await probe("id", "question_feedback_events"),
  };

  const missing = Object.entries(checks)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => ({ key: k, status: v.status, body: v.body }));

  const ok = missing.length === 0;
  console.log(
    JSON.stringify(
      {
        ok,
        applied: ok,
        missing,
        hint: ok
          ? "014 columns/tables present"
          : "Run supabase/migrations/014_checkin_v2.sql in SQL Editor",
      },
      null,
      2
    )
  );
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
