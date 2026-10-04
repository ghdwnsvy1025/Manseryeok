// 모델 호출 1회. 입력은 엔진이 계산한 사실 몇 줄뿐이라 2,000토큰을 넘지 않는다.
// 실패하면 예외를 던지고, 부르는 쪽이 템플릿 문장으로 대신한다.
import type { BaseFortune, PersonalAdjustment } from "./types";
import { personalLine, type TemplateText } from "./text";

export const FORTUNE_MODEL = process.env.OPENAI_FORTUNE_MODEL ?? "gpt-4o-mini";
/** 한국어 1자 ≈ 1~2토큰. 4,000자면 넉넉히 2,000토큰 안쪽 */
export const MAX_PROMPT_CHARS = 4000;

const SYSTEM = `당신은 사주 일기 앱의 작가입니다. 아래 "사실"만 가지고 오늘의 운세를 씁니다.

규칙
- 사실에 없는 합·충·십신·오행을 지어내지 않습니다. 미래 사건을 단정하지 않습니다.
- 전문용어를 쓰지 않습니다: 십신·용신·기신·일간·일지·합·충·오행 이름(목화토금수) 금지. 괄호 안 용어는 참고만 하고 생활어로 옮깁니다.
- 금지어: 기운, 흐름, 두근, "결".
- 어미는 "~어요/~해요"로 통일합니다. 반말, "~입니다", 명령형("~하세요/~보세요/~마세요") 금지. do와 dont도 "~해요/~않아요" 꼴로 씁니다 (예: "작은 목표 하나를 정해요", "큰 계획을 새로 세우지 않아요").
- 내 기록 사실(mine)이 있으면 body 첫 문장이나 둘째 문장에 반드시 반영합니다. 사주 사실과 다르면 기록 쪽을 따릅니다. 숫자는 그대로 쓰지 말고 "그런 날엔 보통 ~했어요"처럼 풀어 씁니다.
- 질병명·사고·돈 액수·연애 사건을 말하지 않습니다.
- headline 18자 이내, body 2~3문장 120자 이내, do와 dont는 각각 한 문장 25자 이내의 구체적 행동.
- 다른 날짜나 다른 사람에게 그대로 옮겨도 말이 되는 문장은 실패입니다. 사실의 조합이 드러나게 씁니다.

출력은 JSON 하나: {"headline":"","body":"","do":"","dont":""}`;

export interface PromptInput {
  base: BaseFortune;
  personal: PersonalAdjustment;
  today: { ko: string; hanja: string; stemKo: string; branchKo: string };
  weekday: string;
  score10: number;
}

export function buildUserPrompt(input: PromptInput): string {
  const mine = personalLine(input.personal, input.today.ko, input.today.stemKo, input.today.branchKo);
  const payload = {
    today: `${input.weekday} · ${input.today.ko}일(${input.today.hanja})`,
    score: `${input.score10}/10 (${input.score10 >= 6.8 ? "수월한 편" : input.score10 >= 4.8 ? "보통" : "조심할 편"})`,
    theme: input.base.family,
    facts: input.base.facts,
    mine: mine ?? "아직 기록 없음",
  };
  return JSON.stringify(payload, null, 0);
}

export async function generateWithModel(input: PromptInput): Promise<TemplateText> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 없음");
  const user = buildUserPrompt(input);
  if (SYSTEM.length + user.length > MAX_PROMPT_CHARS) throw new Error("프롬프트가 너무 깁니다");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: FORTUNE_MODEL,
        temperature: 0.6,
        max_tokens: 400,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fortune",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["headline", "body", "do", "dont"],
              properties: {
                headline: { type: "string" },
                body: { type: "string" },
                do: { type: "string" },
                dont: { type: "string" },
              },
            },
          },
        },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("빈 응답");
    const parsed = JSON.parse(content) as TemplateText;
    for (const k of ["headline", "body", "do", "dont"] as const) {
      if (typeof parsed[k] !== "string" || !parsed[k].trim()) throw new Error(`${k} 비어 있음`);
    }
    return { ...parsed, ...(json.usage ? { usage: json.usage } : {}) } as TemplateText & {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
  } finally {
    clearTimeout(timer);
  }
}
