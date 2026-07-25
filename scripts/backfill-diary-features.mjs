/**
 * 과거 일기 특징 백필 CLI.
 *
 * Usage:
 *   node scripts/backfill-diary-features.mjs
 *   node scripts/backfill-diary-features.mjs --apply --batch-size=50
 *   node scripts/backfill-diary-features.mjs --apply --user-id=<uuid> --from=2025-01-01 --to=2025-12-31
 *   node scripts/backfill-diary-features.mjs --apply --cursor=2025-06-01|<entry-uuid>
 *
 * 기본은 dry-run. --apply 없으면 DB를 쓰지 않는다.
 * 원문(content)은 select/로그에 포함하지 않는다.
 * Ctrl+C 시 커서를 출력하고 종료한다.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
let env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
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
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

// 버전은 스크립트에 고정 — 앱의 versions.ts와 맞출 것
const CALCULATION_VERSION = "saju-calc-1.0.0";
const FEATURE_SCHEMA_VERSION = "saju-feature-mvp-1.0.0";
const THEORY_VERSION = "sajubase-final-2026-07-19";
const DIARY_BACKFILL_VERSION = "diary-features-v1.0.0";

function parseArgs(argv) {
  const opts = {
    dryRun: true,
    batchSize: 50,
    userId: null,
    fromDate: null,
    toDate: null,
    cursor: null,
    modelVersion: DIARY_BACKFILL_VERSION,
    maxBatches: 20,
  };
  for (const a of argv) {
    if (a === "--apply") opts.dryRun = false;
    else if (a.startsWith("--batch-size="))
      opts.batchSize = Math.max(1, Number(a.slice(13)) || 50);
    else if (a.startsWith("--user-id=")) opts.userId = a.slice(10);
    else if (a.startsWith("--from=")) opts.fromDate = a.slice(7);
    else if (a.startsWith("--to=")) opts.toDate = a.slice(5);
    else if (a.startsWith("--cursor=")) opts.cursor = a.slice(9);
    else if (a.startsWith("--model-version="))
      opts.modelVersion = a.slice(16);
    else if (a.startsWith("--max-batches="))
      opts.maxBatches = Math.max(1, Number(a.slice(14)) || 20);
  }
  return opts;
}

let cancelled = false;
process.on("SIGINT", () => {
  cancelled = true;
  console.error("\n[cancel] SIGINT — 현재 배치 후 커서를 남기고 종료합니다.");
});

async function fetchEntries(opts) {
  // content 절대 요청하지 않음
  let q = `${url}/rest/v1/journal_entries?select=id,user_id,entry_date,created_at,first_recorded_at&order=entry_date.asc,id.asc&limit=${opts.batchSize * 3}`;
  if (opts.userId) q += `&user_id=eq.${opts.userId}`;
  if (opts.fromDate) q += `&entry_date=gte.${opts.fromDate}`;
  if (opts.toDate) q += `&entry_date=lte.${opts.toDate}`;
  if (opts.cursor) {
    const [d, id] = opts.cursor.split("|");
    if (d && id) {
      // (entry_date, id) > cursor — PostgREST or 필터로 근사
      q += `&or=(entry_date.gt.${d},and(entry_date.eq.${d},id.gt.${id}))`;
    }
  }
  const res = await fetch(q, { headers });
  if (!res.ok) {
    throw new Error(`journal_entries: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function hasMatchingSnapshot(userId, entryDate) {
  const q = `${url}/rest/v1/astrology_snapshots?select=id&user_id=eq.${userId}&local_date=eq.${entryDate}&calculation_mode=eq.native_with_luck&calculation_version=eq.${CALCULATION_VERSION}&feature_schema_version=eq.${FEATURE_SCHEMA_VERSION}&status=eq.ready&limit=1`;
  const res = await fetch(q, { headers });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function loadProfile(userId) {
  const q = `${url}/rest/v1/astrology_profiles?select=id,day_master,month_branch,day_branch,original_element_distribution,original_pillars&user_id=eq.${userId}&limit=1`;
  const res = await fetch(q, { headers });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

async function ensureFirstRecordedAt(id, createdAt) {
  const res = await fetch(`${url}/rest/v1/journal_entries?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ first_recorded_at: createdAt }),
  });
  return res.ok;
}

async function createSnapshot(userId, entryDate, profile) {
  const body = {
    user_id: userId,
    profile_id: profile.id,
    local_date: entryDate,
    timezone: "Asia/Seoul",
    calculation_mode: "native_with_luck",
    luck_context: { source: "backfill", modelVersion: DIARY_BACKFILL_VERSION },
    raw_calculation_payload: { backfill: true },
    element_distribution: profile.original_element_distribution ?? {},
    ten_god_features: {},
    relation_features: {},
    structured_features: {
      backfillVersion: DIARY_BACKFILL_VERSION,
      dayMaster: profile.day_master,
      monthBranch: profile.month_branch,
      dayBranch: profile.day_branch,
      source: "diary_backfill",
    },
    calculation_version: CALCULATION_VERSION,
    theory_version: THEORY_VERSION,
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    status: "ready",
    retryable: false,
  };
  const res = await fetch(`${url}/rest/v1/astrology_snapshots`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify(body),
  });
  // 23505 unique → 이미 있음 = 멱등 성공
  if (res.ok || res.status === 409) return true;
  const text = await res.text();
  if (/duplicate|23505/i.test(text)) return true;
  throw new Error(`snapshot insert: ${res.status} ${text.slice(0, 160)}`);
}

function planActions(entry, hasSnap) {
  if (hasSnap) return [{ type: "skip", reason: "same_version" }];
  const actions = [];
  if (!entry.first_recorded_at && entry.created_at) {
    actions.push({
      type: "ensure_first_recorded_at",
      value: entry.created_at,
    });
  }
  actions.push({ type: "create_snapshot" });
  return actions;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const progress = {
    scanned: 0,
    skippedSameVersion: 0,
    skippedNoProfile: 0,
    ensuredFirstRecordedAt: 0,
    snapshotsCreated: 0,
    errors: 0,
    dryRun: opts.dryRun,
    modelVersion: opts.modelVersion,
    cursor: opts.cursor,
    batches: 0,
  };

  console.log(
    JSON.stringify(
      {
        start: true,
        dryRun: opts.dryRun,
        batchSize: opts.batchSize,
        userId: opts.userId,
        fromDate: opts.fromDate,
        toDate: opts.toDate,
        cursor: opts.cursor,
        modelVersion: opts.modelVersion,
        calculationVersion: CALCULATION_VERSION,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      },
      null,
      2
    )
  );

  const profileCache = new Map();

  while (!cancelled && progress.batches < opts.maxBatches) {
    const rows = await fetchEntries(opts);
    if (!rows.length) break;

    let lastCursor = opts.cursor;
    for (const row of rows) {
      if (cancelled) break;
      if (progress.scanned >= opts.batchSize && progress.batches > 0) {
        // per-batch cap already via fetch limit; continue to next batch loop
      }
      progress.scanned += 1;
      lastCursor = `${row.entry_date}|${row.id}`;

      const hasSnap = await hasMatchingSnapshot(row.user_id, row.entry_date);
      const actions = planActions(row, hasSnap);

      for (const action of actions) {
        try {
          if (action.type === "skip") {
            progress.skippedSameVersion += 1;
            continue;
          }
          if (action.type === "ensure_first_recorded_at") {
            if (opts.dryRun) {
              progress.ensuredFirstRecordedAt += 1;
            } else {
              const ok = await ensureFirstRecordedAt(row.id, action.value);
              if (ok) progress.ensuredFirstRecordedAt += 1;
              else progress.errors += 1;
            }
            continue;
          }
          if (action.type === "create_snapshot") {
            let profile = profileCache.get(row.user_id);
            if (profile === undefined) {
              profile = await loadProfile(row.user_id);
              profileCache.set(row.user_id, profile);
            }
            if (!profile) {
              progress.skippedNoProfile += 1;
              continue;
            }
            if (opts.dryRun) {
              progress.snapshotsCreated += 1;
            } else {
              await createSnapshot(row.user_id, row.entry_date, profile);
              progress.snapshotsCreated += 1;
            }
          }
        } catch (err) {
          progress.errors += 1;
          console.error(
            JSON.stringify({
              error: true,
              entryId: row.id,
              entryDate: row.entry_date,
              message: err instanceof Error ? err.message : String(err),
            })
          );
        }
      }
    }

    progress.batches += 1;
    opts.cursor = lastCursor;
    progress.cursor = lastCursor;

    console.log(
      JSON.stringify({
        batch: progress.batches,
        scanned: progress.scanned,
        skippedSameVersion: progress.skippedSameVersion,
        skippedNoProfile: progress.skippedNoProfile,
        ensuredFirstRecordedAt: progress.ensuredFirstRecordedAt,
        snapshotsCreated: progress.snapshotsCreated,
        errors: progress.errors,
        cursor: progress.cursor,
        dryRun: opts.dryRun,
        cancelled,
      })
    );

    if (rows.length < opts.batchSize) break;
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        ...progress,
        resumeHint: progress.cursor
          ? `node scripts/backfill-diary-features.mjs ${opts.dryRun ? "" : "--apply "}--cursor=${progress.cursor}`
          : null,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
