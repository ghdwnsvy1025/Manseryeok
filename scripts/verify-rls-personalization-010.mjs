/**
 * Phase 4 — 개인화 Ridge MVP · Cross-user RLS verification
 *
 * Auth: TEST_USER_A/B EMAIL+PASSWORD → JWT → service-role ephemeral.
 * Never treats empty-table count=0 as RLS pass — inserts real rows then checks isolation.
 *
 * Usage: node scripts/verify-rls-personalization-010.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { getSupabaseEnv, restCount } from "./lib/supabaseEnv.mjs";
import {
  resolveTestUsers,
  deleteEphemeralUsers,
} from "./lib/testUsers.mjs";

const PHASE = "Phase 4 — 개인화 Ridge MVP";
const RUN_ID = `p4rls_${Date.now()}_${randomBytes(3).toString("hex")}`;
const MARKER = `[P4_RLS ${RUN_ID}]`;

function fail(failures, code, detail) {
  failures.push({ code, detail });
}

function clientFor(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

async function resolveUsers(envBundle) {
  const { url, anonKey, serviceKey, env } = envBundle;
  const r = await resolveTestUsers(url, anonKey, serviceKey, env, {
    runId: RUN_ID,
    marker: MARKER,
  });
  return {
    mode: r.authMode === "none" ? "missing" : r.authMode,
    a: r.a,
    b: r.b,
    tokenAMasked: r.tokenAMasked,
    tokenBMasked: r.tokenBMasked,
    ephemeralUserIds: r.ephemeralUserIds || [],
  };
}

function modelRow(userId, categoryKey, runKey) {
  return {
    user_id: userId,
    category_key: categoryKey,
    model_type: "ridge",
    model_status: "active",
    data_stage: "early_signal",
    valid_sample_count: 14,
    feature_keys: ["axisPeer", "luck_daily_rate"],
    coefficients: [0.1, -0.05],
    intercept: 0,
    lambda: 10,
    feature_means: [0.2, 1],
    feature_stds: [0.1, 0.2],
    normalization_metadata: { marker: MARKER },
    baseline_metrics: { mae: 0.5 },
    model_metrics: { ridgeMae: 0.4 },
    confidence_components: { volume: 0.2 },
    confidence_score: 40,
    confidence_band: "low",
    prediction_visible: false,
    summary_text: MARKER,
    calculation_version: "saju-calc-1.0.0",
    theory_version: "sajubase-final-2026-07-19",
    feature_schema_version: "saju-feature-mvp-1.0.0",
    model_version: `p4-rls-${RUN_ID}`,
    allowlist_version: "saju-feature-catalog-1.0.0",
    model_code_version: "ridge-mvp-1.0.0",
    training_run_key: runKey,
  };
}

async function cleanup(created, url, anonKey, serviceKey, userA, userB) {
  const result = {
    predictionsDeleted: 0,
    metricsDeleted: 0,
    modelsDeleted: 0,
    errors: [],
  };

  const tryUserDelete = async (accessToken, table, ids) => {
    if (!ids.length) return 0;
    const sb = clientFor(url, anonKey, accessToken);
    const { error, count } = await sb
      .from(table)
      .delete({ count: "exact" })
      .in("id", ids);
    if (error) {
      result.errors.push(`${table}: ${error.message}`);
      return 0;
    }
    return count ?? ids.length;
  };

  result.predictionsDeleted += await tryUserDelete(
    userA.accessToken,
    "personalization_predictions",
    created.a.predictionIds
  );
  result.predictionsDeleted += await tryUserDelete(
    userB.accessToken,
    "personalization_predictions",
    created.b.predictionIds
  );
  result.metricsDeleted += await tryUserDelete(
    userA.accessToken,
    "personalization_model_metrics",
    created.a.metricIds
  );
  result.metricsDeleted += await tryUserDelete(
    userB.accessToken,
    "personalization_model_metrics",
    created.b.metricIds
  );
  result.modelsDeleted += await tryUserDelete(
    userA.accessToken,
    "personalization_models",
    created.a.modelIds
  );
  result.modelsDeleted += await tryUserDelete(
    userB.accessToken,
    "personalization_models",
    created.b.modelIds
  );

  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const uids = [userA.userId, userB.userId].filter(Boolean);
    // predictions first (by test category prefix), then models by MARKER (cascades metrics)
    const { error: e1 } = await admin
      .from("personalization_predictions")
      .delete()
      .in("user_id", uids)
      .like("category_key", "p4rls_%");
    if (e1) result.errors.push(`admin predictions: ${e1.message}`);
    const { error: e3 } = await admin
      .from("personalization_models")
      .delete()
      .in("user_id", uids)
      .eq("summary_text", MARKER);
    if (e3) result.errors.push(`admin models: ${e3.message}`);
  }

  return result;
}

async function main() {
  const failures = [];
  const out = {
    phase: PHASE,
    runId: RUN_ID,
    marker: MARKER,
    authMode: null,
    loginA: null,
    loginB: null,
    userIdsDistinct: null,
    tokenAMasked: null,
    tokenBMasked: null,
    baseline: {
      diary_entries: null,
      journal_entries: null,
      astrology_snapshots: null,
      personalization_models: null,
    },
    afterCleanup: {},
    ownCrud: {},
    crossUserReadBlocked: {},
    crossUserWriteBlocked: {},
    anonBlocked: {},
    cleanup: null,
    emptyTableNotUsedAsPass: true,
    verdict: {
      remoteMigration: "assumed_applied",
      schemaVerification: "see_verify-personalization-010",
      existingDataPreservation: "pending",
      crossUserRlsVerification: "pending",
      approximateFeatureExclusion: "see_verify-personalization-010",
      phase4ProductionReadiness: "pending",
      appWideProductionReadiness: "pending",
    },
    ok: false,
    failures: [],
    nextActions: [],
  };

  const envBundle = getSupabaseEnv();
  if (!envBundle.ok) {
    fail(failures, "env", envBundle.reason);
    out.failures = failures;
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  const { url, anonKey, serviceKey } = envBundle;

  if (serviceKey) {
    for (const t of [
      "diary_entries",
      "journal_entries",
      "astrology_snapshots",
      "personalization_models",
    ]) {
      const c = await restCount(url, serviceKey, t);
      if (c.ok) out.baseline[t] = c.count;
    }
  }

  // Tables must exist
  if (out.baseline.personalization_models == null) {
    fail(
      failures,
      "migration_010_missing",
      "personalization_models 없음 — 010 적용 후 verify-personalization-010.mjs 먼저 실행"
    );
    out.failures = failures;
    out.nextActions.push("supabase/migrations/010_personalization_models.sql 적용");
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  const resolved = await resolveUsers(envBundle);
  out.authMode = resolved.mode;
  out.tokenAMasked = resolved.tokenAMasked;
  out.tokenBMasked = resolved.tokenBMasked;

  if (resolved.mode === "missing") {
    fail(
      failures,
      "missing_credentials",
      "TEST_USER_A_EMAIL/PASSWORD + TEST_USER_B_EMAIL/PASSWORD 필요"
    );
    out.failures = failures;
    out.nextActions = [
      "Phase 3에서 사용한 A/B 테스트 계정 재사용",
      ".env.local에 TEST_USER_* 설정",
      "docs/PHASE_4_REMOTE_VERIFICATION.md 참고",
    ];
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  out.loginA = {
    ok: resolved.a.ok,
    userId: resolved.a.userId,
    error: resolved.a.error || null,
  };
  out.loginB = {
    ok: resolved.b.ok,
    userId: resolved.b.userId,
    error: resolved.b.error || null,
  };

  if (!resolved.a.ok || !resolved.b.ok) {
    if (!resolved.a.ok) fail(failures, "login_a_failed", resolved.a.error);
    if (!resolved.b.ok) fail(failures, "login_b_failed", resolved.b.error);
    out.failures = failures;
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  out.userIdsDistinct = resolved.a.userId !== resolved.b.userId;
  if (!out.userIdsDistinct) {
    fail(failures, "same_user", "A와 B user id 동일");
    out.failures = failures;
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  const userA = resolved.a;
  const userB = resolved.b;
  const sbA = clientFor(url, anonKey, userA.accessToken);
  const sbB = clientFor(url, anonKey, userB.accessToken);
  const sbAnon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const created = {
    a: { modelIds: [], metricIds: [], predictionIds: [] },
    b: { modelIds: [], metricIds: [], predictionIds: [] },
  };

  const catA = `p4rls_a_${RUN_ID.slice(-8)}`;
  const catB = `p4rls_b_${RUN_ID.slice(-8)}`;

  try {
    // --- Own create model ---
    const insA = await sbA
      .from("personalization_models")
      .insert(modelRow(userA.userId, catA, `${RUN_ID}|A|${catA}`))
      .select("id,user_id,feature_keys,summary_text")
      .single();
    if (insA.error || !insA.data?.id) {
      fail(failures, "a_model_create", insA.error?.message || "no id");
    } else {
      created.a.modelIds.push(insA.data.id);
      out.ownCrud.a_model_create = true;
      if (
        Array.isArray(insA.data.feature_keys) &&
        insA.data.feature_keys.some((k) =>
          ["yinRatio", "yangRatio", "original_rate"].includes(k)
        )
      ) {
        fail(failures, "a_forbidden_feature_keys", insA.data.feature_keys);
      }
    }

    const insB = await sbB
      .from("personalization_models")
      .insert(modelRow(userB.userId, catB, `${RUN_ID}|B|${catB}`))
      .select("id,user_id")
      .single();
    if (insB.error || !insB.data?.id) {
      fail(failures, "b_model_create", insB.error?.message || "no id");
    } else {
      created.b.modelIds.push(insB.data.id);
      out.ownCrud.b_model_create = true;
    }

    const modelA = created.a.modelIds[0];
    const modelB = created.b.modelIds[0];

    // Must have created rows — empty table ≠ pass
    if (!modelA || !modelB) {
      fail(
        failures,
        "insufficient_seed_rows",
        "자기 모델 생성 실패 — 빈 테이블 0건으로 RLS 통과 판정 금지"
      );
    }

    // Own read
    if (modelA) {
      const r = await sbA
        .from("personalization_models")
        .select("id")
        .eq("id", modelA)
        .maybeSingle();
      out.ownCrud.a_model_read = Boolean(r.data?.id);
      if (!r.data?.id) fail(failures, "a_model_read", r.error?.message);
    }
    if (modelB) {
      const r = await sbB
        .from("personalization_models")
        .select("id")
        .eq("id", modelB)
        .maybeSingle();
      out.ownCrud.b_model_read = Boolean(r.data?.id);
      if (!r.data?.id) fail(failures, "b_model_read", r.error?.message);
    }

    // Own metrics + predictions
    if (modelA) {
      const m = await sbA
        .from("personalization_model_metrics")
        .insert({
          model_id: modelA,
          user_id: userA.userId,
          baseline_mae: 1,
          ridge_mae: 0.8,
          mae_improvement: 0.2,
          validation_sample_count: 3,
          train_sample_count: 11,
          lambda: 10,
        })
        .select("id")
        .single();
      if (m.error || !m.data?.id) {
        fail(failures, "a_metrics_create", m.error?.message);
      } else {
        created.a.metricIds.push(m.data.id);
        out.ownCrud.a_metrics_create = true;
      }

      const p = await sbA
        .from("personalization_predictions")
        .insert({
          model_id: modelA,
          user_id: userA.userId,
          category_key: catA,
          local_date: "2099-06-01",
          predicted_z: 0.1,
          baseline_raw: 3,
          visible: false,
        })
        .select("id")
        .single();
      if (p.error || !p.data?.id) {
        fail(failures, "a_prediction_create", p.error?.message);
      } else {
        created.a.predictionIds.push(p.data.id);
        out.ownCrud.a_prediction_create = true;
      }

      const mr = await sbA
        .from("personalization_model_metrics")
        .select("id")
        .eq("id", created.a.metricIds[0] || "")
        .maybeSingle();
      out.ownCrud.a_metrics_read = Boolean(mr.data?.id);
      const pr = await sbA
        .from("personalization_predictions")
        .select("id")
        .eq("id", created.a.predictionIds[0] || "")
        .maybeSingle();
      out.ownCrud.a_prediction_read = Boolean(pr.data?.id);
    }

    if (modelB) {
      const m = await sbB
        .from("personalization_model_metrics")
        .insert({
          model_id: modelB,
          user_id: userB.userId,
          baseline_mae: 1.1,
          ridge_mae: 0.9,
        })
        .select("id")
        .single();
      if (m.data?.id) {
        created.b.metricIds.push(m.data.id);
        out.ownCrud.b_metrics_create = true;
      } else {
        fail(failures, "b_metrics_create", m.error?.message);
      }
      const p = await sbB
        .from("personalization_predictions")
        .insert({
          model_id: modelB,
          user_id: userB.userId,
          category_key: catB,
          local_date: "2099-06-02",
          predicted_z: -0.1,
          visible: false,
        })
        .select("id")
        .single();
      if (p.data?.id) {
        created.b.predictionIds.push(p.data.id);
        out.ownCrud.b_prediction_create = true;
      } else {
        fail(failures, "b_prediction_create", p.error?.message);
      }
    }

    // --- Cross-user READ blocked ---
    if (modelB) {
      const cross = await sbA
        .from("personalization_models")
        .select("id")
        .eq("id", modelB)
        .maybeSingle();
      out.crossUserReadBlocked.a_cannot_read_b_model = !cross.data?.id;
      if (cross.data?.id) {
        fail(failures, "a_read_b_model", "A가 B 모델을 읽음");
      }
    }
    if (modelA) {
      const cross = await sbB
        .from("personalization_models")
        .select("id")
        .eq("id", modelA)
        .maybeSingle();
      out.crossUserReadBlocked.b_cannot_read_a_model = !cross.data?.id;
      if (cross.data?.id) {
        fail(failures, "b_read_a_model", "B가 A 모델을 읽음");
      }
    }
    if (created.b.metricIds[0]) {
      const cross = await sbA
        .from("personalization_model_metrics")
        .select("id")
        .eq("id", created.b.metricIds[0])
        .maybeSingle();
      out.crossUserReadBlocked.a_cannot_read_b_metrics = !cross.data?.id;
      if (cross.data?.id) fail(failures, "a_read_b_metrics", "leak");
    }
    if (created.b.predictionIds[0]) {
      const cross = await sbA
        .from("personalization_predictions")
        .select("id")
        .eq("id", created.b.predictionIds[0])
        .maybeSingle();
      out.crossUserReadBlocked.a_cannot_read_b_prediction = !cross.data?.id;
      if (cross.data?.id) fail(failures, "a_read_b_prediction", "leak");
    }

    // --- Cross-user UPDATE/DELETE blocked ---
    if (modelB) {
      const upd = await sbA
        .from("personalization_models")
        .update({ summary_text: `${MARKER} hacked by A` })
        .eq("id", modelB)
        .select("id");
      const updated = Array.isArray(upd.data) && upd.data.length > 0;
      out.crossUserWriteBlocked.a_cannot_update_b_model = !updated;
      if (updated) fail(failures, "a_update_b_model", "A가 B 수정");

      const del = await sbA
        .from("personalization_models")
        .delete()
        .eq("id", modelB)
        .select("id");
      const deleted = Array.isArray(del.data) && del.data.length > 0;
      out.crossUserWriteBlocked.a_cannot_delete_b_model = !deleted;
      if (deleted) {
        fail(failures, "a_delete_b_model", "A가 B 삭제");
        created.b.modelIds = created.b.modelIds.filter((id) => id !== modelB);
      }
    }
    if (modelA) {
      const upd = await sbB
        .from("personalization_models")
        .update({ summary_text: `${MARKER} hacked by B` })
        .eq("id", modelA)
        .select("id");
      const updated = Array.isArray(upd.data) && upd.data.length > 0;
      out.crossUserWriteBlocked.b_cannot_update_a_model = !updated;
      if (updated) fail(failures, "b_update_a_model", "B가 A 수정");

      const del = await sbB
        .from("personalization_models")
        .delete()
        .eq("id", modelA)
        .select("id");
      const deleted = Array.isArray(del.data) && del.data.length > 0;
      out.crossUserWriteBlocked.b_cannot_delete_a_model = !deleted;
      if (deleted) {
        fail(failures, "b_delete_a_model", "B가 A 삭제");
        created.a.modelIds = created.a.modelIds.filter((id) => id !== modelA);
      }
    }

    if (created.b.predictionIds[0]) {
      const del = await sbA
        .from("personalization_predictions")
        .delete()
        .eq("id", created.b.predictionIds[0])
        .select("id");
      const deleted = Array.isArray(del.data) && del.data.length > 0;
      out.crossUserWriteBlocked.a_cannot_delete_b_prediction = !deleted;
      if (deleted) fail(failures, "a_delete_b_prediction", "leak delete");
    }

    // --- Anon blocked ---
    const anonSelect = await sbAnon
      .from("personalization_models")
      .select("id")
      .eq("id", modelA || "00000000-0000-0000-0000-000000000000");
    out.anonBlocked.read =
      !anonSelect.data || anonSelect.data.length === 0;
    if (anonSelect.data?.length) {
      fail(failures, "anon_read", "익명이 모델 조회");
    }

    const anonIns = await sbAnon
      .from("personalization_models")
      .insert(
        modelRow(
          userA.userId,
          `p4rls_anon_${RUN_ID.slice(-6)}`,
          `${RUN_ID}|anon`
        )
      )
      .select("id");
    out.anonBlocked.create = Boolean(anonIns.error) || !anonIns.data?.length;
    if (!out.anonBlocked.create && anonIns.data?.[0]?.id) {
      fail(failures, "anon_create", "익명 생성 성공");
      // cleanup orphan via service
      if (serviceKey) {
        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false },
        });
        await admin
          .from("personalization_models")
          .delete()
          .eq("id", anonIns.data[0].id);
      }
    }

    if (modelA) {
      const anonUpd = await sbAnon
        .from("personalization_models")
        .update({ summary_text: "anon" })
        .eq("id", modelA)
        .select("id");
      out.anonBlocked.update =
        !anonUpd.data || anonUpd.data.length === 0;
      if (anonUpd.data?.length) fail(failures, "anon_update", "익명 수정");

      const anonDel = await sbAnon
        .from("personalization_models")
        .delete()
        .eq("id", modelA)
        .select("id");
      out.anonBlocked.delete =
        !anonDel.data || anonDel.data.length === 0;
      if (anonDel.data?.length) {
        fail(failures, "anon_delete", "익명 삭제");
        created.a.modelIds = [];
      }
    }
  } finally {
    out.cleanup = await cleanup(
      created,
      url,
      anonKey,
      serviceKey,
      userA,
      userB
    );
  }

  // Preservation after cleanup
  if (serviceKey) {
    for (const t of [
      "diary_entries",
      "journal_entries",
      "astrology_snapshots",
    ]) {
      const c = await restCount(url, serviceKey, t);
      out.afterCleanup[t] = c.count;
      if (
        out.baseline[t] != null &&
        c.count != null &&
        c.count !== out.baseline[t]
      ) {
        fail(failures, `${t}_count_changed`, {
          before: out.baseline[t],
          after: c.count,
        });
      }
    }
  }

  if (resolved.ephemeralUserIds?.length && serviceKey) {
    out.ephemeralCleanup = await deleteEphemeralUsers(
      url,
      serviceKey,
      resolved.ephemeralUserIds
    );
  }

  out.failures = failures;
  const rlsOk = failures.length === 0;
  out.ok = rlsOk;
  out.verdict.crossUserRlsVerification = rlsOk ? "complete" : "failed";
  out.verdict.existingDataPreservation =
    failures.some((f) => String(f.code).includes("count_changed"))
      ? "failed"
      : out.baseline.diary_entries != null
        ? "complete"
        : "partial";

  // Production readiness: this script alone is not enough — user must also have schema verify
  out.verdict.phase4ProductionReadiness = "pending";
  out.verdict.appWideProductionReadiness = "pending";
  out.note =
    "이 스크립트 ok:true = Cross-user RLS complete. Phase 4 production readiness는 schema+preservation+RLS+allowlist 모두 complete일 때만 수동/문서에서 complete로 표시. 앱 전체 출시 ≠ Phase 4.";

  if (rlsOk) {
    out.nextActions.push(
      "verify-personalization-010.mjs 의 verdict(schema/preservation/allowlist)가 complete인지 확인"
    );
    out.nextActions.push(
      "모두 complete이면 docs/QA_STATUS.md 에 Phase 4 production readiness: complete 기록 (앱 전체는 pending 유지)"
    );
  } else {
    out.nextActions.push("failures 수정 후 재실행");
    out.nextActions.push("cleanup.errors 및 잔여 MARKER 행 점검");
  }

  console.log(JSON.stringify(out, null, 2));
  process.exitCode = rlsOk ? 0 : 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
