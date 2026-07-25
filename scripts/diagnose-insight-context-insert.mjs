/**
 * Diagnose why daily_insight_contexts inserts may fail.
 * Usage: node scripts/diagnose-insight-context-insert.mjs
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");
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
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function main() {
  const qRes = await fetch(
    `${url}/rest/v1/daily_questions?select=user_id,question_date,context_id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const questions = await qRes.json();
  const userId = questions?.[0]?.user_id;
  const eventDate = questions?.[0]?.question_date || "2026-07-25";
  if (!userId) {
    console.log(JSON.stringify({ ok: false, reason: "no_question_user" }));
    process.exit(1);
  }

  const probeDate = "2099-01-01"; // disposable probe row
  const payload = {
    user_id: userId,
    event_date: probeDate,
    timezone: "Asia/Seoul",
    data_cutoff_at: `${probeDate}T00:00:00.000+09:00`,
    context_json: {
      eventDate: probeDate,
      timezone: "Asia/Seoul",
      dataCutoffAt: `${probeDate}T00:00:00.000+09:00`,
      engineVersion: "insight-v1.0.0-probe",
      overallConfidence: 0.5,
    },
    confidence_json: { overall: 0.5 },
    engine_version: "insight-v1.0.0-probe",
  };

  const insertRes = await fetch(`${url}/rest/v1/daily_insight_contexts`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const insertBody = await insertRes.text();

  // cleanup
  await fetch(
    `${url}/rest/v1/daily_insight_contexts?event_date=eq.${probeDate}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }
  );

  const fortuneProbe = {
    user_id: userId,
    event_date: probeDate,
    overall_headline: "probe",
    overall_summary: "probe",
    scoring_version: "probe",
  };
  const fortuneRes = await fetch(`${url}/rest/v1/daily_fortunes`, {
    method: "POST",
    headers,
    body: JSON.stringify(fortuneProbe),
  });
  const fortuneBody = await fortuneRes.text();
  await fetch(
    `${url}/rest/v1/daily_fortunes?event_date=eq.${probeDate}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }
  );

  console.log(
    JSON.stringify(
      {
        userIdPrefix: `${String(userId).slice(0, 8)}…`,
        eventDateSample: eventDate,
        contextInsert: {
          status: insertRes.status,
          body: insertBody.slice(0, 500),
        },
        fortuneInsert: {
          status: fortuneRes.status,
          body: fortuneBody.slice(0, 500),
        },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
