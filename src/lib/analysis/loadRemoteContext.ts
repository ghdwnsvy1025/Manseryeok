/**
 * Phase 5 — 분석 UI·서술: 원격 DB → AssembleInput
 * RLS 하에서 호출자 세션의 userId만 조회. userId는 AssembleInput에 넣지 않음.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import type { CategoryCode } from "@/lib/journal/types";
import type {
  AssembleAstrologySnapshot,
  AssembleInput,
  AssembleModelSnapshot,
  AssembleScorePoint,
  PeriodType,
} from "./types";

export type RemoteLoadResult = {
  ok: boolean;
  authenticated: boolean;
  assembleInput: AssembleInput;
  /** 내부 감사 전용 — UI/응답에 넣지 말 것 */
  _audit?: {
    scoreCount: number;
    snapshotFound: boolean;
    modelFound: boolean;
    tagCount: number;
  };
  error?: string;
};

function emptyInput(
  periodType: PeriodType,
  periodStart: string,
  periodEnd: string,
  focusDate: string,
  categoryKey: string,
  categoryLabel: string
): AssembleInput {
  return {
    periodType,
    periodStart,
    periodEnd,
    focusDate,
    categoryKey,
    categoryLabel,
    scores: [],
    tags: [],
    astrology: null,
    model: null,
  };
}

export async function loadRemoteAssembleInput(
  sb: SupabaseClient,
  opts: {
    periodType: PeriodType;
    periodStart: string;
    periodEnd: string;
    focusDate?: string;
    categoryKey: string;
  }
): Promise<RemoteLoadResult> {
  const focus = opts.focusDate ?? opts.periodStart;
  const cat = getCategoryByCode(opts.categoryKey as CategoryCode);
  const categoryLabel = cat?.name ?? opts.categoryKey;

  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user?.id) {
    return {
      ok: true,
      authenticated: false,
      assembleInput: emptyInput(
        opts.periodType,
        opts.periodStart,
        opts.periodEnd,
        focus,
        opts.categoryKey,
        categoryLabel
      ),
      error: "unauthenticated",
    };
  }

  const userId = user.id;

  try {
    const { data: scoreRows, error: sErr } = await sb
      .from("category_scores")
      .select("raw_score,is_not_applicable,entry_id")
      .eq("user_id", userId)
      .eq("category_code", opts.categoryKey);
    if (sErr) throw new Error(sErr.message);

    const entryIds = Array.from(
      new Set((scoreRows || []).map((r) => r.entry_id as string))
    );
    let dateById = new Map<string, string>();
    if (entryIds.length) {
      const { data: entries, error: eErr } = await sb
        .from("journal_entries")
        .select("id,entry_date")
        .eq("user_id", userId)
        .in("id", entryIds);
      if (eErr) throw new Error(eErr.message);
      dateById = new Map(
        (entries || []).map((e) => [e.id as string, e.entry_date as string])
      );
    }

    const scores: AssembleScorePoint[] = [];
    for (const row of scoreRows || []) {
      const localDate = dateById.get(row.entry_id as string);
      if (!localDate) continue;
      if (localDate < opts.periodStart || localDate > opts.periodEnd) {
        // keep all scores for sampleCount baseline; assembler filters period for aggregate
        // Actually assemble uses all scores for sampleCount - load all user scores for category
      }
      scores.push({
        localDate,
        rawScore: row.raw_score == null ? null : Number(row.raw_score),
        isNotApplicable:
          Boolean(row.is_not_applicable) || row.raw_score == null,
      });
    }
    // Reload without period filter for full sample history — already have all
    scores.sort((a, b) => a.localDate.localeCompare(b.localDate));

    // tags in period
    let tags: string[] = [];
    if (entryIds.length) {
      const periodEntryIds = (scoreRows || [])
        .filter((r) => {
          const d = dateById.get(r.entry_id as string);
          return d && d >= opts.periodStart && d <= opts.periodEnd;
        })
        .map((r) => r.entry_id as string);
      if (periodEntryIds.length) {
        const { data: tagRows } = await sb
          .from("journal_entry_tags")
          .select("tag_code")
          .eq("user_id", userId)
          .in("entry_id", periodEntryIds);
        tags = Array.from(
          new Set((tagRows || []).map((t) => t.tag_code as string))
        ).slice(0, 12);
      }
    }

    // astrology snapshot for focus (daily) or period end
    const snapDate = opts.periodType === "daily" ? focus : opts.periodEnd;
    let astrology: AssembleAstrologySnapshot | null = null;
    const { data: snap } = await sb
      .from("astrology_snapshots")
      .select(
        "local_date,calculation_version,theory_version,feature_schema_version,status"
      )
      .eq("user_id", userId)
      .eq("local_date", snapDate)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snap) {
      const { data: vec } = await sb
        .from("astrology_feature_vectors")
        .select("vector")
        .eq("user_id", userId)
        .eq("local_date", snapDate)
        .limit(1)
        .maybeSingle();
      const vector = (vec?.vector || {}) as Record<string, unknown>;
      const approx = Boolean(vector.__elementDistributionApproximate);
      const verifiedFeatureKeys = Object.keys(vector).filter(
        (k) =>
          k !== "__elementDistributionApproximate" &&
          typeof vector[k] === "number"
      );
      astrology = {
        localDate: snap.local_date as string,
        calculationVersion: snap.calculation_version as string,
        theoryVersion: snap.theory_version as string,
        featureSchemaVersion: snap.feature_schema_version as string,
        verifiedFeatureKeys,
        elementDistributionApproximate: approx,
        theoryPlainSummary: approx
          ? null
          : "원국과 운의 구조적 흐름을 이론 관점으로 참고합니다.",
      };
    }

    // personalization model — never select coefficients
    let model: AssembleModelSnapshot | null = null;
    const { data: mrow } = await sb
      .from("personalization_models")
      .select(
        "model_status,data_stage,prediction_visible,confidence_score,confidence_band,valid_sample_count,feature_keys,normalization_metadata,model_metrics,calculation_version,theory_version,feature_schema_version,model_version,allowlist_version,training_start_date,training_end_date,summary_text,deprecated_at"
      )
      .eq("user_id", userId)
      .eq("category_key", opts.categoryKey)
      .is("deprecated_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mrow) {
      const row = mrow as unknown as Record<string, unknown>;
      const norm = (row.normalization_metadata || {}) as Record<
        string,
        unknown
      >;
      const metrics = (row.model_metrics || {}) as Record<string, unknown>;
      model = {
        modelStatus: String(row.model_status),
        dataStage: String(row.data_stage),
        predictionVisible: Boolean(row.prediction_visible),
        confidenceScore: Number(row.confidence_score || 0),
        confidenceBand: String(row.confidence_band || "insufficient"),
        validSampleCount: Number(row.valid_sample_count || 0),
        featureKeys: Array.isArray(row.feature_keys)
          ? (row.feature_keys as string[])
          : [],
        baselineWeightedMean:
          typeof norm.weightedMean === "number"
            ? norm.weightedMean
            : null,
        maeImprovement:
          typeof metrics.maeImprovement === "number"
            ? metrics.maeImprovement
            : null,
        baselineMae:
          typeof metrics.baselineMae === "number" ? metrics.baselineMae : null,
        ridgeMae:
          typeof metrics.ridgeMae === "number" ? metrics.ridgeMae : null,
        validationSampleCount: Number(metrics.validationSampleCount || 0),
        calculationVersion: String(row.calculation_version),
        theoryVersion: String(row.theory_version),
        featureSchemaVersion: String(row.feature_schema_version),
        modelVersion: String(row.model_version),
        allowlistVersion: String(row.allowlist_version),
        trainingStartDate: (row.training_start_date as string) || null,
        trainingEndDate: (row.training_end_date as string) || null,
        summaryText: (row.summary_text as string) || null,
      };
    }

    const assembleInput: AssembleInput = {
      periodType: opts.periodType,
      periodStart: opts.periodStart,
      periodEnd: opts.periodEnd,
      focusDate: focus,
      categoryKey: opts.categoryKey,
      categoryLabel,
      scores,
      tags,
      astrology,
      model,
      expectedCalculationVersion: astrology?.calculationVersion,
      expectedFeatureSchemaVersion: astrology?.featureSchemaVersion,
    };

    return {
      ok: true,
      authenticated: true,
      assembleInput,
      _audit: {
        scoreCount: scores.length,
        snapshotFound: Boolean(astrology),
        modelFound: Boolean(model),
        tagCount: tags.length,
      },
    };
  } catch (e) {
    return {
      ok: false,
      authenticated: true,
      assembleInput: emptyInput(
        opts.periodType,
        opts.periodStart,
        opts.periodEnd,
        focus,
        opts.categoryKey,
        categoryLabel
      ),
      error: e instanceof Error ? e.message : "load_failed",
    };
  }
}
