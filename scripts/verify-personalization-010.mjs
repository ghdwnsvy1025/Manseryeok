/**
 * Phase 4 — 개인화 Ridge MVP · remote schema / preservation verify
 *
 * Usage (010 적용 후):
 *   # 적용 전 기록한 기준 행 수를 .env.local 에 넣은 뒤
 *   BASELINE_DIARY_ENTRIES=2
 *   BASELINE_JOURNAL_ENTRIES=…
 *   BASELINE_ASTROLOGY_SNAPSHOTS=…
 *   node scripts/verify-personalization-010.mjs
 *
 * Does NOT claim Phase 4 production readiness.
 * Cross-user RLS: node scripts/verify-rls-personalization-010.mjs
 *
 * Empty table count=0 is NEVER treated as RLS pass.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, restCount } from "./lib/supabaseEnv.mjs";

const PHASE = "Phase 4 — 개인화 Ridge MVP";

const PERSONALIZATION = [
  "personalization_models",
  "personalization_model_metrics",
  "personalization_predictions",
];

const JOURNAL_008 = [
  "category_catalog",
  "event_tag_catalog",
  "user_category_preferences",
  "journal_entries",
  "category_scores",
  "journal_entry_tags",
];

const ASTROLOGY_009 = [
  "astrology_profiles",
  "astrology_snapshots",
  "astrology_feature_vectors",
];

const REQUIRED_COLUMNS = {
  personalization_models: [
    "id",
    "user_id",
    "category_key",
    "model_type",
    "model_status",
    "data_stage",
    "valid_sample_count",
    "feature_keys",
    "coefficients",
    "intercept",
    "lambda",
    "feature_means",
    "feature_stds",
    "normalization_metadata",
    "baseline_metrics",
    "model_metrics",
    "confidence_components",
    "confidence_score",
    "confidence_band",
    "prediction_visible",
    "calculation_version",
    "theory_version",
    "feature_schema_version",
    "model_version",
    "allowlist_version",
    "model_code_version",
    "training_run_key",
    "created_at",
    "deprecated_at",
  ],
  personalization_model_metrics: [
    "id",
    "model_id",
    "user_id",
    "baseline_mae",
    "ridge_mae",
    "mae_improvement",
    "created_at",
  ],
  personalization_predictions: [
    "id",
    "model_id",
    "user_id",
    "category_key",
    "local_date",
    "predicted_z",
    "visible",
    "created_at",
  ],
};

/** train.ts / featureMatrix 가 넣을 수 있는 verified 후보 (원국 단독 제외) */
const ALLOWED_FEATURE_KEYS = new Set([
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
  "axisPeer",
  "axisOutput",
  "axisWealth",
  "axisAuthority",
  "axisResource",
  "luck_daewoon_rate",
  "luck_yearly_rate",
  "luck_monthly_rate",
  "luck_daily_rate",
  "rel_yukhap",
  "rel_chung",
  "rel_hyeong",
  "rel_pa",
  "rel_hae",
  "rel_cheonGanHap",
  "tenGod_비견",
  "tenGod_겁재",
  "tenGod_식신",
  "tenGod_상관",
  "tenGod_편재",
  "tenGod_정재",
  "tenGod_편관",
  "tenGod_정관",
  "tenGod_편인",
  "tenGod_정인",
]);

/** 학습에 단독 입력 금지 — 저장되어 있으면 실패 */
const FORBIDDEN_FEATURE_KEYS = new Set([
  "yinRatio",
  "yangRatio",
  "original_rate",
]);

function parseBaseline(env, key) {
  const raw = env[key];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function probeColumns(url, key, table, columns) {
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

function modelPayload(userId, runKey, modelVersion) {
  return {
    user_id: userId,
    category_key: "verify_energy",
    model_type: "ridge",
    model_status: "insufficient_data",
    data_stage: "insufficient_data",
    valid_sample_count: 0,
    feature_keys: ["axisPeer", "luck_daily_rate"],
    coefficients: [0.1, 0.2],
    intercept: 0,
    lambda: 10,
    feature_means: [0, 0],
    feature_stds: [1, 1],
    normalization_metadata: { marker: "verify-010" },
    baseline_metrics: {},
    model_metrics: {},
    confidence_components: {},
    confidence_score: 0,
    confidence_band: "insufficient",
    prediction_visible: false,
    summary_text: "verify-010 probe",
    calculation_version: "saju-calc-1.0.0",
    theory_version: "sajubase-final-2026-07-19",
    feature_schema_version: "saju-feature-mvp-1.0.0",
    model_version: modelVersion,
    allowlist_version: "saju-feature-catalog-1.0.0",
    model_code_version: "ridge-mvp-1.0.0",
    training_run_key: runKey,
  };
}

async function main() {
  const envBundle = getSupabaseEnv();
  if (!envBundle.ok || !envBundle.serviceKey) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          phase: PHASE,
          reason: envBundle.ok ? "missing_service_role" : envBundle.reason,
          verdict: {
            remoteMigration: "pending",
            schemaVerification: "pending",
            existingDataPreservation: "pending",
            crossUserRlsVerification: "pending",
            approximateFeatureExclusion: "pending",
            phase4ProductionReadiness: "pending",
            appWideProductionReadiness: "pending",
          },
          nextActions: [
            ".env.local에 NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE 확인",
          ],
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  const { url, serviceKey, anonKey, env } = envBundle;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const baseline = {
    diary_entries: parseBaseline(env, "BASELINE_DIARY_ENTRIES"),
    journal_entries: parseBaseline(env, "BASELINE_JOURNAL_ENTRIES"),
    astrology_snapshots: parseBaseline(env, "BASELINE_ASTROLOGY_SNAPSHOTS"),
  };

  const out = {
    phase: PHASE,
    ok: false,
    host: new URL(url).host,
    checks: {
      tablesExist: false,
      requiredColumns: false,
      rlsEnabledInferred: "not_proven_by_empty_count",
      ownerPolicyProven: "deferred_to_verify-rls-personalization-010",
      trainingRunKeyUnique: false,
      modelVersionCoexistence: false,
      duplicateTrainPrevented: false,
      diaryUnchanged: null,
      journalUnchanged: null,
      astrologyUnchanged: null,
      journal008Intact: false,
      astrology009Intact: false,
      featureKeysAllowlist: false,
    },
    baseline,
    counts: {
      serviceRole: {},
      anon: {},
    },
    columns: {},
    featureKeysAudit: {
      modelsScanned: 0,
      forbiddenFound: [],
      unknownFound: [],
      note:
        "approximate 오행 제외는 학습 시점 강제. 원격은 저장 feature_keys ⊆ 허용 후보 + 원국단독 금지를 검사.",
    },
    uniquenessProbe: {},
    coexistenceProbe: {},
    errors: [],
    nextActions: [],
    verdict: {
      remoteMigration: "pending",
      schemaVerification: "pending",
      existingDataPreservation: "pending",
      crossUserRlsVerification: "pending",
      approximateFeatureExclusion: "pending",
      phase4ProductionReadiness: "pending",
      appWideProductionReadiness: "pending",
    },
    note:
      "스키마·보존 검증만. 교차 RLS·production readiness는 verify-rls-personalization-010.mjs 성공 후에만 complete.",
  };

  // --- 1–3 tables + service/anon counts (15) ---
  for (const t of [
    ...PERSONALIZATION,
    "diary_entries",
    ...JOURNAL_008,
    ...ASTROLOGY_009,
  ]) {
    out.counts.serviceRole[t] = await restCount(url, serviceKey, t);
  }
  if (anonKey) {
    for (const t of PERSONALIZATION) {
      out.counts.anon[t] = await restCount(url, anonKey, t);
    }
    // anon insert probe (should fail) — proves not fully open
    const anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonIns = await anonClient.from("personalization_models").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      category_key: "x",
      model_status: "failed",
      data_stage: "insufficient_data",
      calculation_version: "x",
      theory_version: "x",
      feature_schema_version: "x",
      model_version: "x",
      allowlist_version: "x",
      model_code_version: "x",
      training_run_key: `anon_probe_${Date.now()}`,
    });
    out.counts.anon.insertProbe = {
      blocked: Boolean(anonIns.error),
      error: anonIns.error?.message?.slice(0, 200) || null,
      note: "anon create must fail; success would mean RLS/policy broken",
    };
    if (!anonIns.error) {
      out.errors.push({
        code: "anon_insert_allowed",
        message: "익명 insert가 성공함 — RLS 실패",
      });
    }
  } else {
    out.nextActions.push("anon key 없음 — service/anon 비교 및 anon insert probe 스킵");
  }

  const missingPers = PERSONALIZATION.filter(
    (t) => !out.counts.serviceRole[t]?.ok
  );
  if (missingPers.length) {
    out.errors.push({ code: "migration_010_not_applied", missing: missingPers });
    out.nextActions.push(
      "SQL Editor에서 supabase/migrations/010_personalization_models.sql 실행"
    );
    out.nextActions.push("적용 전 BASELINE_* 행 수를 .env.local에 기록");
    out.nextActions.push("node scripts/verify-personalization-010.mjs 재실행");
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }
  out.checks.tablesExist = true;
  out.verdict.remoteMigration = "complete";

  // --- 4 columns ---
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
  out.checks.requiredColumns = Object.values(out.columns).every((c) => c.ok);

  // --- 5–6 RLS: empty count ≠ pass ---
  out.checks.rlsEnabledInferred =
    "catalog_not_queryable_via_postgrest; use SQL Editor relrowsecurity + verify-rls-personalization-010";
  if (out.counts.anon.insertProbe && !out.counts.anon.insertProbe.blocked) {
    out.checks.rlsEnabledInferred = "FAILED_anon_write_open";
  } else if (out.counts.anon.insertProbe?.blocked) {
    out.checks.rlsEnabledInferred =
      "anon_write_blocked_only; enablement+owner_policy require SQL+RLS script";
  }

  // --- 13 008/009 intact ---
  out.checks.journal008Intact = JOURNAL_008.every(
    (t) => out.counts.serviceRole[t]?.ok
  );
  out.checks.astrology009Intact = ASTROLOGY_009.every(
    (t) => out.counts.serviceRole[t]?.ok
  );
  if (!out.checks.journal008Intact) {
    out.errors.push({ code: "journal_008_missing" });
  }
  if (!out.checks.astrology009Intact) {
    out.errors.push({ code: "astrology_009_missing" });
  }

  // --- 10–12 preservation ---
  const current = {
    diary_entries: out.counts.serviceRole.diary_entries?.count ?? null,
    journal_entries: out.counts.serviceRole.journal_entries?.count ?? null,
    astrology_snapshots:
      out.counts.serviceRole.astrology_snapshots?.count ?? null,
  };
  out.currentCounts = current;

  const compare = (name, base, cur) => {
    if (base == null) {
      out.nextActions.push(
        `BASELINE_${name.toUpperCase()} 를 .env.local에 설정 후 재실행 (적용 전 기록값)`
      );
      return "baseline_missing";
    }
    if (cur == null) return "current_unavailable";
    return base === cur ? true : false;
  };

  out.checks.diaryUnchanged = compare(
    "diary_entries",
    baseline.diary_entries,
    current.diary_entries
  );
  out.checks.journalUnchanged = compare(
    "journal_entries",
    baseline.journal_entries,
    current.journal_entries
  );
  out.checks.astrologyUnchanged = compare(
    "astrology_snapshots",
    baseline.astrology_snapshots,
    current.astrology_snapshots
  );

  for (const [label, v] of [
    ["diary", out.checks.diaryUnchanged],
    ["journal", out.checks.journalUnchanged],
    ["astrology", out.checks.astrologyUnchanged],
  ]) {
    if (v === false) {
      out.errors.push({
        code: `${label}_count_changed`,
        baseline: baseline[`${label === "astrology" ? "astrology_snapshots" : label === "diary" ? "diary_entries" : "journal_entries"}`],
        current,
      });
    }
  }

  if (
    out.checks.diaryUnchanged === true &&
    out.checks.journalUnchanged === true &&
    out.checks.astrologyUnchanged === true
  ) {
    out.verdict.existingDataPreservation = "complete";
  } else if (
    [out.checks.diaryUnchanged, out.checks.journalUnchanged, out.checks.astrologyUnchanged].some(
      (x) => x === "baseline_missing"
    )
  ) {
    out.verdict.existingDataPreservation = "pending_baseline_env";
  } else {
    out.verdict.existingDataPreservation = "failed";
  }

  // --- 14 feature keys audit ---
  const { data: models, error: modelsErr } = await admin
    .from("personalization_models")
    .select("id,feature_keys")
    .limit(500);
  if (modelsErr) {
    out.errors.push({
      code: "feature_keys_scan_failed",
      detail: modelsErr.message,
    });
  } else {
    out.featureKeysAudit.modelsScanned = models?.length ?? 0;
    for (const row of models || []) {
      const keys = Array.isArray(row.feature_keys) ? row.feature_keys : [];
      for (const k of keys) {
        if (FORBIDDEN_FEATURE_KEYS.has(k)) {
          out.featureKeysAudit.forbiddenFound.push({ id: row.id, key: k });
        } else if (!ALLOWED_FEATURE_KEYS.has(k)) {
          out.featureKeysAudit.unknownFound.push({ id: row.id, key: k });
        }
      }
    }
    const clean =
      out.featureKeysAudit.forbiddenFound.length === 0 &&
      out.featureKeysAudit.unknownFound.length === 0;
    out.checks.featureKeysAllowlist = clean;
    out.verdict.approximateFeatureExclusion = clean
      ? out.featureKeysAudit.modelsScanned === 0
        ? "complete_vacuous_no_models"
        : "complete"
      : "failed";
    if (!clean) {
      out.errors.push({
        code: "feature_keys_violate_allowlist",
        forbidden: out.featureKeysAudit.forbiddenFound,
        unknown: out.featureKeysAudit.unknownFound,
      });
    }
  }

  // --- 7–9 unique + coexistence (service role) ---
  // Need a real auth.users id — pick from TEST_USER or skip
  let probeUserId = null;
  const email = env.TEST_USER_A_EMAIL || "";
  const pass = env.TEST_USER_A_PASSWORD || "";
  if (email && pass && anonKey) {
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (!error && data.user?.id) probeUserId = data.user.id;
  }
  if (!probeUserId && env.TEST_USER_A_JWT) {
    try {
      const payload = JSON.parse(
        Buffer.from(env.TEST_USER_A_JWT.split(".")[1], "base64url").toString(
          "utf8"
        )
      );
      probeUserId = payload.sub || null;
    } catch {
      /* ignore */
    }
  }

  if (!probeUserId) {
    out.nextActions.push(
      "training_run_key/병존 프로브: TEST_USER_A_EMAIL/PASSWORD (또는 JWT) 필요"
    );
    out.uniquenessProbe = { skipped: true, reason: "no_test_user" };
  } else {
    const stamp = Date.now();
    const runKey = `verify010_unique_${stamp}`;
    const runKey2 = `verify010_coexist_${stamp}`;
    const createdIds = [];

    const ins1 = await admin
      .from("personalization_models")
      .insert(modelPayload(probeUserId, runKey, `v1-${stamp}`))
      .select("id")
      .single();
    if (ins1.error || !ins1.data?.id) {
      out.errors.push({
        code: "unique_probe_insert_failed",
        detail: ins1.error?.message,
      });
    } else {
      createdIds.push(ins1.data.id);
      const dup = await admin
        .from("personalization_models")
        .insert(modelPayload(probeUserId, runKey, `v1-dup-${stamp}`))
        .select("id")
        .single();
      out.uniquenessProbe = {
        duplicateRejected: Boolean(dup.error),
        error: dup.error?.message?.slice(0, 200) || null,
      };
      out.checks.trainingRunKeyUnique = Boolean(dup.error);
      out.checks.duplicateTrainPrevented = Boolean(dup.error);
      if (!dup.error && dup.data?.id) {
        createdIds.push(dup.data.id);
        out.errors.push({
          code: "training_run_key_not_unique",
          message: "동일 training_run_key 중복 insert 성공",
        });
      }

      const ins2 = await admin
        .from("personalization_models")
        .insert(modelPayload(probeUserId, runKey2, `v2-${stamp}`))
        .select("id")
        .single();
      out.coexistenceProbe = {
        secondVersionOk: Boolean(ins2.data?.id) && !ins2.error,
        error: ins2.error?.message?.slice(0, 200) || null,
      };
      out.checks.modelVersionCoexistence = Boolean(ins2.data?.id);
      if (ins2.data?.id) createdIds.push(ins2.data.id);
      if (ins2.error) {
        out.errors.push({
          code: "version_coexistence_failed",
          detail: ins2.error.message,
        });
      }
    }

    if (createdIds.length) {
      await admin.from("personalization_models").delete().in("id", createdIds);
    }
  }

  // --- schema verdict ---
  const schemaOk =
    out.checks.tablesExist &&
    out.checks.requiredColumns &&
    out.checks.journal008Intact &&
    out.checks.astrology009Intact &&
    (out.checks.trainingRunKeyUnique ||
      out.uniquenessProbe?.skipped === true) &&
    (out.checks.modelVersionCoexistence ||
      out.uniquenessProbe?.skipped === true) &&
    out.checks.featureKeysAllowlist &&
    out.errors.filter((e) =>
      [
        "migration_010_not_applied",
        "missing_columns",
        "journal_008_missing",
        "astrology_009_missing",
        "training_run_key_not_unique",
        "version_coexistence_failed",
        "feature_keys_violate_allowlist",
        "anon_insert_allowed",
        "diary_count_changed",
        "journal_count_changed",
        "astrology_count_changed",
      ].includes(e.code)
    ).length === 0;

  // If uniqueness skipped, schema still partial
  if (out.uniquenessProbe?.skipped) {
    out.verdict.schemaVerification = schemaOk
      ? "partial_unique_probe_skipped"
      : "failed";
  } else {
    out.verdict.schemaVerification =
      schemaOk &&
      out.checks.trainingRunKeyUnique &&
      out.checks.modelVersionCoexistence
        ? "complete"
        : "failed";
  }

  out.nextActions.push(
    "SQL Editor에서 relrowsecurity=true 및 policy 이름 확인 (docs/PHASE_4_REMOTE_VERIFICATION.md)"
  );
  out.nextActions.push(
    "node scripts/verify-rls-personalization-010.mjs 로 교차 사용자 RLS 검증"
  );

  out.ok =
    out.verdict.remoteMigration === "complete" &&
    (out.verdict.schemaVerification === "complete" ||
      out.verdict.schemaVerification === "partial_unique_probe_skipped") &&
    out.verdict.existingDataPreservation !== "failed" &&
    out.verdict.approximateFeatureExclusion !== "failed";

  // Never mark production ready here
  out.verdict.crossUserRlsVerification = "pending";
  out.verdict.phase4ProductionReadiness = "pending";
  out.verdict.appWideProductionReadiness = "pending";

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok || out.verdict.existingDataPreservation === "failed") {
    process.exitCode = 1;
  }
  if (out.verdict.schemaVerification === "failed") process.exitCode = 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
