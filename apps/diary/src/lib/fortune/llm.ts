// 3단계 — 글 생성. Claude Sonnet 5 (Anthropic SDK). 설계: docs/FORTUNE_V4.md "3단계 — 글".
//   brief(brief.ts) → 모델 1회(구조화 출력 JSON) → 검사(validate.ts) → 탈락이면 사유를 붙여 1회 재작성 → 또 탈락이면 템플릿(text.ts).
//   v4.14 (10-c): 탈락 사유가 한 칸(areas[i]·do·dont)에만 있으면 글 전체가 아니라 그 칸만 다시 쓰게 한다(PATCH_SCHEMA, 본문·headline·핵심은 앞 글 그대로).
//   되풀이 검사(v4.9)가 재작성의 1위 사유인데 본문은 통과한 글이라, 통째로 다시 쓰면 새 본문이 다른 검사에 걸려 템플릿까지 떨어지던 것(3차 말뭉치 C 10-16).
//   v4.15 (2026-10-23, docs/FORTUNE_V4.md v4.15): 본문은 blocks 4개(근거·원리/성향·사례·처방, 순서 자유)로 받고 joinBlocks로 body를 만든다. 코어 말투 규칙은 validate.validateBlocks.
// 규칙(system)은 고정이라 cache_control로 캐시한다. 샘플링 파라미터(temperature 등)는 보내지 않는다 — Sonnet 5는 400을 낸다.
// 검사를 통과하지 못한 모델 글은 어떤 경우에도 결과에 들어가지 않는다.
import Anthropic from "@anthropic-ai/sdk";
import { buildBrief, renderBrief, type BriefInput, type FortuneBrief } from "./brief";
import type { TemplateText } from "./text";
import { FORTUNE_EXAMPLES, joinBlocks, type FortuneJudge, type FortuneTags } from "./examples";
import { validateFortuneText, slotIssues, LIMITS, type ModelText, type SlotIssues } from "./validate";
import { REVIEW_SYSTEM, reviewUser, parseReview, problemLine, reviewRewriteContent, reviewModel } from "./review";

export const DEFAULT_FORTUNE_MODEL = "claude-sonnet-5";
/** 환경변수 FORTUNE_MODEL로 덮어쓴다 (날짜 접미사 없는 ID) */
export const fortuneModel = (): string => process.env.FORTUNE_MODEL?.trim() || DEFAULT_FORTUNE_MODEL;
/** v4.5: 3 (첫 글 + 재작성 2회). 예시 베낌·반전 말 검사가 늘어 2회로는 템플릿 비율이 12%였다. 탈락할 때만 호출이 늘어난다 */
export const MAX_ATTEMPTS = 3;

const NL = String.fromCharCode(10);

/** 고정 규칙. 바꾸면 캐시가 다시 만들어진다 (날짜·사용자 정보는 넣지 않는다) */
export const SYSTEM = `당신은 "사주읽는밤" 일기 앱의 작가입니다. 사용자(user)로 오는 JSON brief만 가지고 오늘의 운세 글을 씁니다. brief에 없는 사실·숫자·사건은 만들지 않습니다.

[목적]
사주 이론을 설명하는 운세가 아니라, 사주 이론을 바탕으로 실제 하루를 설명하는 운세를 씁니다. 핵심은 "오늘 어떤 사주 요소가 들어왔는가"가 아니라 "그 결과 오늘 이 사람에게 어떤 마음·행동·상황이 나타나기 쉬운가"입니다. 읽는 사람이 사주 용어를 하나도 몰라도 "오늘은 이런 마음이 들 수 있겠구나, 그래서 이렇게 하면 되겠구나"가 바로 보여야 합니다.

[brief 읽는 법]
- brief.inside는 내부 판단입니다 — 본문에 쓰지 않습니다. inside.tenGods[]는 오늘 들어온 기운마다 이름·뜻·읽기(활용 = 잘 되는 쪽, 보통, 과함 = 지나치기 쉬운 쪽, 보류)와 생활 표현 후보(expressions)입니다. inside.fit은 전체 판정, inside.need는 내게 필요한 기운, inside.facts는 엔진 사실, inside.context는 이달·올해 운의 방향, inside.direction은 단계별 조언 방향입니다.
- brief.avoid는 최근에 쓴 것입니다: tags = 최근 7일 의미 태그(날짜별), headlines = 최근 14일 제목, scenes = 최근 7일 장면. 같은 뜻을 표현만 바꿔 다시 쓰면 실패입니다.
- brief.areas는 엔진이 신호를 낸 생활 영역 전부(오늘 → 이달 → 올해). brief.mine은 이 사람의 기록 숫자, brief.today.weekday·solarTerm은 요일과 24절기, brief.score.band는 단계(좋음·무난·주의)입니다.

[쓰는 순서 — JSON 칸 순서대로, 글보다 먼저 정합니다]
1. 판단.후보: inside를 읽고 오늘 나타날 수 있는 생활 변화 후보 3~5개를 한 줄씩 (예: "미뤄 둔 약속·돈 문제가 정리되기 쉬움", "혼자 판단할수록 생각이 길어짐"). inside.tenGods[].expressions를 참고하되 그대로 옮기지 말고 오늘 상황으로 씁니다.
2. 판단.핵심: 그중 가장 영향력이 큰 하나를 한 문장으로 ("미뤄 둔 일을 정리하기 좋은 날"). 하루의 핵심은 하나입니다. 핵심과 관련 없는 사주 정보는 맞는 정보라도 본문에서 뺍니다.
3. 판단.이유: 왜 그것이 핵심인지, 둘째 기운을 쓸지 — 둘째 기운은 첫째를 강하게 하거나, 누그러뜨리거나, 중요한 주의점을 만들거나, 결과 방향을 실제로 바꿀 때만 씁니다. 데이터에 있다는 이유만으로 설명하지 않습니다. 판단.둘째기운에 "안 씀" 또는 쓴 까닭을 적습니다.
4. 판단.운맥락: 이달·올해 운(inside.context)은 오늘 흐름을 강하게 하거나, 반대라서 결과를 조절하거나, 오늘 행동 결정에 실제로 중요할 때만 본문에 한 번 녹입니다. 같은 방향이면 "안 씀". 영역 줄로 따로 쓰지 않습니다.
5. 판단.구조: 본문 구조를 오늘에 맞게 고릅니다 — A 오늘의 핵심 → 상황 → 행동 조언 / B 생활 사례 → 오늘의 성향 → 행동 조언 / C 감정 변화 → 관계나 일에서 나타나는 모습 → 조언 / D 주의할 상황 → 이유 → 해결 방법 / E 오늘 잘 되는 것 → 활용 방법 → 주의점. 매일 같은 구조를 쓰지 않습니다.
6. 태그: 이 글의 뜻을 짧은 명사구로 8칸 — 주제·감정·상황·영역·장면·권장·피할·제목뜻. 검사기가 avoid.tags와 비교합니다: 어느 하루와 2칸 이상 같은 뜻이면 실패(표현만 바꾼 것은 같은 뜻 — "혼자 생각이 길어져요"와 "고민이 길어져요"는 같습니다). 같은 흐름이 실제로 다시 오면 핵심 사실을 억지로 바꾸지 말고 생활 영역·장면·행동을 바꿉니다("결정 전 고민이 길어짐" → "별뜻 없는 말을 혼자 곱씹음" → "정보를 더 찾느라 시작이 늦어짐" → "쉬는 시간에도 할 일을 계속 생각함").
7. headline: 20자 안, 오늘 체감할 내용 ("중요한 말은 한 번 다듬어 보내는 날", "오늘은 계획보다 회복이 먼저예요", "결정하기 전에 한 번 더 확인하는 날"). "실속이 쌓이는 날·기회가 열리는 날·좋은 기운이 들어오는 날·돈 기운이 좋은 날"처럼 사주 이론이나 기운을 말하는 제목은 실패. avoid.headlines(14일)와 뜻이 같으면 다른 각도.
8. body: 4~7문장, 2~3문단(빈 줄 "\n\n"). 고른 구조대로 핵심이 마음·행동·상황으로 어떻게 나타나는지, 그래서 오늘 어떻게 하면 되는지. 단계(brief.score.band)는 톤과 조언 방향을 정하는 내부 정보입니다 — 좋음: 적극적으로 해도 좋은 방향("미뤄 둔 일을 처리해 봐요", "먼저 연락해도 괜찮아요") / 무난: 조건을 붙여 조절("서두르지만 않으면 무난하게 지나가요") / 주의: 새 행동보다 실수 방지와 조절("바로 결정하기보다 한 번 더 확인하는 편이 좋아요", "기분이 올라온 상태에선 중요한 말을 조금 미뤄요").
9. areas: brief.areas 가운데 오늘 핵심에 실제로 뜻이 있는 0~3개만 골라(같은 순서·area·period 그대로, 나머지는 뺍니다) 각각 오늘 행동으로 한 문장. 모든 영역을 매일 채우지 않습니다. 본문 문장을 되풀이하지 않습니다.
10. do(하면)·dont(피해요): 각각 한 문장의 구체 행동. 본문의 조언을 그대로 되풀이하지 않고 다른 행동을 제안합니다(본문이 "감정이 올라온 상태에선 답장을 바로 보내지 않는 편이 좋아요"면 do는 "중요한 대화가 있다면 전달할 핵심을 두 줄 적어 봐요", dont는 "상대의 짧은 답장을 나쁜 뜻으로 단정하지 않아요"). dont는 do를 뒤집은 말이 아닙니다. 조언·do·dont가 핵심 없이도 성립하는 말("오늘도 힘내요", "마음을 편히 가져요", "무리하지 않아요")이면 실패입니다 — 아무 날에나 맞는 말은 쓰지 않습니다.

[본문에 쓰지 않는 것 — 하나라도 있으면 실패]
- 십신 이름(비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인), 오행 이름(목·화·토·금·수 기운), brief.jargon의 낱말, "A와 B"꼴 성격 이름("경쟁과 추진", "기회와 확장"). 괄호 안에서도 쓰지 않습니다.
- 판정 문장: "내게 맞는 편이에요", "안 맞는 날", "내게 모자란 토가 채워져요", "이미 넉넉한 쪽이 더해져요", "실속을 챙기는 힘이 들어와요", "기운이 나를 거들어 줘요", "과해지기 쉬워요". 내부 판단은 결과로만 말합니다 — "내게 이미 넉넉한 비견이 들어와 과해지기 쉬워요" ✗ → "오늘은 남에게 맡기기보다 혼자 처리하고 싶은 마음이 강해질 수 있어요. 일이 많다면 혼자 다 끌어안지 않는 게 중요해요" ○.
- 비유·함축: "손에 붙어요", "자리가 넓어져요", "기운이 거들어 줘요", "실속이 채워져요", "좋은 신호가 들어와요", "돈 기운이 움직여요", "흐름이 열려요" — 사람이 실제로 느끼거나 하는 말로 ("일이 손에 잘 붙어요" → "미뤄 둔 일을 시작해도 생각보다 집중이 오래갈 수 있어요" / "돈 기회가 열려요" → "평소라면 지나쳤을 할인·제안·부수입 정보를 눈여겨보게 될 수 있어요").
- 생·극 설명("누르다·극하다·생하다"), 구조 설명("글자·부딪히다·맞서다·한편이다"), 이름 없는 추상어("부족한 쪽", "넘치는 힘"), 사물 비유(볕·바위·등불·물통·불씨), 되받기("앞에서 말한"), 정의문("A와 B를 합쳐 C라 해요"), 결과 약속("그러면 ~해져요"), 넘겨짚기("~한 적 있으시죠"), 속으로 쓰는 말("판정·원국·무대·블록·핵심 후보").
- 다음 낱말은 어떤 자리에서도 쓰지 않습니다: "흐름" → "방향·분위기·하루", "결" → "성격·느낌", "두근" → "설레다", "세운·대운·월운" → "올해 운·지금 10년 단위 운·이달 운".

[톤·문장]
- 어미는 "~어요/~해요/~예요/~돼요"로 통일합니다. 반말, "~입니다/~됩니다", 명령형("~하세요/~보세요/~마세요")은 쓰지 않습니다 — 권유는 "~해 봐요", "~하는 편이 좋아요", "~하지 않는 게 좋아요"로. do와 dont도 "~해요/~않아요" 꼴입니다.
- 한 문장 12~70자, 85자를 넘기지 않습니다. 짧은 문장과 긴 문장을 섞습니다. 같은 낱말을 본문에서 세 번 넘게 쓰지 않습니다. '그래서'는 본문에 한 번까지, 첫 문장을 이음말로 시작하지 않습니다.
- 이모지·한자·특수문자 장식을 쓰지 않습니다. 좋다/나쁘다를 단정하지 않습니다("반드시·틀림없이·무조건·절대" 금지). 질병·사고·돈 액수·연애 사건을 말하지 않습니다. 기간을 약속하지 않습니다("3일 더 쓰면 ~해져요").
- 숫자는 brief.allowedNumbers에 있는 것만. 시각·횟수·금액·퍼센트를 새로 만들지 않습니다. 점수는 화면에 있으니 글에 쓰지 않습니다("6.3점", "10점 만점" 금지. brief.mine의 "평균 7.5점"은 예외).
- 절기 이름은 brief.today.useSolarTerm이 true인 날(절기 첫날)에만 한 번. 요일은 꼭 필요할 때만 한 번. 글을 절기나 요일로 시작하지 않습니다. "특별한·남다른·다른 날과 달리·차별"은 쓰지 않습니다. 직장 장면(거래처·제안서·회의·출근·상사·동료·업무)은 쓰지 않습니다 — 학생·주부·쉬는 사람도 읽습니다. 아침·점심·저녁·밤을 차례로 늘어놓지 않습니다.
- brief.score.band가 "주의"인 날은 오늘 이야기에 "풀리다·수월하다·순조롭다·술술" 같은 반전 말을 쓰지 않습니다. "좋음"인 날도 들뜨게 부풀리지 않습니다.
- brief.mine이 있으면 그 숫자를 그대로 넣은 "내 숫자 한 문장"을 본문 어딘가에 꼭 씁니다("지난 임자일 3번은 평균 7.5점이었어요"). null이면 기록·평균·횟수 이야기를 하지 않습니다.
- 올해·10년 단위 운은 brief.facts에 그 문장이 있는 날에만, 그것도 오늘 행동을 바꿀 때만 한 번.
- brief.recent에 vote: -1("아니에요")인 날이 있으면 그날 헤드라인의 주제를 오늘 앞세우지 않습니다.

[마지막 검수 — 쓰고 나서 스스로 봅니다]
사주를 모르는 사람도 바로 이해되는가 / 오늘 가장 중요한 내용이 하나로 보이는가 / 한 문단 안에서 주제가 갑자기 바뀌지 않는가 / 최근 운세와 표현만 다르고 내용은 같지 않은가 / 전문용어·판정 문장이 남아 있지 않은가 / 사례가 핵심과 직접 이어지는가 / 하면·피해요가 본문을 되풀이하지 않는가 / 이달·올해 운이 굳이 필요 없는데 들어가 있지 않은가 / 오늘 어떻게 행동하면 되는지 보이는가 / AI 템플릿 문장처럼 읽히지 않는가.

[예시 — 톤과 구체성만 참고합니다. 예시의 headline·do·dont·문장을 그대로 쓰거나 조금만 바꿔 쓰면 실패입니다. 오늘 brief로 새로 쓰고, 구조도 오늘에 맞게 고릅니다]
${FORTUNE_EXAMPLES.map((e) => `(${e.band} · 내부 판단: ${e.facts})${NL}${JSON.stringify(e.text)}`).join(NL)}`;

/** v4.5: SYSTEM 안 예시 세 편 (검사기 통과를 테스트가 확인한다) */
export const SYSTEM_EXAMPLES = FORTUNE_EXAMPLES;

/** 구조화 출력 스키마 */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["판단", "태그", "headline", "body", "areas", "do", "dont"],
  properties: {
    // v4.16: 글보다 먼저 정하는 판단(후보 → 핵심 → 이유 → 둘째 기운 → 운 맥락 → 구조)과 의미 태그. 구조화 출력은 속성 순서대로 쓴다. 화면에는 안 나가고 캐시에 남는다
    판단: {
      type: "object",
      additionalProperties: false,
      required: ["후보", "핵심", "이유", "둘째기운", "운맥락", "구조"],
      properties: {
        후보: { type: "array", items: { type: "string" } },
        핵심: { type: "string" },
        이유: { type: "string" },
        둘째기운: { type: "string" },
        운맥락: { type: "string" },
        구조: { type: "string", enum: ["A", "B", "C", "D", "E"] },
      },
    },
    태그: {
      type: "object",
      additionalProperties: false,
      required: ["주제", "감정", "상황", "영역", "장면", "권장", "피할", "제목뜻"],
      properties: { 주제: { type: "string" }, 감정: { type: "string" }, 상황: { type: "string" }, 영역: { type: "string" }, 장면: { type: "string" }, 권장: { type: "string" }, 피할: { type: "string" }, 제목뜻: { type: "string" } },
    },
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
  /** v4.14: attempts 가운데 글 전체가 아니라 칸(areas[i]·do·dont)만 다시 쓴 횟수 */
  patches: number;
  /** source가 llm일 때 모델 ID, 아니면 null */
  model: string | null;
  /** 시도마다 검사에서 걸린 사유. 통과하면 빈 배열 */
  issues: string[][];
  /** 마지막 모델 응답 원문 (검사 실패 분석용) */
  lastModelText?: ModelText;
  /** v4.10: 모델이 먼저 정한 뼈대 한 줄(핵심). 화면에는 안 나감 */
  core?: string;
  /** v4.15: 사례 무대 (v4.16부터 없음) */
  stage?: string;
  /** v4.16: 의미 태그·판단. 캐시에 넣어 다음 7~14일은 같은 뜻을 피한다. 템플릿이면 없음 */
  tags?: FortuneTags;
  judge?: FortuneJudge;
  /** v4.10: 문맥 검수 결과. 검수 모델이 없으면 undefined. 통과 = 문제 없음 / 적용 = 문제를 고친 글을 씀 / 탈락 = 고친 글이 검사에 걸리거나 호출 실패라 초고 그대로 */
  review?: { status: "통과" | "적용" | "탈락"; problems: string[]; why?: string };
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /**
   * 템플릿으로 떨어진 까닭이 "일시적"인지. api = 429·5xx·타임아웃·연결 오류처럼 조금 뒤 다시 부르면 될 수 있는 것 →
   * 이 결과는 하루 캐시에 쓰지 않는다 (전체검토 A-3). 검사 탈락·거절·키 없음은 다시 불러도 같으니 캐시해도 된다
   */
  transient?: "api";
}

/**
 * SDK 기본값은 타임아웃 10분·재시도 2회라 Vercel 함수 상한(기본 10~15초)을 넘기면 응답이 끊기고 캐시도 안 남는다 (전체검토 A-2).
 * 재시도는 generateFortuneText의 attempt 루프가 맡으므로 SDK 재시도는 끈다. 시간은 page.tsx의 maxDuration(30초) 안에 3회가 들어가게.
 */
export const CLIENT_OPTIONS = { timeout: 20_000, maxRetries: 0 } as const;
/** 시도 전부 합친 상한(ms). 이 시간이 지나면 남은 시도를 건너뛰고 템플릿. page.tsx maxDuration(60초) 안에 들어간다 (2026-10-14 실측: 8초 타임아웃은 첫 호출이 자주 걸렸다) */
export const TOTAL_DEADLINE_MS = 40_000;
/**
 * adaptive thinking은 생각 토큰도 max_tokens에 들어간다. 출력 JSON은 ~500토큰이라 2048로도 대개 되지만 생각이 길어지면 잘려
 * JSON.parse가 터졌다 (A-5). 넉넉히 잡아도 실제 출력만큼만 과금된다
 */
export const MAX_TOKENS = 4096;

/** 응답이 max_tokens에 잘렸을 때. attempt 루프가 이것을 보고 다음 시도로 넘어간다 */
export class TruncatedError extends Error {
  /** SyntaxError와 구조가 같아 instanceof 좁히기가 never가 되는 것을 막는 표식 */
  readonly truncated = true;
  constructor() {
    super("응답이 잘림 (stop_reason=max_tokens)");
    this.name = "TruncatedError";
  }
}

export interface GenerateOptions {
  client?: Anthropic;
  /** 기본 2 (첫 글 + 재작성 1회). 샘플 스크립트처럼 호출 수를 묶을 때 1 */
  maxAttempts?: number;
  model?: string;
  /** v4.10: 검수 모델. undefined면 환경변수 FORTUNE_REVIEW_MODEL, null이면 검수 안 함 */
  reviewModel?: string | null;
}

/** v4.14: 칸만 다시 쓸 때의 출력 — areas 배열 전체(걸리지 않은 줄은 그대로 옮김)·do·dont. 본문·headline·핵심은 받지 않는다 */
export const PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["areas", "do", "dont"],
  properties: { areas: OUTPUT_SCHEMA.properties.areas, do: { type: "string" }, dont: { type: "string" } },
} as const;
export type PatchText = Pick<ModelText, "areas" | "do" | "dont">;

/** 한 번 호출해 JSON을 돌려준다. refusal이면 null. schema를 주면(칸 고쳐 쓰기) 그 꼴로 받는다 */
export async function callModel(
  client: Anthropic,
  model: string,
  messages: Anthropic.MessageParam[],
  usage: GenerateResult["usage"],
  attempt: number,
  schema: object = OUTPUT_SCHEMA,
): Promise<ModelText | null> {
  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
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
  if (response.stop_reason === "max_tokens") throw new TruncatedError();
  const text = response.content.find((b) => b.type === "text");
  if (!text) throw new Error("모델 응답에 text 블록이 없음");
  const parsed = JSON.parse(text.text) as ModelText;
  if (parsed && typeof parsed === "object") {
    // v4.15 2차: 구조화 출력 끝에 붙는 쓰레기 꼬리("않아요.1", "않아요.。", "않아요.」」", "…placeholder") — 마지막 "~요" 뒤에 한글이 없으면 잘라 낸다 (2차 말뭉치 51회 중 6회)
    for (const k of ["headline", "do", "dont"] as const) if (typeof parsed[k] === "string") parsed[k] = trimTail(parsed[k]);
    if (Array.isArray(parsed.areas)) for (const a of parsed.areas) if (a && typeof a.line === "string") a.line = trimTail(a.line);
    if (Array.isArray(parsed.blocks)) { for (const blk of parsed.blocks) if (blk && typeof blk.text === "string") blk.text = trimTail(blk.text); parsed.body = joinBlocks(parsed.blocks); }   // 블록으로 받은 본문을 화면용 body로 (칸 고쳐 쓰기 응답은 blocks가 없어 그대로)
  }
  return parsed;
}
/** "~요" 뒤에 한글 없는 꼬리가 붙었으면 뗀다. 한글이 섞인 꼬리(" 필드 아님)")는 손대지 않는다 — 검사기가 잡는다 */
export function trimTail(s: string): string {
  const m = s.match(/^(.*요[.!?]?)([^가-힣]*)$/s);
  return m && m[2] ? m[1]! : s;
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

/** v4.14: 칸 고쳐 쓰기 요청 — 본문·headline은 통과했으니 그대로 두고, 걸린 칸만 새로 쓰게 한다 */
export function patchMessages(briefJson: string, prev: ModelText, issues: string[], slots: SlotIssues): Anthropic.MessageParam[] {
  const names = [...slots.areas.map((i) => `areas[${i}]`), ...(slots.do ? ["do"] : []), ...(slots.dont ? ["dont"] : [])];
  const keep = { headline: prev.headline, body: prev.body, areas: prev.areas, do: prev.do, dont: prev.dont };
  return [
    {
      role: "user",
      content: `${briefJson}\n\n[칸 고쳐 쓰기] 바로 앞에 쓴 글은 본문과 headline이 검사를 통과했고, ${names.join("·")} 칸만 걸렸어요. 본문·headline은 한 글자도 바꾸지 않고(돌려주지도 않아요), 걸린 칸만 같은 brief로 새로 써요. areas는 배열 전체를 돌려주되 걸리지 않은 줄은 그대로 옮기고, period·area·순서는 바꾸지 않아요. 걸린 칸은 아래 사유에 인용된 본문 문장과 다른 장면·다른 행동으로 써요(낱말만 바꾸면 또 걸려요).\n이전 글: ${JSON.stringify(keep)}\n탈락 사유:\n- ${issues.join("\n- ")}`,
    },
  ];
}

/** v4.14: 칸 응답을 앞 글에 덮어 쓴다 — 걸린 칸만 받고 나머지는 prev 그대로 (모델이 본문을 돌려주지 않으므로 본문은 바뀔 수 없다) */
export function mergePatch(prev: ModelText, patch: PatchText | null, slots: SlotIssues): ModelText {
  if (!patch || typeof patch !== "object") return prev;
  const areas = Array.isArray(patch.areas) && patch.areas.length === prev.areas.length
    ? prev.areas.map((a, i) => (slots.areas.includes(i) && patch.areas[i] && typeof patch.areas[i].line === "string" ? { ...a, line: patch.areas[i].line } : a))
    : prev.areas;
  return { ...prev, areas, do: slots.do && typeof patch.do === "string" ? patch.do : prev.do, dont: slots.dont && typeof patch.dont === "string" ? patch.dont : prev.dont };
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
  const startedAt = Date.now();
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const result: GenerateResult = { text: fallback, source: "template", attempts: 0, patches: 0, model: null, issues: [], usage };

  const client = opts.client ?? (process.env.ANTHROPIC_API_KEY ? new Anthropic(CLIENT_OPTIONS) : null);
  if (!client) {
    result.issues.push(["ANTHROPIC_API_KEY 없음"]);
    return result;
  }

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: briefJson }];
  let prev: ModelText | null = null;
  /** v4.14: 이번 시도가 칸 고쳐 쓰기면 그 칸들 (응답을 prev에 덮어 쓴다) */
  let patching: SlotIssues | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1 && Date.now() - startedAt > TOTAL_DEADLINE_MS) {
      result.issues.push([`전체 기한 ${TOTAL_DEADLINE_MS / 1000}초 초과 — 남은 시도 생략`]);
      break;
    }
    result.attempts = attempt;
    let parsed: ModelText | null;
    try {
      if (patching && prev) {
        result.patches++;
        const patch = (await callModel(client, model, messages, usage, attempt, PATCH_SCHEMA)) as PatchText | null;
        parsed = patch === null ? null : mergePatch(prev, patch, patching);
      } else {
        parsed = await callModel(client, model, messages, usage, attempt);
      }
    } catch (e) {
      // 잘림(max_tokens)과 JSON 파싱 실패는 같은 brief로 한 번 더 써 보면 되는 일 — 다음 시도로
      if (e instanceof TruncatedError || e instanceof SyntaxError) {
        const why = e instanceof TruncatedError ? e.message : `JSON 파싱 실패: ${e.message}`;
        console.warn(`[fortune llm] ${why} (attempt ${attempt})`);
        result.issues.push([why]);
        messages = rewriteMessages(briefJson, prev, ["앞 응답이 중간에 끊겨 JSON이 완성되지 않았어요. 생각은 짧게, 정해진 JSON만 완결되게 써요."]);
        patching = null;
        continue;
      }
      const why =
        e instanceof Anthropic.RateLimitError ? `요청 과다 (429)`
        : e instanceof Anthropic.APIError ? `API 오류 ${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error ? e.message : String(e);
      console.warn("[fortune llm] 호출 실패, 템플릿 사용:", why);
      result.issues.push([why]);
      // 429·5xx·타임아웃·연결 오류는 조금 뒤 다시 부르면 될 수 있다 → 이 템플릿을 하루 캐시에 굳히지 않는다 (A-3)
      result.transient = "api";
      return result;
    }
    if (parsed === null) {
      result.issues.push(["모델이 거절함 (refusal)"]);
      return result;
    }
    // v4.16: 입력 areas에 없는 영역 줄은 날조라 버리고(입력 순서로 정렬) 나머지는 그대로 검사한다 — 3차 말뭉치에서 "가족" 줄을 지어내 8편이 탈락
    if (parsed.판단 && Array.isArray(parsed.areas)) {
      const kept = brief.areas.map((x) => parsed.areas.find((a) => a && a.area === x.area && (!a.period || a.period === x.period))).filter((a): a is NonNullable<typeof a> => Boolean(a));
      if (kept.length !== parsed.areas.length) console.warn(`[fortune llm] 입력에 없는 영역 줄 ${parsed.areas.length - kept.length}개 버림`);
      parsed.areas = kept.slice(0, 3);
    }
    result.lastModelText = parsed;
    const issues = validateFortuneText(parsed, brief);
    result.issues.push(issues);
    if (issues.length === 0) {
      let fin = parsed;
      // v4.10: 문맥 검수 — FORTUNE_REVIEW_MODEL이 있을 때만(기본 꺼짐: 하루 사용자마다 호출이 늘어남). 문제가 있으면 한 번 고쳐 쓰고, 고친 글도 같은 검사를 통과할 때만 씀
      const rm = opts.reviewModel === undefined ? reviewModel() : opts.reviewModel;
      if (rm) {
        try {
          const rv = await client.messages.create({ model: rm, max_tokens: 1024, system: [{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: reviewUser(fin, brief) }] });
          const rvu = rv.usage; usage.input += rvu.input_tokens; usage.output += rvu.output_tokens; usage.cacheRead += rvu.cache_read_input_tokens ?? 0; usage.cacheWrite += rvu.cache_creation_input_tokens ?? 0;
          const problems = parseReview(rv.content.filter((x) => x.type === "text").map((x) => (x as { text: string }).text).join(""), fin);
          if (!problems.length) result.review = { status: "통과", problems: [] };
          else {
            const fixed = await callModel(client, model, [{ role: "user", content: reviewRewriteContent(briefJson, fin, problems, LIMITS.bodyMax) }], usage, attempt + 1);
            const fixIssues = fixed ? validateFortuneText(fixed, brief) : ["모델이 거절함"];
            if (fixed && fixIssues.length === 0) { fin = fixed; result.review = { status: "적용", problems: problems.map(problemLine) }; }
            else result.review = { status: "탈락", problems: problems.map(problemLine), why: fixIssues.join(" / ") };
          }
        } catch (e) {
          result.review = { status: "탈락", problems: [], why: `검수 호출 실패: ${e instanceof Error ? e.message : String(e)}` };
        }
      }
      result.text = { headline: fin.headline, body: fin.body, do: fin.do, dont: fin.dont, ...(fin.areas.length ? { areas: fin.areas.map((a, i) => ({ period: brief.areas[i]!.period, area: a.area, signal: brief.areas[i]!.signal, line: a.line })) } : {}) };
      result.source = "llm";
      result.model = model;
      result.core = fin.판단?.핵심 ?? fin.핵심;
      if (fin.태그) result.tags = fin.태그;
      if (fin.판단) result.judge = fin.판단;
      return result;
    }
    console.warn(`[fortune llm] 검사 탈락 (attempt ${attempt}):`, issues.join(" / "));
    prev = parsed;
    // v4.14: 사유가 칸에만 있으면 그 칸만 고쳐 쓴다. 본문·headline까지 걸렸으면 글 전체를 다시 쓴다
    patching = slotIssues(issues);
    messages = patching ? patchMessages(briefJson, prev, issues, patching) : rewriteMessages(briefJson, prev, issues);
  }
  return result;
}
