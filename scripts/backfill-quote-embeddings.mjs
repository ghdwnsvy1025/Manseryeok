/**
 * Backfill OpenAI embeddings for quote_library rows missing embedding.
 * Usage: node scripts/backfill-quote-embeddings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("missing .env.local");
  }
  let text = fs.readFileSync(envPath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out = {};
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
    out[k] = [...v]
      .filter((ch) => ch.charCodeAt(0) < 128)
      .join("")
      .trim();
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = env.OPENAI_API_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const listRes = await fetch(
    `${url}/rest/v1/quote_library?select=id,quote_text_ko,author_name,active,embedding&embedding=is.null&order=created_at.asc&limit=100`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const rows = await listRes.json();
  if (!Array.isArray(rows)) {
    console.log(JSON.stringify({ ok: false, error: rows }, null, 2));
    process.exit(2);
  }
  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: true, updated: 0, note: "nothing_to_backfill" }));
    return;
  }

  const client = new OpenAI({ apiKey });
  const results = [];

  for (const row of rows) {
    const text = [row.quote_text_ko, row.author_name].filter(Boolean).join(" ");
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const embedding = emb.data[0].embedding;
    const patch = await fetch(`${url}/rest/v1/quote_library?id=eq.${row.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        embedding,
        updated_at: new Date().toISOString(),
      }),
    });
    const body = await patch.text();
    results.push({
      id: `${String(row.id).slice(0, 8)}…`,
      status: patch.status,
      dims: embedding.length,
      active: row.active,
      ok: patch.ok,
      err: patch.ok ? null : body.slice(0, 200),
    });
  }

  // Probe RPC with first updated embedding text
  const probeText = rows[0]?.quote_text_ko ?? "희망";
  const probeEmb = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: probeText,
  });
  const rpc = await fetch(`${url}/rest/v1/rpc/match_quote_library`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query_embedding: probeEmb.data[0].embedding,
      match_count: 3,
    }),
  });
  const rpcBody = await rpc.text();
  let rpcHits = 0;
  try {
    const parsed = JSON.parse(rpcBody);
    rpcHits = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    /* ignore */
  }

  const countRes = await fetch(
    `${url}/rest/v1/quote_library?select=id&embedding=not.is.null`,
    { headers: { ...headers, Prefer: "count=exact" }, method: "HEAD" }
  );

  console.log(
    JSON.stringify(
      {
        ok: results.every((r) => r.ok),
        updated: results.filter((r) => r.ok).length,
        results,
        rpc: { status: rpc.status, hits: rpcHits },
        quotesWithEmbedding: countRes.headers.get("content-range"),
      },
      null,
      2
    )
  );
  process.exit(results.every((r) => r.ok) && rpc.status === 200 ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
