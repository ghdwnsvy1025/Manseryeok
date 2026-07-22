/**
 * Phase 5 — 분석 UI·서술 · remote data integration e2e
 *
 * Real Supabase + TEST_USER_A/B. Seeds journal/scores/snapshots/vectors/models,
 * runs loadRemoteAssembleInput + assembleAnalysis via jest bridge, audits privacy,
 * isolation, fallback, cleanup. Does NOT claim live LLM complete.
 *
 * Usage:
 *   node scripts/verify-analysis-remote-e2e.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseEnv, maskToken, restCount } from "./lib/supabaseEnv.mjs";

const PHASE = "Phase 5 — 분석 UI·서술";
const RUN_ID = `p5an_${Date.now()}_${randomBytes(3).toString("hex")}`;
const MARKER = `[P5_AN ${RUN_ID}]`;
const CATEGORY = "energy";
const SAMPLE_N = 8;
const DAY_OFFSET = Number(String(Date.now()).slice(-4)) % 280;
const DATE0 = (() => {
  const d = new Date("2098-03-01T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + DAY_OFFSET);
  return d.toISOString().slice(0, 10);
})();
const CALC_V = "saju-calc-1.0.0";
const THEORY_V = "sajubase-final-2026-07-19";
const FEAT_V = "saju-feature-mvp-1.0.0";
const MODEL_V = "ridge-mvp-1.0.0";
const ALLOW_V = "saju-feature-catalog-1.0.0";
const CODE_V = "personalization-ridge-1.0.0";

function fail(failures, code, detail) {
  failures.push({ code, detail });
}

function maskUserId(id) {
  if (!id || typeof id !== "string") return "(none)";
  if (id.length < 12) return "***";
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
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
    email,
    ephemeral: false,
  };
}

async function resolveTestUsers(url, anonKey, serviceKey, env) {
  const emailA = env.TEST_USER_A_EMAIL || "";
  const passA = env.TEST_USER_A_PASSWORD || "";
  const emailB = env.TEST_USER_B_EMAIL || "";
  const passB = env.TEST_USER_B_PASSWORD || "";

  if (emailA && passA && emailB && passB) {
    const a = await signIn(url, anonKey, emailA, passA, "A");
    const b = await signIn(url, anonKey, emailB, passB, "B");
    return { a, b, ephemeralUserIds: [], authMode: "env_password" };
  }

  const jwtA = env.TEST_USER_A_JWT || "";
  const jwtB = env.TEST_USER_B_JWT || "";
  if (jwtA && jwtB) {
    const decodeSub = (jwt) => {
      try {
        const payload = JSON.parse(
          Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")
        );
        return payload.sub || null;
      } catch {
        return null;
      }
    };
    const aId = decodeSub(jwtA);
    const bId = decodeSub(jwtB);
    return {
      a: {
        ok: Boolean(aId),
        label: "A",
        userId: aId,
        accessToken: jwtA,
        error: aId ? null : "invalid JWT A",
        ephemeral: false,
      },
      b: {
        ok: Boolean(bId),
        label: "B",
        userId: bId,
        accessToken: jwtB,
        error: bId ? null : "invalid JWT B",
        ephemeral: false,
      },
      ephemeralUserIds: [],
      authMode: "env_jwt",
    };
  }

  if (!serviceKey) {
    return {
      a: { ok: false, label: "A", error: "no credentials and no service role" },
      b: { ok: false, label: "B", error: "no credentials and no service role" },
      ephemeralUserIds: [],
      authMode: "none",
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pass = `P5_${randomBytes(12).toString("base64url")}!aA1`;
  const eA = `p5an-a-${RUN_ID}@manseryeok-test.local`;
  const eB = `p5an-b-${RUN_ID}@manseryeok-test.local`;
  const createdIds = [];

  for (const [email, label] of [
    [eA, "A"],
    [eB, "B"],
  ]) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { marker: MARKER, purpose: "phase5_remote_e2e" },
    });
    if (error || !data.user?.id) {
      return {
        a: {
          ok: false,
          label: "A",
          error: label === "A" ? error?.message : "skipped",
        },
        b: {
          ok: false,
          label: "B",
          error: label === "B" ? error?.message : "create_failed_earlier",
        },
        ephemeralUserIds: createdIds,
        authMode: "ephemeral_admin",
      };
    }
    createdIds.push(data.user.id);
  }

  const a = await signIn(url, anonKey, eA, pass, "A");
  const b = await signIn(url, anonKey, eB, pass, "B");
  a.ephemeral = true;
  b.ephemeral = true;
  return {
    a,
    b,
    ephemeralUserIds: createdIds,
    authMode: "ephemeral_admin",
  };
}

function verifiedVector(i) {
  const luck = (i % 5) / 4;
  return {
    wood: 18 + (i % 4),
    fire: 22,
    earth: 20,
    metal: 20,
    water: 20 - (i % 3),
    axisPeer: 0.15 + luck * 0.2,
    axisOutput: 0.2,
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

function invokeBridge(input, envExtra = {}) {
  const dir = path.resolve("scripts/.tmp");
  fs.mkdirSync(dir, { recursive: true });
  const inPath = path.join(dir, `${RUN_ID}-in.json`);
  const outPath = path.join(dir, `${RUN_ID}-out.json`);
  fs.writeFileSync(inPath, JSON.stringify(input), "utf8");
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  const jestBin = path.resolve("node_modules", "jest", "bin", "jest.js");
  if (!fs.existsSync(jestBin)) {
    return { ok: false, error: `jest_not_found at ${jestBin}`, raw: null };
  }

  const r = spawnSync(
    process.execPath,
    [
      jestBin,
      "src/__tests__/analysis/analysisBridge.e2e.test.ts",
      "--runInBand",
      "--forceExit",
    ],
    {
      env: {
        ...process.env,
        // Remote e2e asserts deterministic path — never inherit a shell LLM ON flag
        FF_ANALYSIS_NARRATIVE_LLM: "false",
        ...envExtra,
        P5_E2E_INPUT_PATH: inPath,
        P5_E2E_OUTPUT_PATH: outPath,
      },
      encoding: "utf8",
      cwd: process.cwd(),
      windowsHide: true,
    }
  );

  if (!fs.existsSync(outPath)) {
    return {
      ok: false,
      error: `bridge_no_output status=${r.status} stdout=${(r.stdout || "").slice(-500)} stderr=${(r.stderr || "").slice(-700)}`,
      raw: null,
    };
  }
  return {
    ok: true,
    raw: JSON.parse(fs.readFileSync(outPath, "utf8")),
    jestStatus: r.status,
  };
}

async function main() {
  const failures = [];
  const created = {
    journalIds: [],
    scoreIds: [],
    tagPairs: [],
    profileIds: [],
    snapshotIds: [],
    vectorIds: [],
    modelIds: [],
    metricIds: [],
    predictionIds: [],
    prefKeys: [],
    journalIdsB: [],
    scoreIdsB: [],
  };

  const out = {
    phase: PHASE,
    runId: RUN_ID,
    marker: MARKER,
    loginSuccess: false,
    testUserIdMasked: null,
    tokenAMasked: null,
    journalsCreated: 0,
    snapshotsCreatedOrReused: 0,
    personalizationModelsUsed: 0,
    dailyAssembler: null,
    weeklyAssembler: null,
    monthlyAssembler: null,
    predictionVisibilityPolicy: null,
    narrativeInputPrivacyAudit: null,
    approximateFeatureAudit: null,
    crossUserIsolation: null,
    unauthenticatedFallback: null,
    emptyDataFallback: null,
    cleanup: null,
    baselineCounts: {},
    afterCounts: {},
    failures: [],
    remoteAnalysisIntegrationVerification: "pending",
    liveLlmVerification: "pending",
    phase5ProductionReadiness: "pending",
    phase5ProductionReadinessWithLlmDisabled: "pending",
    deterministicProductionPath: "pending",
    llmFeatureProductionReadiness: "pending",
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
    "category_scores",
  ];
  if (serviceKey) {
    for (const t of countTables) {
      const c = await restCount(url, serviceKey, t);
      out.baselineCounts[t] = c.count;
    }
  }

  const resolved = await resolveTestUsers(url, anonKey, serviceKey, env);
  const userA = resolved.a;
  const userB = resolved.b;
  out.authMode = resolved.authMode;
  out.loginSuccess = Boolean(userA.ok && userB.ok);
  out.testUserIdMasked = maskUserId(userA.userId);
  out.tokenAMasked = maskToken(userA.accessToken);
  if (!userA.ok) fail(failures, "login_a", userA.error);
  if (!userB.ok) fail(failures, "login_b", userB.error);
  if (!userA.ok || !userB.ok) {
    // cleanup ephemeral if partial create
    if (serviceKey && resolved.ephemeralUserIds?.length) {
      const adminEarly = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const id of resolved.ephemeralUserIds) {
        await adminEarly.auth.admin.deleteUser(id);
      }
    }
    out.failures = failures;
    out.nextActions = [
      "TEST_USER_A/B EMAIL+PASSWORD 설정, 또는 SERVICE_ROLE로 ephemeral 생성 가능 여부 확인",
    ];
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  const sbA = clientFor(url, anonKey, userA.accessToken);
  const sbB = clientFor(url, anonKey, userB.accessToken);
  const admin = serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  const ephemeralUserIds = resolved.ephemeralUserIds || [];

  const periodEnd = dateOffset(DATE0, SAMPLE_N - 1);
  const periodStartWeekly = dateOffset(DATE0, SAMPLE_N - 7);
  const periodStartMonthly = dateOffset(DATE0, 0);
  const focusDate = periodEnd;

  try {
    // 1. category preference
    const pref = await sbA.from("user_category_preferences").upsert(
      {
        user_id: userA.userId,
        category_code: CATEGORY,
        enabled: true,
        sort_order: 1,
        enabled_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category_code" }
    );
    if (pref.error) fail(failures, "category_pref", pref.error.message);
    else created.prefKeys.push(`${userA.userId}:${CATEGORY}`);

    // 2. astrology profile
    const prof = await sbA
      .from("astrology_profiles")
      .insert({
        user_id: userA.userId,
        saju_profile_id: null,
        birth_timezone: "Asia/Seoul",
        calendar_calculation_version: "0.1.0",
        original_pillars: { marker: MARKER },
        original_element_distribution: {
          목: 20,
          화: 20,
          토: 20,
          금: 20,
          수: 20,
        },
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

    // 3. journals + scores + tags + snapshots + vectors for A
    for (let i = 0; i < SAMPLE_N; i++) {
      const localDate = dateOffset(DATE0, i);
      const je = await sbA
        .from("journal_entries")
        .insert({
          user_id: userA.userId,
          entry_date: localDate,
          user_timezone: "Asia/Seoul",
          content: `${MARKER} private diary body must never reach narrative ${i}`,
          overall_satisfaction: 2 + (i % 3),
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
      out.journalsCreated += 1;

      const sc = await sbA
        .from("category_scores")
        .insert({
          entry_id: je.data.id,
          user_id: userA.userId,
          category_code: CATEGORY,
          raw_score: 2 + (i % 3),
          is_not_applicable: false,
        })
        .select("id")
        .single();
      if (sc.error || !sc.data?.id) {
        fail(failures, "seed_score", sc.error?.message);
      } else {
        created.scoreIds.push(sc.data.id);
      }

      const tg = await sbA.from("journal_entry_tags").insert({
        entry_id: je.data.id,
        tag_code: i % 2 === 0 ? "exercise" : "rest",
        user_id: userA.userId,
        source: "user",
        confirmed_by_user: true,
      });
      if (!tg.error) {
        created.tagPairs.push({ entryId: je.data.id, tag: i % 2 === 0 ? "exercise" : "rest" });
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
      if (snap.error || !snap.data?.id) {
        fail(failures, "seed_snapshot", snap.error?.message);
        continue;
      }
      created.snapshotIds.push(snap.data.id);
      out.snapshotsCreatedOrReused += 1;

      const vec = await sbA
        .from("astrology_feature_vectors")
        .insert({
          snapshot_id: snap.data.id,
          user_id: userA.userId,
          local_date: localDate,
          calculation_mode: "native_with_luck",
          vector: verifiedVector(i),
          feature_schema_version: FEAT_V,
          calculation_version: CALC_V,
        })
        .select("id")
        .single();
      if (vec.error || !vec.data?.id) {
        fail(failures, "seed_vector", vec.error?.message);
      } else {
        created.vectorIds.push(vec.data.id);
      }
    }

    // 4. B pollution data (must not appear in A's assemble)
    const bDate = focusDate;
    const jeB = await sbB
      .from("journal_entries")
      .insert({
        user_id: userB.userId,
        entry_date: bDate,
        user_timezone: "Asia/Seoul",
        content: `${MARKER} B isolation poison`,
        overall_satisfaction: 5,
        mood_label: "high",
        main_event_text: MARKER,
        source: "new_diary",
      })
      .select("id")
      .single();
    if (jeB.data?.id) {
      created.journalIdsB.push(jeB.data.id);
      const scB = await sbB
        .from("category_scores")
        .insert({
          entry_id: jeB.data.id,
          user_id: userB.userId,
          category_code: CATEGORY,
          raw_score: 5,
          is_not_applicable: false,
        })
        .select("id")
        .single();
      if (scB.data?.id) created.scoreIdsB.push(scB.data.id);
    }

    // 5. personalization model + metrics + prediction (A) — visible path
    const trainStart = DATE0;
    const trainEnd = periodEnd;
    const runKey = `p5an_${RUN_ID}_visible`;
    const modelIns = await sbA
      .from("personalization_models")
      .insert({
        user_id: userA.userId,
        category_key: CATEGORY,
        model_type: "ridge",
        model_status: "active",
        data_stage: "active",
        training_start_date: trainStart,
        training_end_date: trainEnd,
        valid_sample_count: SAMPLE_N,
        feature_keys: ["axisPeer", "luck_daily_rate"],
        coefficients: [0.12, -0.05],
        intercept: 3.1,
        lambda: 10,
        feature_means: [0.2, 1.1],
        feature_stds: [0.1, 0.2],
        normalization_metadata: {
          weightedMean: 3.0,
          marker: MARKER,
        },
        baseline_metrics: { mae: 0.9 },
        model_metrics: {
          baselineMae: 0.9,
          ridgeMae: 0.7,
          maeImprovement: 0.2,
          validationSampleCount: 5,
        },
        confidence_components: { n: SAMPLE_N },
        confidence_score: 58,
        confidence_band: "medium",
        prediction_visible: true,
        summary_text: `${MARKER} verified pattern note for analysis`,
        calculation_version: CALC_V,
        theory_version: THEORY_V,
        feature_schema_version: FEAT_V,
        model_version: MODEL_V,
        allowlist_version: ALLOW_V,
        model_code_version: CODE_V,
        training_run_key: runKey,
      })
      .select("id")
      .single();
    if (modelIns.error || !modelIns.data?.id) {
      fail(failures, "seed_model", modelIns.error?.message);
    } else {
      created.modelIds.push(modelIns.data.id);
      out.personalizationModelsUsed += 1;

      const met = await sbA
        .from("personalization_model_metrics")
        .insert({
          model_id: modelIns.data.id,
          user_id: userA.userId,
          baseline_mae: 0.9,
          ridge_mae: 0.7,
          mae_improvement: 0.2,
          validation_sample_count: 5,
          train_sample_count: SAMPLE_N,
          lambda: 10,
        })
        .select("id")
        .single();
      if (met.data?.id) created.metricIds.push(met.data.id);

      const pred = await sbA
        .from("personalization_predictions")
        .insert({
          model_id: modelIns.data.id,
          user_id: userA.userId,
          category_key: CATEGORY,
          local_date: focusDate,
          predicted_z: 0.2,
          baseline_raw: 3.0,
          visible: true,
        })
        .select("id")
        .single();
      if (pred.error) {
        fail(failures, "seed_prediction", pred.error.message);
      } else if (pred.data?.id) {
        created.predictionIds.push(pred.data.id);
      }
    }

    // --- Assemblers ---
    const dailyBridge = invokeBridge({
      mode: "remote_assemble",
      url,
      anonKey,
      accessToken: userA.accessToken,
      periodType: "daily",
      periodStart: focusDate,
      periodEnd: focusDate,
      focusDate,
      categoryKey: CATEGORY,
    });
    out.dailyAssembler = {
      ok: Boolean(dailyBridge.ok && dailyBridge.raw?.loadOk !== false),
      authenticated: dailyBridge.raw?.authenticated,
      sampleCount: dailyBridge.raw?.viewModel?.sampleCount,
      predictionVisible: dailyBridge.raw?.viewModel?.predictionVisible,
      modelExposureAllowed: dailyBridge.raw?.viewModel?.modelExposureAllowed,
      privacyOk: dailyBridge.raw?.privacy?.ok,
      error: dailyBridge.error || dailyBridge.raw?.loadError || null,
    };
    if (!dailyBridge.ok || !dailyBridge.raw?.authenticated) {
      fail(failures, "daily_assemble", dailyBridge.error || dailyBridge.raw);
    } else if (dailyBridge.raw.viewModel?.sampleCount !== SAMPLE_N) {
      fail(failures, "daily_sample_count", {
        expected: SAMPLE_N,
        got: dailyBridge.raw.viewModel?.sampleCount,
      });
    } else if (!dailyBridge.raw.viewModel?.modelExposureAllowed) {
      fail(failures, "daily_exposure_expected_allowed", {
        hideReasons: dailyBridge.raw.viewModel?.hideReasons,
        predictionVisible: dailyBridge.raw.viewModel?.predictionVisible,
      });
    }

    const weeklyBridge = invokeBridge({
      mode: "remote_assemble",
      url,
      anonKey,
      accessToken: userA.accessToken,
      periodType: "weekly",
      periodStart: periodStartWeekly,
      periodEnd: focusDate,
      focusDate,
      categoryKey: CATEGORY,
    });
    out.weeklyAssembler = {
      ok: Boolean(weeklyBridge.ok && weeklyBridge.raw?.authenticated),
      sampleCount: weeklyBridge.raw?.viewModel?.sampleCount,
      privacyOk: weeklyBridge.raw?.privacy?.ok,
      error: weeklyBridge.error || null,
    };
    if (!weeklyBridge.ok || !weeklyBridge.raw?.authenticated) {
      fail(failures, "weekly_assemble", weeklyBridge.error || weeklyBridge.raw);
    }

    const monthlyBridge = invokeBridge({
      mode: "remote_assemble",
      url,
      anonKey,
      accessToken: userA.accessToken,
      periodType: "monthly",
      periodStart: periodStartMonthly,
      periodEnd: focusDate,
      focusDate,
      categoryKey: CATEGORY,
    });
    out.monthlyAssembler = {
      ok: Boolean(monthlyBridge.ok && monthlyBridge.raw?.authenticated),
      sampleCount: monthlyBridge.raw?.viewModel?.sampleCount,
      privacyOk: monthlyBridge.raw?.privacy?.ok,
      error: monthlyBridge.error || null,
    };
    if (!monthlyBridge.ok || !monthlyBridge.raw?.authenticated) {
      fail(failures, "monthly_assemble", monthlyBridge.error || monthlyBridge.raw);
    }

    // Privacy + approximate from daily
    const blob = dailyBridge.raw?.narrativeBlob || "";
    const privacyReasons = dailyBridge.raw?.privacy?.reasons || [];
    const hasDiary =
      blob.includes("private diary") ||
      blob.includes("must never reach narrative");
    const hasCoeff = /coefficient/i.test(blob);
    const hasEmail = /@/.test(blob) && /gmail|example\.com/i.test(blob);
    const hasApproxFlag = blob.includes("__elementDistributionApproximate");
    out.narrativeInputPrivacyAudit = {
      ok:
        Boolean(dailyBridge.raw?.privacy?.ok) &&
        !hasDiary &&
        !hasCoeff &&
        !dailyBridge.raw?.narrativeHasUserId,
      reasons: privacyReasons,
      diaryInNarrative: hasDiary,
      coefficientsInNarrative: hasCoeff,
      emailLike: hasEmail,
      userIdInNarrative: Boolean(dailyBridge.raw?.narrativeHasUserId),
    };
    if (!out.narrativeInputPrivacyAudit.ok) {
      fail(failures, "privacy_audit", out.narrativeInputPrivacyAudit);
    }

    out.approximateFeatureAudit = {
      ok: !hasApproxFlag,
      approximateFlagInNarrative: hasApproxFlag,
    };
    if (!out.approximateFeatureAudit.ok) {
      fail(failures, "approximate_in_narrative", true);
    }

    // Version alignment on daily VM
    const vm = dailyBridge.raw?.viewModel;
    if (vm?.versionMetadata) {
      const v = vm.versionMetadata;
      if (
        v.calculationVersion !== CALC_V ||
        v.featureSchemaVersion !== FEAT_V ||
        (vm.modelExposureAllowed && v.modelVersion && v.modelVersion !== MODEL_V)
      ) {
        fail(failures, "version_mismatch", v);
      }
    }

    // Prediction visibility: deprecate visible, insert hidden model, reassemble
    if (created.modelIds[0]) {
      await sbA
        .from("personalization_models")
        .update({ deprecated_at: new Date().toISOString() })
        .eq("id", created.modelIds[0]);
    }
    const hiddenIns = await sbA
      .from("personalization_models")
      .insert({
        user_id: userA.userId,
        category_key: CATEGORY,
        model_type: "ridge",
        model_status: "degraded",
        data_stage: "early_signal",
        training_start_date: trainStart,
        training_end_date: trainEnd,
        valid_sample_count: SAMPLE_N,
        feature_keys: ["axisPeer"],
        coefficients: [9.99],
        intercept: 0,
        lambda: 10,
        feature_means: [0],
        feature_stds: [1],
        normalization_metadata: { weightedMean: 3.0, marker: MARKER },
        baseline_metrics: {},
        model_metrics: {
          baselineMae: 0.5,
          ridgeMae: 0.8,
          maeImprovement: -0.3,
          validationSampleCount: 2,
        },
        confidence_components: {},
        confidence_score: 20,
        confidence_band: "low",
        prediction_visible: false,
        summary_text: `${MARKER} HIDDEN should not appear in narrative pattern`,
        calculation_version: CALC_V,
        theory_version: THEORY_V,
        feature_schema_version: FEAT_V,
        model_version: MODEL_V,
        allowlist_version: ALLOW_V,
        model_code_version: CODE_V,
        training_run_key: `p5an_${RUN_ID}_hidden`,
      })
      .select("id")
      .single();
    if (hiddenIns.data?.id) {
      created.modelIds.push(hiddenIns.data.id);
      out.personalizationModelsUsed += 1;
    }

    const hideBridge = invokeBridge({
      mode: "remote_assemble",
      url,
      anonKey,
      accessToken: userA.accessToken,
      periodType: "daily",
      periodStart: focusDate,
      periodEnd: focusDate,
      focusDate,
      categoryKey: CATEGORY,
    });
    const hideVm = hideBridge.raw?.viewModel;
    const hideBlob = hideBridge.raw?.narrativeBlob || "";
    out.predictionVisibilityPolicy = {
      ok:
        hideVm &&
        hideVm.predictionVisible === false &&
        hideVm.modelExposureAllowed === false &&
        !hideBlob.includes("HIDDEN should not appear"),
      predictionVisible: hideVm?.predictionVisible,
      modelExposureAllowed: hideVm?.modelExposureAllowed,
      hideReasons: hideVm?.hideReasons,
    };
    if (!out.predictionVisibilityPolicy.ok) {
      fail(failures, "prediction_hide", out.predictionVisibilityPolicy);
    }

    // Cross-user: B assemble should not see A's sample count as A's data
    // B has only 1 score on focusDate
    const bBridge = invokeBridge({
      mode: "remote_assemble",
      url,
      anonKey,
      accessToken: userB.accessToken,
      periodType: "daily",
      periodStart: focusDate,
      periodEnd: focusDate,
      focusDate,
      categoryKey: CATEGORY,
    });
    const bSample = bBridge.raw?.viewModel?.sampleCount;
    // A reading B's journals via RLS
    const crossRead = await sbA
      .from("journal_entries")
      .select("id")
      .eq("id", created.journalIdsB[0] || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    out.crossUserIsolation = {
      ok:
        Boolean(bBridge.ok) &&
        bSample !== SAMPLE_N &&
        (bSample == null || bSample <= 2) &&
        !crossRead.data?.id,
      bSampleCount: bSample,
      aCouldReadBJournal: Boolean(crossRead.data?.id),
    };
    if (!out.crossUserIsolation.ok) {
      fail(failures, "cross_user", out.crossUserIsolation);
    }

    // Unauthenticated
    const anonBridge = invokeBridge({
      mode: "remote_assemble",
      url,
      anonKey,
      accessToken: null,
      periodType: "daily",
      periodStart: focusDate,
      periodEnd: focusDate,
      focusDate,
      categoryKey: CATEGORY,
    });
    out.unauthenticatedFallback = {
      ok:
        anonBridge.ok &&
        anonBridge.raw?.authenticated === false &&
        (anonBridge.raw?.viewModel?.sampleCount ?? 0) === 0,
      authenticated: anonBridge.raw?.authenticated,
      sampleCount: anonBridge.raw?.viewModel?.sampleCount,
    };
    if (!out.unauthenticatedFallback.ok) {
      fail(failures, "unauthenticated", out.unauthenticatedFallback);
    }

    // Empty data fallback (local assemble)
    const emptyBridge = invokeBridge({
      mode: "assemble_local",
      assembleInput: {
        periodType: "daily",
        periodStart: "2099-01-01",
        periodEnd: "2099-01-01",
        focusDate: "2099-01-01",
        categoryKey: CATEGORY,
        categoryLabel: "에너지·활력",
        scores: [],
        tags: [],
        astrology: null,
        model: null,
      },
    });
    out.emptyDataFallback = {
      ok: false,
      sampleCount: emptyBridge.raw?.viewModel?.sampleCount,
      hasFallbackText: false,
    };
    if (emptyBridge.raw?.viewModel) {
      const vm0 = emptyBridge.raw.viewModel;
      out.emptyDataFallback.hasFallbackText = Boolean(
        vm0.personalRecordLayer?.body ||
          vm0.astrologyTheoryLayer?.body ||
          vm0.actionSuggestionLayer?.body
      );
      out.emptyDataFallback.ok =
        emptyBridge.ok &&
        vm0.sampleCount === 0 &&
        out.emptyDataFallback.hasFallbackText;
      out.emptyDataFallback.sampleCount = vm0.sampleCount;
    }
    if (!out.emptyDataFallback.ok) {
      fail(failures, "empty_fallback", out.emptyDataFallback);
    }

    // Deterministic narrative with LLM flag off (bridge default)
    const narrOff = invokeBridge({
      mode: "narrative_live",
      scenario: "deterministic_flag_off",
      assembleInput: {
        periodType: "daily",
        periodStart: focusDate,
        periodEnd: focusDate,
        focusDate,
        categoryKey: CATEGORY,
        categoryLabel: "에너지·활력",
        scores: Array.from({ length: SAMPLE_N }, (_, i) => ({
          localDate: dateOffset(DATE0, i),
          rawScore: 2 + (i % 3),
        })),
        tags: ["exercise"],
        astrology: {
          localDate: focusDate,
          calculationVersion: CALC_V,
          theoryVersion: THEORY_V,
          featureSchemaVersion: FEAT_V,
          verifiedFeatureKeys: ["axisPeer"],
          theoryPlainSummary: "이론 요약",
        },
        model: null,
      },
    });
    out.deterministicFallback = {
      ok:
        narrOff.ok &&
        narrOff.raw?.source === "fallback" &&
        (narrOff.raw?.reasons || []).includes("llm_flag_off"),
      source: narrOff.raw?.source,
      reasons: narrOff.raw?.reasons,
    };
    if (!out.deterministicFallback.ok) {
      fail(failures, "deterministic_fallback", narrOff.raw);
    }
  } finally {
    const cleanup = { deleted: {}, errors: [] };
    const del = async (sb, table, ids) => {
      if (!ids?.length) return 0;
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

    // tags first (composite PK)
    for (const t of created.tagPairs) {
      const { error } = await sbA
        .from("journal_entry_tags")
        .delete()
        .eq("entry_id", t.entryId)
        .eq("tag_code", t.tag);
      if (error) cleanup.errors.push(`tags: ${error.message}`);
    }
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
    cleanup.deleted.scoresB = await del(
      sbB,
      "category_scores",
      created.scoreIdsB
    );
    cleanup.deleted.journalsB = await del(
      sbB,
      "journal_entries",
      created.journalIdsB
    );

    if (admin) {
      const uid = userA.userId;
      await admin
        .from("personalization_models")
        .delete()
        .eq("user_id", uid)
        .like("summary_text", `%${RUN_ID}%`);
      await admin
        .from("journal_entries")
        .delete()
        .eq("user_id", uid)
        .like("content", `%${RUN_ID}%`);
      await admin
        .from("journal_entries")
        .delete()
        .eq("user_id", userB.userId)
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

      // Ephemeral auth users created for this run only
      cleanup.deleted.ephemeralUsers = 0;
      for (const id of ephemeralUserIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) cleanup.errors.push(`deleteUser: ${error.message}`);
        else cleanup.deleted.ephemeralUsers += 1;
      }
    }

    out.cleanup = cleanup;

    if (serviceKey) {
      for (const t of countTables) {
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

  const remoteOk =
    failures.length === 0 &&
    out.loginSuccess &&
    out.dailyAssembler?.ok &&
    out.weeklyAssembler?.ok &&
    out.monthlyAssembler?.ok &&
    out.predictionVisibilityPolicy?.ok &&
    out.narrativeInputPrivacyAudit?.ok &&
    out.approximateFeatureAudit?.ok &&
    out.crossUserIsolation?.ok &&
    out.unauthenticatedFallback?.ok &&
    out.emptyDataFallback?.ok &&
    out.deterministicFallback?.ok;

  out.remoteAnalysisIntegrationVerification = remoteOk
    ? "complete"
    : "failed";
  out.deterministicProductionPath = remoteOk ? "complete" : "pending";
  out.liveLlmVerification = "pending";
  out.llmFeatureProductionReadiness = "pending";
  out.phase5ProductionReadinessWithLlmDisabled = remoteOk
    ? "complete"
    : "pending";
  // Full Phase 5 production readiness requires live LLM script as well
  out.phase5ProductionReadiness = "pending";
  out.appWideProductionReadiness = "pending";

  if (remoteOk) {
    out.note =
      "Remote data integration + deterministic path complete. Run verify-analysis-narrative-live.mjs for Live LLM. Keep FF_ANALYSIS_NARRATIVE_LLM OFF by default. Do not start final QA/release phase.";
  } else {
    out.nextActions = [
      "failures 확인 후 재실행",
      "cleanup.errors / RUN_ID 잔여 행 점검",
      "docs/PHASE_5_REMOTE_VERIFICATION.md 참고",
    ];
  }

  console.log(JSON.stringify(out, null, 2));
  process.exitCode = remoteOk ? 0 : 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
