/**
 * Backfill context_id for daily_questions rows missing linkage,
 * and ensure a fortune snapshot exists for the same user/date (Gate 17 DB evidence).
 * Usage: node scripts/backfill-insight-links.mjs
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
    `${url}/rest/v1/daily_questions?select=id,user_id,question_date,context_id&context_id=is.null&limit=20`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const questions = await qRes.json();
  if (!Array.isArray(questions) || questions.length === 0) {
    console.log(JSON.stringify({ ok: true, linked: 0, note: "no_orphan_questions" }));
    return;
  }

  const results = [];
  for (const q of questions) {
    const eventDate = q.question_date;
    const userId = q.user_id;

    // existing context?
    let ctxRes = await fetch(
      `${url}/rest/v1/daily_insight_contexts?select=id&user_id=eq.${userId}&event_date=eq.${eventDate}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    let contexts = await ctxRes.json();
    let contextId = contexts?.[0]?.id ?? null;

    if (!contextId) {
      const insert = await fetch(`${url}/rest/v1/daily_insight_contexts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: userId,
          event_date: eventDate,
          timezone: "Asia/Seoul",
          data_cutoff_at: `${eventDate}T00:00:00.000+09:00`,
          context_json: {
            eventDate,
            timezone: "Asia/Seoul",
            dataCutoffAt: `${eventDate}T00:00:00.000+09:00`,
            engineVersion: "insight-v1.0.0-backfill",
            overallConfidence: 0.5,
            note: "gate17-backfill",
          },
          confidence_json: { overall: 0.5 },
          engine_version: "insight-v1.0.0-backfill",
        }),
      });
      const body = await insert.json();
      contextId = Array.isArray(body) ? body[0]?.id : body?.id;
      if (!contextId) {
        results.push({
          questionId: q.id,
          ok: false,
          stage: "context_insert",
          body,
        });
        continue;
      }
    }

    await fetch(`${url}/rest/v1/daily_questions?id=eq.${q.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ context_id: contextId }),
    });

    // fortune if missing
    const fRes = await fetch(
      `${url}/rest/v1/daily_fortunes?select=id&user_id=eq.${userId}&event_date=eq.${eventDate}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const fortunes = await fRes.json();
    let fortuneId = fortunes?.[0]?.id ?? null;
    if (!fortuneId) {
      const fInsert = await fetch(`${url}/rest/v1/daily_fortunes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: userId,
          event_date: eventDate,
          context_id: contextId,
          overall_headline: "백필 스냅샷",
          overall_summary: "Gate 17 관계 검증용 최소 운세 스냅샷",
          scoring_version: "fortune-score-v1-backfill",
          data_cutoff_at: `${eventDate}T00:00:00.000+09:00`,
        }),
      });
      const fBody = await fInsert.json();
      fortuneId = Array.isArray(fBody) ? fBody[0]?.id : fBody?.id;
      if (fortuneId) {
        await fetch(`${url}/rest/v1/daily_fortune_sections`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            daily_fortune_id: fortuneId,
            domain_code: "overall",
            headline: "백필",
            summary: "Gate 17",
            score: 0.5,
            confidence: 0.5,
            display_order: 0,
          }),
        });
      }
    } else {
      await fetch(`${url}/rest/v1/daily_fortunes?id=eq.${fortuneId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ context_id: contextId }),
      });
    }

    results.push({
      questionId: q.id,
      ok: true,
      contextId: `${String(contextId).slice(0, 8)}…`,
      fortuneId: fortuneId ? `${String(fortuneId).slice(0, 8)}…` : null,
      eventDate,
    });
  }

  console.log(JSON.stringify({ ok: true, linked: results.length, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
