/**
 * Probe migration 015 tables through PostgREST.
 * Usage: node scripts/verify-daily-insight-015.mjs
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
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0 || trimmed.slice(0, eq).trim() !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    const hash = value.search(/\s#/);
    if (hash >= 0) value = value.slice(0, hash).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return [...value]
      .filter((ch) => ch.charCodeAt(0) < 128)
      .join("")
      .trim();
  }
  return "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: "missing_supabase_env" }));
  process.exit(0);
}

async function probe(table, select = "id") {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=${select}&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }
  );
  return {
    status: response.status,
    ok: response.ok,
    body: response.ok ? null : (await response.text()).slice(0, 400),
  };
}

async function main() {
  const checks = {
    daily_insight_contexts: await probe(
      "daily_insight_contexts",
      "id,event_date,data_cutoff_at,context_json"
    ),
    daily_fortunes: await probe(
      "daily_fortunes",
      "id,event_date,overall_headline"
    ),
    daily_fortune_sections: await probe(
      "daily_fortune_sections",
      "id,domain_code"
    ),
    quote_library: await probe(
      "quote_library",
      "id,verification_status,rights_status,active"
    ),
    daily_quote_deliveries: await probe(
      "daily_quote_deliveries",
      "id,content_type,generated_original_text"
    ),
    content_exposure_events: await probe(
      "content_exposure_events",
      "id,content_type,event_type"
    ),
    content_feedback: await probe("content_feedback", "id,content_type,rating"),
  };

  const missing = Object.entries(checks)
    .filter(([, value]) => !value.ok)
    .map(([name, value]) => ({ name, ...value }));
  const ok = missing.length === 0;

  console.log(
    JSON.stringify(
      {
        ok,
        applied: ok,
        missing,
        hint: ok
          ? "015 tables present"
          : "Run supabase/migrations/015_daily_insight_fortune_quotes.sql in SQL Editor",
      },
      null,
      2
    )
  );
  process.exit(ok ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
