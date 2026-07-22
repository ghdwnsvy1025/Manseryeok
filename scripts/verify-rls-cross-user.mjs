/**
 * Cross-user RLS verification for journal + astrology tables.
 *
 * Auth: TEST_USER_A/B EMAIL+PASSWORD → JWT → service-role ephemeral (deleted after).
 * Never uses anon/service_role as a user JWT.
 *
 * Usage: node scripts/verify-rls-cross-user.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { getSupabaseEnv } from "./lib/supabaseEnv.mjs";
import {
  resolveTestUsers,
  deleteEphemeralUsers,
} from "./lib/testUsers.mjs";

const RUN_ID = `rls_${Date.now()}_${randomBytes(3).toString("hex")}`;
const MARKER = `[RLS_TEST ${RUN_ID}]`;

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

function ownJournalPayload(userId, entryDate) {
  return {
    user_id: userId,
    entry_date: entryDate,
    user_timezone: "Asia/Seoul",
    content: `${MARKER} journal own`,
    overall_satisfaction: 3,
    mood_label: "calm",
    main_event_text: MARKER,
    source: "new_diary",
  };
}

function ownAstrologyProfile(userId) {
  return {
    user_id: userId,
    saju_profile_id: null,
    birth_timezone: "Asia/Seoul",
    calendar_calculation_version: "0.1.0",
    original_pillars: { marker: MARKER },
    original_element_distribution: { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 },
    day_master: "기",
    month_branch: "술",
    day_branch: "축",
    static_feature_payload: { marker: MARKER },
    theory_version: "sajubase-final-2026-07-19",
    feature_schema_version: "saju-feature-mvp-1.0.0",
  };
}

function ownSnapshot(userId, profileId, localDate) {
  return {
    user_id: userId,
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
    calculation_version: "saju-calc-1.0.0",
    theory_version: "sajubase-final-2026-07-19",
    feature_schema_version: "saju-feature-mvp-1.0.0",
    status: "ready",
  };
}

async function cleanup(created, url, anonKey, serviceKey, userA, userB) {
  const result = {
    journalDeleted: 0,
    profilesDeleted: 0,
    snapshotsDeleted: 0,
    vectorsDeleted: 0,
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

  // Vectors first (FK), then snapshots, profiles, journals — by owning user
  result.vectorsDeleted += await tryUserDelete(
    userA.accessToken,
    "astrology_feature_vectors",
    created.a.vectorIds
  );
  result.vectorsDeleted += await tryUserDelete(
    userB.accessToken,
    "astrology_feature_vectors",
    created.b.vectorIds
  );
  result.snapshotsDeleted += await tryUserDelete(
    userA.accessToken,
    "astrology_snapshots",
    created.a.snapshotIds
  );
  result.snapshotsDeleted += await tryUserDelete(
    userB.accessToken,
    "astrology_snapshots",
    created.b.snapshotIds
  );
  result.profilesDeleted += await tryUserDelete(
    userA.accessToken,
    "astrology_profiles",
    created.a.profileIds
  );
  result.profilesDeleted += await tryUserDelete(
    userB.accessToken,
    "astrology_profiles",
    created.b.profileIds
  );
  result.journalDeleted += await tryUserDelete(
    userA.accessToken,
    "journal_entries",
    created.a.journalIds
  );
  result.journalDeleted += await tryUserDelete(
    userB.accessToken,
    "journal_entries",
    created.b.journalIds
  );

  // Service role assist: only rows still matching MARKER for test user ids
  if (serviceKey && (userA.userId || userB.userId)) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const uids = [userA.userId, userB.userId].filter(Boolean);
    const tables = [
      "astrology_feature_vectors",
      "astrology_snapshots",
      "astrology_profiles",
      "journal_entries",
    ];
    for (const table of tables) {
      // journal/content or structured_features marker
      if (table === "journal_entries") {
        const { error } = await admin
          .from(table)
          .delete()
          .in("user_id", uids)
          .like("content", `%${RUN_ID}%`);
        if (error) result.errors.push(`admin ${table}: ${error.message}`);
      } else if (table === "astrology_profiles") {
        const { error } = await admin
          .from(table)
          .delete()
          .in("user_id", uids)
          .contains("static_feature_payload", { marker: MARKER });
        if (error) result.errors.push(`admin ${table}: ${error.message}`);
      } else if (table === "astrology_snapshots") {
        const { error } = await admin
          .from(table)
          .delete()
          .in("user_id", uids)
          .contains("structured_features", { marker: MARKER });
        if (error) result.errors.push(`admin ${table}: ${error.message}`);
      }
    }
  }

  return result;
}

async function main() {
  const failures = [];
  const out = {
    runId: RUN_ID,
    marker: MARKER,
    authMode: null,
    loginA: null,
    loginB: null,
    userIdsDistinct: null,
    tokenAMasked: null,
    tokenBMasked: null,
    diaryEntriesBaseline: null,
    ownCrud: {},
    crossUserReadBlocked: {},
    crossUserWriteBlocked: {},
    anonBlocked: {},
    cleanup: null,
    remoteRlsVerification: "pending",
    productionReady: false,
    ok: false,
    failures: [],
    nextActions: [],
  };

  const envBundle = getSupabaseEnv();
  if (!envBundle.ok) {
    out.failures.push({ code: "env", detail: envBundle.reason });
    out.nextActions.push(".env.local에 URL·ANON_KEY 확인");
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  const { url, anonKey, serviceKey } = envBundle;

  // Baseline diary_entries (must not change)
  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    const { count, error } = await admin
      .from("diary_entries")
      .select("*", { count: "exact", head: true });
    if (!error) out.diaryEntriesBaseline = count;
  }

  const resolved = await resolveUsers(envBundle);
  out.authMode = resolved.mode;
  out.tokenAMasked = resolved.tokenAMasked;
  out.tokenBMasked = resolved.tokenBMasked;

  if (resolved.mode === "missing") {
    fail(
      failures,
      "missing_credentials",
      "TEST_USER_A_EMAIL/PASSWORD + TEST_USER_B_EMAIL/PASSWORD (권장) 또는 JWT 쌍 필요"
    );
    out.failures = failures;
    out.nextActions = [
      "Dashboard → Authentication → Users 에서 테스트 전용 계정 2개 생성",
      ".env.local에 TEST_USER_A_EMAIL/PASSWORD, TEST_USER_B_EMAIL/PASSWORD 추가",
      "docs/RLS_CROSS_USER_VERIFICATION.md 참고",
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

  if (!resolved.a.ok) {
    fail(failures, "login_a_failed", resolved.a.error);
  }
  if (!resolved.b.ok) {
    fail(failures, "login_b_failed", resolved.b.error);
  }
  if (!resolved.a.ok || !resolved.b.ok) {
    out.failures = failures;
    out.nextActions.push(
      "이메일 미확인·비밀번호 오류·계정이 없으면 Dashboard에서 Confirm 후 재시도"
    );
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
    return;
  }

  out.userIdsDistinct = resolved.a.userId !== resolved.b.userId;
  if (!out.userIdsDistinct) {
    fail(failures, "same_user", "A와 B user id가 동일함");
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
    a: { journalIds: [], profileIds: [], snapshotIds: [], vectorIds: [] },
    b: { journalIds: [], profileIds: [], snapshotIds: [], vectorIds: [] },
  };

  // Far-future dates to avoid colliding with real diary habits
  const dateA = "2099-01-11";
  const dateB = "2099-01-12";

  try {
    // --- Own journal CRUD ---
    const insA = await sbA
      .from("journal_entries")
      .insert(ownJournalPayload(userA.userId, dateA))
      .select("id,user_id,content")
      .single();
    if (insA.error || !insA.data?.id) {
      fail(failures, "a_journal_create", insA.error?.message || "no id");
    } else {
      created.a.journalIds.push(insA.data.id);
      out.ownCrud.a_journal_create = true;
    }

    const insB = await sbB
      .from("journal_entries")
      .insert(ownJournalPayload(userB.userId, dateB))
      .select("id,user_id,content")
      .single();
    if (insB.error || !insB.data?.id) {
      fail(failures, "b_journal_create", insB.error?.message || "no id");
    } else {
      created.b.journalIds.push(insB.data.id);
      out.ownCrud.b_journal_create = true;
    }

    const journalAId = created.a.journalIds[0];
    const journalBId = created.b.journalIds[0];

    if (journalAId) {
      const readA = await sbA
        .from("journal_entries")
        .select("id,content")
        .eq("id", journalAId)
        .maybeSingle();
      out.ownCrud.a_journal_read = Boolean(readA.data?.id);
      if (!readA.data?.id) fail(failures, "a_journal_read", readA.error?.message);

      const updA = await sbA
        .from("journal_entries")
        .update({ content: `${MARKER} journal updated` })
        .eq("id", journalAId)
        .select("id,content");
      out.ownCrud.a_journal_update =
        Array.isArray(updA.data) && updA.data.length === 1;
      if (!out.ownCrud.a_journal_update) {
        fail(failures, "a_journal_update", updA.error?.message || "0 rows");
      }
    }

    if (journalBId) {
      const readB = await sbB
        .from("journal_entries")
        .select("id")
        .eq("id", journalBId)
        .maybeSingle();
      out.ownCrud.b_journal_read = Boolean(readB.data?.id);
      const updB = await sbB
        .from("journal_entries")
        .update({ content: `${MARKER} journal updated B` })
        .eq("id", journalBId)
        .select("id");
      out.ownCrud.b_journal_update =
        Array.isArray(updB.data) && updB.data.length === 1;
      if (!out.ownCrud.b_journal_read) {
        fail(failures, "b_journal_read", readB.error?.message);
      }
      if (!out.ownCrud.b_journal_update) {
        fail(failures, "b_journal_update", updB.error?.message || "0 rows");
      }
    }

    // Require both journals exist before isolation claims
    if (!journalAId || !journalBId) {
      fail(
        failures,
        "insufficient_seed",
        "양쪽 journal 생성 실패 — 빈 조회를 RLS 통과로 간주하지 않음"
      );
    } else {
      // Cross read
      const aReadsB = await sbA
        .from("journal_entries")
        .select("id")
        .eq("id", journalBId);
      const bReadsA = await sbB
        .from("journal_entries")
        .select("id")
        .eq("id", journalAId);
      const aListSeesB = await sbA
        .from("journal_entries")
        .select("id")
        .eq("user_id", userB.userId);
      const bListSeesA = await sbB
        .from("journal_entries")
        .select("id")
        .eq("user_id", userA.userId);

      out.crossUserReadBlocked.a_cannot_read_b_journal =
        Array.isArray(aReadsB.data) && aReadsB.data.length === 0;
      out.crossUserReadBlocked.b_cannot_read_a_journal =
        Array.isArray(bReadsA.data) && bReadsA.data.length === 0;
      out.crossUserReadBlocked.a_list_cannot_see_b =
        Array.isArray(aListSeesB.data) && aListSeesB.data.length === 0;
      out.crossUserReadBlocked.b_list_cannot_see_a =
        Array.isArray(bListSeesA.data) && bListSeesA.data.length === 0;

      for (const [k, v] of Object.entries(out.crossUserReadBlocked)) {
        if (!String(k).includes("journal")) continue;
        if (!v) fail(failures, k, "상대 journal 조회가 차단되지 않음");
      }

      // Cross write
      const aUpdB = await sbA
        .from("journal_entries")
        .update({ content: `${MARKER} hack` })
        .eq("id", journalBId)
        .select("id");
      const bUpdA = await sbB
        .from("journal_entries")
        .update({ content: `${MARKER} hack` })
        .eq("id", journalAId)
        .select("id");
      const aDelB = await sbA
        .from("journal_entries")
        .delete()
        .eq("id", journalBId)
        .select("id");
      const bDelA = await sbB
        .from("journal_entries")
        .delete()
        .eq("id", journalAId)
        .select("id");

      out.crossUserWriteBlocked.a_cannot_update_b_journal =
        !aUpdB.data?.length;
      out.crossUserWriteBlocked.b_cannot_update_a_journal =
        !bUpdA.data?.length;
      out.crossUserWriteBlocked.a_cannot_delete_b_journal =
        !aDelB.data?.length;
      out.crossUserWriteBlocked.b_cannot_delete_a_journal =
        !bDelA.data?.length;

      for (const [k, v] of Object.entries(out.crossUserWriteBlocked)) {
        if (!String(k).includes("journal")) continue;
        if (!v) fail(failures, k, "상대 journal 변경이 차단되지 않음");
      }

      // Confirm B row still exists after A delete attempt
      const bStill = await sbB
        .from("journal_entries")
        .select("id")
        .eq("id", journalBId)
        .maybeSingle();
      if (!bStill.data?.id) {
        fail(failures, "b_journal_destroyed", "A의 삭제로 B 데이터가 사라짐");
      }
    }

    // --- Astrology own create ---
    const profA = await sbA
      .from("astrology_profiles")
      .insert(ownAstrologyProfile(userA.userId))
      .select("id")
      .single();
    const profB = await sbB
      .from("astrology_profiles")
      .insert(ownAstrologyProfile(userB.userId))
      .select("id")
      .single();

    if (profA.error || !profA.data?.id) {
      fail(failures, "a_profile_create", profA.error?.message || "no id");
    } else {
      created.a.profileIds.push(profA.data.id);
      out.ownCrud.a_profile_create = true;
    }
    if (profB.error || !profB.data?.id) {
      fail(failures, "b_profile_create", profB.error?.message || "no id");
    } else {
      created.b.profileIds.push(profB.data.id);
      out.ownCrud.b_profile_create = true;
    }

    const profileAId = created.a.profileIds[0];
    const profileBId = created.b.profileIds[0];

    if (profileAId) {
      const r = await sbA
        .from("astrology_profiles")
        .select("id")
        .eq("id", profileAId)
        .maybeSingle();
      out.ownCrud.a_profile_read = Boolean(r.data?.id);
      if (!r.data?.id) fail(failures, "a_profile_read", r.error?.message);
    }

    if (profileAId) {
      const snapA = await sbA
        .from("astrology_snapshots")
        .insert(ownSnapshot(userA.userId, profileAId, dateA))
        .select("id")
        .single();
      if (snapA.error || !snapA.data?.id) {
        fail(failures, "a_snapshot_create", snapA.error?.message || "no id");
      } else {
        created.a.snapshotIds.push(snapA.data.id);
        out.ownCrud.a_snapshot_create = true;
        const vecA = await sbA
          .from("astrology_feature_vectors")
          .insert({
            snapshot_id: snapA.data.id,
            user_id: userA.userId,
            local_date: dateA,
            calculation_mode: "native_with_luck",
            vector: { wood: 1, marker: MARKER },
            feature_schema_version: "saju-feature-mvp-1.0.0",
            calculation_version: "saju-calc-1.0.0",
          })
          .select("id")
          .single();
        if (vecA.error || !vecA.data?.id) {
          fail(failures, "a_vector_create", vecA.error?.message || "no id");
        } else {
          created.a.vectorIds.push(vecA.data.id);
          out.ownCrud.a_vector_create = true;
        }
      }
    }

    if (profileBId) {
      const snapB = await sbB
        .from("astrology_snapshots")
        .insert(ownSnapshot(userB.userId, profileBId, dateB))
        .select("id")
        .single();
      if (snapB.error || !snapB.data?.id) {
        fail(failures, "b_snapshot_create", snapB.error?.message || "no id");
      } else {
        created.b.snapshotIds.push(snapB.data.id);
        const vecB = await sbB
          .from("astrology_feature_vectors")
          .insert({
            snapshot_id: snapB.data.id,
            user_id: userB.userId,
            local_date: dateB,
            calculation_mode: "native_with_luck",
            vector: { wood: 1, marker: MARKER },
            feature_schema_version: "saju-feature-mvp-1.0.0",
            calculation_version: "saju-calc-1.0.0",
          })
          .select("id")
          .single();
        if (vecB.data?.id) created.b.vectorIds.push(vecB.data.id);
      }
    }

    const snapshotAId = created.a.snapshotIds[0];
    const snapshotBId = created.b.snapshotIds[0];
    const vectorAId = created.a.vectorIds[0];
    const vectorBId = created.b.vectorIds[0];

    if (snapshotAId) {
      const r = await sbA
        .from("astrology_snapshots")
        .select("id")
        .eq("id", snapshotAId)
        .maybeSingle();
      out.ownCrud.a_snapshot_read = Boolean(r.data?.id);
    }
    if (vectorAId) {
      const r = await sbA
        .from("astrology_feature_vectors")
        .select("id")
        .eq("id", vectorAId)
        .maybeSingle();
      out.ownCrud.a_vector_read = Boolean(r.data?.id);
    }

    if (profileAId && profileBId && snapshotAId && snapshotBId) {
      const checks = [
        ["a_cannot_read_b_profile", sbA, "astrology_profiles", profileBId],
        ["b_cannot_read_a_profile", sbB, "astrology_profiles", profileAId],
        ["a_cannot_read_b_snapshot", sbA, "astrology_snapshots", snapshotBId],
        ["b_cannot_read_a_snapshot", sbB, "astrology_snapshots", snapshotAId],
      ];
      if (vectorAId && vectorBId) {
        checks.push(
          ["a_cannot_read_b_vector", sbA, "astrology_feature_vectors", vectorBId],
          ["b_cannot_read_a_vector", sbB, "astrology_feature_vectors", vectorAId]
        );
      }
      for (const [key, sb, table, id] of checks) {
        const { data } = await sb.from(table).select("id").eq("id", id);
        out.crossUserReadBlocked[key] = Array.isArray(data) && data.length === 0;
        if (!out.crossUserReadBlocked[key]) {
          fail(failures, key, `${table} 교차 조회 차단 실패`);
        }
      }

      const writeChecks = [
        [
          "a_cannot_update_b_profile",
          sbA,
          "astrology_profiles",
          profileBId,
          { day_master: "갑" },
        ],
        [
          "b_cannot_update_a_profile",
          sbB,
          "astrology_profiles",
          profileAId,
          { day_master: "갑" },
        ],
        [
          "a_cannot_delete_b_snapshot",
          sbA,
          "astrology_snapshots",
          snapshotBId,
          null,
        ],
        [
          "b_cannot_delete_a_snapshot",
          sbB,
          "astrology_snapshots",
          snapshotAId,
          null,
        ],
      ];
      for (const [key, sb, table, id, patch] of writeChecks) {
        let data;
        if (patch) {
          ({ data } = await sb.from(table).update(patch).eq("id", id).select("id"));
        } else {
          ({ data } = await sb.from(table).delete().eq("id", id).select("id"));
        }
        out.crossUserWriteBlocked[key] = !data?.length;
        if (!out.crossUserWriteBlocked[key]) {
          fail(failures, key, `${table} 교차 변경 차단 실패`);
        }
      }
    } else {
      fail(
        failures,
        "astrology_seed_incomplete",
        "astrology 시드 부족 — 교차 검증 생략하지 않고 실패 처리"
      );
    }

    // --- Anon blocked ---
    const anonSelectJournal = await sbAnon
      .from("journal_entries")
      .select("id")
      .eq("id", journalAId || "00000000-0000-0000-0000-000000000000");
    out.anonBlocked.cannot_read_journal =
      Array.isArray(anonSelectJournal.data) &&
      anonSelectJournal.data.length === 0;

    const anonInsert = await sbAnon
      .from("journal_entries")
      .insert(
        ownJournalPayload(
          userA.userId,
          "2099-01-13"
        )
      )
      .select("id");
    out.anonBlocked.cannot_create_journal = Boolean(anonInsert.error) || !anonInsert.data?.length;
    if (anonInsert.data?.[0]?.id) {
      // accidental create — delete with service if possible
      created.a.journalIds.push(anonInsert.data[0].id);
      fail(failures, "anon_created_journal", "익명이 journal 생성에 성공함");
    }

    if (profileAId) {
      const anonProf = await sbAnon
        .from("astrology_profiles")
        .select("id")
        .eq("id", profileAId);
      out.anonBlocked.cannot_read_profile =
        Array.isArray(anonProf.data) && anonProf.data.length === 0;
      const anonUpd = await sbAnon
        .from("astrology_profiles")
        .update({ day_master: "을" })
        .eq("id", profileAId)
        .select("id");
      out.anonBlocked.cannot_update_profile = !anonUpd.data?.length;
    }

    for (const [k, v] of Object.entries(out.anonBlocked)) {
      if (!v) fail(failures, `anon_${k}`, "익명 접근이 차단되지 않음");
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

  // diary_entries unchanged
  if (serviceKey && out.diaryEntriesBaseline != null) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    const { count } = await admin
      .from("diary_entries")
      .select("*", { count: "exact", head: true });
    out.diaryEntriesAfter = count;
    if (count !== out.diaryEntriesBaseline) {
      fail(
        failures,
        "diary_entries_changed",
        `baseline ${out.diaryEntriesBaseline} → ${count}`
      );
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
  out.ok = failures.length === 0;
  if (out.ok) {
    out.remoteRlsVerification = "complete";
    out.productionReady = true;
  } else {
    out.remoteRlsVerification = "pending";
    out.productionReady = false;
    out.likelyCauses = failures.map((f) => ({
      code: f.code,
      hint:
        f.code.startsWith("login_")
          ? "계정 미생성·이메일 미확인·비밀번호 오류"
          : f.code.includes("cannot_")
            ? "RLS 정책 누락 또는 using/with check 오류"
            : f.code.includes("create")
              ? "테이블/컬럼/RLS insert 정책·FK 문제"
              : f.detail,
    }));
  }

  // Never print raw tokens
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.ok ? 0 : 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
