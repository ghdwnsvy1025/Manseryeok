/**
 * Gate B 마이그레이션(021~023) 적용 여부 read-only 점검.
 * 개인정보는 출력하지 않는다. 스키마 존재 여부와 제약 동작만 본다.
 * Usage: node scripts/verify-gate-b-migrations.mjs
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

/** 테이블 존재 여부 */
async function tableExists(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers,
  });
  return { table, exists: res.ok, status: res.status };
}

/** 컬럼 존재 여부 — 없는 컬럼을 select하면 PostgREST가 400을 준다 */
async function columnExists(table, column) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, {
    headers,
  });
  return { table, column, exists: res.ok, status: res.status };
}

/**
 * check 제약이 특정 값을 허용하는지 — 존재하지 않는 user_id로 insert해서
 * 되돌아오는 에러가 FK 위반(23503)이면 check는 통과한 것,
 * check 위반(23514)이면 제약이 값을 거부한 것.
 * 실제로 행이 쓰이지 않으므로 read-only에 준한다.
 */
async function checkAllowsValue(table, row, label) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (res.ok) {
    return { label, allowed: true, note: "inserted (unexpected)" };
  }
  const body = await res.text();
  let code = "";
  try {
    code = JSON.parse(body).code ?? "";
  } catch {
    code = "";
  }
  if (code === "23514") return { label, allowed: false, reason: "check_violation" };
  if (code === "23503") return { label, allowed: true, reason: "fk_only" };
  return { label, allowed: "unknown", code, detail: body.slice(0, 160) };
}

const FAKE_USER = "00000000-0000-0000-0000-000000000000";

const out = {
  "021_journal_onboarding": await tableExists("journal_onboarding_profiles"),
  "022_first_recorded_at": await columnExists(
    "journal_entries",
    "first_recorded_at"
  ),
  "023_fit_neutral": await checkAllowsValue(
    "question_feedback_events",
    {
      user_id: FAKE_USER,
      question_date: "2026-07-25",
      event_type: "fit_neutral",
      rating: 3,
    },
    "question_feedback_events.event_type=fit_neutral"
  ),
};

out.applied = {
  "021": out["021_journal_onboarding"].exists,
  "022": out["022_first_recorded_at"].exists,
  "023": out["023_fit_neutral"].allowed === true,
};
out.allApplied = Object.values(out.applied).every(Boolean);

console.log(JSON.stringify(out, null, 2));
