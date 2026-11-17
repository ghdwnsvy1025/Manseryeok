// 3단계 — 출력 검사기. "brief에 없는 것은 글에 나올 수 없다"를 기계로 확인한다.
// v4.19 (2026-10-31, ChatGPT 검토 반영): 문자열 사유 목록 대신 구조화된 이슈 [{code, field, index?, msg}]를 돌려준다 — 걸린 칸·문장만 수리(llm.ts)하기 위해.
//   field = headline | body(index = 문장 번호) | area(index = areaLines 번호) | do | dont | whole(글 전체 — 다시 쓰기 대상).
//   whole은 JSON 깨짐·문장이 너무 적음·핵심 누락뿐이다. 나머지 규칙은 모두 그 규칙을 어긴 문장 하나를 가리킨다.
//   반복 정책: v4.16의 "최근 7일 태그 2칸 겹침 → 통째 거부"는 없앴다. 최근 제목 완전 동일(14일)·최근 3일 제목 겹침·최근 3일 첫 문장 동일·
//   최근 7일 문장과 높은 유사도는 그 칸(문장)만 수리 대상이다. 같은 주제가 다시 오는 것은 괜찮다(표현 면은 계획의 피할것이 돌린다).
// 검사 항목(전부 v4.18에서 옮김): 금지어 · 전문용어 · 십신 이름 · 판정 문장 · 비유 · 성격 이름 · 추상어 · 생·극 · 구조 서술 · 한자 · 이모지 · 숫자 날조 · 점수 숫자
//   · 어미(~요)·명령조 · 기간 약속 · 단정 · 직장 장면 · 주의인 날 반전 말 · 시간대 나열 · 절기 · 맥락 없는 운 언급 · 기록·평균 · 문장 길이 · 같은 낱말 · 이음말
//   · 결과 약속 · 되받기 · 정의문 · 속말 · 사물 비유 · 넘겨짚기 · 예시 베낌 · 칸 되풀이(영역·하면·피해요가 본문 문장과 같은 말) · 분량.
// v4.27 (2026-11-10, 지적 원장 묶음 1 — 피드백/작가입력_재설계_2026-11-10.md §3): 이론을 쉬운 말로 드러내기로 해서 "왜"를 막던 규칙을 뺐다 —
//   판정 문장(judgement)·생극(shengke)·추상어(abstract)·주의 날 반전 말(reversal)·결과 약속 문장 머리(promise_head)·이음말 수(connectives·so).
//   어미는 "~세요·~죠·~니다"를 허용한다(반말·"~십시오"만 막음). 본문은 두 문단(first·second) 4~14문장, 문장 140자, 제목 40자, 하면·피해요 60자.
//   정규식 상수(JUDGEMENT_RE 등)는 측정·옛 테스트용으로 남겨 두되 검사에는 쓰지 않는다. 금지어 목록에 더한 것은 없다.
import type { FortuneBrief } from "./brief";
import { ABSTRACT_LABELS, NUMBER_RE, TEN_GOD_NAMES } from "./brief";
import { FORTUNE_EXAMPLES } from "./examples";
import { EXEMPLAR_SENTENCES } from "./exemplars";
import type { AreaName } from "./types";

/** v4.19: 모델(작가)이 돌려주는 글 */
export interface Draft {
  headline: string;
  /** 본문 문장 전부 (v4.27: 두 문단을 이어 붙인 것, 5~10개) */
  body: string[];
  /** v4.27: 둘째 문단이 시작하는 문장 번호. 없으면 joinBody가 옛 규칙(앞 두 문장)으로 나눈다 */
  split?: number;
  /** 계획이 준 영역만 */
  areaLines: { area: AreaName; text: string }[];
  do: string;
  dont: string;
}
/** v4.18까지의 모델 출력 꼴 (옛 테스트·검수 호환). normalizeDraft가 Draft로 바꾼다 */
export interface ModelText {
  headline: string;
  body: string | string[];
  areas?: { period?: string; area: AreaName; line: string }[];
  areaLines?: { area: AreaName; text: string }[];
  do: string;
  dont: string;
  [k: string]: unknown;
}

export type IssueField = "headline" | "body" | "area" | "do" | "dont" | "whole";
export interface Issue {
  code: string;
  field: IssueField;
  /** body: 문장 번호, area: areaLines 번호 */
  index?: number;
  msg: string;
}
/**
 * 2026-11-15 (그릴링 Q4, 앱 주인 "추천대로"): v5 글(단락 사전으로 엮은 글)은 "틀리면 안 되는 것" 열 갈래만 본다. 나머지 문체 검사는 v4 글에만 남는다.
 * 사주 용어 · 입력에 없는 숫자 · 넘지 말 선(금지 낱말·길흉 단정·지어낸 기록) · 한자·영문·이모지 · 길이·분량 · 어미 · 최근 글 베끼기 ·
 * 하면·피해요는 한 문장 · 제목 길이(길이에 포함) · 최근 제목 반복. 그리고 빈 칸·JSON 깨짐(꼴).
 * 새 갈래를 더하려면 앱 주인의 지적 원문이 있어야 하고, 그것도 먼저 사전 단락·제목 보기를 고치는 쪽으로 푼다(그릴링 Q5).
 */
export const V5_CHECKS: ReadonlySet<string> = new Set([
  "jargon", "tengod",
  "number", "score",
  "banned", "certain", "record",
  "hanja", "latin", "emoji",
  "length", "body_count",
  "ending",
  "recent_line", "recent_start", "recent_action",
  "one_sentence",
  "recent_headline",
  "empty", "empty_body", "json",
]);
/** 다시 쓰기(글 전체)가 필요한 이슈 — 나머지는 걸린 문장만 고친다 */
export const REWRITE_CODES: ReadonlySet<string> = new Set(["json", "empty_body", "body_count", "core_missing"]);
export const needsRewrite = (issues: readonly Issue[]): boolean => issues.some((i) => i.field === "whole" || REWRITE_CODES.has(i.code));

export const LIMITS = {
  /** v4.27: 제목은 첫 문단의 결론 한 구절 — 앱 주인 제목이 27~37자였다 */
  headlineMax: 40,
  /** v4.19: 본문 문장 4~5개를 요청했다. v4.20: 3~5개를 요청하고 6까지는 받는다. v4.27: 두 문단 6~9문장을 요청하고 4~10을 받는다(수리 뒤 3).
   *  2026-11-17 앱 주인 "이상한 글보다 긴 글이 더 좋아. 상한을 조절해 줘": 요청은 그대로(6~9), 받는 상한만 10 → 14 — 49편 중 12편이 11~14문장으로 걸려 다시 쓰고, 2편은 세 번 다 걸려 사전 글로 나갔다 */
  bodySentences: [4, 14] as const,
  bodyKeepMin: 3,
  areaLineMax: 70,
  doDontMax: 60,
  sentenceMin: 12,
  /** v4.27: 앱 주인이 고쳐 쓴 문장이 100~132자였다 */
  sentenceMax: 140,
  /** 같은 낱말(어절 앞 두 글자)은 본문에서 세 번까지 — v4.20부터 검사기는 이걸로 탈락시키지 않는다(overusedWords는 측정용으로 남김) */
  wordMax: 3,
} as const;

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}]/u;
const HANJA_RE = /[㐀-鿿]/;
/** v4.27: 한글 글에 섞인 영문자 (시안에서 "내가 정한 answer만"이 나왔다). 금지어가 아니라 한자·이모지와 같은 꼴 검사 */
const LATIN_RE = /[A-Za-z]/;
/** 반말·"~십시오" 어미. v4.27: "~세요"(권유 존댓말)·"~니다"(마무리 응원)·"~죠"는 허용 — 앱 주인이 고쳐 쓴 문장의 어미 */
const BAD_ENDING_RE = /(십시오|[하보가]자|라|(?<!니)다)[.!?]?$/;
const GOOD_ENDING_RE = /(요|죠|니다)[.!?]?$/;
/** 기간 약속: "3일 더 쓰면", "일주일만 기록하면", "열흘 뒤에는" */
const PROMISE_RE = /(\d+\s*(일|주|달|개월)|일주일|열흘|보름|한\s?달|며칠)\s*(더|만|쯤|정도)\s*(더\s*)?(쓰|기록|적으|지나|뒤|후)/;
/** 길흉 단정 */
const CERTAIN_RE = /(반드시|틀림없이|꼭\s*(이루어|성공|잘\s*될)|분명히\s*(좋|나쁘)|확실히\s*(좋|나쁘)|대박|망해)/;
/** v4.1 ⑤ 구조 서술 */
export const STRUCTURE_WORDS = ["글자", "짝이 되", "짝이 맞", "부딪히", "맞서", "한편이", "위아래", "윗글", "아랫글"] as const;
const SCORE_PHRASE_RE = /점\s*만점|만점에/;
/** v4.4: 올해·10년 단위 운 언급. 맥락(brief.context)에 그 문장이 없는 날 나오면 탈락 */
export const CONTEXT_MENTION_RE = /올해\s*(의\s*)?운|10년\s*단위/;
/** v4.13: 이달 운 언급. brief.month가 없는 날에만 막는다 */
export const MONTH_MENTION_RE = /(이달|이번 달)\s*(의\s*)?운/;
/** v4.13: 지시 대상 없는 추상어 */
export const ABSTRACT_RE = /(아쉽던|아쉬웠던|부족한|부족했던|모자란|모자랐던|넘치는|넘쳤던) (쪽|부분|자리)|넘치는 힘|힘이 (한곳|한 곳)(에|으로|로) 모이|(?<![을를] (?:\S+ )?)(채워|거들어|받쳐) 주는 (쪽|힘)|쪽으로 (작용|쓰이)|박자가 (안 맞|달라)/;
/** v4.13: 생·극 설명 */
export const SHENG_KE_RE = /누르|눌리|눌려|(?<![가-힣])[생극](하|해)|상생|상극/;
/** v4.16 5항: 판정 문장 — 내부 판단은 결과로만 말한다 */
export const JUDGEMENT_RE = /(맞는|안 맞는) (편|날|쪽)|(모자란|부족한|넉넉한|넘치는|필요한) (기운|힘|쪽)|(모자란|넉넉한|필요한) [목화토금수]\b|실속을 챙기는|기운(이|을|과|도)? ?(나를 |날 )?(거들|받쳐|채워|들어오|더해|보태|도와)|채워지는 (편|날)|거드는 (쪽|날)|받쳐 주는 (날|쪽)|과해지기 쉬|[목화토금수] 기운|[목화토금수]\((재성|관성|인성|비겁|식상)/;
/** v4.16 7항: 함축·비유 표현 → 실제 느낌·행동으로 */
/** v4.27: "기운이 움직·열리·도와"와 "돈 기운"은 뺐다 — 이론을 쉬운 말로 드러내면 '기운' 말이 필요하다 */
export const FIGURATIVE_RE = /손에 (잘 )?붙|자리가 넓어|실속이 (채워|쌓)|(좋은 )?신호가 (들어|와요)|흐름이 (열|트)|기회가 열/;
export const WORKPLACE_WORDS = ["거래처", "제안서", "보고서", "회의", "출근", "퇴근", "상사", "팀장", "동료", "업무"] as const;
export const CARE_DAY_REVERSAL_RE = /수월|순조|술술|(일이|막혀 있던 일이|막힌 일이|잘)\s?풀리/;
export const TIME_WORDS = ["아침", "점심", "저녁", "밤"] as const;
export const BACKREF_RE = /앞에서 본|앞서 본|앞서 말한|앞에서 말한|앞 블록|아까 본|아까 말한|앞 이야기에서/;
export const PROMISE_HEAD_RE = /^(그러면|그럼|그렇게 하면|그리하면|그래야|그래서 결국)\s/;
export const INTERNAL_WORDS = ["판정", "원국", "으로 나와요", "로 나와요", "사실표", "이 풀이는", "이 글은", "설계도", "근거 목록", "코어", "무대", "블록", "핵심 후보", "둘째 기운", "내부 판단"] as const;
export const METAPHOR_WORDS = ["손을 움직", "손으로 만든", "내 손에 있", "손수 ", "한낮의 해", "볕", "바위", "등불", "큰 산", "기름진 밭", "큰 강", "이슬", "덩굴", "큰 나무", "물통", "개울", "숲이", "두터운 흙", "열기가", "열기를", "빛을 품", "빛이 속", "불씨", "불꽃", "타오르", "따뜻한 볕", "불이 밖"] as const;
export const DEFINITION_RE = /(와|과)\s?[가-힣]{2,3}(을|를)\s?(합쳐|묶어|아울러)\s?[가-힣]{2,3}(이라|라)\s?(해요|하는데|부르|불러)|합쳐 부르는 말|묶어 부르는 말/;
// v4.26: 추정 장면을 허용한다("~있을 거예요"). 일어난 일로 단정하는 말만 막는다
export const PRESUME_RE = /있으시죠|있잖아요|겪어 보셨/;
/** 2026-11-17 제목 머리 검사 스위치 — 지난 49편으로 오탐을 센 뒤 앱 주인이 켠다(검사기 조이기 교훈) */
// 2026-11-17 앱 주인 "켜 줘" — 지난 63편에서 3건(셋 다 "미뤄둔/미루던"), 엉뚱하게 걸린 것 0
export const HEADLINE_OPENER_CHECK = true;
/** 제목 첫 낱말의 앞 두 글자("미뤄둔"·"미뤄 둔" → "미뤄"). "오늘·내·그동안·지금"처럼 어느 제목에나 오는 첫마디는 건너뛴다 */
const OPENER_SKIP = new Set(["오늘", "오늘은", "오늘도", "내", "그동안", "지금", "하루"]);
export function headlineOpener(h: string): string {
  const w = h.replace(/[,.!?·'"]/g, " ").split(/\s+/).filter(Boolean);
  const first = w.find((x) => !OPENER_SKIP.has(x)) ?? "";
  return first.slice(0, 2);
}
const RECORD_RE = /기록(했|이|을|한)|평균|\d+\s*번\s*(기록|썼|적)/;
const FIRST_CONNECTIVE_RE = /^(그래서|그러니|그러니까|그런데|그러다 보니)/;

/** v4.2: 영역 줄이 본문 첫 문장을 되풀이하면 탈락 */
export const AREA_OVERLAP_MAX = 0.6;
const tokensOf = (s: string): string[] => s.replace(/[.,!?'"()]/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
export function tokenOverlap(a: string, b: string): number {
  const ta = tokensOf(a), tb = new Set(tokensOf(b));
  if (ta.length < 3) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}
/** v4.9: 칸마다 같은 말 반복 — 영역 줄이 본문 어느 문장과든 이만큼 겹치면 탈락 */
export const REPEAT_OVERLAP_MAX = 0.5;
/** v4.27: 하면·피해요는 둘째 문단의 해결법을 한 줄로 쓰라고 했으니 본문과 뜻이 겹치는 게 정상이다. 거의 베낀 것만 막는다 (시안 7편 중 7편이 0.5에 걸려 수리 호출을 썼고 1편은 템플릿으로 떨어졌다) */
export const ACTION_COPY_MAX = 0.8;
/** v4.21 (ChatGPT 3차 7항): 최근 운세와의 겹침은 "거의 복사"일 때만 수리한다. 0.6에서는 같은 신호가 다시 나온 날의 비슷한 뜻까지 고치게 했다 —
 *  같은 사주 신호면 비슷한 말이 나오는 게 정상이고, 날짜 사이 반복은 품질 지표(scripts/fortune-judge)로 잰다 */
export const RECENT_COPY_MIN = 0.85;
const REPEAT_STOP = new Set(["오늘", "오늘은", "이달엔", "올해는", "평소", "평소엔", "평소보다", "하루예요", "날이에요", "있어요", "좋아요", "해요", "편이", "쪽이", "쪽으로", "조금", "한결"]);
const stemsOf = (s: string): string[] => tokensOf(s).filter((t) => !REPEAT_STOP.has(t)).map((t) => t.slice(0, 2));
export function stemOverlap(a: string, b: string): number {
  const sa = stemsOf(a), sb = new Set(stemsOf(b));
  if (sa.length < 3) return 0;
  return sa.filter((t) => sb.has(t)).length / sa.length;
}
function repeatedSentence(line: string, bodySents: string[], max: number = REPEAT_OVERLAP_MAX): string | null {
  let best: string | null = null, bestScore = 0;
  for (const s of bodySents) { const o = stemOverlap(line, s); if (o >= max && o > bestScore) { best = s; bestScore = o; } }
  return best;
}
const quoteHit = (s: string): string => `(본문 "${s.length > 28 ? s.slice(0, 28) + "…" : s}"와 같은 말 — 다른 장면·다른 행동으로)`;

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

const hasNieun = (ch: string): boolean => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 && k % 28 === 4; };
/** 일상어와 겹치는 전문용어 꼴을 뗀다 — 코어 validate.ts V06과 같은 규칙 */
function stripCommon(t: string): string {
  return t
    .replace(/상관\s?(없|하지|할 바|말고|이 없|안)/g, "")
    .replace(/편인(데|지)/g, "")
    .replace(/메시지/g, "")
    .replace(/지지(해|하|받|를\s?받|를\s?보내)/g, "")
    .replace(/지지\s?(않|말|마|도\s?않|는\s?않|요)/g, "").replace(/세운 (계획|목표|일정|원칙|기준|약속|순서)/g, "")   // v5: 사전 문장 "한번 세운 계획은", "짐을 혼자 지지 마세요"가 전문용어(세운·지지)로 잡혔다 — 동사 꼴은 뗀다
    .replace(/(할|될|올|갈|생길|있을|없을|모를|무슨|어떤|인) 일지/g, "")
    .replace(/일지(도|라도)?\s?모르/g, "")
    .replace(/(\S+) 편인/g, (m, w: string) => (hasNieun(w.at(-1)!) ? "" : m));
}

const WORD_STOP = new Set(["오늘", "내게", "내가", "나에", "그래", "그런", "그렇", "다만", "조금", "한번", "평소", "이에", "에요", "해요", "있어", "수 ", "좋아", "편이", "쪽이"]);
/** 본문에서 세 번 넘게 나온 낱말. 조사가 붙어 어절이 달라도 앞 두 글자가 같으면 같은 낱말로 센다 */
export function overusedWords(text: string, max: number = LIMITS.wordMax, extraStop: Iterable<string> = []): string[] {
  const stop = new Set([...WORD_STOP, ...extraStop]);
  const counts = new Map<string, number>();
  for (const w of text.replace(/[.,!?'"()\n]/g, " ").split(/\s+/)) {
    if (w.length < 2) continue;
    const stem = w.slice(0, 2);
    if (stop.has(stem)) continue;
    counts.set(stem, (counts.get(stem) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > max).map(([w, n]) => `${w}…×${n}`);
}

/** "~요" 뒤에 한글 없는 꼬리가 붙었으면 뗀다 (구조화 출력 끝 쓰레기 "않아요.1", "않아요.」") */
export function trimTail(s: string): string {
  const m = s.match(/^(.*요[.!?]?)([^가-힣]*)$/s);
  return m && m[2] ? m[1]! : s;
}

/** 본문 문장 배열 → 화면용 문자열 (두 문단). v4.27: split(둘째 문단 시작 번호)이 있으면 거기서, 없으면 옛 규칙(앞 두 문장 / 나머지) */
export function joinBody(sentences: readonly string[], split?: number): string {
  const s = sentences.map((x) => x.trim()).filter(Boolean);
  const at = split !== undefined && split > 0 && split < s.length ? split : 2;
  if (s.length <= at) return s.join(" ");
  return `${s.slice(0, at).join(" ")}\n\n${s.slice(at).join(" ")}`;
}

/** 모델 출력(또는 옛 꼴) → Draft. 본문 원소에 문장이 둘 이상 들었으면 문장으로 나눈다. 객체가 아니면 null */
export function normalizeDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<ModelText>;
  const str = (v: unknown) => (typeof v === "string" ? trimTail(v.trim()) : "");
  // v4.20: 배열 원소로 받은 문장은 마침표를 빼먹기도 한다(B 측정 8.6%) — 이어 붙이면 "쉬워요 그 마음이"가 된다. 끝이 한글이면 마침표를 붙인다
  const period = (x: string) => (/[가-힣]$/.test(x) ? `${x}.` : x);
  // v4.27: 작가는 first(첫째 문단)·second(둘째 문단)로 돌려준다. 옛 꼴(body)도 받는다
  const toSents = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? [raw] : []).flatMap((x) => splitSentences(x.replace(/\n+/g, " "))).map((x) => period(trimTail(x)));
  const two = t as { first?: unknown; second?: unknown };
  const hasTwo = Array.isArray(two.first) || Array.isArray(two.second);
  const first = hasTwo ? toSents(two.first) : [];
  const body = hasTwo ? [...first, ...toSents(two.second)] : toSents(t.body);
  const split = hasTwo && first.length > 0 && first.length < body.length ? first.length : undefined;
  const areaLines = Array.isArray(t.areaLines)
    ? t.areaLines.filter((a) => a && typeof a === "object").map((a) => ({ area: a.area, text: str(a.text) }))
    : Array.isArray(t.areas)
      ? t.areas.filter((a) => a && typeof a === "object").map((a) => ({ area: a.area, text: str(a.line) }))
      : [];
  return { headline: str(t.headline), body, ...(split !== undefined ? { split } : {}), areaLines, do: period(str(t.do)), dont: period(str(t.dont)) };
}

/** 이슈를 사람이 읽는 한 줄로 (기록·옛 테스트용) */
export const issueLine = (i: Issue): string => i.msg;

type Unit = { field: Exclude<IssueField, "whole">; index?: number; text: string };

/** 절기 이름이 문장에 나왔는가. "하지"·"대한"은 흔한 말("하지 마세요", "~에 대한")과 겹쳐 절기로 쓰인 꼴만 본다 (v5 시험에서 사전 문장 "혼자 결정해 버리지 마세요…하지 마세요"가 하지 무렵마다 걸렸다) */
export function mentionsTerm(s: string, name: string): boolean {
  if (name === "하지") return /(^|\s)하지(가|를|에|의|인|라|부터|까지|\s?절기|\s?무렵)/.test(s);
  if (name === "대한") return /(?<!에\s?)대한(이|을|은|의|에는|이라|\s?절기|\s?무렵)/.test(s);
  return s.includes(name);
}

/** 한 칸(문장 하나·제목·하면·피해요·영역 줄)에 대한 낱말 규칙 */
function lexicalIssues(u: Unit, b: FortuneBrief, add: (code: string, msg: string) => void): void {
  const s = u.text;
  // v5 (2026-11-14): 글의 몸이 앱 주인이 확정한 단락이라 문체 규칙(비유·성격 이름·구조 서술·직장 장면)은 보지 않는다. 사주 원어·숫자·넘지 말 선만 본다
  const lite = Boolean(b.v5);
  const plain = stripCommon(s);
  for (const w of b.banned) if (plain.includes(w)) add("banned", `금지어 "${w}"`);
  for (const w of b.jargon) if (plain.includes(w)) add("jargon", `전문용어 "${w}"`);
  const names = TEN_GOD_NAMES.filter((n) => plain.includes(n));
  if (names.length) add("tengod", `십신 이름 ${names.map((n) => `"${n}"`).join("·")} (이론 이름 대신 그 결과로 나타나는 마음·행동·상황)`);
  if (HANJA_RE.test(s)) add("hanja", "한자가 있음 (글은 한글로만)");
  if (LATIN_RE.test(s)) add("latin", "영문자가 있음 (글은 한글로만)");
  if (EMOJI_RE.test(s)) add("emoji", "이모지가 있음");
  // v4.27: 판정 문장(JUDGEMENT_RE)·추상어(ABSTRACT_RE)·생극(SHENG_KE_RE) 검사는 뺐다 — 이론을 쉬운 말로 드러낸다
  const fg = lite ? null : s.match(FIGURATIVE_RE); if (fg) add("figurative", `비유 "${fg[0]}" (사람이 실제로 느끼거나 하는 말로)`);
  if (!lite) for (const l of ABSTRACT_LABELS) if (s.includes(l)) add("label", `성격 이름 "${l}"을 그대로 씀 (생활 속 마음·행동으로)`);
  if (!lite && u.field !== "headline") for (const w of STRUCTURE_WORDS) if (s.includes(w)) add("structure", `구조 서술 "${w}"`);
  // 숫자: 계획에 있는 것만, 점수는 안 됨
  const allowed = new Set(b.allowedNumbers);
  const scoreValue = b.score?.value;
  const nums = [...new Set((s.match(NUMBER_RE) ?? []).map(Number))];
  const bad = nums.filter((n) => !allowed.has(n) && n !== scoreValue);
  if (bad.length) add("number", `사실에 없는 숫자 ${bad.join(", ")}`);
  if (scoreValue !== undefined && !allowed.has(scoreValue) && nums.includes(scoreValue)) add("score", `점수 숫자 ${scoreValue} (점수는 화면에 있으니 글에 쓰지 않기)`);
  if (SCORE_PHRASE_RE.test(s)) add("score", '점수 숫자 ("N점 만점" 꼴 — 점수는 화면에 있으니 글에 쓰지 않기)');
  if (!lite && u.field !== "headline" && u.field !== "area") for (const w of WORKPLACE_WORDS) if (s.includes(w)) add("workplace", `직장 장면 "${w}" (직업과 무관한 장면으로)`);
  if (b.today && b.today.useSolarTerm === false && b.today.solarTermName && mentionsTerm(s, b.today.solarTermName)) add("solar_term", `절기 이름 "${b.today.solarTermName}" (절기 첫날에만)`);
  if (PROMISE_RE.test(s)) add("promise", '기간 약속 ("N일 더 쓰면" 꼴)');
  if (CERTAIN_RE.test(s)) add("certain", "길흉 단정 표현");
  if (RECORD_RE.test(s)) add("record", "기록·평균 이야기 (내 기록 숫자는 카드가 보여 준다 — 글에 쓰지 않기)");
  if (u.field !== "area") {
    const ctx = b.context ?? [];
    if (CONTEXT_MENTION_RE.test(s) && !ctx.some((c) => /^(올해 운|지금 10년 단위 운)/.test(c))) add("context", "오늘만: 계획에 없는 올해·10년 단위 운을 말함");
    if (!b.month && MONTH_MENTION_RE.test(s)) add("month", "이달 운 재료가 없는데 이달 운을 말함");
  }
  for (const w of INTERNAL_WORDS) if (s.includes(w)) { add("internal", `속으로 쓰는 말 "${w}"`); break; }
}

/** 문장(본문·하면·피해요·영역 줄) 어미 */
function endingIssues(u: Unit, add: (code: string, msg: string) => void): void {
  const s = u.text.trim();
  if (BAD_ENDING_RE.test(s)) add("ending", `명령조·반말·"~니다" 어미: "${s.slice(-12)}"`);
  else if (!GOOD_ENDING_RE.test(s)) add("ending", `"~요"로 끝나지 않음 "${s.slice(-8)}"`);
}

/** v4.19: 핵심이 본문에 들어갔는가 — 핵심 기운의 뜻·표현 후보와 어간이 하나도 겹치지 않으면 핵심 누락 */
export function coreCovered(body: readonly string[], coreStems: readonly string[]): boolean {
  if (!coreStems.length) return true;
  const set = new Set(coreStems);
  const text = body.join(" ").replace(/[.,!?'"()·]/g, " ");
  return text.split(/\s+/).some((w) => w.length >= 2 && set.has(w.slice(0, 2)));
}

/**
 * v4.19 검사. 이슈가 없으면 빈 배열. 같은 칸에 사유가 여럿이면 이슈도 여럿(수리 요청이 한 항목으로 묶는다).
 * brief.plan이 없으면(옛 테스트가 만든 brief) 핵심 누락은 보지 않는다.
 */
export function checkDraft(d: Draft | null, b: FortuneBrief, opts: { minBody?: number } = {}): Issue[] {
  const issues: Issue[] = [];
  if (!d) return [{ code: "json", field: "whole", msg: "JSON이 아님" }];
  const push = (field: IssueField, index: number | undefined, code: string, msg: string) => issues.push({ code, field, ...(index !== undefined ? { index } : {}), msg });
  const at = (field: IssueField, index?: number) => (code: string, msg: string) => push(field, index, code, field === "body" ? `본문 ${index! + 1}번째 문장: ${msg}` : field === "area" ? `areaLines[${index}]: ${msg}` : `${field}: ${msg}`);

  if (!d.body.length) return [{ code: "empty_body", field: "whole", msg: "본문이 비어 있음" }];
  for (const k of ["headline", "do", "dont"] as const) if (!d[k].trim()) push(k, undefined, "empty", `${k}가 비어 있음`);

  const body = d.body;
  const [minDraft, maxS] = LIMITS.bodySentences;
  const minS = opts.minBody ?? minDraft;   // 수리·지우기 뒤에는 3문장까지 쓴다 (LIMITS.bodyKeepMin)
  if (body.length < minS || body.length > maxS) push("whole", undefined, "body_count", `본문 ${body.length}문장 (${minDraft}~${maxS}문장)`);
  const lite = Boolean(b.v5);   // v5: 핵심 누락·본보기 베낌·넘겨짚기 검사는 하지 않는다 — 사전 단락을 그대로 쓰는 것이 정상이다
  if (b.plan && !lite && !coreCovered(body, b.plan.coreStems)) push("whole", undefined, "core_missing", `핵심("${b.plan.core.meaning}" 쪽 — ${b.plan.core.expressions[0] ?? ""})이 본문에 보이지 않음`);

  // ---- 본문 문장마다 ----
  const exSentences = FORTUNE_EXAMPLES.flatMap((e) => splitSentences(e.text.body.replace(/\n+/g, " ")));
  const recentLines = b.avoid?.lines ?? [];
  body.forEach((s, i) => {
    const add = at("body", i);
    lexicalIssues({ field: "body", index: i, text: s }, b, add);
    endingIssues({ field: "body", index: i, text: s }, add);
    if (s.length > LIMITS.sentenceMax) add("length", `${s.length}자 (${LIMITS.sentenceMax}자 안)`);
    else if (s.length < LIMITS.sentenceMin) add("length", `${s.length}자 (${LIMITS.sentenceMin}자 이상)`);
    const back = s.match(BACKREF_RE); if (back) add("backref", `되받는 말 "${back[0]}"`);
    const def = s.match(DEFINITION_RE); if (def) add("definition", `정의문 "${def[0]}"`);
    // v4.28: 사물 비유 검사(METAPHOR_WORDS)는 뺐다 — 앱 주인 글이 "스포츠카처럼 달리다 사고", "능구렁이처럼"을 쓴다. 목록은 측정용으로 남긴다
    if (!lite && EXEMPLAR_SENTENCES.some((x) => tokenOverlap(s, x) >= 0.85)) add("exemplar_copy", "본보기(앱 주인 글) 문장을 거의 그대로 옮김");
    const pres = lite ? null : s.match(PRESUME_RE); if (pres) add("presume", `넘겨짚는 말 "${pres[0]}"`);
    if (!lite && exSentences.some((x) => tokenOverlap(s, x) >= 0.7)) add("example_copy", "예시 문장을 베낌");
    const hit = recentLines.find((r) => r.lines.some((line) => s.trim() === line.trim() || tokenOverlap(s, line) >= RECENT_COPY_MIN));
    if (hit) add("recent_line", `최근(${hit.date}) 문장을 거의 그대로 씀`);
  });
  // 본문 전체 규칙 → 그 규칙을 처음 넘긴 문장
  if (FIRST_CONNECTIVE_RE.test(body[0] ?? "")) at("body", 0)("connective", "첫 문장이 이음말로 시작");
  // v4.27: '그래서' 2회·이음말 3개 검사는 뺐다 — 앱 주인 지적 10건이 "접속사가 없다·이어지지 않는다"였다
  const seenTimes: string[] = [];
  body.forEach((s, i) => { for (const w of TIME_WORDS) if (s.includes(w) && !seenTimes.includes(w)) { seenTimes.push(w); if (seenTimes.length === 3) at("body", i)("time_list", `시간대 나열 (${seenTimes.join("·")}) — 장면 1~2개만`); } });
  // v4.20 (ChatGPT 2차 3항): "같은 낱말 세 번까지" 탈락은 없앴다 — "결정을… 그 결정은"처럼 뜻을 분명히 하는 반복까지 막았다
  // 최근 3일 첫 문장 겹침
  for (const r of b.recent ?? []) {
    const first = splitSentences(r.start)[0] ?? "";
    if (first && (body[0]!.trim() === first.trim() || tokenOverlap(body[0]!, first) >= RECENT_COPY_MIN)) { at("body", 0)("recent_start", `최근(${r.date}) 운세 첫 문장과 겹침`); break; }
  }

  // ---- 제목 ----
  if (d.headline.trim()) {
    const add = at("headline");
    lexicalIssues({ field: "headline", text: d.headline }, b, add);
    if (d.headline.length > LIMITS.headlineMax) add("length", `${d.headline.length}자 (${LIMITS.headlineMax}자 안)`);
    for (const e of FORTUNE_EXAMPLES) if (d.headline.trim() === e.text.headline) add("example_copy", `예시 제목을 그대로 씀`);
    if (!lite && EXEMPLAR_SENTENCES.includes(d.headline.trim())) add("exemplar_copy", "본보기 제목을 그대로 씀");
    const same14 = (b.avoid?.headlines ?? []).find((h) => d.headline.trim() === h.trim());
    if (same14) add("recent_headline", `최근 14일 제목과 같음 "${same14}"`);
    else { const r3 = (b.recent ?? []).find((r) => tokenOverlap(d.headline, r.headline) >= RECENT_COPY_MIN); if (r3) add("recent_headline", `최근(${r3.date}) 제목과 겹침 "${r3.headline}"`); }
    // 2026-11-17 제목 머리(앱 주인 "추천대로" — 지시를 늘리지 않고 제목 한 줄만 고쳐 쓰게): 사흘 안 제목과 첫 낱말이 같으면. 켜기 전에 지난 글로 잰다
    if (HEADLINE_OPENER_CHECK && !same14) { const o = headlineOpener(d.headline); const r = o ? (b.recent ?? []).find((x) => headlineOpener(x.headline) === o) : undefined; if (r) add("recent_headline", `최근(${r.date}) 제목과 첫 낱말이 같음 "${r.headline}"`); }
  }

  // ---- 하면·피해요 ----
  for (const k of ["do", "dont"] as const) {
    const v = d[k];
    if (!v.trim()) continue;
    const add = at(k);
    lexicalIssues({ field: k, text: v }, b, add);
    endingIssues({ field: k, text: v }, add);
    if (splitSentences(v).length !== 1) add("one_sentence", "1문장이어야 함");
    if (v.length > LIMITS.doDontMax) add("length", `${v.length}자 (${LIMITS.doDontMax}자 안)`);
    const hit = repeatedSentence(v, body, ACTION_COPY_MAX);
    if (hit) add("repeat", `본문 문장을 거의 그대로 옮김 ${quoteHit(hit)}`);
    // v4.20: 최근 3일 하면·피해요와 거의 같으면 그 칸만 고친다 (주의인 날마다 같은 하면이 나왔다). v4.21: 거의 복사(RECENT_COPY_MIN)만
    const prev = (b.avoid?.actions ?? []).find((r) => r.lines.some((x) => v.trim() === x.trim() || tokenOverlap(v, x) >= RECENT_COPY_MIN));
    if (prev) add("recent_action", `최근(${prev.date}) 하면·피해요와 겹침`);
    for (const e of FORTUNE_EXAMPLES) if (v === e.text[k]) { add("example_copy", "예시 하면·피해요를 그대로 씀"); break; }
    if (!lite && EXEMPLAR_SENTENCES.includes(v.trim())) add("exemplar_copy", "본보기 하면·피해요를 그대로 씀");
  }

  // ---- 영역 줄 ----
  d.areaLines.forEach((a, i) => {
    const add = at("area", i);
    const line = a.text;
    if (!line.trim()) { add("empty", "비어 있음"); return; }
    lexicalIssues({ field: "area", index: i, text: line }, b, add);
    endingIssues({ field: "area", index: i, text: line }, add);
    if (splitSentences(line).length !== 1) add("one_sentence", "1문장이어야 함");
    if (line.length > LIMITS.areaLineMax) add("length", `${line.length}자 (${LIMITS.areaLineMax}자 안)`);
    if (tokenOverlap(line, body[0]!) >= AREA_OVERLAP_MAX) add("repeat", "본문 첫 문장과 겹침");
    else { const hit = repeatedSentence(line, body); if (hit) add("repeat", `본문 문장을 되풀이함 ${quoteHit(hit)}`); }
    const period = b.areas?.find((x) => x.area === a.area)?.period;
    if (period && period !== "오늘") for (const r of b.recent ?? []) for (const prev of r.areas ?? []) if (line.trim() === prev.trim() || tokenOverlap(line, prev) >= 0.6) add("recent_line", `${period} 줄이 최근(${r.date}) 줄과 겹침`);
  });

  return lite ? issues.filter((i) => V5_CHECKS.has(i.code)) : issues;
}

/** 옛 호출 꼴: 사유 문자열 목록 (테스트·검수용). 모델 출력 꼴(ModelText)이나 Draft를 받는다 */
export function validateFortuneText(t: ModelText | Draft | null | undefined, b: FortuneBrief): string[] {
  return checkDraft(normalizeDraft(t), b).map(issueLine);
}
