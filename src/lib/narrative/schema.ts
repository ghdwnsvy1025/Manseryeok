export type NarrativeSurface =
  | "saju_expert"
  | "today_beginner"
  | "today_expert"
  | "forecast";

export type NarrativeFacts = {
  targetDate?: string;
  ganjiKo?: string;
  heavenlyStem?: string;
  earthlyBranch?: string;
  tenGod?: string | null;
  relationLabels?: string[];
  elementHints?: string[];
  languageLevel?: "beginner" | "expert";
  sampleSizes?: {
    ganji?: number;
    tenGod?: number;
    stem?: number;
    branch?: number;
  };
  moodAverage?: number | null;
  energyAverage?: number | null;
  frequentTags?: string[];
  todayStructured?: {
    moodLabel?: string | null;
    energyLabel?: string | null;
    primaryArea?: string | null;
    emotions?: string[];
    tags?: string[];
  };
  localDraft?: Record<string, string>;
  sectionDrafts?: Array<{ id: string; title: string; summary: string }>;
};

export type NarrativeRequest = {
  surface: NarrativeSurface;
  facts: NarrativeFacts;
};

export type NarrativeResponse = {
  ok: true;
  surface: NarrativeSurface;
  wording: Record<string, string>;
  usedRag: boolean;
  chunkCount: number;
};

const SENSITIVE_KEYS = [
  "content",
  "birthDate",
  "birth_date",
  "pillars",
  "diaryText",
  "diary_text",
  "rawText",
  "email",
  "name",
];

export function assertNoSensitiveNarrativeFields(body: unknown): string | null {
  if (!body || typeof body !== "object") return "요청 본문이 올바르지 않습니다.";
  const obj = body as Record<string, unknown>;
  for (const key of SENSITIVE_KEYS) {
    if (key in obj && obj[key] != null && obj[key] !== "") {
      return `개인정보·원문 필드(${key})는 전송할 수 없습니다.`;
    }
  }
  if (obj.facts && typeof obj.facts === "object") {
    const facts = obj.facts as Record<string, unknown>;
    for (const key of SENSITIVE_KEYS) {
      if (key in facts && facts[key] != null && facts[key] !== "") {
        return `facts 안의 민감 필드(${key})는 전송할 수 없습니다.`;
      }
    }
  }
  return null;
}

export function isNarrativeRequest(value: unknown): value is NarrativeRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as NarrativeRequest;
  const surfaces: NarrativeSurface[] = [
    "saju_expert",
    "today_beginner",
    "today_expert",
    "forecast",
  ];
  return (
    surfaces.includes(v.surface) &&
    typeof v.facts === "object" &&
    v.facts != null
  );
}

export function buildRetrievalQuery(facts: NarrativeFacts): string {
  const parts: string[] = [];
  if (facts.tenGod) parts.push(`십신 ${facts.tenGod}`);
  if (facts.heavenlyStem) parts.push(`천간 ${facts.heavenlyStem}`);
  if (facts.earthlyBranch) parts.push(`지지 ${facts.earthlyBranch}`);
  if (facts.ganjiKo) parts.push(`일진 ${facts.ganjiKo}`);
  if (facts.relationLabels?.length) {
    parts.push(`관계 ${facts.relationLabels.join(" ")}`);
  }
  if (facts.elementHints?.length) {
    parts.push(`오행 ${facts.elementHints.join(" ")}`);
  }
  parts.push("사주 해석 일상 관찰 감정 집중 에너지");
  return parts.join(" ");
}

const FORBIDDEN = [
  /우울증/,
  /정신질환/,
  /트라우마/,
  /반드시\s*(발생|일어|생길)/,
  /정확도\s*\d+/,
  /위장\s*문제/,
  /병원에\s*가/,
  /회피형/,
  /진단/,
];

export function containsForbiddenNarrative(text: string): boolean {
  return FORBIDDEN.some((re) => re.test(text));
}

export function parseNarrativeWording(
  value: unknown
): Record<string, string> | null {
  if (!value || typeof value !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) {
      out[k] = v.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sanitizeNarrativeWording(
  wording: Record<string, string>
): Record<string, string> | null {
  for (const v of Object.values(wording)) {
    if (containsForbiddenNarrative(v)) return null;
  }
  return wording;
}
