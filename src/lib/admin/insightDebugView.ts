/**
 * 관리자 인사이트 디버그 — 섹션형 뷰 조립.
 * 일기 원문은 기본 제외. 민감정보 권한이 있을 때만 includeContent 가능.
 */

export type AdminDebugVersions = {
  engine?: string | null;
  fortuneScore?: string | null;
  canonicalKeywords?: string | null;
  keywordMapping?: string | null;
  sajuRules?: string | null;
  ridgeEval?: string | null;
  sajuRelationsScoring?: boolean | null;
};

export type AdminDebugFlags = {
  sajuRelationsScoringEnabled?: boolean;
};

type Json = Record<string, unknown>;

function asObj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Json)
    : {};
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function pick(obj: Json, keys: string[]): Json {
  const out: Json = {};
  for (const k of keys) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

/** context_json / payload에서 원문·생년월일 등 민감 키 제거 */
export const SENSITIVE_KEYS = [
  "content",
  "diary",
  "diaryContent",
  "entryContent",
  "mainEventText",
  "main_event_text",
  "birthDate",
  "birth_date",
  "birthDateTime",
  "rawText",
  "quote_text_ko", // 명언 본문은 별도 필드로 허용하되 일기와 혼동 방지
] as const;

export function stripSensitive(
  value: unknown,
  opts: { allowQuoteText?: boolean } = {}
): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => stripSensitive(v, opts));
  }
  if (!value || typeof value !== "object") return value;
  const out: Json = {};
  for (const [k, v] of Object.entries(value as Json)) {
    const lower = k.toLowerCase();
    if (
      SENSITIVE_KEYS.some((s) => s.toLowerCase() === lower) &&
      !(opts.allowQuoteText && lower === "quote_text_ko")
    ) {
      continue;
    }
    if (
      lower.includes("content") &&
      lower !== "content_type" &&
      lower !== "content_id" &&
      lower !== "content_score" &&
      lower !== "contentscorebycategory" &&
      !lower.startsWith("content_score") &&
      !lower.includes("contentscore")
    ) {
      continue;
    }
    out[k] = stripSensitive(v, opts);
  }
  return out;
}

export type AdminDebugSections = {
  common: {
    contextId: string | null;
    dataCutoffAt: string | null;
    timezone: string | null;
    engineVersion: string | null;
    ruleVersion: string | null;
    mappingVersion: string | null;
    eventDate: string;
    userId: string | null;
    priorUniqueDays: number | null;
    overallConfidence: number | null;
  };
  question: {
    questionId: string | null;
    questionText: string | null;
    topKeywords: unknown[];
    keywordCodes: unknown[];
    evidence: unknown;
    confidence: number | null;
    modelVersion: string | null;
    moduleScores: unknown;
  } | null;
  fortune: {
    fortuneId: string | null;
    overallHeadline: string | null;
    overallSummary: string | null;
    overallConfidence: number | null;
    scoringVersion: string | null;
    sections: Array<{
      domain: string;
      score: number | null;
      confidence: number | null;
      headline: string;
      opportunity: string | null;
      caution: string | null;
      action: string | null;
    }>;
  } | null;
  quote: {
    deliveryId: string | null;
    contentType: string | null;
    verificationStatus: string | null;
    rightsStatus: string | null;
    fitnessScore: number | null;
    exclusionReasons: unknown[];
    repeatLimitHit: boolean | null;
    fallbackStage: string | null;
    authorName: string | null;
    workTitle: string | null;
    /** 명언 문구 — 일기가 아님. 민감 권한이 없어도 노출 가능 */
    quoteText: string | null;
  } | null;
  saju: {
    dayMaster: string | null;
    tenGod: string | null;
    keywords: unknown[];
    focusHints: unknown[];
    sajuWeight: number | null;
    plainSummary: string | null;
    ruleVersion: string | null;
    fromContext: unknown;
  } | null;
  model: {
    ridgeEvalVersion: string | null;
    relationsScoringEnabled: boolean | null;
    note: string;
  };
  feedback: {
    questionEvents: Array<{
      eventType: string;
      rating: number | null;
      createdAt: string | null;
    }>;
    contentFeedback: Array<{
      contentType: string;
      rating: string | null;
      saved: boolean;
      shared: boolean;
    }>;
    exposures: Array<{
      contentType: string;
      eventType: string;
      occurredAt: string | null;
    }>;
  };
  privacy: {
    diaryContentIncluded: boolean;
    sensitiveAccess: boolean;
  };
};

export function assembleAdminDebugSections(input: {
  eventDate: string;
  userId: string | null;
  versions: AdminDebugVersions;
  flags?: AdminDebugFlags;
  insightRows: Json[];
  fortuneRows: Json[];
  deliveryRows: Json[];
  exposureRows: Json[];
  questionRows?: Json[];
  questionFeedbackRows?: Json[];
  contentFeedbackRows?: Json[];
  sensitiveAccess: boolean;
  includeContent?: boolean;
}): AdminDebugSections {
  const includeContent = Boolean(
    input.includeContent && input.sensitiveAccess
  );

  const insight = input.insightRows[0] ?? null;
  const ctxJson = asObj(
    includeContent
      ? insight?.context_json
      : stripSensitive(insight?.context_json)
  );
  const recent = asObj(ctxJson.recentState);
  const natal = asObj(ctxJson.natalPrior);

  const fortune = input.fortuneRows[0] ?? null;
  const sections = asArr(fortune?.daily_fortune_sections).map((s) => {
    const row = asObj(s);
    return {
      domain: String(row.domain_code ?? ""),
      score: typeof row.score === "number" ? row.score : null,
      confidence: typeof row.confidence === "number" ? row.confidence : null,
      headline: String(row.headline ?? ""),
      opportunity:
        row.opportunity == null ? null : String(row.opportunity),
      caution: row.caution == null ? null : String(row.caution),
      action: row.action == null ? null : String(row.action),
    };
  });

  const question = (input.questionRows ?? [])[0] ?? null;
  const delivery = input.deliveryRows[0] ?? null;
  const deliveryMeta = asObj(delivery?.metadata_json ?? delivery?.meta);

  const questionEvents = (input.questionFeedbackRows ?? []).map((r) => {
    const row = asObj(r);
    return {
      eventType: String(row.event_type ?? ""),
      rating: typeof row.rating === "number" ? row.rating : null,
      createdAt: row.created_at == null ? null : String(row.created_at),
    };
  });

  const contentFeedback = (input.contentFeedbackRows ?? []).map((r) => {
    const row = asObj(r);
    return {
      contentType: String(row.content_type ?? ""),
      rating: row.rating == null ? null : String(row.rating),
      saved: Boolean(row.saved),
      shared: Boolean(row.shared),
    };
  });

  const exposures = input.exposureRows.slice(0, 30).map((r) => {
    const row = asObj(r);
    return {
      contentType: String(row.content_type ?? ""),
      eventType: String(row.event_type ?? ""),
      occurredAt:
        row.occurred_at == null ? null : String(row.occurred_at),
    };
  });

  return {
    common: {
      contextId: insight?.id == null ? null : String(insight.id),
      dataCutoffAt:
        insight?.data_cutoff_at == null
          ? null
          : String(insight.data_cutoff_at),
      timezone:
        insight?.timezone == null ? null : String(insight.timezone),
      engineVersion:
        insight?.engine_version == null
          ? input.versions.engine ?? null
          : String(insight.engine_version),
      ruleVersion: input.versions.sajuRules ?? null,
      mappingVersion: input.versions.keywordMapping ?? null,
      eventDate: input.eventDate,
      userId: input.userId,
      priorUniqueDays:
        typeof ctxJson.priorUniqueDays === "number"
          ? ctxJson.priorUniqueDays
          : null,
      overallConfidence:
        typeof ctxJson.overallConfidence === "number"
          ? ctxJson.overallConfidence
          : null,
    },
    question: question
      ? {
          questionId: question.id == null ? null : String(question.id),
          questionText:
            question.question_text == null
              ? null
              : String(question.question_text),
          topKeywords: asArr(ctxJson.topKeywords),
          keywordCodes: asArr(question.keyword_codes),
          evidence: includeContent
            ? question.evidence
            : stripSensitive(question.evidence),
          confidence:
            typeof question.confidence === "number"
              ? question.confidence
              : null,
          modelVersion:
            question.model_version == null
              ? null
              : String(question.model_version),
          moduleScores: pick(recent, [
            "contentScoreByCategory",
            "recentAOverall",
            "confidence",
            "keywordScores",
          ]),
        }
      : null,
    fortune: fortune
      ? {
          fortuneId: fortune.id == null ? null : String(fortune.id),
          overallHeadline:
            fortune.overall_headline == null
              ? null
              : String(fortune.overall_headline),
          overallSummary:
            fortune.overall_summary == null
              ? null
              : String(fortune.overall_summary),
          overallConfidence:
            typeof fortune.overall_confidence === "number"
              ? fortune.overall_confidence
              : null,
          scoringVersion:
            fortune.scoring_version == null
              ? input.versions.fortuneScore ?? null
              : String(fortune.scoring_version),
          sections,
        }
      : null,
    quote: delivery
      ? {
          deliveryId: delivery.id == null ? null : String(delivery.id),
          contentType:
            delivery.content_type == null
              ? null
              : String(delivery.content_type),
          verificationStatus:
            delivery.verification_status == null
              ? deliveryMeta.verificationStatus == null
                ? null
                : String(deliveryMeta.verificationStatus)
              : String(delivery.verification_status),
          rightsStatus:
            delivery.rights_status == null
              ? deliveryMeta.rightsStatus == null
                ? null
                : String(deliveryMeta.rightsStatus)
              : String(delivery.rights_status),
          fitnessScore:
            typeof delivery.fitness_score === "number"
              ? delivery.fitness_score
              : typeof deliveryMeta.fitnessScore === "number"
                ? deliveryMeta.fitnessScore
                : null,
          exclusionReasons: asArr(
            delivery.exclusion_reasons ?? deliveryMeta.exclusionReasons
          ),
          repeatLimitHit:
            typeof delivery.repeat_limit_hit === "boolean"
              ? delivery.repeat_limit_hit
              : typeof deliveryMeta.repeatLimitHit === "boolean"
                ? deliveryMeta.repeatLimitHit
                : null,
          fallbackStage:
            delivery.fallback_stage == null
              ? deliveryMeta.fallbackStage == null
                ? null
                : String(deliveryMeta.fallbackStage)
              : String(delivery.fallback_stage),
          authorName:
            delivery.author_name == null
              ? null
              : String(delivery.author_name),
          workTitle:
            delivery.work_title == null
              ? null
              : String(delivery.work_title),
          quoteText:
            delivery.generated_original_text == null &&
            delivery.quote_text_ko == null
              ? null
              : String(
                  delivery.quote_text_ko ??
                    delivery.generated_original_text
                ),
        }
      : null,
    saju: {
      dayMaster:
        natal.tenGod == null && natal.dayMaster == null
          ? null
          : String(natal.dayMaster ?? natal.tenGod ?? ""),
      tenGod: natal.tenGod == null ? null : String(natal.tenGod),
      keywords: asArr(natal.keywords),
      focusHints: asArr(natal.focusHints),
      sajuWeight:
        typeof natal.sajuWeight === "number" ? natal.sajuWeight : null,
      plainSummary:
        natal.plainSummary == null ? null : String(natal.plainSummary),
      ruleVersion: input.versions.sajuRules ?? null,
      fromContext: pick(natal, [
        "tenGod",
        "keywords",
        "focusHints",
        "sajuWeight",
        "confidence",
      ]),
    },
    model: {
      ridgeEvalVersion: input.versions.ridgeEval ?? null,
      relationsScoringEnabled:
        input.flags?.sajuRelationsScoringEnabled ??
        input.versions.sajuRelationsScoring ??
        null,
      note: "Ridge는 shadow 전용. live 결정에 넣지 않음.",
    },
    feedback: {
      questionEvents,
      contentFeedback,
      exposures,
    },
    privacy: {
      diaryContentIncluded: includeContent,
      sensitiveAccess: input.sensitiveAccess,
    },
  };
}

export function isSensitiveAdminEmail(
  email: string | null | undefined,
  sensitiveList: string[]
): boolean {
  if (!email) return false;
  if (sensitiveList.length === 0) return false;
  return sensitiveList.includes(email.trim().toLowerCase());
}

export function getSensitiveAdminEmails(
  raw: string | undefined = process.env.ADMIN_SENSITIVE_EMAILS
): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
