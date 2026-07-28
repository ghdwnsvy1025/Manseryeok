/**
 * Apply migration 025 via Supabase SQL using service role + pg REST is not enough.
 * Prefer: paste supabase/migrations/025_saju_profile_scoped_data.sql in SQL Editor.
 *
 * This script verifies post-apply column presence.
 * Usage: node scripts/verify-025-profile-scope.mjs
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
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function columnExists(table, column) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, {
    headers,
  });
  return { table, column, exists: res.ok, status: res.status };
}

const checks = await Promise.all([
  columnExists("journal_entries", "saju_profile_id"),
  columnExists("user_category_preferences", "saju_profile_id"),
  columnExists("journal_onboarding_profiles", "saju_profile_id"),
  columnExists("daily_questions", "saju_profile_id"),
  columnExists("daily_insight_contexts", "saju_profile_id"),
  columnExists("daily_fortunes", "saju_profile_id"),
  columnExists("daily_quote_deliveries", "saju_profile_id"),
  columnExists("question_feedback_events", "saju_profile_id"),
  columnExists("content_exposure_events", "saju_profile_id"),
  columnExists("content_feedback", "saju_profile_id"),
]);

const allApplied = checks.every((c) => c.exists);
console.log(JSON.stringify({ allApplied, checks }, null, 2));
process.exit(allApplied ? 0 : 2);
