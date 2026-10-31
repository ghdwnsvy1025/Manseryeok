// 3단계 — 글 생성. Claude Sonnet 5 (Anthropic SDK). 설계: docs/FORTUNE_V4.md "3단계 — 글" · "v4.19".
// v4.19 (2026-10-31, ChatGPT 검토 반영): 사주 계산은 코드가 하고, 오늘 무엇을 말할지도 코드(plan.ts)가 고르고, 모델은 그걸 사람 말처럼 쓰는 데만 쓴다.
//   계획(plan.ts) → brief(brief.ts) → 초안 1회(구조화 출력 {headline, body[], areaLines, do, dont}) → 검사(validate.ts: 구조화 이슈)
//   → 걸린 칸·문장만 수리(한 번의 호출로 여러 항목 replace/delete) → 같은 검사 → 수리 최대 2라운드 → 그래도 걸린 본문 문장·영역 줄은 지운다.
//   글 전체 다시 쓰기는 JSON 깨짐·잘림·문장이 너무 적음·핵심 누락일 때만. 초안 + 수리(또는 다시 쓰기) 합쳐 호출은 최대 3번(MAX_ATTEMPTS).
//   v4.14의 칸 고쳐 쓰기(PATCH: areas·do·dont)는 이 수리 틀로 합쳤다. 판단·태그 출력은 없앴다(태그가 필요하면 plan.tagsFromPlan).
// 규칙(system)은 고정이라 cache_control로 캐시한다. 샘플링 파라미터(temperature 등)는 보내지 않는다 — Sonnet 5는 400을 낸다.
// 검사를 통과하지 못한 모델 글은 어떤 경우에도 결과에 들어가지 않는다. 템플릿으로 떨어져도 그때까지 쓴 토큰·시간은 usage·metrics에 남는다.
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { BANNED_ALL, buildBrief, JARGON, renderBrief, TEN_GOD_NAMES, type BriefInput, type FortuneBrief } from "./brief";
import { planSummary, tagsFromPlan } from "./plan";
import { parseReview, problemLine, problemTarget, REVIEW_SYSTEM, reviewModel, reviewUser } from "./review";
import type { TemplateText } from "./text";
import type { FortuneTags } from "./examples";
import type { AreaName, AreaPeriod, FortuneCallMetric, FortuneMetrics, FortunePlanSummary } from "./types";
import { checkDraft, joinBody, LIMITS, needsRewrite, normalizeDraft, trimTail, type Draft, type Issue } from "./validate";

export { trimTail };

export const DEFAULT_FORTUNE_MODEL = "claude-sonnet-5";
/** 환경변수 FORTUNE_MODEL로 덮어쓴다 (날짜 접미사 없는 ID). v4.19: 효과 비교를 위해 기본값은 그대로 */
export const fortuneModel = (): string => process.env.FORTUNE_MODEL?.trim() || DEFAULT_FORTUNE_MODEL;
/** v4.19: 수리 호출 모델. 환경변수 FORTUNE_PATCH_MODEL, 없으면 글쓰기 모델 그대로 */
export const patchModel = (writer: string = fortuneModel()): string => process.env.FORTUNE_PATCH_MODEL?.trim() || writer;
/** 초안 1 + 수리(또는 다시 쓰기) 최대 2라운드 */
export const MAX_ATTEMPTS = 3;

const BAN_WORDS = [...new Set([...BANNED_ALL, ...JARGON, ...TEN_GOD_NAMES].map((w) => w.trim()))].join("·");

/** 고정 규칙. 바꾸면 캐시가 다시 만들어진다 (날짜·사용자 정보는 넣지 않는다). v4.19: 글쓰기 철학 + 절대 금지 한 번만. 예시 세 편은 빠졌다(examples.ts는 베낌 검사용) */
export const SYSTEM = `당신은 일기 앱 "사주읽는밤"의 작가입니다. 오늘 무엇을 말할지는 코드가 이미 정해 user의 JSON 계획으로 보냅니다. 당신은 그 계획을 사람의 말로 자연스럽게 옮기기만 합니다. 계획에 없는 사실·숫자·사건·영역은 더하지 않습니다.

[쓰는 법]
- 읽는 사람은 사주를 모릅니다. 사주 요소가 아니라 그 결과로 오늘 생기기 쉬운 마음·행동·상황을 씁니다. "이런 마음이 들 수 있겠구나, 그럼 이렇게 하면 되겠구나"가 바로 보여야 합니다.
- 중심은 계획.핵심 하나입니다. 핵심.표현 가운데 하나를 골라 오늘의 구체적인 장면으로 풀어 씁니다(그대로 옮기지 않기). 핵심.뜻·오늘·사실은 이해를 돕는 재료일 뿐 그 말을 글에 쓰지 않습니다.
- 보조가 있으면 핵심을 세게 하거나 누그러뜨리는 한 문장으로만, 맥락이 있으면 오늘 행동을 바꾸는 한 문장으로만 녹입니다. 없으면 말하지 않습니다.
- 조언은 계획.방향 쪽으로, 말투는 계획.말투로. 아무 날에나 맞는 말("힘내요", "마음을 편히 가져요", "무리하지 않아요")은 쓰지 않습니다.
- 계획.피할것은 최근 글에 쓴 장면·동작·첫 어절·제목 끝맺음입니다. 주제는 같아도 되지만 이것들은 다른 것으로 바꿉니다. 피할것.아니에요의 주제는 앞세우지 않습니다.

[출력]
- headline: 20자 안, 오늘 체감할 내용 한 구절. 기운·이론을 말하는 제목("기회가 열리는 날")은 안 됩니다.
- body: 문장 4~5개의 배열(원소 하나에 한 문장). 한 문장 12~80자, 짧은 문장과 긴 문장을 섞습니다. 첫 문장은 이음말로 시작하지 않고, '그래서'는 한 번까지, 같은 낱말은 세 번까지.
- areaLines: 계획.영역에 있는 영역만. text는 그 신호(↑ 잘 되는 쪽, ↓ 조심할 쪽)에 맞는 오늘 행동 한 문장(70자 안), 본문과 다른 말로. 이달·올해 영역은 "이달엔/올해는"으로. 계획.영역이 비면 [].
- do·dont: 각 한 문장(45자 안)의 구체 행동. 본문 조언을 되풀이하지 않고, dont는 do를 뒤집은 말이 아닙니다.
- 모든 문장은 "~어요/~해요/~예요"로 끝납니다. 권유는 "~해 봐요/~하는 편이 좋아요", dont는 "~않아요" 꼴.

[절대 쓰지 않는 것]
- 낱말: ${BAN_WORDS}.
- 오행 이름을 기운으로("토 기운"), "A와 B"꼴 성격 이름("경쟁과 추진"), 판정 문장("맞는 편·모자란·넉넉한·실속을 챙기는·기운이 거들어·과해지기 쉬워"), 생·극·구조 설명("누르다·부딪히다·글자"), 비유("손에 붙어요·흐름이 열려요·신호가 들어와요", 볕·바위·불씨 같은 사물 그림), 속말("판정·원국·내부 판단").
- 명령형("~하세요/~마세요")·반말·"~입니다", 결과 약속("그러면 ~해져요")·기간 약속("3일 더 하면"), 넘겨짚기("~한 적 있으시죠"), 되받기("앞에서 말한"), 정의문("A와 B를 합쳐 C라 해요").
- 질병·사고·돈 액수·연애 사건, 직장 장면(회의·출근·상사·동료·업무), 점수와 내 기록 이야기("N점", "기록했·평균·N번"), 계획.숫자에 없는 숫자, 이모지·한자, 아침·점심·저녁·밤을 차례로 늘어놓기.
- 절기 이름은 계획.오늘.절기첫날이 true일 때만 한 번, 요일은 꼭 필요할 때만 한 번. 글을 절기·요일로 시작하지 않습니다.
- 단계가 주의인 날엔 오늘 이야기에 "풀리다·수월하다·순조롭다·술술"을 쓰지 않습니다.`;

/** 구조화 출력 스키마 (v4.19: 작가 칸만) */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "body", "areaLines", "do", "dont"],
  properties: {
    headline: { type: "string" },
    body: { type: "array", items: { type: "string" } },
    areaLines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "text"],
        properties: {
          area: { type: "string", enum: ["대인", "재물", "직업", "학업", "연애", "가족", "건강"] },
          text: { type: "string" },
        },
      },
    },
    do: { type: "string" },
    dont: { type: "string" },
  },
} as const;

/** v4.19: 수리 출력 — 걸린 항목마다 replace(새 문장) 또는 delete(본문 문장·영역 줄만) */
export const REPAIR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixes"],
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "action", "text"],
        properties: { id: { type: "string" }, action: { type: "string", enum: ["replace", "delete"] }, text: { type: "string" } },
      },
    },
  },
} as const;
export interface RepairFix { id: string; action: "replace" | "delete"; text: string }

/** 프롬프트 판본: 버전 + SYSTEM·스키마 지문. metrics에 남아 판본별 비교에 쓴다 */
export const PROMPT_VERSION = `v4.19-${createHash("sha256").update(SYSTEM + JSON.stringify(OUTPUT_SCHEMA) + JSON.stringify(REPAIR_SCHEMA)).digest("hex").slice(0, 8)}`;

export interface GenerateResult {
  text: TemplateText;
  /** v4.19: 모델 글이면 본문 문장 배열 (text.body는 이것을 이어 붙인 것) */
  bodySentences?: string[];
  /** v4.19: 계획이 고른 영역에 모델이 쓴 문장 */
  areaNarratives?: { period: AreaPeriod; area: AreaName; text: string }[];
  source: "llm" | "template";
  /** 모델을 부른 횟수 (0이면 부르지 않았다) */
  attempts: number;
  /** attempts 가운데 수리 호출 수 */
  patches: number;
  /** source가 llm일 때 모델 ID, 아니면 null */
  model: string | null;
  /** 호출마다 검사에서 걸린 사유. 통과하면 빈 배열 */
  issues: string[][];
  /** 마지막 초안 (검사 실패 분석용) */
  lastDraft?: Draft;
  /** v4.19: 코드가 만든 기록용 태그 (모델 글일 때) */
  tags?: FortuneTags;
  plan?: FortunePlanSummary;
  /** v4.10: 문맥 검수 결과. 검수 모델이 없으면 undefined */
  review?: { status: "통과" | "적용" | "탈락"; problems: string[]; why?: string };
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** api = 429·5xx·타임아웃·연결 오류 → 이 결과는 하루 캐시에 쓰지 않는다 (A-3) */
  transient?: "api";
  /** v4.19: 시간·호출 (totalMs·coreMs는 index.ts가 채운다) */
  metrics: Omit<FortuneMetrics, "totalMs" | "coreMs"> & { llmMs: number };
}

/** SDK 기본값은 타임아웃 10분·재시도 2회라 함수 상한을 넘긴다 (A-2). 재시도는 이 파일의 라운드가 맡는다. 호출마다 남은 시간으로 더 줄인다 */
export const CLIENT_OPTIONS = { timeout: 20_000, maxRetries: 0 } as const;
/** v4.19: 글 단계 전체 기한(ms). 이 안에서만 호출을 시작하고, 호출마다 남은 시간만큼만 기다린다 — page maxDuration(60초) 안 */
export const TOTAL_DEADLINE_MS = 45_000;
/** 남은 시간이 이보다 적으면 새 호출을 시작하지 않는다 */
export const MIN_CALL_MS = 8_000;
/** adaptive thinking은 생각 토큰도 max_tokens에 들어간다 (A-5). 실제 출력만큼만 과금된다 */
export const MAX_TOKENS = 4096;
export const REPAIR_MAX_TOKENS = 2048;

/** 응답이 max_tokens에 잘렸을 때 */
export class TruncatedError extends Error {
  readonly truncated = true;
  constructor() {
    super("응답이 잘림 (stop_reason=max_tokens)");
    this.name = "TruncatedError";
  }
}

export interface GenerateOptions {
  client?: Anthropic;
  /** 기본 3 (초안 + 2라운드). 샘플 스크립트처럼 호출 수를 묶을 때 1 */
  maxAttempts?: number;
  model?: string;
  /** 수리 모델. 없으면 FORTUNE_PATCH_MODEL, 그것도 없으면 model */
  patchModel?: string;
  /** v4.10: 검수 모델. undefined면 환경변수 FORTUNE_REVIEW_MODEL, null이면 검수 안 함 */
  reviewModel?: string | null;
  /** 글 단계 기한(ms). 기본 TOTAL_DEADLINE_MS */
  deadlineMs?: number;
  /** 테스트용 시계 */
  now?: () => number;
}

type Usage = GenerateResult["usage"];

/** 한 번 호출해 JSON을 돌려준다. refusal이면 null. 측정은 metric에 채운다(실패해도 토큰은 남는다) */
export async function callModel(
  client: Anthropic,
  model: string,
  messages: Anthropic.MessageParam[],
  usage: Usage,
  metric: FortuneCallMetric,
  schema: object = OUTPUT_SCHEMA,
  opts: { timeoutMs?: number; maxTokens?: number; now?: () => number } = {},
): Promise<unknown | null> {
  const now = opts.now ?? Date.now;
  const t0 = now();
  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: opts.maxTokens ?? MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages,
      },
      opts.timeoutMs ? { timeout: opts.timeoutMs } : undefined,
    );
    const u = response.usage;
    metric.input = u.input_tokens; metric.output = u.output_tokens;
    metric.cacheRead = u.cache_read_input_tokens ?? 0; metric.cacheWrite = u.cache_creation_input_tokens ?? 0;
    usage.input += metric.input; usage.output += metric.output; usage.cacheRead += metric.cacheRead; usage.cacheWrite += metric.cacheWrite;
    console.info(`[fortune llm] ${model} ${metric.kind} in=${u.input_tokens} out=${u.output_tokens} cache_read=${metric.cacheRead} cache_write=${metric.cacheWrite} stop=${response.stop_reason}`);
    if (response.stop_reason === "refusal") return null;
    if (response.stop_reason === "max_tokens") throw new TruncatedError();
    const text = response.content.find((b) => b.type === "text");
    if (!text) throw new Error("모델 응답에 text 블록이 없음");
    return JSON.parse(text.text) as unknown;
  } finally {
    metric.ms = now() - t0;
  }
}

/** 수리 항목 id: "headline" | "do" | "dont" | "body.N" | "area.N" (N은 0부터) */
export const unitId = (i: Pick<Issue, "field" | "index">): string => (i.field === "body" || i.field === "area" ? `${i.field}.${i.index}` : i.field);
function unitText(d: Draft, id: string): string {
  const [f, n] = id.split(".");
  if (f === "body") return d.body[Number(n)] ?? "";
  if (f === "area") return d.areaLines[Number(n)]?.text ?? "";
  return f === "headline" ? d.headline : f === "do" ? d.do : f === "dont" ? d.dont : "";
}

/** 다시 쓰기 요청 (글 전체): 이전 글과 사유를 붙인다 */
export function rewriteMessages(briefJson: string, prev: Draft | null, reasons: string[]): Anthropic.MessageParam[] {
  const prevText = prev ? JSON.stringify(prev) : "(JSON 파싱 실패)";
  return [{ role: "user", content: `${briefJson}\n\n[다시 쓰기] 바로 앞에 쓴 글을 쓸 수 없었어요. 아래 사유를 고쳐 같은 계획으로 처음부터 다시 써요.\n이전 글: ${prevText}\n사유:\n- ${reasons.join("\n- ")}` }];
}

/** v4.19: 수리 요청 — 걸린 칸마다 앞뒤 문장과 사유. 나머지는 손대지 않는다 */
export function repairMessages(briefJson: string, d: Draft, issues: Issue[]): Anthropic.MessageParam[] {
  const byUnit = new Map<string, string[]>();
  for (const i of issues) { if (i.field === "whole") continue; const id = unitId(i); byUnit.set(id, [...(byUnit.get(id) ?? []), i.msg]); }
  const items = [...byUnit.entries()].map(([id, msgs]) => {
    const [f, n] = id.split(".");
    const k = Number(n);
    const ctx = f === "body" ? { 앞: d.body[k - 1] ?? "(없음 — 첫 문장)", 뒤: d.body[k + 1] ?? "(없음 — 마지막 문장)" } : f === "area" ? { 영역: d.areaLines[k]?.area } : {};
    return { id, 지금: unitText(d, id), ...ctx, 사유: msgs };
  });
  return [{
    role: "user",
    content: `${briefJson}\n\n[수리] 아래 글은 대부분 검사를 통과했고, 표시한 항목만 걸렸어요. 항목마다 사유를 없앤 새 문장으로 바꾸거나(replace), 본문 문장·영역 줄은 지울 수도 있어요(delete — text는 빈 문자열). 제목·do·dont는 지우지 않아요. 고친 문장은 앞뒤와 자연스럽게 이어지고, 낱말만 바꾸지 말고 걸린 까닭을 없애요. 표시하지 않은 칸은 돌려주지 않아요.\n제목: ${d.headline}\n고칠 항목: ${JSON.stringify(items)}`,
  }];
}

/** 수리 응답을 초안에 덮어 쓴다 — 표시한 칸만 받는다(그 밖의 id는 무시). 본문은 지운 뒤 남은 문장 순서 그대로 */
export function applyRepair(d: Draft, fixes: unknown, allowed: ReadonlySet<string>): Draft {
  const list = (fixes && typeof fixes === "object" && Array.isArray((fixes as { fixes?: unknown }).fixes) ? (fixes as { fixes: RepairFix[] }).fixes : []).filter((f) => f && typeof f.id === "string" && allowed.has(f.id));
  const out: Draft = { ...d, body: [...d.body], areaLines: d.areaLines.map((a) => ({ ...a })) };
  const dropBody = new Set<number>(), dropArea = new Set<number>();
  for (const f of list) {
    const [field, n] = f.id.split(".");
    const k = Number(n);
    const text = trimTail(String(f.text ?? "").trim());
    if (f.action === "delete" || !text) {
      if (field === "body") dropBody.add(k);
      else if (field === "area") dropArea.add(k);
      continue;   // 제목·do·dont의 delete는 무시 — 다음 검사에 또 걸린다
    }
    if (field === "body" && k < out.body.length) out.body[k] = text;
    else if (field === "area" && out.areaLines[k]) out.areaLines[k]!.text = text;
    else if (field === "headline") out.headline = text;
    else if (field === "do") out.do = text;
    else if (field === "dont") out.dont = text;
  }
  // 바꾼 문장에 문장이 둘 들었으면 나눈다 (normalizeDraft와 같은 규칙)
  out.body = out.body.flatMap((s, i) => (dropBody.has(i) ? [] : normalizeDraft({ body: [s] })!.body));
  out.areaLines = out.areaLines.filter((_, i) => !dropArea.has(i));
  return out;
}

/** 수리 라운드가 끝났는데도 걸린 본문 문장·영역 줄을 지운다. 제목·하면·피해요·전체 이슈가 남거나 본문이 너무 짧아지면 null */
export function pruneFailing(d: Draft, brief: FortuneBrief): Draft | null {
  let cur = d;
  for (let n = 0; n < 6; n++) {
    const issues = checkDraft(cur, brief, KEEP);
    if (!issues.length) return cur;
    if (issues.some((i) => i.field === "headline" || i.field === "do" || i.field === "dont" || i.field === "whole")) return null;
    const dropB = new Set(issues.filter((i) => i.field === "body").map((i) => i.index!));
    const dropA = new Set(issues.filter((i) => i.field === "area").map((i) => i.index!));
    const body = cur.body.filter((_, i) => !dropB.has(i));
    if (body.length < LIMITS.bodyKeepMin) return null;
    cur = { ...cur, body, areaLines: cur.areaLines.filter((_, i) => !dropA.has(i)) };
  }
  return checkDraft(cur, brief, KEEP).length ? null : cur;
}
/** 수리·지우기 뒤의 검사: 본문은 3문장까지 받는다 */
const KEEP = { minBody: LIMITS.bodyKeepMin } as const;

/** 계획에 없는 영역 줄은 날조라 버리고 계획 순서로 맞춘다 (같은 영역 둘이면 앞의 것) */
function keepPlannedAreas(d: Draft, brief: FortuneBrief): Draft {
  const areaLines = brief.areas.map((x) => d.areaLines.find((a) => a.area === x.area)).filter((a): a is Draft["areaLines"][number] => Boolean(a));
  if (areaLines.length !== d.areaLines.length) console.warn(`[fortune llm] 계획에 없는 영역 줄 ${d.areaLines.length - areaLines.length}개 버림`);
  return { ...d, areaLines };
}

const codesOf = (issues: Issue[]): string[] => [...new Set(issues.map((i) => i.code))];

/**
 * 글 파이프라인. 모델 글이 검사를 통과하면 그것, 아니면 fallback(템플릿).
 * 키가 없거나 API 오류면 예외 없이 템플릿으로 떨어진다 (사유는 issues·metrics.fallback에 남긴다).
 */
export async function generateFortuneText(input: BriefInput, fallback: TemplateText, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const now = opts.now ?? Date.now;
  const t0 = now();
  const brief: FortuneBrief = buildBrief(input);
  const briefJson = renderBrief(brief);
  const briefMs = now() - t0;
  const model = opts.model ?? fortuneModel();
  const fixModel = opts.patchModel ?? patchModel(model);
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const deadline = t0 + (opts.deadlineMs ?? TOTAL_DEADLINE_MS);
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const calls: FortuneCallMetric[] = [];
  const result: GenerateResult = {
    text: fallback, source: "template", attempts: 0, patches: 0, model: null, issues: [], usage, plan: planSummary(brief.plan),
    metrics: { promptVersion: PROMPT_VERSION, briefMs, llmMs: 0, calls, firstPass: false },
  };
  const finish = (fallbackWhy?: string): GenerateResult => {
    result.metrics.llmMs = now() - t0;
    if (fallbackWhy) result.metrics.fallback = fallbackWhy;
    return result;
  };

  const client = opts.client ?? (process.env.ANTHROPIC_API_KEY ? new Anthropic(CLIENT_OPTIONS) : null);
  if (!client) {
    result.issues.push(["ANTHROPIC_API_KEY 없음"]);
    return finish("no_key");
  }

  /** 남은 시간 안에서 한 번 더 부를 수 있는가 */
  const canCall = () => result.attempts < maxAttempts && deadline - now() >= MIN_CALL_MS;
  /** 호출 한 번. 성공이면 응답 JSON(거절이면 null), 실패면 "retry"(잘림·JSON)·"stop"(API 오류 — 결과는 이미 정해 둠) */
  const call = async (kind: FortuneCallMetric["kind"], messages: Anthropic.MessageParam[]): Promise<{ ok: true; json: unknown | null; metric: FortuneCallMetric } | { ok: false; retry: boolean; why: string }> => {
    result.attempts++;
    if (kind === "patch") result.patches++;
    const m = kind === "patch" ? fixModel : model;
    const metric: FortuneCallMetric = { kind, model: m, ms: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, issueCodes: [] };
    calls.push(metric);
    try {
      const json = await callModel(client, m, messages, usage, metric, kind === "patch" ? REPAIR_SCHEMA : OUTPUT_SCHEMA, { timeoutMs: Math.max(1000, Math.min(CLIENT_OPTIONS.timeout, deadline - now())), maxTokens: kind === "patch" ? REPAIR_MAX_TOKENS : MAX_TOKENS, now });
      if (json === null) metric.issueCodes = ["refusal"];
      return { ok: true, json, metric };
    } catch (e) {
      if (e instanceof TruncatedError || e instanceof SyntaxError) {
        const why = e instanceof TruncatedError ? e.message : `JSON 파싱 실패: ${e.message}`;
        metric.issueCodes = [e instanceof TruncatedError ? "truncated" : "json"];
        console.warn(`[fortune llm] ${why} (${kind})`);
        result.issues.push([why]);
        return { ok: false, retry: true, why };
      }
      const why =
        e instanceof Anthropic.RateLimitError ? `요청 과다 (429)`
        : e instanceof Anthropic.APIError ? `API 오류 ${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error ? e.message : String(e);
      metric.issueCodes = ["api"];
      console.warn("[fortune llm] 호출 실패, 템플릿 사용:", why);
      result.issues.push([why]);
      result.transient = "api";
      return { ok: false, retry: false, why };
    }
  };

  // ---- 초안 (잘리거나 JSON이 깨지면 다시 쓰기) ----
  let draft: Draft | null = null;
  let issues: Issue[] = [];
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: briefJson }];
  let kind: FortuneCallMetric["kind"] = "draft";
  for (;;) {
    if (!canCall()) return finish(deadline - now() < MIN_CALL_MS ? "deadline" : issues.length ? "unresolved" : "json");
    const r = await call(kind, messages);
    if (!r.ok) {
      if (!r.retry) return finish("api");
      messages = rewriteMessages(briefJson, draft, ["앞 응답이 중간에 끊겨 JSON이 완성되지 않았어요. 생각은 짧게, 정해진 JSON만 완결되게 써요."]);
      kind = "rewrite";
      continue;
    }
    if (r.json === null) { result.issues.push(["모델이 거절함 (refusal)"]); return finish("refusal"); }
    const d = normalizeDraft(r.json);
    draft = d ? keepPlannedAreas(d, brief) : null;
    issues = checkDraft(draft, brief);
    r.metric.issueCodes = codesOf(issues);
    result.issues.push(issues.map((i) => i.msg));
    if (kind === "draft") result.metrics.firstPass = issues.length === 0;
    if (draft) result.lastDraft = draft;
    if (!issues.length || !needsRewrite(issues)) break;
    // 문장이 너무 적음·핵심 누락·JSON 아님 → 글 전체 다시 쓰기
    console.warn(`[fortune llm] 다시 쓰기 (${kind}): ${codesOf(issues).join(",")}`);   // 본문은 로그에 남기지 않는다 — 코드만
    messages = rewriteMessages(briefJson, draft, issues.map((i) => i.msg));
    kind = "rewrite";
  }

  // ---- 수리 (걸린 칸만, 남은 라운드·시간 안에서) ----
  let repairApiDown = false;
  while (issues.length && draft && canCall()) {
    console.warn(`[fortune llm] 수리 ${issues.length}건: ${issues.map((i) => `${i.code}@${unitId(i)}`).join(",")}`);
    const allowed = new Set(issues.filter((i) => i.field !== "whole").map(unitId));
    const r = await call("patch", repairMessages(briefJson, draft, issues));
    if (!r.ok) {
      if (!r.retry) { repairApiDown = true; break; }   // 수리 중 API 장애 — 지우기로 살릴 수 있으면 살린다
      continue;   // 수리 응답이 깨졌으면 같은 초안으로 다음 라운드(또는 지우기)
    }
    if (r.json === null) { r.metric.issueCodes = ["refusal"]; break; }
    const next = applyRepair(draft, r.json, allowed);
    const nextIssues = checkDraft(next, brief, KEEP);
    r.metric.issueCodes = codesOf(nextIssues);
    result.issues.push(nextIssues.map((i) => i.msg));
    // 수리가 전체 이슈(문장 너무 적음 등)를 만들면 그 수리는 버리고 앞 초안으로 지우기 단계에 간다
    if (needsRewrite(nextIssues)) break;
    draft = next;
    issues = nextIssues;
  }

  // ---- 그래도 걸린 본문 문장·영역 줄은 지운다 ----
  const fin = issues.length && draft ? pruneFailing(draft, brief) : draft;
  if (!fin) return finish(repairApiDown ? "api" : deadline - now() < MIN_CALL_MS && result.attempts < maxAttempts ? "deadline" : "unresolved");
  if (repairApiDown) delete result.transient;   // 글은 살았으니 하루 캐시에 써도 된다

  // ---- v4.10 문맥 검수 (기본 꺼짐). 문제는 인용이 든 칸만 한 번 수리하고, 고친 글도 같은 검사를 통과할 때만 쓴다 ----
  let out = fin;
  const rm = opts.reviewModel === undefined ? reviewModel() : opts.reviewModel;
  if (rm && deadline - now() >= MIN_CALL_MS) {
    try {
      const rv = await client.messages.create({ model: rm, max_tokens: 1024, system: [{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: reviewUser(out, brief) }] });
      const rvu = rv.usage; usage.input += rvu.input_tokens; usage.output += rvu.output_tokens; usage.cacheRead += rvu.cache_read_input_tokens ?? 0; usage.cacheWrite += rvu.cache_creation_input_tokens ?? 0;
      const problems = parseReview(rv.content.filter((x) => x.type === "text").map((x) => (x as { text: string }).text).join(""), out);
      if (!problems.length) result.review = { status: "통과", problems: [] };
      else {
        const asIssues: Issue[] = problems.flatMap((p) => { const t = problemTarget(p, out); return t ? [{ code: "review", ...t, msg: problemLine(p) }] : []; });
        const allowed = new Set(asIssues.map(unitId));
        const r = asIssues.length ? await call("patch", repairMessages(briefJson, out, asIssues)) : null;
        const fixed = r && r.ok && r.json ? applyRepair(out, r.json, allowed) : null;
        const fixIssues = fixed ? checkDraft(fixed, brief, KEEP) : [];
        if (r && r.ok) r.metric.issueCodes = codesOf(fixIssues);
        if (fixed && fixIssues.length === 0) { out = fixed; result.review = { status: "적용", problems: problems.map(problemLine) }; }
        else result.review = { status: "탈락", problems: problems.map(problemLine), why: fixed ? fixIssues.map((i) => i.msg).join(" / ") : "수리 호출 실패" };
        if (result.transient && r && !r.ok) delete result.transient;   // 검수 수리 실패는 초고로 산다
      }
    } catch (e) {
      result.review = { status: "탈락", problems: [], why: `검수 호출 실패: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const body = joinBody(out.body);
  result.text = { headline: out.headline, body, do: out.do, dont: out.dont };
  result.bodySentences = out.body;
  result.areaNarratives = out.areaLines.map((a) => ({ period: brief.areas.find((x) => x.area === a.area)!.period, area: a.area, text: a.text }));
  result.source = "llm";
  result.model = model;
  result.tags = tagsFromPlan(brief.plan, result.text, input.band);
  return finish();
}
