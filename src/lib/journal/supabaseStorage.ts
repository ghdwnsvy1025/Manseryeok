import type { JournalStorage, JournalSaveInput, JournalSaveResult } from "./storage";
import type {
  CategoryCode,
  CategoryScoreRecord,
  JournalEntry,
  JournalEntryTag,
  UserCategoryPreference,
} from "./types";
import { CHECKIN_VERSION_V2, JOURNAL_SCHEMA_VERSION } from "./types";
import { migrateScoreToTen } from "./scoreScale";
import { isCategoryCode } from "./categoryCatalog";
import {
  createDefaultPreferences,
  getEnabledCodesOrdered,
  loadCategoryPreferencesLocal,
  saveCategoryPreferencesLocal,
} from "./preferences";
import {
  validateSaveScores,
  validateTagCodes,
} from "./validation";
import { computeFinalScore } from "./finalScore";
import { fuseTextAndUserScore } from "./textAlphaFusion";
import { resolveUserScore } from "./buildScores";
import { applyJournalXpOnSave } from "./xp";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveActiveSajuProfileId } from "@/lib/diary/activeSajuProfile";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 마이그레이션이 아직 원격에 적용되지 않았을 수 있는 컬럼들.
 *  - 014: happiness_score / mood_labels / core_states / domain_scores / checkin_version
 *  - 022: first_recorded_at
 */
export const MIGRATION_GATED_ENTRY_COLUMNS = [
  "happiness_score",
  "mood_labels",
  "core_states",
  "domain_scores",
  "checkin_version",
  "first_recorded_at",
] as const;

/** 에러 메시지에 언급된, 아직 없는 게이트 컬럼들 */
export function missingGatedColumns(message: string): string[] {
  return MIGRATION_GATED_ENTRY_COLUMNS.filter((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(message)
  );
}

/**
 * Supabase journal storage.
 * 테이블이 아직 없거나 active saju 프로필/025 컬럼이 없으면 null → IndexedDB 폴백.
 */
export async function getSupabaseJournalStorage(): Promise<JournalStorage | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const probe = await client.from("journal_entries").select("id").limit(1);
  if (probe.error) {
    return null;
  }

  const profileId = await resolveActiveSajuProfileId(client, user.id);
  if (!profileId) return null;

  const colProbe = await client
    .from("journal_entries")
    .select("saju_profile_id")
    .limit(1);
  if (colProbe.error) {
    return null;
  }

  return new SupabaseJournalStorage(user.id, profileId);
}

class SupabaseJournalStorage implements JournalStorage {
  constructor(
    private userId: string,
    private sajuProfileId: string
  ) {}

  private get client() {
    const c = getSupabaseBrowserClient();
    if (!c) throw new Error("Supabase가 설정되지 않았습니다.");
    return c;
  }

  private scopedEntries() {
    return this.client
      .from("journal_entries")
      .select("*")
      .eq("user_id", this.userId)
      .eq("saju_profile_id", this.sajuProfileId);
  }

  async getByDate(entryDate: string): Promise<JournalEntry | null> {
    const { data: row, error } = await this.scopedEntries()
      .eq("entry_date", entryDate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return this.hydrate(row as Record<string, unknown>);
  }

  async list(): Promise<JournalEntry[]> {
    const { data, error } = await this.scopedEntries().order("entry_date", {
      ascending: false,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) return [];

    const ids = rows.map((row) => String(row.id));
    const [{ data: allScores }, { data: allTags }] = await Promise.all([
      this.client
        .from("category_scores")
        .select("*")
        .eq("user_id", this.userId)
        .in("entry_id", ids),
      this.client
        .from("journal_entry_tags")
        .select("*")
        .eq("user_id", this.userId)
        .in("entry_id", ids),
    ]);

    const scoresByEntry = new Map<string, Record<string, unknown>[]>();
    for (const s of allScores ?? []) {
      const entryId = String((s as { entry_id: string }).entry_id);
      const bucket = scoresByEntry.get(entryId);
      if (bucket) bucket.push(s as Record<string, unknown>);
      else scoresByEntry.set(entryId, [s as Record<string, unknown>]);
    }
    const tagsByEntry = new Map<string, Record<string, unknown>[]>();
    for (const t of allTags ?? []) {
      const entryId = String((t as { entry_id: string }).entry_id);
      const bucket = tagsByEntry.get(entryId);
      if (bucket) bucket.push(t as Record<string, unknown>);
      else tagsByEntry.set(entryId, [t as Record<string, unknown>]);
    }

    return rows.map((row) => {
      const entryId = String(row.id);
      return this.assembleEntry(
        row,
        scoresByEntry.get(entryId) ?? [],
        tagsByEntry.get(entryId) ?? []
      );
    });
  }

  async deleteByDate(entryDate: string): Promise<boolean> {
    const existing = await this.getByDate(entryDate);
    if (!existing) return false;
    const { error } = await this.client
      .from("journal_entries")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", this.userId)
      .eq("saju_profile_id", this.sajuProfileId);
    if (error) throw new Error(error.message);
    return true;
  }

  private mapScoreRow(
    entryId: string,
    s: Record<string, unknown>,
    schemaVersion: number
  ): CategoryScoreRecord {
    const isNotApplicable = Boolean(s.is_not_applicable);
    const userRaw =
      (s.user_score as number | null | undefined) ??
      (s.raw_score as number | null) ??
      null;
    const userScore = migrateScoreToTen(userRaw, schemaVersion) as
      | JournalEntry["scores"][number]["userScore"]
      | null;
    const aiScore = migrateScoreToTen(
      s.ai_score == null ? null : Number(s.ai_score),
      schemaVersion
    );
    let finalScore = migrateScoreToTen(
      s.final_score == null ? null : Number(s.final_score),
      schemaVersion
    );
    if (finalScore == null && !isNotApplicable) {
      finalScore = computeFinalScore({
        userScore,
        aiScore,
        isNotApplicable,
      });
    }
    return {
      id: String(s.id),
      entryId,
      userId: this.userId,
      categoryCode: s.category_code as CategoryCode,
      userScore,
      aiScore,
      finalScore: isNotApplicable ? null : finalScore,
      rawScore: userScore,
      isNotApplicable,
      normalizedZ: (s.normalized_z as number | null) ?? null,
      normalizationVersion: (s.normalization_version as string | null) ?? null,
      createdAt: String(s.created_at),
      updatedAt: String(s.updated_at),
    };
  }

  private async hydrate(row: Record<string, unknown>): Promise<JournalEntry> {
    const entryId = String(row.id);
    const [{ data: scores }, { data: tags }] = await Promise.all([
      this.client
        .from("category_scores")
        .select("*")
        .eq("entry_id", entryId)
        .eq("user_id", this.userId),
      this.client
        .from("journal_entry_tags")
        .select("*")
        .eq("entry_id", entryId)
        .eq("user_id", this.userId),
    ]);
    return this.assembleEntry(
      row,
      (scores ?? []) as Record<string, unknown>[],
      (tags ?? []) as Record<string, unknown>[]
    );
  }

  private assembleEntry(
    row: Record<string, unknown>,
    scores: Record<string, unknown>[],
    tags: Record<string, unknown>[]
  ): JournalEntry {
    const entryId = String(row.id);
    const schemaVersion =
      typeof row.schema_version === "number" ? row.schema_version : 1;

    const scoreRecords: CategoryScoreRecord[] = scores.map((s) =>
      this.mapScoreRow(entryId, s, schemaVersion)
    );

    const tagRecords: JournalEntryTag[] = tags.map((t) => ({
      tagCode: String(t.tag_code),
      source: (t.source as JournalEntryTag["source"] | null) ?? "user",
      confirmedByUser: t.confirmed_by_user !== false,
    }));

    const overallRaw =
      row.overall_satisfaction == null
        ? null
        : Number(row.overall_satisfaction);
    const overallSatisfaction =
      overallRaw === 0
        ? 0
        : (migrateScoreToTen(
            overallRaw,
            schemaVersion
          ) as JournalEntry["overallSatisfaction"]);

    return {
      id: entryId,
      userId: this.userId,
      sajuProfileId:
        (row.saju_profile_id as string | null) ?? this.sajuProfileId,
      entryDate: String(row.entry_date),
      userTimezone: String(row.user_timezone ?? "Asia/Seoul"),
      content: String(row.content ?? ""),
      overallSatisfaction,
      happinessScore:
        row.happiness_score == null ? null : Number(row.happiness_score),
      moodLabel: (row.mood_label as string | null) ?? null,
      moodLabels: Array.isArray(row.mood_labels)
        ? (row.mood_labels as unknown[]).filter(
            (m): m is string => typeof m === "string"
          )
        : row.mood_label
          ? [String(row.mood_label)]
          : [],
      mainEventText: (row.main_event_text as string | null) ?? null,
      source: (row.source as JournalEntry["source"]) ?? "new_diary",
      scores: scoreRecords,
      tags: tagRecords,
      coreStates:
        row.core_states && typeof row.core_states === "object"
          ? (row.core_states as JournalEntry["coreStates"])
          : null,
      domainScores: Array.isArray(row.domain_scores)
        ? (row.domain_scores as JournalEntry["domainScores"])
        : null,
      checkinVersion:
        typeof row.checkin_version === "number" ? row.checkin_version : null,
      xpGranted: Boolean(row.xp_granted),
      xpAwarded: typeof row.xp_awarded === "number" ? row.xp_awarded : 0,
      schemaVersion: Math.max(schemaVersion, JOURNAL_SCHEMA_VERSION),
      firstRecordedAt:
        row.first_recorded_at == null
          ? String(row.created_at)
          : String(row.first_recorded_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private async upsertEntryRow(row: Record<string, unknown>): Promise<void> {
    let attempt = { ...row };
    const dropped: string[] = [];

    for (let i = 0; i <= MIGRATION_GATED_ENTRY_COLUMNS.length; i += 1) {
      const { error } = await this.client.from("journal_entries").upsert(attempt, {
        onConflict: "user_id,saju_profile_id,entry_date",
      });
      if (!error) return;

      const missing = missingGatedColumns(error.message).filter(
        (c) => c in attempt
      );
      if (missing.length === 0) throw new Error(error.message);

      for (const c of missing) delete attempt[c];
      dropped.push(...missing);
      attempt = { ...attempt };
    }

    throw new Error(
      `journal_entries 저장 실패: 미적용 마이그레이션 컬럼(${dropped.join(", ")})`
    );
  }

  async save(input: JournalSaveInput): Promise<JournalEntry> {
    const result = await this.saveWithMeta(input);
    return result.entry;
  }

  async saveWithMeta(input: JournalSaveInput): Promise<JournalSaveResult> {
    const tagCheck = validateTagCodes(input.tagCodes);
    if (!tagCheck.ok) throw new Error(tagCheck.error);

    const prefs = await this.getPreferences();
    const enabledCodes = (input.enabledCodes?.filter(isCategoryCode) ??
      getEnabledCodesOrdered(prefs)) as CategoryCode[];

    const saveCheck = validateSaveScores({
      enabledCodes,
      scores: input.scores,
      relaxEnabledCount: Boolean(input.relaxEnabledCount),
    });
    if (!saveCheck.ok) throw new Error(saveCheck.error);

    const now = new Date().toISOString();
    const existing = await this.getByDate(input.entryDate);
    const id = existing?.id ?? generateId();
    const profileId = input.sajuProfileId || this.sajuProfileId;

    const allEntries = await this.list();
    const xp = applyJournalXpOnSave({
      existing,
      saveInput: input,
      allEntries,
    });

    const moodLabels =
      input.moodLabels ?? (input.moodLabel ? [input.moodLabel] : []);

    if (
      input.checkinVersion === 2 ||
      input.checkinVersion === CHECKIN_VERSION_V2
    ) {
      const { validateCheckInSave } = await import(
        "@/lib/journal/checkin/validation"
      );
      const { CORE_STATE_CODES } = await import(
        "@/lib/journal/checkin/catalog"
      );
      type CoreStateCode = (typeof CORE_STATE_CODES)[number];
      const coreUi = {} as Record<
        CoreStateCode,
        { ordinal: 1 | 2 | 3 | 4 | 5 | null; isNotApplicable: boolean }
      >;
      for (const code of CORE_STATE_CODES) {
        const row = input.coreStates?.[code];
        coreUi[code] = {
          ordinal: (row?.ordinal as 1 | 2 | 3 | 4 | 5 | null) ?? null,
          isNotApplicable: Boolean(row?.isNotApplicable),
        };
      }
      const domainUi = (input.domainScores ?? []).map((d) => ({
        code: d.code as import("@/lib/journal/checkin/catalog").DomainCode,
        ordinal: (d.ordinal as 1 | 2 | 3 | 4 | 5 | null) ?? null,
        isNotApplicable: Boolean(d.isNotApplicable),
      }));
      const v = validateCheckInSave({
        happiness:
          input.happinessScore !== undefined && input.happinessScore !== null
            ? input.happinessScore
            : input.overallSatisfaction,
        moods: moodLabels,
        tagCodes: input.tagCodes,
        core: coreUi,
        domains: domainUi,
      });
      if (!v.ok) throw new Error(v.error);
    }

    const upsertRow: Record<string, unknown> = {
      id,
      user_id: this.userId,
      saju_profile_id: profileId,
      entry_date: input.entryDate,
      user_timezone: input.userTimezone ?? "Asia/Seoul",
      content: input.content,
      overall_satisfaction: input.overallSatisfaction,
      mood_label: input.moodLabel ?? moodLabels[0] ?? null,
      main_event_text: input.mainEventText,
      source: "new_diary",
      schema_version: JOURNAL_SCHEMA_VERSION,
      xp_granted: xp.xpGranted,
      xp_awarded: xp.xpAwarded,
      updated_at: now,
      created_at: existing?.createdAt ?? now,
      first_recorded_at: existing?.firstRecordedAt ?? existing?.createdAt ?? now,
      happiness_score:
        input.happinessScore !== undefined
          ? input.happinessScore
          : input.overallSatisfaction,
      mood_labels: moodLabels,
      core_states: input.coreStates ?? null,
      domain_scores: input.domainScores ?? null,
      checkin_version: input.checkinVersion ?? null,
    };

    await this.upsertEntryRow(upsertRow);

    await this.client
      .from("category_scores")
      .delete()
      .eq("entry_id", id)
      .eq("user_id", this.userId);

    const dedupedScores = Array.from(
      new Map(
        input.scores
          .filter((s) => isCategoryCode(s.categoryCode))
          .map((s) => [s.categoryCode, s])
      ).values()
    );

    const scoreRows = dedupedScores.map((s) => {
      const userScore = resolveUserScore(s);
      const aiScore =
        s.aiScore != null && Number.isFinite(s.aiScore)
          ? Number(s.aiScore)
          : null;
      const finalScore =
        s.finalScore !== undefined
          ? s.finalScore
          : fuseTextAndUserScore({
              userScore,
              aiScore,
              aiConfidence: s.aiConfidence ?? null,
              content: input.content,
              isNotApplicable: s.isNotApplicable,
            }).finalScore;
      return {
        id: generateId(),
        entry_id: id,
        user_id: this.userId,
        category_code: s.categoryCode,
        raw_score: userScore,
        user_score: userScore,
        ai_score: aiScore,
        final_score: finalScore,
        is_not_applicable: s.isNotApplicable,
        updated_at: now,
        created_at: now,
      };
    });

    if (scoreRows.length > 0) {
      const { error } = await this.client
        .from("category_scores")
        .insert(scoreRows);
      if (error) {
        if (/user_score|ai_score|final_score|xp_/i.test(error.message)) {
          const legacyRows = scoreRows.map(
            ({ user_score: _u, ai_score: _a, final_score: _f, ...rest }) => rest
          );
          const { error: e2 } = await this.client
            .from("category_scores")
            .insert(legacyRows);
          if (e2) throw new Error(e2.message);
        } else {
          throw new Error(error.message);
        }
      }
    }

    await this.client
      .from("journal_entry_tags")
      .delete()
      .eq("entry_id", id)
      .eq("user_id", this.userId);

    if (input.tagCodes.length > 0) {
      const tagRows = input.tagCodes.map((tag_code) => ({
        entry_id: id,
        tag_code,
        user_id: this.userId,
        source: "user",
        confirmed_by_user: true,
      }));
      const { error } = await this.client
        .from("journal_entry_tags")
        .insert(tagRows);
      if (error) throw new Error(error.message);
    }

    const saved = await this.getByDate(input.entryDate);
    if (!saved) throw new Error("저장 후 일기를 불러오지 못했습니다.");
    return { entry: saved, xp: xp.result };
  }

  async getPreferences(): Promise<UserCategoryPreference[]> {
    const { data, error } = await this.client
      .from("user_category_preferences")
      .select("*")
      .eq("user_id", this.userId)
      .eq("saju_profile_id", this.sajuProfileId);
    if (error) {
      return loadCategoryPreferencesLocal(this.userId, this.sajuProfileId);
    }
    if (!data || data.length === 0) {
      return createDefaultPreferences(this.userId, this.sajuProfileId);
    }
    return data.map((p) => ({
      userId: this.userId,
      sajuProfileId: this.sajuProfileId,
      categoryCode: p.category_code,
      enabled: Boolean(p.enabled),
      sortOrder: p.sort_order ?? 0,
      enabledAt: p.enabled_at,
      disabledAt: p.disabled_at,
      updatedAt: p.updated_at,
    }));
  }

  async savePreferences(prefs: UserCategoryPreference[]): Promise<void> {
    const local = saveCategoryPreferencesLocal(prefs, this.sajuProfileId);
    if (!local.ok) throw new Error(local.error);

    const rows = prefs.map((p) => ({
      user_id: this.userId,
      saju_profile_id: this.sajuProfileId,
      category_code: p.categoryCode,
      enabled: p.enabled,
      sort_order: p.sortOrder,
      enabled_at: p.enabledAt,
      disabled_at: p.disabledAt,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.client
      .from("user_category_preferences")
      .upsert(rows, { onConflict: "user_id,saju_profile_id,category_code" });
    if (error) throw new Error(error.message);
  }
}
