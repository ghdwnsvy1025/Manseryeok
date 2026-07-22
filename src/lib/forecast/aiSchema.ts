/** AI에 전달하는 구조화 입력 (원문·생년월일·원국 금지) */
export type ForecastAiInput = {
  targetDate: string;
  languageLevel: "beginner" | "expert";
  tomorrowSaju: {
    dayGanjiKo: string;
    heavenlyStem: string;
    earthlyBranch: string;
    tenGod: string | null;
    relationLabels: string[];
  };
  recentState: {
    summary: string;
    moodAvg: number | null;
    energyAvg: number | null;
  };
  similarDayStatistics: {
    sampleSizes: {
      ganji: number;
      tenGod: number;
      stem: number;
      branch: number;
    };
    moodAverage: number | null;
    energyAverage: number | null;
    frequentTags: string[];
  };
  todayStructured: {
    moodLabel: string | null;
    energyLabel: string | null;
    primaryArea: string | null;
    emotions: string[];
    tags: string[];
  };
  localDraft: {
    todaySummary: string;
    innerSignal: string;
    neededCondition: string;
    emotionForecast: string;
    focusForecast: string;
    conditionForecast: string;
    oneAction: string;
    reflectionSentence: string;
  };
  dataMaturity: string;
};

export type ForecastAiOutput = {
  todaySummary: string;
  possibleInnerSignal: string;
  neededCondition: string;
  emotionForecast: string;
  focusForecast: string;
  conditionForecast: string;
  oneAction: string;
  reflectionSentence: string;
};

const FORBIDDEN_PATTERNS = [
  /우울증/,
  /정신질환/,
  /트라우마/,
  /반드시\s*(발생|일어|생길)/,
  /정확도\s*\d+/,
  /위장\s*문제/,
  /병원에\s*가/,
  /회피형/,
  /애착/,
  /진단/,
];

const SENSITIVE_REQUEST_KEYS = [
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

export function assertNoSensitiveFields(body: unknown): string | null {
  if (!body || typeof body !== "object") return "요청 본문이 올바르지 않습니다.";
  const obj = body as Record<string, unknown>;
  for (const key of SENSITIVE_REQUEST_KEYS) {
    if (key in obj && obj[key] != null && obj[key] !== "") {
      return `개인정보·원문 필드(${key})는 전송할 수 없습니다.`;
    }
  }
  return null;
}

export function isForecastAiInput(value: unknown): value is ForecastAiInput {
  if (!value || typeof value !== "object") return false;
  const v = value as ForecastAiInput;
  return (
    typeof v.targetDate === "string" &&
    typeof v.localDraft === "object" &&
    v.localDraft != null &&
    typeof v.localDraft.todaySummary === "string"
  );
}

export function parseForecastAiOutput(value: unknown): ForecastAiOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const required = [
    "todaySummary",
    "possibleInnerSignal",
    "neededCondition",
    "emotionForecast",
    "focusForecast",
    "conditionForecast",
    "oneAction",
    "reflectionSentence",
  ] as const;
  const out: Partial<ForecastAiOutput> = {};
  for (const key of required) {
    if (typeof v[key] !== "string" || !(v[key] as string).trim()) return null;
    out[key] = (v[key] as string).trim();
  }
  return out as ForecastAiOutput;
}

export function containsForbiddenExpression(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

export function sanitizeAiOutput(output: ForecastAiOutput): ForecastAiOutput | null {
  for (const value of Object.values(output)) {
    if (containsForbiddenExpression(value)) return null;
  }
  return output;
}
