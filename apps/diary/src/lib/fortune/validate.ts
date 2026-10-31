// 3단계 — 출력 검사기. "brief에 없는 것은 글에 나올 수 없다"를 기계로 확인한다.
// v4.19 (2026-10-31, ChatGPT 검토 반영): 문자열 사유 목록 대신 구조화된 이슈 [{code, field, index?, msg}]를 돌려준다 — 걸린 칸·문장만 수리(llm.ts)하기 위해.
//   field = headline | body(index = 문장 번호) | area(index = areaLines 번호) | do | dont | whole(글 전체 — 다시 쓰기 대상).
//   whole은 JSON 깨짐·문장이 너무 적음·핵심 누락뿐이다. 나머지 규칙은 모두 그 규칙을 어긴 문장 하나를 가리킨다.
//   반복 정책: v4.16의 "최근 7일 태그 2칸 겹침 → 통째 거부"는 없앴다. 최근 제목 완전 동일(14일)·최근 3일 제목 겹침·최근 3일 첫 문장 동일·
//   최근 7일 문장과 높은 유사도는 그 칸(문장)만 수리 대상이다. 같은 주제가 다시 오는 것은 괜찮다(표현 면은 계획의 피할것이 돌린다).
// 검사 항목(전부 v4.18에서 옮김): 금지어 · 전문용어 · 십신 이름 · 판정 문장 · 비유 · 성격 이름 · 추상어 · 생·극 · 구조 서술 · 한자 · 이모지 · 숫자 날조 · 점수 숫자
//   · 어미(~요)·명령조 · 기간 약속 · 단정 · 직장 장면 · 주의인 날 반전 말 · 시간대 나열 · 절기 · 맥락 없는 운 언급 · 기록·평균 · 문장 길이 · 같은 낱말 · 이음말
//   · 결과 약속 · 되받기 · 정의문 · 속말 · 사물 비유 · 넘겨짚기 · 예시 베낌 · 칸 되풀이(영역·하면·피해요가 본문 문장과 같은 말) · 분량.
import type { FortuneBrief } from "./brief";
import { ABSTRACT_LABELS, NUMBER_RE, TEN_GOD_NAMES } from "./brief";
import { FORTUNE_EXAMPLES } from "./examples";
import type { AreaName } from "./types";

/** v4.19: 모델(작가)이 돌려주는 글 */
export interface Draft {
  headline: string;
  /** 본문 문장 (4~5개) */
  body: string[];
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
/** 다시 쓰기(글 전체)가 필요한 이슈 — 나머지는 걸린 문장만 고친다 */
export const REWRITE_CODES: ReadonlySet<string> = new Set(["json", "empty_body", "body_count", "core_missing"]);
export const needsRewrite = (issues: readonly Issue[]): boolean => issues.some((i) => i.field === "whole" || REWRITE_CODES.has(i.code));

export const LIMITS = {
  headlineMax: 22,
  /** v4.19: 본문 문장 4~5개를 요청했다. v4.20: 3~5개를 요청하고 6까지는 받는다(내용이 적은 날 채우려고 장면을 지어내지 않게) */
  bodySentences: [3, 6] as const,
  bodyKeepMin: 3,
  areaLineMax: 70,
  doDontMax: 45,
  sentenceMin: 12,
  sentenceMax: 85,
  /** 같은 낱말(어절 앞 두 글자)은 본문에서 세 번까지 — v4.20부터 검사기는 이걸로 탈락시키지 않는다(overusedWords는 측정용으로 남김) */
  wordMax: 3,
} as const;

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}]/u;
const HANJA_RE = /[㐀-鿿]/;
/** 명령조·반말·"~입니다" 어미 */
const BAD_ENDING_RE = /(세요|십시오|[하보가]자|라|다)[.!?]?$/;
const GOOD_ENDING_RE = /요[.!?]?$/;
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
export const FIGURATIVE_RE = /손에 (잘 )?붙|자리가 넓어|기운이 (움직|열리|도와)|실속이 (채워|쌓)|(좋은 )?신호가 (들어|와요)|돈 기운|흐름이 (열|트)|기회가 열/;
export const WORKPLACE_WORDS = ["거래처", "제안서", "보고서", "회의", "출근", "퇴근", "상사", "팀장", "동료", "업무"] as const;
export const CARE_DAY_REVERSAL_RE = /수월|순조|술술|(일이|막혀 있던 일이|막힌 일이|잘)\s?풀리/;
export const TIME_WORDS = ["아침", "점심", "저녁", "밤"] as const;
export const BACKREF_RE = /앞에서 본|앞서 본|앞서 말한|앞에서 말한|앞 블록|아까 본|아까 말한|앞 이야기에서/;
export const PROMISE_HEAD_RE = /^(그러면|그럼|그렇게 하면|그리하면|그래야|그래서 결국)\s/;
export const INTERNAL_WORDS = ["판정", "원국", "으로 나와요", "로 나와요", "사실표", "이 풀이는", "이 글은", "설계도", "근거 목록", "코어", "무대", "블록", "핵심 후보", "둘째 기운", "내부 판단"] as const;
export const METAPHOR_WORDS = ["손을 움직", "손으로 만든", "내 손에 있", "손수 ", "한낮의 해", "볕", "바위", "등불", "큰 산", "기름진 밭", "큰 강", "이슬", "덩굴", "큰 나무", "물통", "개울", "숲이", "두터운 흙", "열기가", "열기를", "빛을 품", "빛이 속", "불씨", "불꽃", "타오르", "따뜻한 볕", "불이 밖"] as const;
export const DEFINITION_RE = /(와|과)\s?[가-힣]{2,3}(을|를)\s?(합쳐|묶어|아울러)\s?[가-힣]{2,3}(이라|라)\s?(해요|하는데|부르|불러)|합쳐 부르는 말|묶어 부르는 말/;
export const PRESUME_RE = /있을 거예요|있으시죠|있으실 거예요|있잖아요|겪어 보셨/;
const RECORD_RE = /기록(했|이|을|한)|평균|\d+\s*번\s*(기록|썼|적)/;
const CONNECTIVE_RE = /^(그래서|그러니|그러니까|그런데|그래도|그러다 보니|하지만)/;
const FIRST_CONNECTIVE_RE = /^(그래서|그러니|그러니까|그런데|그러다 보니)/;

/** v4.2: 영역 줄이 본문 첫 문장을 되풀이하면 탈락 */
export const AREA_OVERLAP_MAX = 0.6;
const tokensOf = (s: string): string[] => s.replace(/[.,!?'"()]/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
export function tokenOverlap(a: string, b: string): number {
  const ta = tokensOf(a), tb = new Set(tokensOf(b));
  if (ta.length < 3) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}
/** v4.9: 칸마다 같은 말 반복 — 영역 줄·do·dont가 본문 어느 문장과든 이만큼 겹치면 탈락 */
export const REPEAT_OVERLAP_MAX = 0.5;
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
function repeatedSentence(line: string, bodySents: string[]): string | null {
  let best: string | null = null, bestScore = 0;
  for (const s of bodySents) { const o = stemOverlap(line, s); if (o >= REPEAT_OVERLAP_MAX && o > bestScore) { best = s; bestScore = o; } }
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
    .replace(/지지\s?(않|말|도\s?않|는\s?않|요)/g, "")
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

/** 본문 문장 배열 → 화면용 문자열 (두 문단: 앞 두 문장 / 나머지). 옛 캐시와 같은 꼴 */
export function joinBody(sentences: readonly string[]): string {
  const s = sentences.map((x) => x.trim()).filter(Boolean);
  if (s.length <= 2) return s.join(" ");
  return `${s.slice(0, 2).join(" ")}\n\n${s.slice(2).join(" ")}`;
}

/** 모델 출력(또는 옛 꼴) → Draft. 본문 원소에 문장이 둘 이상 들었으면 문장으로 나눈다. 객체가 아니면 null */
export function normalizeDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<ModelText>;
  const str = (v: unknown) => (typeof v === "string" ? trimTail(v.trim()) : "");
  // v4.20: 배열 원소로 받은 문장은 마침표를 빼먹기도 한다(B 측정 8.6%) — 이어 붙이면 "쉬워요 그 마음이"가 된다. 끝이 한글이면 마침표를 붙인다
  const period = (x: string) => (/[가-힣]$/.test(x) ? `${x}.` : x);
  const bodyRaw = Array.isArray(t.body) ? t.body.map(String) : typeof t.body === "string" ? [t.body] : [];
  const body = bodyRaw.flatMap((x) => splitSentences(x.replace(/\n+/g, " "))).map((x) => period(trimTail(x)));
  const areaLines = Array.isArray(t.areaLines)
    ? t.areaLines.filter((a) => a && typeof a === "object").map((a) => ({ area: a.area, text: str(a.text) }))
    : Array.isArray(t.areas)
      ? t.areas.filter((a) => a && typeof a === "object").map((a) => ({ area: a.area, text: str(a.line) }))
      : [];
  return { headline: str(t.headline), body, areaLines, do: period(str(t.do)), dont: period(str(t.dont)) };
}

/** 이슈를 사람이 읽는 한 줄로 (기록·옛 테스트용) */
export const issueLine = (i: Issue): string => i.msg;

type Unit = { field: Exclude<IssueField, "whole">; index?: number; text: string };

/** 한 칸(문장 하나·제목·하면·피해요·영역 줄)에 대한 낱말 규칙 */
function lexicalIssues(u: Unit, b: FortuneBrief, add: (code: string, msg: string) => void): void {
  const s = u.text;
  const plain = stripCommon(s);
  for (const w of b.banned) if (plain.includes(w)) add("banned", `금지어 "${w}"`);
  for (const w of b.jargon) if (plain.includes(w)) add("jargon", `전문용어 "${w}"`);
  const names = TEN_GOD_NAMES.filter((n) => plain.includes(n));
  if (names.length) add("tengod", `십신 이름 ${names.map((n) => `"${n}"`).join("·")} (이론 이름 대신 그 결과로 나타나는 마음·행동·상황)`);
  if (HANJA_RE.test(s)) add("hanja", "한자가 있음 (글은 한글로만)");
  if (EMOJI_RE.test(s)) add("emoji", "이모지가 있음");
  const jm = s.match(JUDGEMENT_RE); if (jm) add("judgement", `판정 문장 "${jm[0]}" (맞는 편·모자란·넉넉한·실속·기운이 거든다는 말 대신 실제 결과로)`);
  const fg = s.match(FIGURATIVE_RE); if (fg) add("figurative", `비유 "${fg[0]}" (사람이 실제로 느끼거나 하는 말로)`);
  for (const l of ABSTRACT_LABELS) if (s.includes(l)) add("label", `성격 이름 "${l}"을 그대로 씀 (생활 속 마음·행동으로)`);
  const ab = s.match(ABSTRACT_RE); if (ab) add("abstract", `추상어 "${ab[0]}" (무엇이 모자라고 넘치는지 이름 없는 말)`);
  const sk = s.match(SHENG_KE_RE); if (sk) add("shengke", `생·극 설명 "${sk[0]}"`);
  if (u.field !== "headline") for (const w of STRUCTURE_WORDS) if (s.includes(w)) add("structure", `구조 서술 "${w}"`);
  // 숫자: 계획에 있는 것만, 점수는 안 됨
  const allowed = new Set(b.allowedNumbers);
  const scoreValue = b.score?.value;
  const nums = [...new Set((s.match(NUMBER_RE) ?? []).map(Number))];
  const bad = nums.filter((n) => !allowed.has(n) && n !== scoreValue);
  if (bad.length) add("number", `사실에 없는 숫자 ${bad.join(", ")}`);
  if (scoreValue !== undefined && !allowed.has(scoreValue) && nums.includes(scoreValue)) add("score", `점수 숫자 ${scoreValue} (점수는 화면에 있으니 글에 쓰지 않기)`);
  if (SCORE_PHRASE_RE.test(s)) add("score", '점수 숫자 ("N점 만점" 꼴 — 점수는 화면에 있으니 글에 쓰지 않기)');
  if (u.field !== "headline" && u.field !== "area") for (const w of WORKPLACE_WORDS) if (s.includes(w)) add("workplace", `직장 장면 "${w}" (직업과 무관한 장면으로)`);
  if (b.today && b.today.useSolarTerm === false && b.today.solarTermName && s.includes(b.today.solarTermName)) add("solar_term", `절기 이름 "${b.today.solarTermName}" (절기 첫날에만)`);
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
  if (body.length < minS || body.length > maxS) push("whole", undefined, "body_count", `본문 ${body.length}문장 (${minDraft}~5문장)`);
  if (b.plan && !coreCovered(body, b.plan.coreStems)) push("whole", undefined, "core_missing", `핵심("${b.plan.core.meaning}" 쪽 — ${b.plan.core.expressions[0] ?? ""})이 본문에 보이지 않음`);

  // ---- 본문 문장마다 ----
  const exSentences = FORTUNE_EXAMPLES.flatMap((e) => splitSentences(e.text.body.replace(/\n+/g, " ")));
  const recentLines = b.avoid?.lines ?? [];
  body.forEach((s, i) => {
    const add = at("body", i);
    lexicalIssues({ field: "body", index: i, text: s }, b, add);
    endingIssues({ field: "body", index: i, text: s }, add);
    if (s.length > LIMITS.sentenceMax) add("length", `${s.length}자 (${LIMITS.sentenceMax}자 안)`);
    else if (s.length < LIMITS.sentenceMin) add("length", `${s.length}자 (${LIMITS.sentenceMin}자 이상)`);
    if (PROMISE_HEAD_RE.test(s)) add("promise_head", `결과를 약속하는 문장 ('그러면 ~해져요' 꼴은 쓰지 않음)`);
    const back = s.match(BACKREF_RE); if (back) add("backref", `되받는 말 "${back[0]}"`);
    const def = s.match(DEFINITION_RE); if (def) add("definition", `정의문 "${def[0]}"`);
    const meta = METAPHOR_WORDS.find((w) => s.includes(w)); if (meta) add("metaphor", `비유 낱말 "${meta}" (사물 그림으로 이유를 대지 않음)`);
    const pres = s.match(PRESUME_RE); if (pres) add("presume", `넘겨짚는 말 "${pres[0]}"`);
    if (b.score?.band === "주의" && !/이달|이번 달|올해|10년/.test(s)) { const m = s.match(CARE_DAY_REVERSAL_RE); if (m) add("reversal", `주의인 날 반전 말 "${m[0]}"`); }
    if (exSentences.some((x) => tokenOverlap(s, x) >= 0.7)) add("example_copy", "예시 문장을 베낌");
    const hit = recentLines.find((r) => r.lines.some((line) => s.trim() === line.trim() || tokenOverlap(s, line) >= RECENT_COPY_MIN));
    if (hit) add("recent_line", `최근(${hit.date}) 문장을 거의 그대로 씀`);
  });
  // 본문 전체 규칙 → 그 규칙을 처음 넘긴 문장
  if (FIRST_CONNECTIVE_RE.test(body[0] ?? "")) at("body", 0)("connective", "첫 문장이 이음말로 시작");
  { let n = 0; body.forEach((s, i) => { const c = (s.match(/그래서/g) ?? []).length; if (n < 2 && n + c >= 2) at("body", i)("so", "'그래서'가 두 번째 (본문에 한 번까지)"); n += c; }); }
  const conn = body.map((s, i) => (CONNECTIVE_RE.test(s) ? i : -1)).filter((i) => i >= 0);
  if (body.length >= 4 && conn.length >= 3) at("body", conn[2]!)("connectives", `이음말로 시작하는 문장이 ${conn.length}개`);
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
    const same14 = (b.avoid?.headlines ?? []).find((h) => d.headline.trim() === h.trim());
    if (same14) add("recent_headline", `최근 14일 제목과 같음 "${same14}"`);
    else { const r3 = (b.recent ?? []).find((r) => tokenOverlap(d.headline, r.headline) >= RECENT_COPY_MIN); if (r3) add("recent_headline", `최근(${r3.date}) 제목과 겹침 "${r3.headline}"`); }
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
    const hit = repeatedSentence(v, body);
    if (hit) add("repeat", `본문 문장을 되풀이함 ${quoteHit(hit)}`);
    // v4.20: 최근 3일 하면·피해요와 거의 같으면 그 칸만 고친다 (주의인 날마다 같은 하면이 나왔다). v4.21: 거의 복사(RECENT_COPY_MIN)만
    const prev = (b.avoid?.actions ?? []).find((r) => r.lines.some((x) => v.trim() === x.trim() || tokenOverlap(v, x) >= RECENT_COPY_MIN));
    if (prev) add("recent_action", `최근(${prev.date}) 하면·피해요와 겹침`);
    for (const e of FORTUNE_EXAMPLES) if (v === e.text[k]) { add("example_copy", "예시 하면·피해요를 그대로 씀"); break; }
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

  return issues;
}

/** 옛 호출 꼴: 사유 문자열 목록 (테스트·검수용). 모델 출력 꼴(ModelText)이나 Draft를 받는다 */
export function validateFortuneText(t: ModelText | Draft | null | undefined, b: FortuneBrief): string[] {
  return checkDraft(normalizeDraft(t), b).map(issueLine);
}
