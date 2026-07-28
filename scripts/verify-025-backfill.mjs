/**
 * Smoke: journal rows all have saju_profile_id after 025 backfill.
 * Usage: node scripts/verify-025-backfill.mjs
 */
import fs from "node:fs";
import path from "node:path";

let env = fs.readFileSync(path.resolve(".env.local"), "utf8");
if (env.charCodeAt(0) === 0xfeff) env = env.slice(1);

function get(key) {
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0 || t.slice(0, eq).trim() !== key) continue;
    let v = t.slice(eq + 1).trim();
    const hash = v.search(/\s#/);
    if (hash >= 0) v = v.slice(0, hash).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return [...v].filter((c) => c.charCodeAt(0) < 128).join("").trim();
  }
  return "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: "count=exact",
};

async function count(table, query = "") {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=id${query}`,
    { headers, method: "HEAD" }
  );
  return res.headers.get("content-range");
}

const journalAll = await count("journal_entries");
const journalNull = await count(
  "journal_entries",
  "&saju_profile_id=is.null"
);
const prefsAll = await count("user_category_preferences", "&limit=1");
const onboarding = await count("journal_onboarding_profiles");

console.log(
  JSON.stringify(
    {
      journalAll,
      journalNull,
      prefsSample: prefsAll,
      onboarding,
      ok: journalNull === "*/0" || journalNull === "0-0/0" || /\/0$/.test(journalNull ?? ""),
    },
    null,
    2
  )
);
