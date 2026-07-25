/**
 * Probe category_scores raw_score constraint (1-5 vs 1-10).
 * Inserts a throwaway row on an unused (entry_id, category_code) pair, then deletes it.
 * Usage: node scripts/verify-category-scores-scale.mjs
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
    let v = trimmed.slice(eq + 1).trim();
    const hash = v.search(/\s#/);
    if (hash >= 0) v = v.slice(0, hash).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return [...v].filter((ch) => ch.charCodeAt(0) < 128).join("").trim();
  }
  return "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const PROBE_ID = "00000000-0000-4000-8000-000000000099";

async function cleanupProbe() {
  await fetch(`${url}/rest/v1/category_scores?id=eq.${PROBE_ID}`, {
    method: "DELETE",
    headers,
  });
}

async function main() {
  if (!url || !key) {
    console.log(JSON.stringify({ ok: false, reason: "missing_supabase_env" }));
    process.exit(2);
  }

  await cleanupProbe();

  const catalog = await fetch(
    `${url}/rest/v1/category_catalog?select=code&limit=50`,
    { headers }
  ).then((r) => r.json());
  const allCodes = Array.isArray(catalog)
    ? catalog.map((c) => c.code).filter(Boolean)
    : [];

  const entries = await fetch(
    `${url}/rest/v1/journal_entries?select=id,user_id&limit=1`,
    { headers }
  ).then((r) => r.json());

  if (!Array.isArray(entries) || entries.length === 0) {
    console.log(JSON.stringify({ ok: false, reason: "no_journal_entries" }));
    process.exit(2);
  }
  const entry = entries[0];

  const used = await fetch(
    `${url}/rest/v1/category_scores?select=category_code&entry_id=eq.${entry.id}`,
    { headers }
  ).then((r) => r.json());
  const usedCodes = new Set(
    Array.isArray(used) ? used.map((r) => r.category_code) : []
  );
  const freeCode = allCodes.find((c) => !usedCodes.has(c));

  const probe = freeCode
    ? await probeByInsert(entry, freeCode)
    : await probeByUpdate(entry);

  const stillFive =
    Boolean(probe.body) && /category_scores_raw_score_check/i.test(probe.body);

  console.log(
    JSON.stringify(
      {
        ok: probe.ok,
        mode: probe.mode,
        status: probe.status,
        target: probe.target,
        body: probe.body,
        likelyScale: probe.ok ? "1-10" : stillFive ? "still_1-5" : "other_error",
        hint: probe.ok
          ? "raw_score=8 accepted (1~10 제약 적용됨)"
          : stillFive
            ? "Run supabase/migrations/017_fix_category_scores_1_to_10.sql"
            : "예상치 못한 오류 — body 확인",
      },
      null,
      2
    )
  );
  process.exit(probe.ok ? 0 : 2);
}

async function probeByInsert(entry, code) {
  const res = await fetch(`${url}/rest/v1/category_scores`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: PROBE_ID,
      entry_id: entry.id,
      user_id: entry.user_id,
      category_code: code,
      raw_score: 8,
      is_not_applicable: false,
    }),
  });
  const body = res.ok ? null : (await res.text()).slice(0, 500);
  await cleanupProbe();
  return { mode: "insert", ok: res.ok, status: res.status, target: code, body };
}

/** 여유 카테고리가 없으면 기존 행의 raw_score를 잠깐 8로 바꾸고 즉시 원복한다. */
async function probeByUpdate(entry) {
  const rows = await fetch(
    `${url}/rest/v1/category_scores?select=id,category_code,raw_score,is_not_applicable&entry_id=eq.${entry.id}&limit=1`,
    { headers }
  ).then((r) => r.json());

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      mode: "update",
      ok: false,
      status: 0,
      target: null,
      body: "no_category_scores_row",
    };
  }
  const row = rows[0];

  const res = await fetch(`${url}/rest/v1/category_scores?id=eq.${row.id}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ raw_score: 8, is_not_applicable: false }),
  });
  const body = res.ok ? null : (await res.text()).slice(0, 500);

  if (res.ok) {
    await fetch(`${url}/rest/v1/category_scores?id=eq.${row.id}`, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        raw_score: row.raw_score,
        is_not_applicable: row.is_not_applicable,
      }),
    });
  }

  return {
    mode: "update",
    ok: res.ok,
    status: res.status,
    target: row.category_code,
    body,
  };
}

main().catch(async (e) => {
  await cleanupProbe().catch(() => {});
  console.error(e);
  process.exit(1);
});
