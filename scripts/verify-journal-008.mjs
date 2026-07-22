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
  const lines = env.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) continue;
    let v = trimmed.slice(eq + 1).trim();
    // strip inline comments only when preceded by space
    const hash = v.search(/\s#/);
    if (hash >= 0) v = v.slice(0, hash).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    // headers must be ByteString
    v = [...v].filter((ch) => ch.charCodeAt(0) < 128).join("").trim();
    return v;
  }
  return "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!url || !key) {
  console.log(
    JSON.stringify({
      ok: false,
      reason: "missing_supabase_env",
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
      keyLen: key.length,
    })
  );
  process.exit(0);
}

const tables = [
  "category_catalog",
  "event_tag_catalog",
  "user_category_preferences",
  "journal_entries",
  "category_scores",
  "journal_entry_tags",
  "diary_entries",
];

async function countTable(table, authKey) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      Prefer: "count=exact",
    },
  });
  const cr = r.headers.get("content-range");
  const count = cr && cr.includes("/") ? Number(cr.split("/")[1]) : null;
  const body = r.ok ? null : (await r.text()).slice(0, 300);
  return { status: r.status, ok: r.ok, count, body };
}

async function main() {
  const out = {
    host: new URL(url).host,
    serviceRole: {},
    rlsProbeAnon: {},
    diaryEntriesCount: null,
    notes: [],
  };

  for (const t of tables) {
    out.serviceRole[t] = await countTable(t, key);
    if (t === "diary_entries" && out.serviceRole[t].ok) {
      out.diaryEntriesCount = out.serviceRole[t].count;
    }
  }

  for (const t of ["category_catalog", "event_tag_catalog"]) {
    if (out.serviceRole[t]?.ok) {
      const r = await fetch(`${url}/rest/v1/${t}?select=*`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: "count=exact",
        },
      });
      const cr = r.headers.get("content-range");
      out.serviceRole[t].fullCount =
        cr && cr.includes("/") ? Number(cr.split("/")[1]) : null;
    }
  }

  if (anon) {
    for (const t of [
      "journal_entries",
      "category_scores",
      "user_category_preferences",
      "journal_entry_tags",
    ]) {
      out.rlsProbeAnon[t] = await countTable(t, anon);
    }
  } else {
    out.notes.push("anon key missing — RLS probe skipped");
  }

  const required = tables.filter((t) => t !== "diary_entries");
  out.migration008Applied = required.every((t) => out.serviceRole[t]?.ok);
  out.ok = out.migration008Applied;
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
