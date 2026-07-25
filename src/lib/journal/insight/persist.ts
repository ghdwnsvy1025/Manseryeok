/**
 * DailyInsightContext / daily_fortunes 영속화 (동일 날짜 안정성)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyInsightContext, FortuneDomainResult } from "./types";

export async function loadPersistedInsightContext(
  sb: SupabaseClient,
  userId: string,
  eventDate: string
): Promise<DailyInsightContext | null> {
  const { data, error } = await sb
    .from("daily_insight_contexts")
    .select("context_json")
    .eq("user_id", userId)
    .eq("event_date", eventDate)
    .maybeSingle();
  if (error || !data?.context_json) return null;
  return data.context_json as DailyInsightContext;
}

export async function persistInsightContext(
  sb: SupabaseClient,
  userId: string,
  ctx: DailyInsightContext
): Promise<string | null> {
  const { data, error } = await sb
    .from("daily_insight_contexts")
    .upsert(
      {
        user_id: userId,
        event_date: ctx.eventDate,
        timezone: ctx.timezone,
        data_cutoff_at: ctx.dataCutoffAt,
        context_json: ctx,
        confidence_json: { overall: ctx.overallConfidence },
        engine_version: ctx.engineVersion,
      },
      { onConflict: "user_id,event_date" }
    )
    .select("id")
    .single();
  if (error || !data?.id) return null;
  return String(data.id);
}

export type PersistedFortune = {
  id: string;
  overallHeadline: string;
  overallSummary: string;
  sections: FortuneDomainResult[];
  scoringVersion: string | null;
};

export async function loadPersistedFortune(
  sb: SupabaseClient,
  userId: string,
  eventDate: string
): Promise<PersistedFortune | null> {
  const { data: fortune, error } = await sb
    .from("daily_fortunes")
    .select("id, overall_headline, overall_summary, scoring_version")
    .eq("user_id", userId)
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

export async function persistFortune(
  sb: SupabaseClient,
  opts: {
    userId: string;
    eventDate: string;
    contextId: string | null;
    overall: FortuneDomainResult;
    domains: FortuneDomainResult[];
    scoringVersion: string;
    modelVersion?: string | null;
    dataCutoffAt: string;
  }
): Promise<string | null> {
  const all = [opts.overall, ...opts.domains];
  const { data: fortune, error } = await sb
    .from("daily_fortunes")
    .upsert(
      {
        user_id: opts.userId,
        event_date: opts.eventDate,
        context_id: opts.contextId,
        overall_headline: opts.overall.headline,
        overall_summary: opts.overall.summary,
        overall_confidence: opts.overall.confidence,
        scoring_version: opts.scoringVersion,
        model_version: opts.modelVersion ?? null,
        data_cutoff_at: opts.dataCutoffAt,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_date" }
    )
    .select("id")
    .single();
  if (error || !fortune?.id) return null;

  await sb
    .from("daily_fortune_sections")
    .delete()
    .eq("daily_fortune_id", fortune.id);

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
