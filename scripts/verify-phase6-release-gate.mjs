/**
 * Phase 6 — 최종 QA·출시 준비 · release gate (counts + schema presence)
 * Does not deploy. Does not mutate production user data.
 * Heavy e2e scripts remain separate (documented in RELEASE_CHECKLIST).
 *
 * Usage: node scripts/verify-phase6-release-gate.mjs
 */
import { getSupabaseEnv, restCount } from "./lib/supabaseEnv.mjs";

const TABLES = [
  "diary_entries",
  "user_profiles",
  "saju_profiles",
  "journal_entries",
  "category_scores",
  "journal_entry_tags",
  "user_category_preferences",
  "category_catalog",
  "event_tag_catalog",
  "astrology_profiles",
  "astrology_snapshots",
  "astrology_feature_vectors",
  "personalization_models",
  "personalization_model_metrics",
  "personalization_predictions",
  "knowledge_documents",
  "knowledge_chunks",
  "daily_forecasts",
];

const REQUIRED_008 = [
  "journal_entries",
  "category_scores",
  "category_catalog",
  "event_tag_catalog",
  "user_category_preferences",
];
const REQUIRED_009 = [
  "astrology_profiles",
  "astrology_snapshots",
  "astrology_feature_vectors",
];
const REQUIRED_010 = [
  "personalization_models",
  "personalization_model_metrics",
  "personalization_predictions",
];

async function main() {
  const failures = [];
  const out = {
    phase: "Phase 6 — 최종 QA·출시 준비",
    masterNote: "마스터 프롬프트 Phase 8 대응 (서두만)",
    counts: {},
    schema: { "008": null, "009": null, "010": null },
    anonProbe: {},
    failures: [],
    schemaDriftSuspected: false,
    dataPreservationSnapshot: {},
    releaseGateSchema: "pending",
  };

  const env = getSupabaseEnv();
  if (!env.ok || !env.serviceKey) {
    failures.push({ code: "env", detail: env.reason || "need service role" });
    out.failures = failures;
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  for (const t of TABLES) {
    const c = await restCount(env.url, env.serviceKey, t);
    out.counts[t] = { ok: c.ok, status: c.status, count: c.count };
    if (!c.ok && c.status === 404) {
      failures.push({ code: `missing_table_${t}`, detail: c.body });
    }
  }

  const present = (list) =>
    list.every((t) => out.counts[t]?.ok && out.counts[t]?.status !== 404);

  out.schema["008"] = present(REQUIRED_008) ? "present" : "missing";
  out.schema["009"] = present(REQUIRED_009) ? "present" : "missing";
  out.schema["010"] = present(REQUIRED_010) ? "present" : "missing";

  for (const [label, list] of [
    ["008", REQUIRED_008],
    ["009", REQUIRED_009],
    ["010", REQUIRED_010],
  ]) {
    if (out.schema[label] !== "present") {
      failures.push({ code: `schema_${label}`, detail: list });
    }
  }

  // Anon must not freely read personal tables
  const anonTables = [
    "journal_entries",
    "astrology_snapshots",
    "personalization_models",
    "diary_entries",
  ];
  for (const t of anonTables) {
    const r = await fetch(`${env.url}/rest/v1/${t}?select=id&limit=1`, {
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
    });
    const text = await r.text();
    let rows = [];
    try {
      rows = JSON.parse(text);
    } catch {
      rows = [];
    }
    const leaked = r.ok && Array.isArray(rows) && rows.length > 0;
    out.anonProbe[t] = {
      status: r.status,
      ok: r.ok,
      rowCount: Array.isArray(rows) ? rows.length : null,
      leaked,
    };
    // Empty array with 200 can be RLS filtering — OK if no rows returned
    // 401/403 also OK. Leak = rows visible to anon.
    if (leaked) {
      failures.push({ code: `anon_leak_${t}`, detail: out.anonProbe[t] });
    }
  }

  out.dataPreservationSnapshot = {
    diary_entries: out.counts.diary_entries?.count ?? null,
    journal_entries: out.counts.journal_entries?.count ?? null,
    category_scores: out.counts.category_scores?.count ?? null,
    astrology_profiles: out.counts.astrology_profiles?.count ?? null,
    astrology_snapshots: out.counts.astrology_snapshots?.count ?? null,
    astrology_feature_vectors:
      out.counts.astrology_feature_vectors?.count ?? null,
    personalization_models: out.counts.personalization_models?.count ?? null,
    personalization_model_metrics:
      out.counts.personalization_model_metrics?.count ?? null,
    personalization_predictions:
      out.counts.personalization_predictions?.count ?? null,
  };

  // Drift heuristic: required tables missing vs SQL in repo
  out.schemaDriftSuspected = failures.some((f) =>
    String(f.code).startsWith("schema_")
  );

  out.failures = failures;
  out.releaseGateSchema = failures.length === 0 ? "complete" : "failed";
  out.note =
    "Heavy RLS/training/analysis e2e are separate release-gate commands — see docs/RELEASE_CHECKLIST.md";

  console.log(JSON.stringify(out, null, 2));
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
