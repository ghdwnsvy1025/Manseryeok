/**
 * Phase 4 — 개인화 Ridge MVP · remote training smoke (e2e)
 *
 * Uses TEST_USER_A/B only. Seeds minimal journal + verified feature vectors,
 * runs runPersonalizationTrainingPipeline (via jest bridge), audits stored
 * feature_keys, duplicate run, coexistence, cross-user isolation, cleanup.
 *
 * Usage:
 *   node scripts/verify-personalization-training-e2e.mjs
 *
 * phase4ProductionReadiness: complete only when remoteTrainingPipelineVerification
 * is complete AND stored-model allowlist audit passes. App-wide stays pending.
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseEnv, maskToken, restCount } from "./lib/supabaseEnv.mjs";

const PHASE = "Phase 4 — 개인화 Ridge MVP";
const RUN_ID = `p4train_${Date.now()}_${randomBytes(3).toString("hex")}`;
const MARKER = `[P4_TRAIN ${RUN_ID}]`;
const CATEGORY = "energy";
const SAMPLE_N = 16;
const DAY_OFFSET = Number(String(Date.now()).slice(-4)) % 300;
const DATE0 = (() => {
  const d = new Date("2097-01-01T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + DAY_OFFSET);
  return d.toISOString().slice(0, 10);
})();
const CALC_V = "saju-calc-1.0.0";
const THEORY_V = "sajubase-final-2026-07-19";
const FEAT_V = "saju-feature-mvp-1.0.0";

const ALLOWED_KEYS = new Set([
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
const FORBIDDEN_NATAL = new Set(["yinRatio", "yangRatio", "original_rate"]);
const APPROX_ELEMENTS = ["wood", "fire", "earth", "metal", "water"];

function fail(failures, code, detail) {
  failures.push({ code, detail });
}

function dateOffset(base, days) {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clientFor(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

async function signIn(url, anonKey, email, password, label) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token || !data.user?.id) {
    return { ok: false, label, error: error?.message || "no session" };
  }
  return {
    ok: true,
    label,
    userId: data.user.id,
    accessToken: data.session.access_token,
  };
}

function verifiedVector(i, signal) {
  const luck = signal ? (i % 5) / 4 : 0.5;
  return {
    wood: 18 + (i % 4),
    fire: 22,
    earth: 20,
    metal: 20,
    water: 20 - (i % 3),
    axisPeer: 0.15 + luck * 0.2,
    axisOutput: 0.2 + (i % 3) * 0.05,
    axisWealth: 0.2,
    axisAuthority: 0.2,
    axisResource: 0.2,
    luck_daewoon_rate: 1,
    luck_yearly_rate: 1.01,
    luck_monthly_rate: 1 + luck * 0.15,
    luck_daily_rate: 1 + luck * 0.25,
    rel_yukhap: i % 2,
    rel_chung: 0,
    rel_hyeong: 0,
    rel_pa: 0,
    rel_hae: 0,
    rel_cheonGanHap: 0,
    tenGod_비견: 1,
    tenGod_겁재: 0,
    tenGod_식신: i % 2,
    tenGod_상관: 0,
    tenGod_편재: 0,
    tenGod_정재: 0,
    tenGod_편관: 0,
    tenGod_정관: 0,
    tenGod_편인: 0,
    tenGod_정인: 1,
  };
}

function scoreFromSignal(i) {
  // correlate with luck pattern for better-than-baseline chance
  const luck = (i % 5) / 4;
  const raw = Math.round(2 + luck * 3);
  return Math.max(1, Math.min(5, raw));
}

function invokeBridge(input) {
  const dir = path.resolve("scripts/.tmp");
  fs.mkdirSync(dir, { recursive: true });
  const inPath = path.join(dir, `${RUN_ID}-in.json`);
  const outPath = path.join(dir, `${RUN_ID}-out.json`);
  fs.writeFileSync(inPath, JSON.stringify(input), "utf8");
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  const jestBin = path.resolve(
    "node_modules",
    "jest",
    "bin",
    "jest.js"
  );
  if (!fs.existsSync(jestBin)) {
    return { ok: false, error: `jest_not_found at ${jestBin}`, raw: null };
  }

  const r = spawnSync(
    process.execPath,
    [
      jestBin,
      "src/__tests__/personalization/trainingBridge.e2e.test.ts",
      "--runInBand",
      "--forceExit",
    ],
    {
      env: {
        ...process.env,
        P4_E2E_INPUT_PATH: inPath,
        P4_E2E_OUTPUT_PATH: outPath,
      },
      encoding: "utf8",
      cwd: process.cwd(),
      windowsHide: true,
    }
  );

  if (!fs.existsSync(outPath)) {
    return {
      ok: false,
      error: `bridge_no_output status=${r.status} err=${r.error || ""} stdout=${(r.stdout || "").slice(-600)} stderr=${(r.stderr || "").slice(-800)}`,
      raw: null,
    };
  }
  const raw = JSON.parse(fs.readFileSync(outPath, "utf8"));
  return { ok: true, raw, jestStatus: r.status };
}

function auditFeatureKeys(keys) {
  const approximateFound = [];
  const unknownFound = [];
  const natalOnlyFound = [];
  // Stored models from verified train may include wood etc — that is OK.
  // Approximate discovery = keys that are never allowed OR natal-only.
  for (const k of keys || []) {
    if (FORBIDDEN_NATAL.has(k)) natalOnlyFound.push(k);
    else if (!ALLOWED_KEYS.has(k)) unknownFound.push(k);
  }
  return {
    approximateFound,
    unknownFound,
    natalOnlyFound,
    ok: natalOnlyFound.length === 0 && unknownFound.length === 0,
  };
}

async function main() {
  const failures = [];
  const created = {
    journalIds: [],
    scoreIds: [],
    profileIds: [],
    snapshotIds: [],
    vectorIds: [],
    modelIds: [],
    metricIds: [],
    predictionIds: [],
  };

  const out = {
    phase: PHASE,
    runId: RUN_ID,
    marker: MARKER,
    loginA: null,
    loginB: null,
    seeded: {
      journalEntries: 0,
      categoryScores: 0,
      astrologySnapshots: 0,
      featureVectors: 0,
    },
    trainingUserId: null,
    categoryKey: CATEGORY,
    validSampleCount: null,
    modelStage: null,
    selectedLambda: null,
    savedModelId: null,
    metricsSaved: false,
    predictionsSaved: false,
    featureKeys: [],
    approximateFeatureFound: false,
    unknownFeatureFound: false,
    natalOnlyFeatureFound: false,
    baselineMae: null,
    ridgeMae: null,
    modelStatus: null,
    predictionVisible: null,
    versions: {},
    ridgeInvoked: false,
    duplicateRunPrevented: null,
    coexistenceOk: null,
    approximateRejectOk: null,
    crossUserReadBlocked: null,
    cleanup: null,
    baselineCounts: {},
    afterCounts: {},
    failures: [],
    remoteTrainingPipelineVerification: "pending",
    remoteStoredModelAllowlistAudit: "pending",
    phase4ProductionReadiness: "pending",
    appWideProductionReadiness: "pending",
  };

  const envBundle = getSupabaseEnv();
  if (!envBundle.ok || !envBundle.anonKey) {
    fail(failures, "env", envBundle.reason || "missing env");
    out.failures = failures;
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }
  const { url, anonKey, serviceKey, env } = envBundle;

  const countTables = [
    "diary_entries",
    "journal_entries",
    "astrology_snapshots",
    "personalization_models",
  ];
  if (serviceKey) {
    for (const t of countTables) {
      const c = await restCount(url, serviceKey, t);
      out.baselineCounts[t] = c.count;
    }
  }

  const { resolveTestUsers, deleteEphemeralUsers } = await import(
    "./lib/testUsers.mjs"
  );
  const resolved = await resolveTestUsers(url, anonKey, serviceKey, env, {
    runId: RUN_ID,
    marker: MARKER,
  });
  const userA = resolved.a;
  const userB = resolved.b;
  out.authMode = resolved.authMode;
  out.loginA = { ok: userA.ok, userId: userA.userId || null, error: userA.error || null };
  out.loginB = { ok: userB.ok, userId: userB.userId || null, error: userB.error || null };
  if (!userA.ok) fail(failures, "login_a", userA.error);
  if (!userB.ok) fail(failures, "login_b", userB.error);
  if (!userA.ok || !userB.ok) {
    if (serviceKey && resolved.ephemeralUserIds?.length) {
      await deleteEphemeralUsers(url, serviceKey, resolved.ephemeralUserIds);
    }
    out.failures = failures;
    out.nextActions = [
      "TEST_USER_A/B 또는 SERVICE_ROLE ephemeral 생성 가능 여부 확인",
    ];
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }
  out.trainingUserId = userA.userId;
  out.tokenAMasked = resolved.tokenAMasked;
  const ephemeralUserIds = resolved.ephemeralUserIds || [];

  const sbA = clientFor(url, anonKey, userA.accessToken);
  const sbB = clientFor(url, anonKey, userB.accessToken);
  const admin = serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  try {
    // --- Seed astrology profile (A) ---
    const prof = await sbA
      .from("astrology_profiles")
      .insert({
        user_id: userA.userId,
        saju_profile_id: null,
        birth_timezone: "Asia/Seoul",
        calendar_calculation_version: "0.1.0",
        original_pillars: { marker: MARKER },
        original_element_distribution: { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 },
        day_master: "기",
        month_branch: "술",
        day_branch: "축",
        static_feature_payload: { marker: MARKER },
        theory_version: THEORY_V,
        feature_schema_version: FEAT_V,
      })
      .select("id")
      .single();
    if (prof.error || !prof.data?.id) {
      fail(failures, "seed_profile", prof.error?.message);
    } else {
      created.profileIds.push(prof.data.id);
    }
    const profileId = created.profileIds[0];

    // --- Seed N journal + scores + snapshots + vectors ---
    for (let i = 0; i < SAMPLE_N; i++) {
      const localDate = dateOffset(DATE0, i);
      const je = await sbA
        .from("journal_entries")
        .insert({
          user_id: userA.userId,
          entry_date: localDate,
          user_timezone: "Asia/Seoul",
          content: `${MARKER} train seed ${i}`,
          overall_satisfaction: scoreFromSignal(i),
          mood_label: "calm",
          main_event_text: MARKER,
          source: "new_diary",
        })
        .select("id")
        .single();
      if (je.error || !je.data?.id) {
        fail(failures, "seed_journal", je.error?.message || localDate);
        continue;
      }
      created.journalIds.push(je.data.id);
      out.seeded.journalEntries += 1;

      const sc = await sbA
        .from("category_scores")
        .insert({
          entry_id: je.data.id,
          user_id: userA.userId,
          category_code: CATEGORY,
          raw_score: scoreFromSignal(i),
          is_not_applicable: false,
        })
        .select("id")
        .single();
      if (sc.error || !sc.data?.id) {
        fail(failures, "seed_score", sc.error?.message);
      } else {
        created.scoreIds.push(sc.data.id);
        out.seeded.categoryScores += 1;
      }

      if (!profileId) continue;
      const snap = await sbA
        .from("astrology_snapshots")
        .insert({
          user_id: userA.userId,
          profile_id: profileId,
          local_date: localDate,
          timezone: "Asia/Seoul",
          calculation_mode: "native_with_luck",
          luck_context: { marker: MARKER, daewoon: true, yearly: true },
          raw_calculation_payload: { marker: MARKER },
          element_distribution: { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 },
          ten_god_features: {},
          relation_features: {},
          structured_features: { marker: MARKER },
          calculation_version: CALC_V,
          theory_version: THEORY_V,
          feature_schema_version: FEAT_V,
          status: "ready",
        })
        .select("id")
        .single();
      if (snap.error || !snap.data?.id) {
        fail(failures, "seed_snapshot", snap.error?.message);
        continue;
      }
      created.snapshotIds.push(snap.data.id);
      out.seeded.astrologySnapshots += 1;

      const vec = await sbA
        .from("astrology_feature_vectors")
        .insert({
          snapshot_id: snap.data.id,
          user_id: userA.userId,
          local_date: localDate,
          calculation_mode: "native_with_luck",
          vector: verifiedVector(i, true),
          feature_schema_version: FEAT_V,
          calculation_version: CALC_V,
        })
        .select("id")
        .single();
      if (vec.error || !vec.data?.id) {
        fail(failures, "seed_vector", vec.error?.message);
      } else {
        created.vectorIds.push(vec.data.id);
        out.seeded.featureVectors += 1;
      }
    }

    if (out.seeded.categoryScores < 14) {
      fail(failures, "insufficient_seed", `scores=${out.seeded.categoryScores}`);
    }

    // --- Negative: approximate injection rejected ---
    const dates = Array.from({ length: SAMPLE_N }, (_, i) =>
      dateOffset(DATE0, i)
    );
    const approxRows = dates.map((localDate, i) => ({
      localDate,
      elementDistributionApproximate: true,
      features: {
        ...verifiedVector(i, true),
        wood: 30,
        fire: 20,
        earth: 20,
        metal: 20,
        water: 10,
      },
    }));
    const rejectBridge = invokeBridge({
      mode: "reject_approximate",
      url,
      anonKey,
      accessToken: userA.accessToken,
      userId: userA.userId,
      categoryKey: CATEGORY,
      calculationVersion: CALC_V,
      theoryVersion: THEORY_V,
      featureSchemaVersion: FEAT_V,
      scores: dates.map((localDate, i) => ({
        localDate,
        rawScore: scoreFromSignal(i),
      })),
      featureRows: approxRows,
      asOfDate: dateOffset(DATE0, SAMPLE_N - 1),
    });
    out.approximateRejectOk = Boolean(
      rejectBridge.ok && rejectBridge.raw?.rejected
    );
    if (!out.approximateRejectOk) {
      fail(failures, "approx_reject", rejectBridge.error || rejectBridge.raw);
    }

    // --- Positive pipeline train + persist ---
    const trainBridge = invokeBridge({
      mode: "pipeline",
      url,
      anonKey,
      accessToken: userA.accessToken,
      userId: userA.userId,
      categoryKey: CATEGORY,
      calculationVersion: CALC_V,
      theoryVersion: THEORY_V,
      featureSchemaVersion: FEAT_V,
      asOfDate: dateOffset(DATE0, SAMPLE_N - 1),
    });
    if (!trainBridge.ok || !trainBridge.raw?.trainOk || !trainBridge.raw?.model) {
      fail(
        failures,
        "pipeline_train",
        trainBridge.error || trainBridge.raw?.trainError || trainBridge.raw
      );
    } else {
      const m = trainBridge.raw.model;
      out.ridgeInvoked = Boolean(trainBridge.raw.ridgeInvoked);
      out.savedModelId = m.id;
      out.validSampleCount = m.validSampleCount;
      out.modelStage = m.dataStage;
      out.selectedLambda = m.lambda;
      out.featureKeys = m.featureKeys || [];
      out.baselineMae = m.baselineMae;
      out.ridgeMae = m.ridgeMae;
      out.modelStatus = m.modelStatus;
      out.predictionVisible = m.predictionVisible;
      out.versions = {
        calculationVersion: m.calculationVersion,
        theoryVersion: m.theoryVersion,
        featureSchemaVersion: m.featureSchemaVersion,
        modelVersion: m.modelVersion,
        allowlistVersion: m.allowlistVersion,
        modelCodeVersion: m.modelCodeVersion,
      };
      out.metricsSaved = Boolean(trainBridge.raw.metricsId);
      out.predictionsSaved =
        Array.isArray(trainBridge.raw.predictionIds) &&
        trainBridge.raw.predictionIds.length > 0;
      created.modelIds.push(m.id);
      if (trainBridge.raw.metricsId) created.metricIds.push(trainBridge.raw.metricsId);
      for (const id of trainBridge.raw.predictionIds || []) {
        created.predictionIds.push(id);
      }

      if (!out.ridgeInvoked) fail(failures, "ridge_not_invoked", m);
      if (!out.savedModelId) fail(failures, "model_not_saved", null);
      if (!out.metricsSaved) fail(failures, "metrics_not_saved", null);
      // predictions only required when predictionVisible
      if (out.predictionVisible && !out.predictionsSaved) {
        fail(failures, "predictions_missing_when_visible", null);
      }

      const audit = auditFeatureKeys(out.featureKeys);
      out.unknownFeatureFound = audit.unknownFound.length > 0;
      out.natalOnlyFeatureFound = audit.natalOnlyFound.length > 0;
      out.approximateFeatureFound = false; // elements allowed when verified
      if (!audit.ok) {
        fail(failures, "feature_keys_audit", audit);
        out.remoteStoredModelAllowlistAudit = "failed";
      } else {
        out.remoteStoredModelAllowlistAudit = "complete";
      }

      for (const k of [
        "calculationVersion",
        "theoryVersion",
        "featureSchemaVersion",
        "modelVersion",
        "allowlistVersion",
      ]) {
        if (!out.versions[k]) fail(failures, `missing_${k}`, out.versions);
      }
      if (out.baselineMae == null || out.ridgeMae == null) {
        fail(failures, "mae_missing", { b: out.baselineMae, r: out.ridgeMae });
      }

      // Reload from DB to prove persistence
      const { data: dbModel, error: dbErr } = await sbA
        .from("personalization_models")
        .select("id,feature_keys,prediction_visible,model_status")
        .eq("id", m.id)
        .maybeSingle();
      if (dbErr || !dbModel?.id) {
        fail(failures, "db_model_reload", dbErr?.message);
      } else {
        await sbA
          .from("personalization_models")
          .update({ summary_text: MARKER })
          .eq("id", m.id);
      }

      // Duplicate run key
      const dupBridge = invokeBridge({
        mode: "pipeline",
        url,
        anonKey,
        accessToken: userA.accessToken,
        userId: userA.userId,
        categoryKey: CATEGORY,
        calculationVersion: CALC_V,
        theoryVersion: THEORY_V,
        featureSchemaVersion: FEAT_V,
        asOfDate: dateOffset(DATE0, SAMPLE_N - 1),
      });
      out.duplicateRunPrevented = Boolean(
        dupBridge.ok && dupBridge.raw?.reused && dupBridge.raw?.model?.id === m.id
      );
      if (!out.duplicateRunPrevented) {
        fail(failures, "duplicate_run", dupBridge.raw);
        if (dupBridge.raw?.model?.id && dupBridge.raw.model.id !== m.id) {
          created.modelIds.push(dupBridge.raw.model.id);
        }
      }

      // Coexistence: different training_run_key via extra samples bump
      // Insert one more day then retrain → new run key
      const extraDate = dateOffset(DATE0, SAMPLE_N);
      const je2 = await sbA
        .from("journal_entries")
        .insert({
          user_id: userA.userId,
          entry_date: extraDate,
          user_timezone: "Asia/Seoul",
          content: `${MARKER} coexist`,
          overall_satisfaction: 4,
          mood_label: "calm",
          main_event_text: MARKER,
          source: "new_diary",
        })
        .select("id")
        .single();
      if (je2.data?.id) {
        created.journalIds.push(je2.data.id);
        await sbA.from("category_scores").insert({
          entry_id: je2.data.id,
          user_id: userA.userId,
          category_code: CATEGORY,
          raw_score: 4,
          is_not_applicable: false,
        });
        if (profileId) {
          const snap2 = await sbA
            .from("astrology_snapshots")
            .insert({
              user_id: userA.userId,
              profile_id: profileId,
              local_date: extraDate,
              timezone: "Asia/Seoul",
              calculation_mode: "native_with_luck",
              luck_context: { marker: MARKER },
              raw_calculation_payload: { marker: MARKER },
              element_distribution: { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 },
              ten_god_features: {},
              relation_features: {},
              structured_features: { marker: MARKER },
              calculation_version: CALC_V,
              theory_version: THEORY_V,
              feature_schema_version: FEAT_V,
              status: "ready",
            })
            .select("id")
            .single();
          if (snap2.data?.id) {
            created.snapshotIds.push(snap2.data.id);
            const v2 = await sbA
              .from("astrology_feature_vectors")
              .insert({
                snapshot_id: snap2.data.id,
                user_id: userA.userId,
                local_date: extraDate,
                calculation_mode: "native_with_luck",
                vector: verifiedVector(SAMPLE_N, true),
                feature_schema_version: FEAT_V,
                calculation_version: CALC_V,
              })
              .select("id")
              .single();
            if (v2.data?.id) created.vectorIds.push(v2.data.id);
          }
        }
      }

      const coexistBridge = invokeBridge({
        mode: "pipeline",
        url,
        anonKey,
        accessToken: userA.accessToken,
        userId: userA.userId,
        categoryKey: CATEGORY,
        calculationVersion: CALC_V,
        theoryVersion: THEORY_V,
        featureSchemaVersion: FEAT_V,
        asOfDate: extraDate,
      });
      const m2 = coexistBridge.raw?.model;
      out.coexistenceOk = Boolean(
        coexistBridge.ok &&
          m2?.id &&
          m2.id !== m.id &&
          m2.trainingRunKey !== m.trainingRunKey
      );
      if (m2?.id) created.modelIds.push(m2.id);
      if (coexistBridge.raw?.metricsId) {
        created.metricIds.push(coexistBridge.raw.metricsId);
      }
      for (const id of coexistBridge.raw?.predictionIds || []) {
        created.predictionIds.push(id);
      }
      if (!out.coexistenceOk) {
        fail(failures, "coexistence", coexistBridge.raw);
      }

      // Cross-user: B cannot read A's model
      const cross = await sbB
        .from("personalization_models")
        .select("id")
        .eq("id", m.id)
        .maybeSingle();
      out.crossUserReadBlocked = !cross.data?.id;
      if (cross.data?.id) fail(failures, "cross_user_read", "B saw A model");
    }
  } finally {
    // Cleanup only test rows (by ids + marker)
    const cleanup = {
      deleted: {},
      errors: [],
    };
    const del = async (sb, table, ids) => {
      if (!ids.length) return 0;
      const { error, count } = await sb
        .from(table)
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) {
        cleanup.errors.push(`${table}: ${error.message}`);
        return 0;
      }
      return count ?? ids.length;
    };

    // children first
    cleanup.deleted.predictions = await del(
      sbA,
      "personalization_predictions",
      created.predictionIds
    );
    cleanup.deleted.metrics = await del(
      sbA,
      "personalization_model_metrics",
      created.metricIds
    );
    cleanup.deleted.models = await del(
      sbA,
      "personalization_models",
      created.modelIds
    );
    cleanup.deleted.vectors = await del(
      sbA,
      "astrology_feature_vectors",
      created.vectorIds
    );
    cleanup.deleted.snapshots = await del(
      sbA,
      "astrology_snapshots",
      created.snapshotIds
    );
    cleanup.deleted.scores = await del(sbA, "category_scores", created.scoreIds);
    cleanup.deleted.journals = await del(
      sbA,
      "journal_entries",
      created.journalIds
    );
    cleanup.deleted.profiles = await del(
      sbA,
      "astrology_profiles",
      created.profileIds
    );

    // Admin sweep by marker for leftovers
    if (admin) {
      const uid = userA.userId;
      await admin
        .from("personalization_models")
        .delete()
        .eq("user_id", uid)
        .eq("summary_text", MARKER);
      // Only delete journals with our marker content
      await admin
        .from("journal_entries")
        .delete()
        .eq("user_id", uid)
        .like("content", `%${RUN_ID}%`);
      await admin
        .from("astrology_profiles")
        .delete()
        .eq("user_id", uid)
        .contains("static_feature_payload", { marker: MARKER });
      await admin
        .from("astrology_snapshots")
        .delete()
        .eq("user_id", uid)
        .contains("structured_features", { marker: MARKER });

      if (ephemeralUserIds.length) {
        const { deleteEphemeralUsers: delUsers } = await import(
          "./lib/testUsers.mjs"
        );
        cleanup.ephemeralUsers = await delUsers(
          url,
          serviceKey,
          ephemeralUserIds
        );
      }
    }

    out.cleanup = cleanup;

    if (serviceKey) {
      for (const t of [
        "diary_entries",
        "journal_entries",
        "astrology_snapshots",
      ]) {
        const c = await restCount(url, serviceKey, t);
        out.afterCounts[t] = c.count;
        if (
          out.baselineCounts[t] != null &&
          c.count != null &&
          c.count !== out.baselineCounts[t]
        ) {
          fail(failures, `${t}_count_drift`, {
            before: out.baselineCounts[t],
            after: c.count,
          });
        }
      }
    }
  }

  out.failures = failures;

  const pipelineOk =
    failures.length === 0 &&
    out.ridgeInvoked &&
    out.savedModelId &&
    out.metricsSaved &&
    out.duplicateRunPrevented &&
    out.coexistenceOk &&
    out.approximateRejectOk &&
    out.crossUserReadBlocked &&
    out.remoteStoredModelAllowlistAudit === "complete";

  out.remoteTrainingPipelineVerification = pipelineOk
    ? "complete"
    : "failed";

  out.phase4ProductionReadiness = pipelineOk ? "complete" : "pending";
  out.appWideProductionReadiness = "pending";

  if (pipelineOk) {
    out.note =
      "Phase 4 production readiness = complete (개인화 모델·DB 범위). 앱 전체 production readiness는 pending. 상담 AI 미착수.";
  } else {
    out.nextActions = [
      "failures 확인 후 재실행",
      "cleanup.errors / 잔여 MARKER 행 점검",
      "docs/PHASE_4_REMOTE_VERIFICATION.md 참고",
    ];
  }

  console.log(JSON.stringify(out, null, 2));
  process.exitCode = pipelineOk ? 0 : 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
