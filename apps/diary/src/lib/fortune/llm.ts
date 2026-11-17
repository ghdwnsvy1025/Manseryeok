// 3단계 — 글 생성. Claude Sonnet 5 (Anthropic SDK). 설계: docs/FORTUNE_V4.md "3단계 — 글" · "v4.19".
// v4.19 (2026-10-31, ChatGPT 검토 반영): 사주 계산은 코드가 하고, 오늘 무엇을 말할지도 코드(plan.ts)가 고르고, 모델은 그걸 사람 말처럼 쓰는 데만 쓴다.
//   계획(plan.ts) → brief(brief.ts) → 초안 1회(구조화 출력 {headline, body[], areaLines, do, dont}) → 검사(validate.ts: 구조화 이슈)
//   → 걸린 칸·문장만 수리(한 번의 호출로 여러 항목 replace/delete) → 같은 검사 → 수리 최대 2라운드 → 그래도 걸린 영역 줄은 지운다(v4.20: 본문 문장은 지우지 않고 템플릿으로).
//   글 전체 다시 쓰기는 JSON 깨짐·잘림·문장이 너무 적음·핵심 누락일 때만. 초안 + 수리(또는 다시 쓰기) 합쳐 호출은 최대 3번(MAX_ATTEMPTS).
//   v4.14의 칸 고쳐 쓰기(PATCH: areas·do·dont)는 이 수리 틀로 합쳤다. 판단·태그 출력은 없앴다(태그가 필요하면 plan.tagsFromPlan).
// 규칙(system)은 고정이라 cache_control로 캐시한다. 샘플링 파라미터(temperature 등)는 보내지 않는다 — Sonnet 5는 400을 낸다.
// 검사를 통과하지 못한 모델 글은 어떤 경우에도 결과에 들어가지 않는다. 템플릿으로 떨어져도 그때까지 쓴 토큰·시간은 usage·metrics에 남는다.
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { BANNED_ALL, buildBrief, JARGON, renderBrief, TEN_GOD_NAMES, type BriefInput, type FortuneBrief } from "./brief";
import { renderExemplars } from "./exemplars";
import { planSummary, tagsFromPlan } from "./plan";
import { parseReview, problemLine, problemTarget, REVIEW_SYSTEM, reviewModel, reviewUser } from "./review";
import type { TemplateText } from "./text";
import type { FortuneTags } from "./examples";
import type { AreaName, AreaPeriod, FortuneCallMetric, FortuneMetrics, FortunePlanSummary } from "./types";
import { promptVersionV5, renderBriefV5, SYSTEM_V5 } from "./v5";
import { placeRecordLine } from "./recall";
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

/** 고정 규칙. 바꾸면 캐시가 다시 만들어진다 (날짜·사용자 정보는 넣지 않는다). v4.19: 글쓰기 철학 + 절대 금지 한 번만. 예시 세 편은 빠졌다(examples.ts는 베낌 검사용)
 *  v4.28 (2026-11-10): 앱 주인이 직접 쓴 글 6편을 본보기로 넣는다(exemplars.ts). "작가는 좋은 글을 한 편도 본 적이 없다"가 시안 7편이 규칙 모양으로 나온 까닭이었다.
 *  규칙은 "본보기에서 배울 것" 8조로 줄였고, 입력은 까닭·장면·비유(renderBrief)로 바뀌었다. 본보기가 캐시되므로 토큰 부담은 작다
 *  v4.27 (2026-11-10, 지적 원장 묶음 1 — 피드백/작가입력_재설계_2026-11-10.md): 두 문단(사주 층 → 생활 층+해결+응원), 문장마다 무엇을·어디서, 접속사로 잇기,
 *  이론을 쉬운 말로 드러내기, 결과는 가능성으로, 읽는 사람을 깎는 말 금지. 출력은 first·second 두 배열 */
export const SYSTEM = `당신은 일기 앱 "사주읽는밤"의 오늘 운세 작가입니다. 사주 계산은 코드가 하고 user의 JSON(단계·나·오늘글자·까닭·장면·비유·영역)으로 보냅니다. 당신은 맨 아래 [본보기]처럼 씁니다. 본보기는 이 앱 주인이 직접 쓴 글이고, 그 글의 문장 단위·순서·어조·길이가 기준입니다. 규칙보다 본보기가 먼저입니다.

[본보기에서 배울 것]
1. 한 문장은 장면 하나와 그때의 마음입니다. "주변 사람들이 성취해 내는 것을 보면 조바심이 들 수 있는 하루예요"처럼. 기운 이름이나 판정("세지기 쉬운 날이에요")으로 문장을 만들지 않습니다. 문장마다 무엇을·어떤 일에서가 보입니다.
2. 순서: 장면 → 마음 → 좋게 풀리면 / 나쁘게 가면 → 예를 들어 → 반대로 → 하지만 결론 → 응원 한마디. 접속사(그래서·그러다 보니·한편·하지만·예를 들어·즉·그렇기 때문에)로 사건을 잇습니다.
3. 사주 까닭은 한 편에 한두 번, 결과 바로 앞에 짧게 씁니다. "재물의 기운이 약하기 때문에 돈이 나갈 일이", "고집이 강해지는 기운도 들어오지만 여유로운 기운도 같이". 까닭 칸의 문장을 그대로 옮기지 않고, 사주 용어 원어는 쓰지 않습니다.
4. 장면·비유 재료는 문장 속에 녹입니다. 비유는 한 편에 하나면 충분합니다(스포츠카처럼 달리다 사고, 능구렁이처럼 빠져나가기, 벼락치기).
5. 어조는 확신 있게. "강해져요", "유리한 날이에요", "분명 빛을 발할 수 있는 날", "~입니다", "~하세요"가 됩니다. "~기 쉬워요", "~수 있어요"를 문장마다 겹치지 않습니다. 단정("반드시·틀림없이")과 일어난 일처럼 지어내기("퇴근길에 쇼핑몰에 들렀어요")만 안 됩니다.
6. 좋은 점은 부각하고 조심할 점은 해결법으로 닫습니다. 주의인 날도 마지막은 응원입니다. 읽는 사람을 깎는 말("남들", "거슬린다", "끼어든다")은 쓰지 않습니다.
7. 같은 뜻은 한 번. 전체 6~8문장. first(첫째 문단) 3~5문장, second(둘째 문단) 2~4문장. 영역은 화면에 화살표로 따로 보이니 문장을 따로 쓰지 않고 둘째 문단에 녹입니다.
8. 본보기 문장을 그대로 베끼지 않습니다. 같은 성격의 날이라도 오늘의 장면·영역·각도로 새로 씁니다. 오늘의각도가 있으면 첫째 문단에서 그 이야기를 꺼냅니다(문구 그대로는 아님). 피할것의 최근 제목·하면·마무리와 같은 말은 쓰지 않습니다.

[출력]
- headline: 40자 안, 첫째 문단의 결론 한 구절. 본보기 제목처럼 단정형("고집이 강해지는 날", "바쁘지만 알찬 하루").
- first, second: 문장 배열(원소 하나에 한 문장, 140자 안).
- do: 해결법 한 줄 명령(60자 안, "계획한 것을 차근차근 해치워 보세요"). dont: 세지는 쪽을 누르는 한 줄(60자 안, "자신을 달달 볶지 마세요"). 본문 문장을 그대로 옮기지 않고, dont는 do를 뒤집은 말이 아닙니다.

[절대 쓰지 않는 것]
- 낱말: ${BAN_WORDS}.
- "A와 B"꼴 성격 이름("경쟁과 추진"), 속말("판정·원국·내부 판단·코드"), 명령형 반말·"~십시오", 기간 약속("3일 더 하면"), 넘겨짚기("~한 적 있으시죠"), 되받기("앞에서 말한"), 정의문("A와 B를 합쳐 C라 해요").
- 질병·실제 사고의 단정·돈 액수·연애 사건, 직장 장면(회의·출근·상사·동료·업무), 점수와 내 기록 이야기("N점", "기록했·평균·N번"), 계획.숫자에 없는 숫자, 이모지·한자·영문자, 요일·날짜·시간대(아침·저녁 등). 계획.절기첫날이 있을 때만 그 이름을 분위기로 한 번.

[본보기 — 앱 주인이 쓴 글. 입력은 지금 받는 JSON의 핵심 칸만 추린 것]
${renderExemplars()}`;

/** 구조화 출력 스키마 (v4.19: 작가 칸만. v4.20: 영역 줄은 모델이 쓰지 않는다 — 화면이 코드 상태말과 화살표로) */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "first", "second", "do", "dont"],
  properties: {
    headline: { type: "string" },
    first: { type: "array", items: { type: "string" } },
    second: { type: "array", items: { type: "string" } },
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
export const PROMPT_VERSION = `v4.28-${createHash("sha256").update(SYSTEM + JSON.stringify(OUTPUT_SCHEMA) + JSON.stringify(REPAIR_SCHEMA)).digest("hex").slice(0, 8)}`;

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
  opts: { timeoutMs?: number; maxTokens?: number; now?: () => number; /** v5: 편집자 지시(SYSTEM_V5). 없으면 SYSTEM */ system?: string } = {},
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
        system: [{ type: "text", text: opts.system ?? SYSTEM, cache_control: { type: "ephemeral" } }],
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
    content: `${briefJson}\n\n[수리] 아래 글은 대부분 검사를 통과했고, 표시한 항목만 걸렸어요. (body.N은 첫째·둘째 문단을 이어 붙인 번호예요.) 항목마다 사유를 없앤 새 문장으로 바꾸거나(replace), 본문 문장·영역 줄은 지울 수도 있어요(delete — text는 빈 문자열). 제목·do·dont는 지우지 않아요. 고친 문장은 앞뒤와 자연스럽게 이어지고, 낱말만 바꾸지 말고 걸린 까닭을 없애요. 표시하지 않은 칸은 돌려주지 않아요.\n제목: ${d.headline}\n고칠 항목: ${JSON.stringify(items)}`,
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
  // 바꾼 문장에 문장이 둘 들었으면 나눈다 (normalizeDraft와 같은 규칙). v4.27: 문단 경계(split)도 같이 옮긴다
  const pieces = out.body.map((s, i) => (dropBody.has(i) ? [] : normalizeDraft({ body: [s] })!.body));
  if (out.split !== undefined) { const before = pieces.slice(0, out.split).reduce((n, p) => n + p.length, 0); if (before > 0) out.split = before; else delete out.split; }
  out.body = pieces.flat();
  out.areaLines = out.areaLines.filter((_, i) => !dropArea.has(i));
  return out;
}

/** 수리 라운드가 끝났는데도 걸린 영역 줄을 지운다. v4.20: 영역 줄 말고 다른 칸(본문 포함)이 걸려 있으면 null — 본문 문장은 지우지 않는다 */
export function pruneFailing(d: Draft, brief: FortuneBrief): Draft | null {
  let cur = d;
  for (let n = 0; n < 6; n++) {
    const issues = checkDraft(cur, brief, KEEP);
    if (!issues.length) return cur;
    // v4.20: 본문 문장은 지우지 않는다 — A→B→C에서 B를 지우면 A→C로 비약이 생긴다. 본문이 걸려 있으면 템플릿으로
    if (issues.some((i) => i.field !== "area")) return null;
    const dropA = new Set(issues.filter((i) => i.field === "area").map((i) => i.index!));
    cur = { ...cur, areaLines: cur.areaLines.filter((_, i) => !dropA.has(i)) };
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
  // v5: 단락 사전 글감이 있으면 편집자 지시와 그 입력으로 (compose.ts · v5.ts). 호출·수리·검사의 틀은 같다
  const system = brief.v5 ? SYSTEM_V5 : SYSTEM;
  const briefJson = brief.v5 ? renderBriefV5(brief) : renderBrief(brief);
  const briefMs = now() - t0;
  const model = opts.model ?? fortuneModel();
  const fixModel = opts.patchModel ?? patchModel(model);
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const deadline = t0 + (opts.deadlineMs ?? TOTAL_DEADLINE_MS);
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const calls: FortuneCallMetric[] = [];
  const result: GenerateResult = {
    text: fallback, source: "template", attempts: 0, patches: 0, model: null, issues: [], usage, plan: planSummary(brief.plan),
    metrics: { promptVersion: brief.v5 ? promptVersionV5(brief.v5.dict) : PROMPT_VERSION, briefMs, llmMs: 0, calls, firstPass: false },
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
      const json = await callModel(client, m, messages, usage, metric, kind === "patch" ? REPAIR_SCHEMA : OUTPUT_SCHEMA, { timeoutMs: Math.max(1000, Math.min(CLIENT_OPTIONS.timeout, deadline - now())), maxTokens: kind === "patch" ? REPAIR_MAX_TOKENS : MAX_TOKENS, now, system });
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

  // 2026-11-17 기록 반영: 편집자가 기록 한 줄을 뺐으면 코드가 둘째 문단 마무리 앞에 그대로 넣는다(앱 주인 "빠지면 코드가 넣기")
  if (brief.v5?.내기록) out = { ...out, body: placeRecordLine(out.body, out.split, brief.v5.내기록) };
  const body = joinBody(out.body, out.split);
  result.text = { headline: out.headline, body, do: out.do, dont: out.dont };
  result.bodySentences = out.body;
  result.areaNarratives = out.areaLines.map((a) => ({ period: brief.areas.find((x) => x.area === a.area)!.period, area: a.area, text: a.text }));
  result.source = "llm";
  result.model = model;
  result.tags = tagsFromPlan(brief.plan, result.text, input.band);
  return finish();
}
