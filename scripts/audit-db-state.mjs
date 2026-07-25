/**
 * AUDIT ARTIFACT — 원격 DB 상태 read-only 점검.
 * 개인정보(일기 원문·생년월일)는 절대 출력하지 않는다. 카운트/스키마만.
 * Usage: node scripts/audit-db-state.mjs
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return [...v].filter((c) => c.charCodeAt(0) < 128).join("").trim();
  }
  return "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const TABLES = [
  "journal_entries",
  "category_scores",
  "journal_entry_tags",
  "daily_insight_contexts",
  "daily_fortunes",
  "daily_fortune_sections",
  "quote_library",
  "daily_quote_deliveries",
  "content_exposure_events",
  "content_feedback",
  "question_feedback_events",
  "personalization_models",
  "knowledge_documents",
];

async function count(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) {
    return { table, exists: false, status: res.status, detail: (await res.text()).slice(0, 160) };
  }
  const range = res.headers.get("content-range") || "";
  const total = range.split("/")[1] ?? "?";
  return { table, exists: true, rows: total };
}

async function quoteBreakdown() {
  const res = await fetch(
    `${url}/rest/v1/quote_library?select=verification_status,rights_status,active,embedding`,
    { headers }
  );
  if (!res.ok) return { error: res.status };
  const rows = await res.json();
  const exposable = rows.filter(
    (r) =>
      r.active &&
      ["primary_source_verified", "reputable_secondary_verified", "translation_verified"].includes(
        r.verification_status
      ) &&
      ["public_domain", "licensed", "permission_granted", "internally_written"].includes(
        r.rights_status
      )
  );
  return {
    total: rows.length,
    exposable: exposable.length,
    withEmbedding: rows.filter((r) => r.embedding).length,
  };
}

async function anonReadsQuoteLibrary() {
  // RLS 검증: 익명 키로 quote_library 읽기 시도
  const res = await fetch(`${url}/rest/v1/quote_library?select=id&limit=5`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const body = await res.text();
  let n = null;
  try {
    n = JSON.parse(body).length;
  } catch {
    /* not an array */
  }
  return { status: res.status, rowsVisibleToAnon: n, detail: n == null ? body.slice(0, 160) : undefined };
}

async function anonReadsJournal() {
  const res = await fetch(`${url}/rest/v1/journal_entries?select=id&limit=5`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const body = await res.text();
  let n = null;
  try {
    n = JSON.parse(body).length;
  } catch {
    /* ignore */
  }
  return { status: res.status, rowsVisibleToAnon: n };
}

async function rpcExists(name) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = (await res.text()).slice(0, 200);
  return { rpc: name, status: res.status, missing: /Could not find the function|PGRST202/.test(body) };
}

async function main() {
  const out = { tables: [], quoteLibrary: null, rls: {}, rpc: [] };
  for (const t of TABLES) out.tables.push(await count(t));
  out.quoteLibrary = await quoteBreakdown();
  out.rls.anon_quote_library = await anonReadsQuoteLibrary();
  out.rls.anon_journal_entries = await anonReadsJournal();
  out.rpc.push(await rpcExists("match_quote_library"));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
