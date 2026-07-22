import { getSupabaseEnv, restCount } from "./lib/supabaseEnv.mjs";

const REQUIRED = [
  "astrology_profiles",
  "astrology_snapshots",
  "astrology_feature_vectors",
];

const JOURNAL = [
  "category_catalog",
  "journal_entries",
  "category_scores",
];

const REQUIRED_COLUMNS = {
  astrology_profiles: [
    "id",
    "user_id",
    "saju_profile_id",
    "original_pillars",
    "original_element_distribution",
    "day_master",
    "theory_version",
    "feature_schema_version",
  ],
  astrology_snapshots: [
    "id",
    "user_id",
    "local_date",
    "calculation_mode",
    "raw_calculation_payload",
    "element_distribution",
    "calculation_version",
    "theory_version",
    "feature_schema_version",
    "status",
  ],
  astrology_feature_vectors: [
    "id",
    "snapshot_id",
    "user_id",
    "vector",
    "feature_schema_version",
    "calculation_version",
  ],
};

async function probeColumns(url, key, table, columns) {
  // PostgREST returns error if unknown column requested
  const select = columns.join(",");
  const r = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=0`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const body = r.ok ? null : (await r.text()).slice(0, 300);
  return { ok: r.ok, status: r.status, body };
}

async function main() {
  const env = getSupabaseEnv();
  if (!env.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: env.reason,
          nextAction:
            ".env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  const { url, serviceKey, anonKey } = env;
  const out = {
    ok: false,
    host: new URL(url).host,
    tables: {},
    columns: {},
    diaryEntriesCount: null,
    journalEntriesCount: null,
    rlsProbeAnon: {},
    uniqueness: {
      note: "동일 버전 unique + 다른 버전 병존은 DB constraint로 보장; 원격 CRUD는 JWT 필요",
      indexExpected: "astrology_snapshots_idempotent_uidx",
    },
    crossUserRlsReady: false,
    nextActions: [],
    errors: [],
  };

  for (const t of [...REQUIRED, "diary_entries", ...JOURNAL]) {
    out.tables[t] = await restCount(url, serviceKey, t);
  }

  if (out.tables.diary_entries?.ok) {
    out.diaryEntriesCount = out.tables.diary_entries.count;
  }

  if (out.tables.journal_entries?.ok) {
    out.journalEntriesCount = out.tables.journal_entries.count;
  }

  const missing = REQUIRED.filter((t) => !out.tables[t]?.ok);
  if (missing.length) {
    out.errors.push({
      code: "migration_009_not_applied",
      missing,
      message: "astrology_* 테이블이 없습니다. 009 SQL을 SQL Editor에서 적용하세요.",
    });
    out.nextActions.push(
      "1) docs/MIGRATION_STRATEGY.md 적용 전 SQL로 diary_entries count 기록"
    );
    out.nextActions.push(
      "2) supabase/migrations/008_journal_category_system.sql 적용 (미적용 시)"
    );
    out.nextActions.push(
      "3) supabase/migrations/009_astrology_snapshots.sql 적용"
    );
    out.nextActions.push("4) node scripts/verify-astrology-009.mjs 재실행");
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    out.columns[table] = await probeColumns(url, serviceKey, table, cols);
    if (!out.columns[table].ok) {
      out.errors.push({
        code: "missing_columns",
        table,
        body: out.columns[table].body,
      });
    }
  }

  if (anonKey) {
    for (const t of REQUIRED) {
      out.rlsProbeAnon[t] = await restCount(url, anonKey, t);
    }
  } else {
    out.nextActions.push("anon key 없음 — RLS anon probe 스킵");
  }

  const aJwt = env.env.TEST_USER_A_JWT || "";
  const bJwt = env.env.TEST_USER_B_JWT || "";
  out.crossUserRlsReady = Boolean(aJwt && bJwt);
  if (!out.crossUserRlsReady) {
    out.nextActions.push(
      "교차 사용자 RLS: .env.local에 TEST_USER_A_JWT / TEST_USER_B_JWT 설정 후 node scripts/verify-rls-cross-user.mjs"
    );
    out.nextActions.push(
      "또는 docs/RLS_CROSS_USER_VERIFICATION.md 수동 절차"
    );
  }

  out.ok =
    missing.length === 0 &&
    Object.values(out.columns).every((c) => c.ok) &&
    out.errors.length === 0;

  if (!out.ok) {
    process.exitCode = 1;
  } else if (!out.crossUserRlsReady) {
    out.errors.push({
      code: "rls_cross_user_pending",
      message: "테이블은 있으나 교차 사용자 JWT 검증은 미완료 — 운영 검증 완료로 보지 말 것",
    });
    // still exit 0 for schema ok but flag in JSON — user asked not to treat as success for full ops
    // Use exit 0 for schema, document pending RLS. Actually user said don't treat as success if not applied.
    // Schema applied = partial success. exit 0 with ok:true but productionReady:false
  }

  out.productionReady = false;
  out.remoteRlsVerification = out.crossUserRlsReady ? "run_verify_rls_script" : "pending";

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
