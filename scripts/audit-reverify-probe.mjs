/**
 * Independent audit probe — migrations, shared context_id, events, quote RPC, mood bypass.
 * Usage: node scripts/audit-reverify-probe.mjs
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
const service = get("SUPABASE_SERVICE_ROLE_KEY");
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const svc = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function headCount(table, query = "", select = "id") {
  const r = await fetch(`${url}/rest/v1/${table}?select=${select}${query}`, {
    method: "HEAD",
    headers: { ...svc, Prefer: "count=exact" },
  });
  return { status: r.status, range: r.headers.get("content-range") };
}

async function sample(table, select, query = "", limit = 5) {
  const r = await fetch(
    `${url}/rest/v1/${table}?select=${select}${query}&limit=${limit}`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  );
  const text = await r.text();
  let rows = [];
  try {
    rows = JSON.parse(text);
  } catch {
    return { status: r.status, error: text.slice(0, 300) };
  }
  return {
    status: r.status,
    rows: (Array.isArray(rows) ? rows : []).map((row) => {
      const copy = { ...row };
      if (typeof copy.user_id === "string") {
        copy.user_id = `${copy.user_id.slice(0, 8)}…`;
      }
      if (typeof copy.embedding !== "undefined") {
        copy.embedding = copy.embedding == null ? null : "[vector]";
      }
      return copy;
    }),
  };
}

async function main() {
  // §6 migrations
  const mig = {
    onboarding: await headCount("journal_onboarding_profiles", "", "user_id"),
    firstRecordedAt: await fetch(
      `${url}/rest/v1/journal_entries?select=first_recorded_at&limit=1`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` } }
    ).then(async (r) => ({
      status: r.status,
      body: (await r.text()).slice(0, 120),
    })),
    fitNeutral: null,
  };

  // try fit_neutral insert then delete
  const qfProbeUser = await sample("question_feedback_events", "user_id", "", 1);
  const uid = qfProbeUser.rows?.[0]?.user_id;
  // can't use truncated id — refetch raw
  const rawUser = await fetch(
    `${url}/rest/v1/question_feedback_events?select=user_id&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  ).then((r) => r.json());
  const realUid = rawUser?.[0]?.user_id;

  if (realUid) {
    const ins = await fetch(`${url}/rest/v1/question_feedback_events`, {
      method: "POST",
      headers: svc,
      body: JSON.stringify({
        user_id: realUid,
        event_type: "fit_neutral",
        payload: { audit: true },
      }),
    });
    const insBody = await ins.text();
    mig.fitNeutral = { status: ins.status, ok: ins.ok, body: insBody.slice(0, 200) };
    if (ins.ok) {
      try {
        const parsed = JSON.parse(insBody);
        const id = parsed?.[0]?.id;
        if (id) {
          await fetch(`${url}/rest/v1/question_feedback_events?id=eq.${id}`, {
            method: "DELETE",
            headers: { apikey: service, Authorization: `Bearer ${service}` },
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  // §7 shared context
  const linked = {
    questions: await sample(
      "daily_questions",
      "id,user_id,question_date,context_id",
      "&context_id=not.is.null",
      3
    ),
    fortunes: await sample(
      "daily_fortunes",
      "id,user_id,event_date,context_id",
      "&context_id=not.is.null",
      3
    ),
    contexts: await sample(
      "daily_insight_contexts",
      "id,user_id,event_date",
      "",
      3
    ),
  };

  // same context shared?
  const qCtx = linked.questions.rows?.[0]?.context_id;
  const fCtx = linked.fortunes.rows?.[0]?.context_id;
  const sharedSame =
    qCtx && fCtx && qCtx === fCtx
      ? true
      : qCtx && fCtx
        ? false
        : null;

  // §11 quote RPC
  const quotes = await sample(
    "quote_library",
    "id,quote_text_ko,active,embedding",
    "&active=eq.true",
    1
  );
  let rpc = { status: null, hits: 0, body: "" };
  if (quotes.rows?.[0]) {
    // use zero vector — still should return rows if embeddings exist (ordered by distance)
    const zero = Array(1536).fill(0);
    const r = await fetch(`${url}/rest/v1/rpc/match_quote_library`, {
      method: "POST",
      headers: svc,
      body: JSON.stringify({ query_embedding: zero, match_count: 3 }),
    });
    const body = await r.text();
    let hits = 0;
    try {
      hits = JSON.parse(body)?.length ?? 0;
    } catch {
      /* */
    }
    rpc = { status: r.status, hits, body: body.slice(0, 250) };
  }

  // §20 event tables
  const events = {
    content_exposure: await headCount("content_exposure_events"),
    question_feedback: await headCount("question_feedback_events"),
    quote_deliveries: await headCount("daily_quote_deliveries"),
    daily_questions: await headCount("daily_questions"),
    daily_fortunes: await headCount("daily_fortunes"),
  };

  // §21 anon cannot read private tables
  const anonHeaders = {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
  const isolation = {};
  for (const table of [
    "daily_insight_contexts",
    "daily_fortunes",
    "daily_questions",
    "journal_entries",
    "question_feedback_events",
  ]) {
    const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=5`, {
      headers: anonHeaders,
    });
    const text = await r.text();
    let n = 0;
    try {
      n = Array.isArray(JSON.parse(text)) ? JSON.parse(text).length : -1;
    } catch {
      n = -1;
    }
    isolation[table] = { status: r.status, rowsVisible: n };
  }

  // mood_labels length > 3 via service (constraint check)
  let moodBypass = { note: "no journal entry to probe" };
  const je = await fetch(
    `${url}/rest/v1/journal_entries?select=id,user_id,entry_date&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  ).then((r) => r.json());
  if (je?.[0]?.id) {
    const probe = await fetch(
      `${url}/rest/v1/journal_entries?id=eq.${je[0].id}`,
      {
        method: "PATCH",
        headers: svc,
        body: JSON.stringify({
          mood_labels: ["a", "b", "c", "d"],
        }),
      }
    );
    const pb = await probe.text();
    moodBypass = {
      status: probe.status,
      blocked: !probe.ok,
      body: pb.slice(0, 250),
    };
  }

  console.log(
    JSON.stringify(
      {
        mig,
        linked,
        sharedContextIdEqual: sharedSame,
        questionContextId: qCtx ? `${String(qCtx).slice(0, 8)}…` : null,
        fortuneContextId: fCtx ? `${String(fCtx).slice(0, 8)}…` : null,
        quoteRpc: rpc,
        quoteSample: quotes,
        events,
        isolationAnon: isolation,
        moodLabelsMax3: moodBypass,
        embeddingCount: await headCount("quote_library", "&embedding=not.is.null"),
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
