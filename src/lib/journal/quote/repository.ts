/**
 * 명언 라이브러리 저장소 (service role / 사용자 읽기)
 */
import OpenAI from "openai";
import { getSupabaseServiceClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  QuoteLibraryItem,
  QuoteRightsStatus,
  QuoteVerificationStatus,
} from "./types";

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function mapRow(row: Record<string, unknown>): QuoteLibraryItem {
  return {
    id: String(row.id),
    quoteTextKo: String(row.quote_text_ko ?? ""),
    originalText: (row.original_text as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? null,
    workTitle: (row.work_title as string | null) ?? null,
    publicationInfo: (row.publication_info as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    sourceType: (row.source_type as string | null) ?? null,
    translator: (row.translator as string | null) ?? null,
    language: String(row.language ?? "ko"),
    themes: asStringArray(row.themes_json),
    emotionalTone: asStringArray(row.emotional_tone_json),
    suitableStates: asStringArray(row.suitable_states_json),
    unsuitableStates: asStringArray(row.unsuitable_states_json),
    rightsStatus: row.rights_status as QuoteRightsStatus,
    verificationStatus: row.verification_status as QuoteVerificationStatus,
    attributionConfidence: Number(row.attribution_confidence ?? 0),
    active: Boolean(row.active),
    similarity:
      typeof row.similarity === "number" ? row.similarity : undefined,
  };
}

async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 필요합니다.");
  const client = new OpenAI({ apiKey });
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0]!.embedding;
}

export async function listQuotesAdmin(): Promise<QuoteLibraryItem[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("quote_library")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export type QuoteUpsertInput = {
  id?: string;
  quoteTextKo: string;
  originalText?: string | null;
  authorName?: string | null;
  workTitle?: string | null;
  publicationInfo?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  translator?: string | null;
  language?: string;
  themes?: string[];
  emotionalTone?: string[];
  suitableStates?: string[];
  unsuitableStates?: string[];
  rightsStatus: QuoteRightsStatus;
  verificationStatus: QuoteVerificationStatus;
  attributionConfidence: number;
  active: boolean;
  reviewedBy?: string | null;
};

export async function upsertQuote(
  input: QuoteUpsertInput
): Promise<QuoteLibraryItem> {
  const sb = getSupabaseServiceClient();
  const embedding = await embedText(input.quoteTextKo).catch(() => null);
  const payload: Record<string, unknown> = {
    quote_text_ko: input.quoteTextKo,
    original_text: input.originalText ?? null,
    author_name: input.authorName ?? null,
    work_title: input.workTitle ?? null,
    publication_info: input.publicationInfo ?? null,
    source_url: input.sourceUrl ?? null,
    source_type: input.sourceType ?? null,
    translator: input.translator ?? null,
    language: input.language ?? "ko",
    themes_json: input.themes ?? [],
    emotional_tone_json: input.emotionalTone ?? [],
    suitable_states_json: input.suitableStates ?? [],
    unsuitable_states_json: input.unsuitableStates ?? [],
    rights_status: input.rightsStatus,
    verification_status: input.verificationStatus,
    attribution_confidence: input.attributionConfidence,
    active: input.active,
    reviewed_by: input.reviewedBy ?? null,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (embedding) payload.embedding = embedding;

  if (input.id) {
    const { data, error } = await sb
      .from("quote_library")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await sb
    .from("quote_library")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deactivateQuote(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("quote_library")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** 내부 라이브러리 의미 검색 + 고전 카탈로그 병합 */
export async function retrieveQuoteCandidates(
  queryText: string,
  matchCount = 12
): Promise<QuoteLibraryItem[]> {
  const poolLimit = Math.max(matchCount, 48);
  let semantic: QuoteLibraryItem[] = [];
  try {
    const sb = getSupabaseServiceClient();
    const embedding = await embedText(queryText);
    const { data, error } = await sb.rpc("match_quote_library", {
      query_embedding: embedding,
      match_count: poolLimit,
    });
    if (!error && data && Array.isArray(data) && data.length > 0) {
      semantic = data.map((r) => mapRow(r as Record<string, unknown>));
    }
  } catch {
    /* fall through */
  }

  const userSb = getSupabaseServerClient();
  const client = userSb ?? getSupabaseServiceClient();
  const { data, error } = await client
    .from("quote_library")
    .select("*")
    .eq("active", true)
    .in("verification_status", [
      "primary_source_verified",
      "reputable_secondary_verified",
      "translation_verified",
    ])
    .in("rights_status", [
      "public_domain",
      "licensed",
      "permission_granted",
      "internally_written",
    ])
    .order("attribution_confidence", { ascending: false })
    .limit(poolLimit);
  if (error || !data) return semantic.slice(0, matchCount);

  const catalog = data.map((r) => mapRow(r as Record<string, unknown>));
  catalog.sort((a, b) => {
    const pa = (a.sourceType ?? "").startsWith("verified_classic") ? 1 : 0;
    const pb = (b.sourceType ?? "").startsWith("verified_classic") ? 1 : 0;
    if (pb !== pa) return pb - pa;
    return (b.attributionConfidence ?? 0) - (a.attributionConfidence ?? 0);
  });

  const byId = new Map<string, QuoteLibraryItem>();
  for (const q of [...semantic, ...catalog]) {
    if (!byId.has(q.id)) byId.set(q.id, q);
  }
  return [...byId.values()].slice(0, matchCount);
}

export async function loadRecentDeliveries(
  userId: string,
  opts?: { limit?: number; sinceDays?: number; sajuProfileId?: string }
): Promise<
  Array<{
    quoteId: string | null;
    authorName: string | null;
    sourceKey: string | null;
    contentType: string;
    text: string | null;
    deliveredAt: string;
    eventDate: string | null;
  }>
> {
  const sb = getSupabaseServiceClient();
  const sinceDays = opts?.sinceDays ?? 180;
  const limit = opts?.limit ?? 200;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - sinceDays);
  const sinceIso = since.toISOString();

  let query = sb
    .from("daily_quote_deliveries")
    .select(
      "quote_id, content_type, generated_original_text, delivered_at, event_date, selection_reasons_json"
    )
    .eq("user_id", userId)
    .gte("delivered_at", sinceIso)
    .order("delivered_at", { ascending: false })
    .limit(limit);
  if (opts?.sajuProfileId) {
    query = query.eq("saju_profile_id", opts.sajuProfileId);
  }
  const { data, error } = await query;
  if (error || !data) return [];

  // 작가/출처는 quote_library join 없이 context 또는 별도 조회
  const quoteIds = data
    .map((r) => r.quote_id as string | null)
    .filter((id): id is string => Boolean(id));
  const metaById = new Map<
    string,
    { authorName: string | null; sourceKey: string | null }
  >();
  if (quoteIds.length > 0) {
    const { data: quotes } = await sb
      .from("quote_library")
      .select("id, author_name, source_url, work_title, publication_info")
      .in("id", quoteIds);
    for (const q of quotes ?? []) {
      const sourceKey = q.source_url
        ? `url:${q.source_url}`
        : q.work_title
          ? `work:${q.work_title}`
          : q.publication_info
            ? `pub:${q.publication_info}`
            : null;
      metaById.set(String(q.id), {
        authorName: (q.author_name as string | null) ?? null,
        sourceKey,
      });
    }
  }

  return data.map((r) => {
    const id = (r.quote_id as string | null) ?? null;
    const meta = id ? metaById.get(id) : undefined;
    const ctx = (r.selection_reasons_json ?? {}) as Record<string, unknown>;
    return {
      quoteId: id,
      authorName:
        meta?.authorName ??
        (typeof ctx.authorName === "string" ? ctx.authorName : null),
      sourceKey: meta?.sourceKey ?? null,
      contentType: String(r.content_type),
      text: (r.generated_original_text as string | null) ?? null,
      deliveredAt: String(r.delivered_at),
      eventDate: r.event_date ? String(r.event_date) : null,
    };
  });
}

