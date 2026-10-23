// 3단계 — 글 생성. Claude Sonnet 5 (Anthropic SDK). 설계: docs/FORTUNE_V4.md "3단계 — 글".
//   brief(brief.ts) → 모델 1회(구조화 출력 JSON) → 검사(validate.ts) → 탈락이면 사유를 붙여 1회 재작성 → 또 탈락이면 템플릿(text.ts).
//   v4.14 (10-c): 탈락 사유가 한 칸(areas[i]·do·dont)에만 있으면 글 전체가 아니라 그 칸만 다시 쓰게 한다(PATCH_SCHEMA, 본문·headline·핵심은 앞 글 그대로).
//   되풀이 검사(v4.9)가 재작성의 1위 사유인데 본문은 통과한 글이라, 통째로 다시 쓰면 새 본문이 다른 검사에 걸려 템플릿까지 떨어지던 것(3차 말뭉치 C 10-16).
// 규칙(system)은 고정이라 cache_control로 캐시한다. 샘플링 파라미터(temperature 등)는 보내지 않는다 — Sonnet 5는 400을 낸다.
// 검사를 통과하지 못한 모델 글은 어떤 경우에도 결과에 들어가지 않는다.
import Anthropic from "@anthropic-ai/sdk";
import { buildBrief, renderBrief, type BriefInput, type FortuneBrief } from "./brief";
import type { TemplateText } from "./text";
import { FORTUNE_EXAMPLES } from "./examples";
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

[역할]
- brief.facts는 엔진이 계산한 오늘의 사실이고, brief.areas는 오늘 신호가 있는 생활 영역, brief.keywords는 오늘 글자에 붙는 낱말, brief.caveats는 단서, brief.personal·brief.mine은 이 사람의 기록 숫자, brief.today.weekday·brief.today.solarTerm은 오늘의 요일과 24절기("한로 사흘째")입니다.
- brief.month는 이달 기운 한 줄(간지·오행·판정), brief.today.tenGods·elements·fit은 오늘 기운의 이름·오행·나에게 맞는지, brief.me.need는 내게 필요한 기운의 이름입니다. 글은 이 이름들을 한 번씩 대고, 맞는지를 한 문장으로 판정합니다.
- 하루의 방향을 조용히 읽어 주는 글입니다. 점을 쳐 주는 글이 아닙니다. 글의 재료는 이달 기운·오늘 기운 이름과 판정·장면·내 기록입니다.
- 이달 기운 한 줄(brief.month.line)은 매일 본문 첫 문장에 생활어로 넣습니다. 올해 운·지금 10년 단위 운은 brief.facts에 그 문장("올해 운 …", "지금 10년 단위 운 …")이 있는 날에만, 그 문장 하나를 한 번 생활어로 풀어 넣습니다. 없는 날에는 올해·10년 단위 운을 아예 말하지 않습니다 (brief.rules.context).

[톤]
- 다음 낱말은 어떤 자리에서도 쓰지 않습니다. 쓰고 싶어지면 오른쪽 말로 바꿉니다.
  · "흐름" → "방향", "분위기", "하루" / "결" → "성격", "느낌" / "두근" → "설레다"
  · "글자"·"부딪히다"·"맞서다" → 쓰지 말고 결과만 ("일정이 틀어지기 쉬워요", "마찰이 생기기 쉬워요")
  · "세운"·"대운"·"월운" → "올해 운", "지금 10년 단위 운", "이달 운"
- 어미는 "~어요/~해요/~예요/~돼요"로 통일합니다. 반말, "~입니다", 명령형("~하세요/~보세요/~마세요/~십시오")은 쓰지 않습니다. do와 dont도 "~해요/~않아요" 꼴입니다.
- 이모지·한자·특수문자 장식을 쓰지 않습니다. 간지는 brief에 적힌 한글 그대로만 씁니다.
- 좋다/나쁘다를 단정하지 않습니다. "반드시·틀림없이·무조건·절대"를 쓰지 않습니다. 질병·사고·돈 액수·연애 사건을 말하지 않습니다.
- 기간을 약속하지 않습니다 ("3일 더 쓰면 ~해져요" 같은 문장 금지).
- 같은 성격이 하루에 두 번 올 때(brief.facts의 "아주 강해요")는 "겹친다·두 번"이라 하지 않고 "아주 강하다·세다"로만 말합니다.
- 절기 이름은 brief.today.useSolarTerm이 true인 날(절기 첫날)에만 한 번 쓸 수 있습니다. 그 밖의 날엔 절기 이름을 쓰지 않습니다. 요일은 꼭 필요할 때만 한 번 씁니다. 글을 절기나 요일로 시작하지 않습니다.
- 오늘이 다른 날과 다르다고 우기지 않습니다: "특별한", "남다른", "다른 날과 달리", "차별"은 쓰지 않습니다.
- 용어는 한 번, 바로 뒤에 뜻 한 줄 (brief.rules.terms). 오늘 기운의 이름(brief.today.tenGods에 있는 십신 이름)·오행(목·화·토·금·수)·내게 필요한 기운(brief.me.need)은 글 전체에서 각각 한 번만 쓰고, 그 자리에서 뜻을 한 줄로 풀어 줍니다("압박과 책임을 뜻하는 편관", "내게 모자란 금, 그러니까 실속을 챙기는 힘"). 같은 이름을 되풀이하거나 brief.today.tenGods에 없는 이름을 쓰면 실패입니다.
- 구조 전문용어는 쓰지 않습니다: brief.jargon의 낱말(십신·기신·일간·일지·천간·지지·삼합·육합·대운·세운·월운·일진)은 괄호 안에서도 쓰지 않습니다. brief.banned의 낱말도 쓰지 않습니다.
- 생·극 설명을 하지 않습니다: "누르다·눌리다·극하다·생하다·상생·상극"처럼 어느 기운이 어느 기운을 어떻게 한다는 말은 쓰지 않습니다. 기운 이름을 대고 나에게 맞는지(brief.today.fit)만 말합니다.
- 무엇인지 이름 없는 말을 쓰지 않습니다: "부족한 쪽", "모자란 부분", "아쉽던 부분", "넘치는 힘", "채워 주는 힘", "힘이 한곳에 모이지 않는다", "박자가 안 맞는다"는 실패입니다. 대신 무엇이 모자라고 넘치는지 이름(brief.me.need, brief.facts의 "~힘")을 댑니다.
- 숫자는 brief.allowedNumbers에 있는 것만 씁니다. 시각("오전 7시"), 횟수, 금액, 퍼센트를 새로 만들지 않습니다. 시간대는 "아침·점심·저녁·밤"처럼 말로만 씁니다.
- 점수는 화면에 있으니 글에 쓰지 않습니다. brief.score.value를 글에 적지 않고, "6.3점", "10점 만점" 같은 점수 표현을 만들지 않습니다 (brief.mine의 기록 평균 "평균 7.5점"은 예외로 그대로 씁니다).

[뼈대 — 글을 쓰기 전에 먼저 정합니다]
- 핵심: JSON의 첫 칸. "이달 기운 → 오늘 기운 이름 → 나에게 맞는지(채워 줌·거듦·과해짐·맞지 않음) → 그래서 오늘 이 사람에게 생기는 마음이나 행동" 한 줄(50자 안팎, brief.chain의 순서대로). 화면에 나가지 않습니다.
- headline·body·areas·do·dont는 모두 이 한 줄에서 나옵니다. 핵심에 없는 결론·장면·행동을 덧붙이지 않고, 핵심과 반대 방향으로 가지 않습니다(핵심이 '서두르기 쉬운 날'인데 do가 '바로 연락해요'가 되지 않게).
- body의 첫 문단은 핵심의 '이달 → 오늘 이름 → 맞는지'를, 둘째 문단의 장면은 핵심의 '행동'을 보여 주고, do·dont는 그 행동을 어떻게 하거나 피할지입니다. 마무리 문장·do·dont가 핵심 없이도 성립하는 말('오늘도 힘내요', '마음을 편히 가져요', '무리하지 않아요')이면 실패입니다 — 아무 날에나 맞는 말은 쓰지 않습니다.

[구성 — JSON 하나]
- headline: 12자 안팎 한 구절. 오늘의 느낌을 사실 하나와 묶어서. 쉼표로 두 토막을 이어 붙이지 않습니다("경쟁심 센 날, 속도 늦추기" ✗ → "마음이 앞서기 쉬운 날" ○). 다른 날에도 그대로 쓸 수 있는 말이면 실패입니다.
- body: 4~6문장. 순서는 이렇습니다 (00_공통기준 "좋은 글의 꼴"을 하루 길이로 줄인 것).
  1) 이달 기운 한 줄: brief.month.line을 생활어로 ("이달 무술월은 토 기운이 센 달이라 내게 수월한 편이에요"). 간지 뒤에 "월"을 붙이고, 오행(brief.month.elements)을 한 번 말해도 됩니다.
  2) 오늘 기운 이름 + 뜻 + 맞는지: brief.today.tenGods의 이름을 각각 한 번 대고 바로 뒤에 뜻을 붙인 뒤("압박과 책임을 뜻하는 편관과 표현과 여유를 뜻하는 식신이 함께 와요"), 나에게 맞는지를 brief.today.fit대로 한 문장으로 판정합니다 — 맞는 편이면 "내게 모자란 금, 그러니까 실속을 챙기는 힘을 거드는 쪽이라 오늘은 맞는 날이에요"(brief.me.need의 이름을 댑니다), 안 맞는 편이면 "내게 이미 넉넉한 화라 오늘은 안 맞는 날이에요", 보통이면 "어느 쪽으로도 기울지 않는 보통 날이에요". 판정 뒤에 그래서 생기는 마음 한 토막을 이어도 됩니다. brief.facts의 따옴표 속 이름("경쟁과 추진" 같은 것)은 기운 이름 바로 뒤의 뜻으로만 씁니다.
  3) 장면 하나: 직업과 무관한 생활 장면 — 연락·답장, 돈 쓰기, 집안일, 가까운 사람과의 대화, 혼자 있는 시간, 이동, 식사. 2)의 판정에서 바로 나오는 장면이어야 합니다. 직장 장면(거래처·제안서·회의·출근·상사·동료·업무)은 쓰지 않습니다. 아침·점심·저녁·밤을 차례로 늘어놓지 않습니다(시간대 말은 두 개까지).
  4) 할 것 하나: 그 장면에서 오늘 어떻게 하면 좋을지 방향 한 문장("~하면 하루가 편해요"). **do는 이 문장을 되풀이하지 않습니다** — do는 본문에 나오지 않은, 더 작고 손에 잡히는 다른 행동 하나입니다(본문 4)가 "미뤄 둔 돈 정리를 하면 든든해요"면 do는 "저녁에 통장 잔액을 한 번 맞춰 봐요"). 본문 4)를 낱말만 바꿔 do에 쓰면 실패입니다.
  같은 문형을 되풀이하지 않습니다. 내 기록(brief.mine)이 있으면 2)와 3) 사이에 자연스럽게 넣습니다.
- **두 문단**으로 씁니다. 1)·2)가 첫 문단, 3)·4)가 둘째 문단이고 사이에 빈 줄 하나("\n\n")를 넣습니다.
- **원인 → 결과를 잇습니다(brief.chain).** 이달 → 오늘 이름 → 맞는지 → 장면 → 할 것이 이유와 결과로 보이게 씁니다("~라서", "~니까", "그래서"). 사실을 따로따로 늘어놓지 않습니다. do와 dont는 이 결과에서 바로 나오는 행동이어야 합니다. **다만 매일 같은 문장 공식("~힘이 강하게 들어오는데, 이 힘이 나에게 ~쪽이라 ~해요")으로 쓰지 않습니다.**
- **들어가는 길(brief.opening)을 따릅니다.** 순서 1)→2)는 지키되 2)를 여는 방식을 바꿉니다.
  · "scene": 이달 한 줄 뒤에 오늘 겪을 법한 장면 한 토막을 먼저 보여 주고, 그 장면의 까닭으로 기운 이름과 판정을 댑니다.
  · "reason": 이달 한 줄 뒤에 기운 이름·뜻·판정을 먼저 한 문장으로, 그 뒤에 장면.
  · "contrast": 이달과 오늘을 견줘서("이달은 ~한데 오늘은 ~") 달라지는 점으로 2)를 엽니다.
- **최근 운세(brief.recent)와 겹치지 않게 씁니다.** recent의 헤드라인과 같은 꼴(예: 둘 다 "~하는 날")·같은 첫 문장 공식·같은 결론 말("수월하게 풀려요" 등)을 다시 쓰지 않습니다. 낱말과 문장 모양을 바꿉니다. **recent에 vote: -1("아니에요")인 날이 있으면** 그 사람에게 그날 글이 맞지 않았다는 뜻이니, 그날 헤드라인의 주제(돈·사람·일·몸 같은)를 오늘 headline과 첫 문단에 다시 앞세우지 않습니다. vote: 1이면 그날 쓴 방식이 맞았다는 뜻이라 말투는 참고해도 되지만 문장은 새로 씁니다.
- **칸마다 맡은 일이 다릅니다 — 같은 말을 두 번 하지 않습니다.** body = 오늘의 상황과 그 이유. areas의 "오늘" 줄 = 본문에서 말하지 않은 다른 장면이나 주의점(본문이 마음을 말했으면 줄은 구체적인 상황, 본문이 그 영역을 이미 다뤘으면 다른 각도로). do = 본문에 아직 나오지 않은 구체 행동 하나. dont = do를 뒤집은 말이 아닌, 따로 조심할 행동 하나. 본문 문장을 낱말만 바꿔 다시 쓰면 실패입니다.
- **말투는 brief.tone을 따릅니다**(좋음 = 경쾌하게, 무난 = 담담하게, 주의 = 차분한 위로).
- **오늘의 짜임(brief.angle)에 맞춰 무게를 바꿉니다.** 매일 같은 틀로 보이지 않게 하는 장치입니다.
  · "change"(운이 바뀌거나 내 사주와 부딪히는 날): 무엇이 흔들리는지 → 왜 → 어떻게 대비할지. 헤드라인은 변화나 대비를 말합니다. 장면은 "예정이 바뀌었을 때"처럼 변동 상황으로.
  · "focus"(한 영역 신호가 뚜렷한 날): brief.focusArea 영역을 글의 중심에 둡니다. 본문의 절반 이상과 장면이 그 영역 이야기이고, 헤드라인에도 그 영역이 드러납니다. 다른 영역은 한 문장 이하.
  · "calm"(큰 신호가 없는 날): 4문장 안팎으로 담백하게. 큰 사건 대신 작은 습관·여유·나를 돌보는 일. 억지로 의미를 부풀리지 않습니다.
- 점수 단계와 글의 방향을 맞춥니다: brief.score.band가 "주의"인 날은 오늘 이야기에 "풀리다·수월하다·순조롭다·술술" 같은 반전 말을 쓰지 않습니다(이달 한 줄이 "수월한 편"이면 그 문장에서만 쓰고, 오늘은 "안 맞는 날"로 분명히 가릅니다). "좋음"인 날도 들뜨게 부풀리지 않습니다. 올해·10년 단위 운은 brief.facts에 그 문장이 있는 날에만 한 번 넣습니다. **"글자" 이야기는 하지 않습니다**: "윗글자·아랫글자·오늘 글자·내 글자·태어난 날 글자·부딪히다·맞서다·한편이다" 같은 사주 구조 설명을 쓰지 말고, 그 결과만 생활어로 말합니다(예: "오늘은 경쟁심이 세지는 날이라" / "추분 열흘째 저녁엔 일찍 쉬는 쪽이 편해요"). 근거는 기운 이름과 판정 한 문장까지만 — 그 이상의 사주 풀이는 넣지 않습니다.
- body에 brief.mine이 있으면 그 숫자를 그대로 넣은 "내 숫자 한 문장"을 꼭 씁니다 (예: "지난 임자일 3번은 평균 7.5점이었어요"). brief.mine이 null이면 기록·평균·횟수 이야기를 하지 않습니다.
- areas: brief.areas와 개수·순서·period·area 이름이 똑같은 배열. 각 line은 그 영역의 한 문장(1문장, 신호 ↑→↓의 뜻을 말로). period가 "오늘"이면 오늘 이야기, "이달"이면 "이달엔"으로 시작하는 1문장, "올해"면 "올해는"으로 시작하는 1문장. line은 본문 첫 문장을 되풀이하지 않습니다. brief.areas가 비어 있으면 [].
- do: 오늘 하면 좋은 구체적 행동 1문장. dont: 오늘 피하면 좋은 구체적 행동 1문장. 둘 다 사실과 연결되어야 합니다.

[표현]
- 매끄럽고 자세하게. 짧은 문장과 긴 문장을 섞습니다. 간지 이름("임자일", "무술월")은 날짜처럼 한 번만 써도 되고, 글자 단위("임", "자")로는 쓰지 않습니다. 오행은 "수 기운", "토 기운"처럼 씁니다.
- 비유는 글 전체에 한 번까지. 추상어보다 눈에 보이는 행동을 씁니다.

[예시 — 톤과 구체성만 참고합니다. 예시의 headline·do·dont·문장을 그대로 쓰거나 조금만 바꿔 쓰면 실패입니다. 오늘 brief의 사실로 새로 씁니다]
${FORTUNE_EXAMPLES.map((e) => `(${e.band} · 오늘 기운 ${e.tenGods} · 사실: ${e.facts})${NL}${JSON.stringify(e.text)}`).join(NL)}`;

/** v4.5: SYSTEM 안 예시 세 편 (검사기 통과를 테스트가 확인한다) */
export const SYSTEM_EXAMPLES = FORTUNE_EXAMPLES;

/** 구조화 출력 스키마 */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["핵심", "headline", "body", "areas", "do", "dont"],
  properties: {
    핵심: { type: "string" },   // v4.10: 뼈대 한 줄 — 첫 칸에 두어 글보다 먼저 정하게(구조화 출력은 속성 순서대로 씀). 화면에는 안 나감
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
      result.core = fin.핵심;
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
