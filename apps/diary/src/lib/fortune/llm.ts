// 3단계 — 글 생성. Claude Sonnet 5 (Anthropic SDK). 설계: docs/FORTUNE_V4.md "3단계 — 글".
//   brief(brief.ts) → 모델 1회(구조화 출력 JSON) → 검사(validate.ts) → 탈락이면 사유를 붙여 1회 재작성 → 또 탈락이면 템플릿(text.ts).
// 규칙(system)은 고정이라 cache_control로 캐시한다. 샘플링 파라미터(temperature 등)는 보내지 않는다 — Sonnet 5는 400을 낸다.
// 검사를 통과하지 못한 모델 글은 어떤 경우에도 결과에 들어가지 않는다.
import Anthropic from "@anthropic-ai/sdk";
import { buildBrief, renderBrief, type BriefInput, type FortuneBrief } from "./brief";
import type { TemplateText } from "./text";
import { validateFortuneText, type ModelText } from "./validate";

export const DEFAULT_FORTUNE_MODEL = "claude-sonnet-5";
/** 환경변수 FORTUNE_MODEL로 덮어쓴다 (날짜 접미사 없는 ID) */
export const fortuneModel = (): string => process.env.FORTUNE_MODEL?.trim() || DEFAULT_FORTUNE_MODEL;
export const MAX_ATTEMPTS = 2;

/** 고정 규칙. 바꾸면 캐시가 다시 만들어진다 (날짜·사용자 정보는 넣지 않는다) */
export const SYSTEM = `당신은 "사주읽는밤" 일기 앱의 작가입니다. 사용자(user)로 오는 JSON brief만 가지고 오늘의 운세 글을 씁니다. brief에 없는 사실·숫자·사건은 만들지 않습니다.

[역할]
- brief.facts는 엔진이 계산한 오늘의 사실이고, brief.areas는 오늘 신호가 있는 생활 영역, brief.keywords는 오늘 글자에 붙는 낱말, brief.caveats는 단서, brief.personal·brief.mine은 이 사람의 기록 숫자입니다.
- 하루의 방향을 조용히 읽어 주는 글입니다. 점을 쳐 주는 글이 아닙니다.

[톤]
- 다음 낱말은 어떤 자리에서도 쓰지 않습니다: "기운", "흐름", "결", "두근". "올해의 흐름", "10년 단위의 흐름"처럼 운을 말할 때도 "올해 운", "지금 10년 단위 운", "힘", "방향", "속도", "분위기"로 바꿔 씁니다.
- 어미는 "~어요/~해요/~예요/~돼요"로 통일합니다. 반말, "~입니다", 명령형("~하세요/~보세요/~마세요/~십시오")은 쓰지 않습니다. do와 dont도 "~해요/~않아요" 꼴입니다.
- 이모지·한자·특수문자 장식을 쓰지 않습니다. 간지는 brief에 적힌 한글 그대로만 씁니다.
- 좋다/나쁘다를 단정하지 않습니다. "반드시·틀림없이·무조건·절대"를 쓰지 않습니다. 질병·사고·돈 액수·연애 사건을 말하지 않습니다.
- 기간을 약속하지 않습니다 ("3일 더 쓰면 ~해져요" 같은 문장 금지).
- 같은 성격이 하루에 두 번 올 때(brief.facts의 "아주 강해요")는 "겹친다·두 번"이라 하지 않고 "아주 강하다·세다"로만 말합니다.
- 전문용어를 쓰지 않습니다: brief.jargon의 낱말(십신·용신·기신·일간·일지·천간·지지·오행·삼합·육합·대운·세운, 비견~정인 같은 이름)은 괄호 안에서도 쓰지 않습니다. brief.banned의 낱말도 쓰지 않습니다.
- 숫자는 brief.allowedNumbers에 있는 것만 씁니다. 시각("오전 7시"), 횟수, 금액, 퍼센트를 새로 만들지 않습니다. 시간대는 "아침·점심·저녁·밤"처럼 말로만 씁니다.
- 점수는 화면에 있으니 글에 쓰지 않습니다. brief.score.value를 글에 적지 않고, "6.3점", "10점 만점" 같은 점수 표현을 만들지 않습니다 (brief.mine의 기록 평균 "평균 7.5점"은 예외로 그대로 씁니다).

[구성 — JSON 하나]
- headline: 12자 안팎 한 구절. 오늘의 느낌을 사실 하나와 묶어서. 다른 날에도 그대로 쓸 수 있는 말이면 실패입니다.
- body: 4~6문장. 사실들을 번호 매기듯 나열하지 말고 아침부터 밤까지 하나의 하루 흐름으로 잇습니다. 아침·점심·저녁 중 한 장면을 구체적으로 하나 넣습니다(장소나 행동이 보이게, 단 숫자 없이). 같은 문형을 되풀이하지 않습니다. 사실의 조합이 드러나야 합니다 — 오늘이 나에게 어떤 쪽의 날인지, 올해·이달·지금 10년 단위의 운과 어떻게 겹치는지가 한 흐름 안에 자연스럽게 들어갑니다. **"글자" 이야기는 하지 않습니다**: "윗글자·아랫글자·오늘 글자·내 글자·태어난 날 글자·부딪히다·맞서다·한편이다" 같은 사주 구조 설명을 쓰지 말고, 그 결과만 생활어로 말합니다(예: "오늘은 경쟁심이 세지는 날이라" / "올해 운과 겹쳐 조급해지기 쉬워요"). 근거는 화면이 따로 보여 주므로 글에 넣지 않습니다.
- body에 brief.mine이 있으면 그 숫자를 그대로 넣은 "내 숫자 한 문장"을 꼭 씁니다 (예: "지난 임자일 3번은 평균 7.5점이었어요"). brief.mine이 null이면 기록·평균·횟수 이야기를 하지 않습니다.
- areas: brief.areas와 개수·순서·period·area 이름이 똑같은 배열. 각 line은 그 영역의 한 문장(1문장, 신호 ↑→↓의 뜻을 말로). period가 "오늘"이면 오늘 이야기, "이달"이면 "이달엔"으로 시작하는 1문장, "올해"면 "올해는"으로 시작하는 1문장. line은 본문 첫 문장을 되풀이하지 않습니다. brief.areas가 비어 있으면 [].
- do: 오늘 하면 좋은 구체적 행동 1문장. dont: 오늘 피하면 좋은 구체적 행동 1문장. 둘 다 사실과 연결되어야 합니다.

[표현]
- 매끄럽고 자세하게. 짧은 문장과 긴 문장을 섞습니다. 간지 이름("임자일")은 날짜처럼 한 번만 써도 되고, 글자 단위("임", "자")로는 쓰지 않습니다.`;

/** 구조화 출력 스키마 */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "body", "areas", "do", "dont"],
  properties: {
    headline: { type: "string" },
    body: { type: "string" },
    areas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["period", "area", "line"],
        properties: {
          period: { type: "string", enum: ["오늘", "이달", "올해"] },
          area: { type: "string", enum: ["대인", "재물", "직업", "학업", "연애", "가족", "건강"] },
          line: { type: "string" },
        },
      },
    },
    do: { type: "string" },
    dont: { type: "string" },
  },
} as const;

export interface GenerateResult {
  text: TemplateText;
  source: "llm" | "template";
  /** 모델을 부른 횟수 (0이면 부르지 않았다) */
  attempts: number;
  /** source가 llm일 때 모델 ID, 아니면 null */
  model: string | null;
  /** 시도마다 검사에서 걸린 사유. 통과하면 빈 배열 */
  issues: string[][];
  /** 마지막 모델 응답 원문 (검사 실패 분석용) */
  lastModelText?: ModelText;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export interface GenerateOptions {
  client?: Anthropic;
  /** 기본 2 (첫 글 + 재작성 1회). 샘플 스크립트처럼 호출 수를 묶을 때 1 */
  maxAttempts?: number;
  model?: string;
}

/** 한 번 호출해 JSON을 돌려준다. refusal이면 null */
export async function callModel(
  client: Anthropic,
  model: string,
  messages: Anthropic.MessageParam[],
  usage: GenerateResult["usage"],
  attempt: number,
): Promise<ModelText | null> {
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });
  const u = response.usage;
  usage.input += u.input_tokens;
  usage.output += u.output_tokens;
  usage.cacheRead += u.cache_read_input_tokens ?? 0;
  usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
  console.info(`[fortune llm] ${model} attempt=${attempt} in=${u.input_tokens} out=${u.output_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} stop=${response.stop_reason}`);
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text");
  if (!text) throw new Error("모델 응답에 text 블록이 없음");
  return JSON.parse(text.text) as ModelText;
}

/** 재작성 요청: 이전 글과 탈락 사유를 붙인다 */
export function rewriteMessages(briefJson: string, prev: ModelText | null, issues: string[]): Anthropic.MessageParam[] {
  const prevText = prev ? JSON.stringify(prev) : "(JSON 파싱 실패)";
  return [
    {
      role: "user",
      content: `${briefJson}\n\n[재작성] 바로 앞에 쓴 글이 검사에서 걸렸어요. 아래 사유를 모두 고쳐 같은 brief로 다시 써요. 고치지 않은 부분도 규칙에 맞게 다듬어요.\n이전 글: ${prevText}\n탈락 사유:\n- ${issues.join("\n- ")}`,
    },
  ];
}

/**
 * 글 파이프라인. 모델 글이 검사를 통과하면 그것, 아니면 fallback(템플릿).
 * 키가 없거나 API 오류면 예외 없이 템플릿으로 떨어진다 (사유는 issues에 남긴다).
 */
export async function generateFortuneText(input: BriefInput, fallback: TemplateText, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const brief: FortuneBrief = buildBrief(input);
  const briefJson = renderBrief(brief);
  const model = opts.model ?? fortuneModel();
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const result: GenerateResult = { text: fallback, source: "template", attempts: 0, model: null, issues: [], usage };

  const client = opts.client ?? (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null);
  if (!client) {
    result.issues.push(["ANTHROPIC_API_KEY 없음"]);
    return result;
  }

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: briefJson }];
  let prev: ModelText | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result.attempts = attempt;
    let parsed: ModelText | null;
    try {
      parsed = await callModel(client, model, messages, usage, attempt);
    } catch (e) {
      const why =
        e instanceof Anthropic.RateLimitError ? `요청 과다 (429)`
        : e instanceof Anthropic.APIError ? `API 오류 ${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error ? e.message : String(e);
      console.warn("[fortune llm] 호출 실패, 템플릿 사용:", why);
      result.issues.push([why]);
      return result;
    }
    if (parsed === null) {
      result.issues.push(["모델이 거절함 (refusal)"]);
      return result;
    }
    result.lastModelText = parsed;
    const issues = validateFortuneText(parsed, brief);
    result.issues.push(issues);
    if (issues.length === 0) {
      result.text = { headline: parsed.headline, body: parsed.body, do: parsed.do, dont: parsed.dont, ...(parsed.areas.length ? { areas: parsed.areas.map((a, i) => ({ period: brief.areas[i]!.period, area: a.area, signal: brief.areas[i]!.signal, line: a.line })) } : {}) };
      result.source = "llm";
      result.model = model;
      return result;
    }
    console.warn(`[fortune llm] 검사 탈락 (attempt ${attempt}):`, issues.join(" / "));
    prev = parsed;
    messages = rewriteMessages(briefJson, prev, issues);
  }
  return result;
}
