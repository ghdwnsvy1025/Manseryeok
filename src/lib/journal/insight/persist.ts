/**
 * DailyInsightContext / daily_fortunes / daily_questions 영속화
 * — 동일 (user_id, saju_profile_id, event_date) 스냅샷은 생성 후 덮어쓰지 않음
 * — skipLlm과 무관하게 점수·컨텍스트는 저장
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyInsightContext, FortuneDomainResult } from "./types";

export type LoadedInsightContext = {
  id: string;
  ctx: DailyInsightContext;
  created: boolean;
};

export async function loadPersistedInsightContext(
  sb: SupabaseClient,
  userId: string,
  eventDate: string,
  sajuProfileId: string
): Promise<DailyInsightContext | null> {
  const loaded = await loadInsightContextRow(
    sb,
    userId,
    eventDate,
    sajuProfileId
  );
  return loaded?.ctx ?? null;
}

export async function loadInsightContextRow(
  sb: SupabaseClient,
  userId: string,
  eventDate: string,
  sajuProfileId: string
): Promise<{ id: string; ctx: DailyInsightContext } | null> {
  const { data, error } = await sb
    .from("daily_insight_contexts")
    .select("id, context_json")
    .eq("user_id", userId)
    .eq("saju_profile_id", sajuProfileId)
    .eq("event_date", eventDate)
    .maybeSingle();
  if (error || !data?.id || !data.context_json) return null;
  return {
    id: String(data.id),
    ctx: data.context_json as DailyInsightContext,
  };
}

/**
 * 기존 행이 있으면 당시 스냅샷을 반환하고 재계산하지 않는다.
 * 없으면 build() 결과를 insert-once 한다 (동시 요청 시 UNIQUE 충돌 후 재조회).
 */
export async function loadOrBuildDailyInsightContext(
  sb: SupabaseClient,
  opts: {
    userId: string;
    eventDate: string;
    sajuProfileId: string;
    build: () => DailyInsightContext;
  }
): Promise<LoadedInsightContext | null> {
  const existing = await loadInsightContextRow(
    sb,
    opts.userId,
    opts.eventDate,
    opts.sajuProfileId
  );
  if (existing) {
    return { id: existing.id, ctx: existing.ctx, created: false };
  }

  const built = opts.build();
  if (built.eventDate !== opts.eventDate) {
    built.eventDate = opts.eventDate;
  }

  const inserted = await insertInsightContextOnce(
    sb,
    opts.userId,
    opts.sajuProfileId,
    built
  );
  if (inserted) {
    return { id: inserted, ctx: built, created: true };
  }

  // 동시 insert 충돌 등 → 승자 행 재조회
  const afterConflict = await loadInsightContextRow(
    sb,
    opts.userId,
    opts.eventDate,
    opts.sajuProfileId
  );
  if (afterConflict) {
    return { id: afterConflict.id, ctx: afterConflict.ctx, created: false };
  }
  return null;
}

/** @deprecated Prefer loadOrBuildDailyInsightContext — upsert overwrite 금지 */
export async function persistInsightContext(
  sb: SupabaseClient,
  userId: string,
  sajuProfileId: string,
  ctx: DailyInsightContext
): Promise<string | null> {
  const existing = await loadInsightContextRow(
    sb,
    userId,
    ctx.eventDate,
    sajuProfileId
  );
  if (existing) return existing.id;
  return insertInsightContextOnce(sb, userId, sajuProfileId, ctx);
}

export async function persistDailyInsightContext(
  sb: SupabaseClient,
  userId: string,
  sajuProfileId: string,
  ctx: DailyInsightContext
): Promise<string | null> {
  return persistInsightContext(sb, userId, sajuProfileId, ctx);
}

async function insertInsightContextOnce(
  sb: SupabaseClient,
  userId: string,
  sajuProfileId: string,
  ctx: DailyInsightContext
): Promise<string | null> {
  const { data, error } = await sb
    .from("daily_insight_contexts")
    .insert({
      user_id: userId,
      saju_profile_id: sajuProfileId,
      event_date: ctx.eventDate,
      timezone: ctx.timezone,
      data_cutoff_at: ctx.dataCutoffAt,
      context_json: ctx,
      confidence_json: { overall: ctx.overallConfidence },
      engine_version: ctx.engineVersion,
    })
    .select("id")
    .maybeSingle();

  if (!error && data?.id) return String(data.id);

  // unique_violation(23505)·동시성 → 호출측 재조회.
  // 그 외 오류는 삼키지 않고 남겨 Gate/운영에서 원인 추적 가능하게 한다.
  if (error && error.code !== "23505") {
    console.error("[insight] daily_insight_contexts insert failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      eventDate: ctx.eventDate,
      sajuProfileId,
    });
  }

  return null;
}

export type PersistedFortune = {
  id: string;
  contextId: string | null;
  overallHeadline: string;
  overallSummary: string;
  sections: FortuneDomainResult[];
  scoringVersion: string | null;
};

export async function loadPersistedFortune(
  sb: SupabaseClient,
  userId: string,
  eventDate: string,
  sajuProfileId: string
): Promise<PersistedFortune | null> {
  const { data: fortune, error } = await sb
    .from("daily_fortunes")
    .select(
      "id, context_id, overall_headline, overall_summary, scoring_version"
    )
    .eq("user_id", userId)
    .eq("saju_profile_id", sajuProfileId)
    .eq("event_date", eventDate)
    .maybeSingle();
  if (error || !fortune) return null;

  const { data: sections } = await sb
    .from("daily_fortune_sections")
    .select("*")
    .eq("daily_fortune_id", fortune.id)
    .order("display_order", { ascending: true });

  return {
    id: String(fortune.id),
    contextId: fortune.context_id ? String(fortune.context_id) : null,
    overallHeadline: String(fortune.overall_headline ?? ""),
    overallSummary: String(fortune.overall_summary ?? ""),
    scoringVersion: (fortune.scoring_version as string | null) ?? null,
    sections: (sections ?? []).map((s) => ({
      domain: s.domain_code as FortuneDomainResult["domain"],
      title: String(s.domain_code),
      tone: "balanced" as const,
      score: Number(s.score ?? 0.5),
      confidence: Number(s.confidence ?? 0.5),
      headline: String(s.headline ?? ""),
      summary: String(s.summary ?? ""),
      opportunity: String(s.opportunity ?? ""),
      caution: String(s.caution ?? ""),
      action: String(s.action ?? ""),
      evidenceCodes: Array.isArray(s.evidence_json)
        ? (s.evidence_json as string[])
        : [],
    })),
  };
}

/**
 * 운세 점수 스냅샷 insert-once.
 * 이미 행이 있어도 scoring_version 이 다르면 점수·섹션을 업그레이드 교체한다.
 */
export async function persistFortune(
  sb: SupabaseClient,
  opts: {
    userId: string;
    sajuProfileId: string;
    eventDate: string;
    contextId: string | null;
    overall: FortuneDomainResult;
    domains: FortuneDomainResult[];
    scoringVersion: string;
    modelVersion?: string | null;
    dataCutoffAt: string;
  }
): Promise<string | null> {
  const existing = await loadPersistedFortune(
    sb,
    opts.userId,
    opts.eventDate,
    opts.sajuProfileId
  );
  if (existing && existing.scoringVersion === opts.scoringVersion) {
    return existing.id;
  }

  // 엔진 버전 변경 → 기존 행 삭제 후 재삽입
  if (existing?.id) {
    await sb.from("daily_fortune_sections").delete().eq("daily_fortune_id", existing.id);
    await sb.from("daily_fortunes").delete().eq("id", existing.id);
  }

  const all = [opts.overall, ...opts.domains];
  const { data: fortune, error } = await sb
    .from("daily_fortunes")
    .insert({
      user_id: opts.userId,
      saju_profile_id: opts.sajuProfileId,
      event_date: opts.eventDate,
      context_id: opts.contextId,
      overall_headline: opts.overall.headline,
      overall_summary: opts.overall.summary,
      overall_confidence: opts.overall.confidence,
      scoring_version: opts.scoringVersion,
      model_version: opts.modelVersion ?? null,
      data_cutoff_at: opts.dataCutoffAt,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !fortune?.id) {
    if (error && error.code !== "23505") {
      console.error("[insight] daily_fortunes insert failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        eventDate: opts.eventDate,
        sajuProfileId: opts.sajuProfileId,
      });
    }
    // 동시 insert — 재조회
    const again = await loadPersistedFortune(
      sb,
      opts.userId,
      opts.eventDate,
      opts.sajuProfileId
    );
    return again?.id ?? null;
  }

  const rows = all.map((d, i) => ({
    daily_fortune_id: fortune.id,
    domain_code: d.domain,
    headline: d.headline,
    summary: d.summary,
    opportunity: d.opportunity,
    caution: d.caution,
    action: d.action,
    score: d.score,
    confidence: d.confidence,
    evidence_json: d.evidenceCodes,
    display_order: i,
  }));
  await sb.from("daily_fortune_sections").insert(rows);
  return String(fortune.id);
}

/**
 * 이미 저장된 운세의 문장만 갱신 (점수·context_id 유지).
 */
export async function updateFortuneWording(
  sb: SupabaseClient,
  opts: {
    userId: string;
    sajuProfileId: string;
    eventDate: string;
    overall: FortuneDomainResult;
    domains: FortuneDomainResult[];
    modelVersion?: string | null;
  }
): Promise<boolean> {
  const existing = await loadPersistedFortune(
    sb,
    opts.userId,
    opts.eventDate,
    opts.sajuProfileId
  );
  if (!existing) return false;

  await sb
    .from("daily_fortunes")
    .update({
      overall_headline: opts.overall.headline,
      overall_summary: opts.overall.summary,
      overall_confidence: opts.overall.confidence,
      model_version: opts.modelVersion ?? null,
      generated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("user_id", opts.userId)
    .eq("saju_profile_id", opts.sajuProfileId);

  const all = [opts.overall, ...opts.domains];
  for (const d of all) {
    await sb
      .from("daily_fortune_sections")
      .update({
        headline: d.headline,
        summary: d.summary,
        opportunity: d.opportunity,
        caution: d.caution,
        action: d.action,
      })
      .eq("daily_fortune_id", existing.id)
      .eq("domain_code", d.domain);
  }
  return true;
}

export type PersistedQuestion = {
  id: string;
  contextId: string | null;
  questionText: string;
  keywordCodes: string[];
  evidence: Record<string, unknown>;
  scoringVersion: string | null;
};

export async function loadPersistedQuestion(
  sb: SupabaseClient,
  userId: string,
  questionDate: string,
  sajuProfileId: string
): Promise<PersistedQuestion | null> {
  const { data, error } = await sb
    .from("daily_questions")
    .select(
      "id, context_id, question_text, keyword_codes, evidence, scoring_version"
    )
    .eq("user_id", userId)
    .eq("saju_profile_id", sajuProfileId)
    .eq("question_date", questionDate)
    .maybeSingle();
  if (error || !data?.id) return null;
  return {
    id: String(data.id),
    contextId: data.context_id ? String(data.context_id) : null,
    questionText: String(data.question_text ?? ""),
    keywordCodes: Array.isArray(data.keyword_codes)
      ? (data.keyword_codes as string[])
      : [],
    evidence:
      data.evidence && typeof data.evidence === "object"
        ? (data.evidence as Record<string, unknown>)
        : {},
    scoringVersion: (data.scoring_version as string | null) ?? null,
  };
}

/**
 * 질문 스냅샷 insert-once. 이미 있으면 context_id만 보강(비어 있을 때)하고 id 반환.
 */
export async function persistDailyQuestion(
  sb: SupabaseClient,
  opts: {
    userId: string;
    sajuProfileId: string;
    questionDate: string;
    contextId: string | null;
    questionText: string;
    keywordCodes: string[];
    evidence: Record<string, unknown>;
    confidence?: number | null;
    scoringVersion?: string | null;
    dataCutoffAt?: string | null;
    modelVersion?: string | null;
  }
): Promise<string | null> {
  const existing = await loadPersistedQuestion(
    sb,
    opts.userId,
    opts.questionDate,
    opts.sajuProfileId
  );
  if (existing) {
    if (!existing.contextId && opts.contextId) {
      await sb
        .from("daily_questions")
        .update({ context_id: opts.contextId })
        .eq("id", existing.id)
        .eq("user_id", opts.userId)
        .eq("saju_profile_id", opts.sajuProfileId);
    }
    return existing.id;
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("daily_questions")
    .insert({
      user_id: opts.userId,
      saju_profile_id: opts.sajuProfileId,
      question_date: opts.questionDate,
      context_id: opts.contextId,
      question_text: opts.questionText.slice(0, 500),
      keyword_codes: opts.keywordCodes,
      evidence: opts.evidence,
      confidence: opts.confidence ?? null,
      scoring_version: opts.scoringVersion ?? null,
      data_cutoff_at: opts.dataCutoffAt ?? null,
      model_version: opts.modelVersion ?? null,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();

  if (!error && data?.id) return String(data.id);

  const again = await loadPersistedQuestion(
    sb,
    opts.userId,
    opts.questionDate,
    opts.sajuProfileId
  );
  return again?.id ?? null;
}
