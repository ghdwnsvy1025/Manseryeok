/**
 * Gate 17 DB relationship probe (counts + quote RPC + samples).
 * Usage: node scripts/verify-gate-17-db.mjs
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

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function headCount(table, query = "", select = "id") {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=${select}${query}`,
    {
      headers: { ...headers, Prefer: "count=exact" },
      method: "HEAD",
    }
  );
  return {
    status: response.status,
    range: response.headers.get("content-range"),
  };
}

async function sample(table, select, limit = 3) {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=${select}&limit=${limit}`,
    { headers }
  );
  const text = await response.text();
  let rows = null;
  if (response.ok) {
    try {
      rows = JSON.parse(text);
    } catch {
      rows = text.slice(0, 200);
    }
  }
  return {
    status: response.status,
    ok: response.ok,
    rows: response.ok
      ? (Array.isArray(rows) ? rows : []).map((row) => {
          const copy = { ...row };
          if ("user_id" in copy && typeof copy.user_id === "string") {
            copy.user_id = `${copy.user_id.slice(0, 8)}…`;
          }
          if ("embedding" in copy) {
            copy.embedding = copy.embedding == null ? null : "[present]";
          }
          if ("question_text" in copy && typeof copy.question_text === "string") {
            copy.question_text = copy.question_text.slice(0, 40);
          }
          if (
            "overall_headline" in copy &&
            typeof copy.overall_headline === "string"
          ) {
            copy.overall_headline = copy.overall_headline.slice(0, 40);
          }
          if ("quote_text" in copy && typeof copy.quote_text === "string") {
            copy.quote_text = copy.quote_text.slice(0, 40);
          }
          return copy;
        })
      : text.slice(0, 200),
  };
}

async function rpcMatch() {
  const response = await fetch(`${url}/rest/v1/rpc/match_quote_library`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      query_embedding: Array(1536).fill(0),
      match_count: 1,
    }),
  });
  const body = (await response.text()).slice(0, 300);
  return { status: response.status, body };
}

async function main() {
  const tables = [
    "daily_insight_contexts",
    "daily_fortunes",
    "daily_fortune_sections",
    "daily_questions",
    "daily_quote_deliveries",
    "quote_library",
    "content_exposure_events",
    "question_feedback_events",
    "journal_onboarding_profiles",
  ];

  const counts = {};
  for (const table of tables) {
    const select = table === "journal_onboarding_profiles" ? "user_id" : "id";
    counts[table] = await headCount(table, "", select);
  }

  const linked = {
    fortunesWithContext: await headCount(
      "daily_fortunes",
      "&context_id=not.is.null"
    ),
    questionsWithContext: await headCount(
      "daily_questions",
      "&context_id=not.is.null"
    ),
    quotesWithEmbedding: await headCount(
      "quote_library",
      "&embedding=not.is.null"
    ),
  };

  const result = {
    ok: Object.values(counts).every((c) => c.status === 200),
    counts,
    linked,
    rpc: await rpcMatch(),
    samples: {
      quote_library: await sample("quote_library", "*", 3),
      daily_insight_contexts: await sample("daily_insight_contexts", "*", 3),
      daily_fortunes: await sample("daily_fortunes", "*", 3),
      daily_questions: await sample("daily_questions", "*", 3),
      daily_quote_deliveries: await sample("daily_quote_deliveries", "*", 3),
      journal_onboarding_profiles: await sample(
        "journal_onboarding_profiles",
        "*",
        3
      ),
    },
  };

  const schemaIssues = [];
  if (counts.journal_onboarding_profiles?.status === 400) {
    schemaIssues.push("journal_onboarding_profiles HEAD select=id failed");
  }
  result.schemaIssues = schemaIssues;
  result.gate17Notes = {
    contextsEmpty: counts.daily_insight_contexts?.range === "*/0",
    fortunesEmpty: counts.daily_fortunes?.range === "*/0",
    embeddingsEmpty: linked.quotesWithEmbedding?.range === "*/0",
    rpcOk: result.rpc.status === 200,
  };

  console.log(JSON.stringify(result, null, 2));
  const hardFail = Object.entries(counts).some(
    ([name, c]) => name !== "journal_onboarding_profiles" && c.status !== 200
  );
  process.exit(hardFail ? 2 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
