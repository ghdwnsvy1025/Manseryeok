/**
 * Seed one verified public-domain quote (Cicero) and ensure match_quote_library RPC exists.
 * Usage: node scripts/seed-cicero-quote.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line
      .slice(i + 1)
      .trim()
      .replace(/\s+#.*$/, "");
    out[k] = v;
  }
  return out;
}

const QUOTE_KO = "삶이 있는 한 희망은 있다";
const AUTHOR = "키케로";
const ORIGINAL = "Dum spiro, spero";

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // Check existing
  const listRes = await fetch(
    `${url}/rest/v1/quote_library?quote_text_ko=eq.${encodeURIComponent(QUOTE_KO)}&select=id,active,verification_status,rights_status`,
    { headers }
  );
  const existing = await listRes.json();
  console.log("existing rows", existing);

  let embedding = null;
  if (env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const emb = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: `${QUOTE_KO} ${AUTHOR}`,
      });
      embedding = emb.data[0].embedding;
      console.log("embedding dims", embedding.length);
    } catch (e) {
      console.warn("embedding failed", e.message);
    }
  }

  const payload = {
    quote_text_ko: QUOTE_KO,
    original_text: ORIGINAL,
    author_name: AUTHOR,
    work_title: "전통 귀속 격언 (Tusculanae Disputationes 계열 전통)",
    publication_info:
      "Public domain Latin proverb traditionally attributed to Cicero; Korean translation for app seed",
    source_url: null,
    source_type: "public_domain_tradition",
    translator: "app_internal_ko",
    language: "ko",
    themes_json: ["희망", "회복", "안정"],
    emotional_tone_json: ["차분", "인정"],
    suitable_states_json: ["지침", "불안", "슬픔"],
    unsuitable_states_json: [],
    rights_status: "public_domain",
    verification_status: "reputable_secondary_verified",
    attribution_confidence: 0.7,
    active: true,
    reviewed_by: "seed-script",
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (embedding) payload.embedding = embedding;

  let quoteId;
  if (Array.isArray(existing) && existing[0]?.id) {
    quoteId = existing[0].id;
    const upd = await fetch(
      `${url}/rest/v1/quote_library?id=eq.${quoteId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      }
    );
    console.log("updated", upd.status, await upd.text().then((t) => t.slice(0, 200)));
  } else {
    const ins = await fetch(`${url}/rest/v1/quote_library`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const body = await ins.text();
    console.log("inserted", ins.status, body.slice(0, 300));
    const parsed = JSON.parse(body);
    quoteId = parsed[0]?.id;
  }

  // Probe RPC
  if (embedding) {
    const rpc = await fetch(`${url}/rest/v1/rpc/match_quote_library`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: 5,
      }),
    });
    const rpcText = await rpc.text();
    console.log("match_quote_library", rpc.status, rpcText.slice(0, 400));
    if (rpc.status === 404) {
      console.log(
        "RPC missing — apply supabase/migrations/016_quote_library_embedding.sql in SQL Editor"
      );
    }
  }

  const countRes = await fetch(
    `${url}/rest/v1/quote_library?select=id&active=eq.true`,
    { headers: { ...headers, Prefer: "count=exact" } }
  );
  console.log(
    "active quote count header",
    countRes.headers.get("content-range")
  );
  console.log("seed done", { quoteId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
