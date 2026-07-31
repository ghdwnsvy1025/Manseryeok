/**
 * 출처 검증 고전 명언 시드 (우선: 동양 500 + 서양 500).
 * 한국어 격언 5000은 --include-aphorisms 로만 후순위 시드.
 *
 * Usage:
 *   node scripts/seed-verified-classic-quotes.mjs
 *   node scripts/seed-verified-classic-quotes.mjs --include-aphorisms
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const quotesDir = path.join(root, "data", "quotes");

const INCLUDE_APHORISMS = process.argv.includes("--include-aphorisms");
const BATCH = 80;

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("missing .env.local");
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

/** 본문에서 테마·톤·적합 상태 추정 — 일기/기분 매칭용 */
const INFER_RULES = [
  {
    re: /인내|견디|참으|버티|참고/,
    themes: ["인내", "회복"],
    tone: ["차분", "위로"],
    suitable: ["지침", "불안", "슬픔", "답답함"],
  },
  {
    re: /분노|화내|격정|성냄|노여/,
    themes: ["평정", "절제"],
    tone: ["차분", "인정"],
    suitable: ["분노", "짜증남", "답답함"],
  },
  {
    re: /고요|평온|침묵|고요히|차분/,
    themes: ["안정", "평정"],
    tone: ["차분", "회복"],
    suitable: ["불안", "지침", "과부하"],
  },
  {
    re: /배움|배우|공부|지혜|앎|알면/,
    themes: ["배움", "성장"],
    tone: ["격려", "차분"],
    suitable: ["망설임", "불안"],
  },
  {
    re: /친구|우정|사랑|배려|온화|겸손/,
    themes: ["관계", "공감"],
    tone: ["따뜻", "동행"],
    suitable: ["외로움", "슬픔", "갈등"],
  },
  {
    re: /용기|두려움|겁|도전|시작/,
    themes: ["용기", "실행"],
    tone: ["격려", "단호"],
    suitable: ["불안", "망설임", "두려움"],
  },
  {
    re: /절제|중용|과욕|탐닉|욕심/,
    themes: ["절제", "균형"],
    tone: ["차분", "단호"],
    suitable: ["과부하", "짜증남"],
  },
  {
    re: /현재|오늘|순간|지금|하루/,
    themes: ["현재", "실행"],
    tone: ["격려", "활기"],
    suitable: ["망설임", "지침"],
    unsuitable: ["hard_day"],
  },
  {
    re: /희망|내일을|가능성|빛/,
    themes: ["희망", "회복"],
    tone: ["위로", "격려"],
    suitable: ["슬픔", "우울함", "지침"],
  },
  {
    re: /진실|성실|정직|본분|의무/,
    themes: ["성실", "책임"],
    tone: ["단호", "차분"],
    suitable: ["후회스러움", "불안"],
  },
  {
    re: /죽음|병|고통|슬픔|상실/,
    themes: ["수용", "위로"],
    tone: ["위로", "인정"],
    suitable: ["슬픔", "우울함", "지침"],
    unsuitable: [],
  },
  {
    re: /일|노동|부지런|게으/,
    themes: ["실행", "성실"],
    tone: ["격려", "단호"],
    suitable: ["지침", "망설임"],
  },
];

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function inferMeta(text) {
  const themes = [];
  const tone = [];
  const suitable = [];
  const unsuitable = [];
  for (const rule of INFER_RULES) {
    if (!rule.re.test(text)) continue;
    themes.push(...rule.themes);
    tone.push(...rule.tone);
    suitable.push(...(rule.suitable ?? []));
    unsuitable.push(...(rule.unsuitable ?? []));
  }
  return {
    themes: unique(themes).slice(0, 5),
    tone: unique(tone).slice(0, 4),
    suitable: unique(suitable).slice(0, 6),
    unsuitable: unique(unsuitable).slice(0, 3),
  };
}

function cleanAuthor(authorKo) {
  if (!authorKo) return null;
  return String(authorKo)
    .replace(/\(전통적 귀속\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapVerifiedQuote(q, dataset) {
  const text = String(q.text_ko ?? "").trim();
  if (!text || text.length < 8) return null;
  const inferred = inferMeta(text);
  const author = cleanAuthor(q.author_ko) || q.author || null;
  const work = q.work_ko || q.work || null;
  const location = q.location ? String(q.location) : null;
  return {
    quote_text_ko: text.slice(0, 400),
    original_text: q.text_source_en ? String(q.text_source_en).slice(0, 600) : null,
    author_name: author,
    work_title: work,
    publication_info: [location, q.id ? `id:${q.id}` : null]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 240),
    source_url: q.source_url ?? null,
    source_type: dataset,
    translator: q.source_translator
      ? `ko_from_${q.source_translator}`
      : "app_ko_semantic",
    language: "ko",
    themes_json:
      inferred.themes.length > 0 ? inferred.themes : ["성찰", "지혜"],
    emotional_tone_json:
      inferred.tone.length > 0 ? inferred.tone : ["차분", "성찰"],
    suitable_states_json:
      inferred.suitable.length > 0 ? inferred.suitable : ["불안", "망설임"],
    unsuitable_states_json: inferred.unsuitable,
    rights_status: "public_domain",
    verification_status: "primary_source_verified",
    attribution_confidence: 0.92,
    active: true,
    reviewed_by: "seed-verified-classic-quotes",
    reviewed_at: new Date().toISOString(),
  };
}

function mapAphorism(q) {
  const text = String(q.text ?? "").trim();
  if (!text || text.length < 8) return null;
  const category = q.category ? String(q.category) : "성찰";
  const tags = Array.isArray(q.tags) ? q.tags.map(String) : [];
  const inferred = inferMeta(text);
  return {
    quote_text_ko: text.slice(0, 400),
    original_text: null,
    author_name: "앱 내부 격언",
    work_title: null,
    publication_info: q.id ? `aphorism:${q.id}` : "korean_aphorisms_5000",
    source_url: null,
    source_type: "ai_aphorism_deferred",
    translator: null,
    language: "ko",
    themes_json: unique([category, ...tags, ...inferred.themes]).slice(0, 6),
    emotional_tone_json:
      inferred.tone.length > 0 ? inferred.tone : ["차분", "격려"],
    suitable_states_json: unique([
      ...inferred.suitable,
      category,
      ...tags,
    ]).slice(0, 8),
    unsuitable_states_json: inferred.unsuitable,
    rights_status: "internally_written",
    verification_status: "translation_verified",
    attribution_confidence: 0.7,
    active: true,
    reviewed_by: "seed-verified-classic-quotes",
    reviewed_at: new Date().toISOString(),
  };
}

async function fetchAllExisting(url, key) {
  const seen = new Set();
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${url}/rest/v1/quote_library?select=quote_text_ko,author_name&order=created_at.asc&limit=1000&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    if (rows.length === 0) break;
    for (const r of rows) {
      seen.add(`${r.quote_text_ko}||${r.author_name ?? ""}`);
    }
    offset += rows.length;
    if (rows.length < 1000) break;
  }
  return seen;
}

async function insertBatch(url, key, rows) {
  const res = await fetch(`${url}/rest/v1/quote_library`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`insert ${res.status}: ${body.slice(0, 600)}`);
  }
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");

  const classicPath = path.join(quotesDir, "verified_classic_quotes_500_ko.json");
  const westernPath = path.join(quotesDir, "western_classic_quotes_500_ko.json");
  const aphorismPath = path.join(quotesDir, "korean_aphorisms_5000.json");

  const classic = JSON.parse(fs.readFileSync(classicPath, "utf8"));
  const western = JSON.parse(fs.readFileSync(westernPath, "utf8"));

  /** @type {Array<Record<string, unknown>>} */
  const mapped = [];
  for (const q of classic.quotes ?? []) {
    const row = mapVerifiedQuote(q, "verified_classic_east");
    if (row) mapped.push(row);
  }
  for (const q of western.quotes ?? []) {
    const row = mapVerifiedQuote(q, "verified_classic_west");
    if (row) mapped.push(row);
  }

  let aphorismMapped = [];
  if (INCLUDE_APHORISMS) {
    const aph = JSON.parse(fs.readFileSync(aphorismPath, "utf8"));
    for (const q of aph.quotes ?? []) {
      const row = mapAphorism(q);
      if (row) aphorismMapped.push(row);
    }
  }

  const existing = await fetchAllExisting(url, key);
  const priority = mapped.filter(
    (r) => !existing.has(`${r.quote_text_ko}||${r.author_name ?? ""}`)
  );
  const deferred = aphorismMapped.filter(
    (r) => !existing.has(`${r.quote_text_ko}||${r.author_name ?? ""}`)
  );

  let inserted = 0;
  for (let i = 0; i < priority.length; i += BATCH) {
    const chunk = priority.slice(i, i + BATCH);
    await insertBatch(url, key, chunk);
    inserted += chunk.length;
    console.log(`classic batch ${i / BATCH + 1}: +${chunk.length} (total ${inserted})`);
  }

  let aphInserted = 0;
  if (INCLUDE_APHORISMS) {
    for (let i = 0; i < deferred.length; i += BATCH) {
      const chunk = deferred.slice(i, i + BATCH);
      await insertBatch(url, key, chunk);
      aphInserted += chunk.length;
      console.log(
        `aphorism batch ${i / BATCH + 1}: +${chunk.length} (total ${aphInserted})`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        classicReady: mapped.length,
        classicInserted: inserted,
        classicSkipped: mapped.length - priority.length,
        aphorismsIncluded: INCLUDE_APHORISMS,
        aphorismInserted: aphInserted,
        note: INCLUDE_APHORISMS
          ? "verified classics first, then aphorisms"
          : "aphorisms deferred — rerun with --include-aphorisms",
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
