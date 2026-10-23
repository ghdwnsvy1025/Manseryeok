// 3단계 — 출력 검사기. "brief에 없는 것은 글에 나올 수 없다"를 기계로 확인한다. 사유가 하나라도 있으면 그 글은 쓰지 않는다(재작성 → 템플릿).
// 검사 항목: 금지어 · 전문용어 · 한자 · 이모지 · 숫자 날조 · 어미(~어요) · 명령조 · 기간 약속 · 문장 수 · 영역 부분집합 · 길이 상한 · 기록·평균 금지(v4.17) · 구조 서술(v4.1) · 맥락 없는 운 언급(v4.4)
//           · 점수 숫자(v4.2) · 영역 줄이 본문 첫 문장과 60% 이상 겹침(v4.2) · 칸 되풀이(v4.9) · 이음말(v4.10) · 칸만 다시 쓰기(v4.14)
//           · v4.16 (2026-10-24, 사용자 수정 방향): 본문에 십신·오행 이름과 판정 문장("맞는 편·모자란·넉넉한·실속·기운이 거든다")이 나오면 탈락 — 이론은 내부 판단으로만.
//             비유("손에 붙어요·흐름이 열려요") 탈락. 판단(후보 3~5·핵심·구조 A~E)과 태그 8칸이 있어야 하고, 최근 7일 태그와 2칸 이상 뜻이 같으면 탈락(제목뜻은 14일). areas는 입력의 부분집합 0~3개.
//             문장 규칙(v4.15에서 옮김): 한 문장 12~85자, 같은 낱말 3회, 결과 약속·되받기·정의문·비유 낱말·내부 말투 금지.
import type { FortuneBrief } from "./brief";
import { ABSTRACT_LABELS, hasContextFact, NUMBER_RE, TEN_GOD_NAMES } from "./brief";
import { FORTUNE_EXAMPLES, joinBlocks, TAG_KEYS, type FortuneBlock, type FortuneJudge, type FortuneTags } from "./examples";
import type { AreaName, AreaPeriod } from "./types";

/** 모델이 돌려주는 JSON */
export interface ModelText {
  /** v4.10: 뼈대 한 줄. v4.16부터는 판단.핵심이 대신한다 (옛 테스트 호환) */
  핵심?: string;
  /** v4.16: 글보다 먼저 정한 판단 */
  판단?: FortuneJudge;
  /** v4.16: 의미 태그 */
  태그?: FortuneTags;
  headline: string;
  /** v4.15 블록 (v4.16부터 모델은 보내지 않는다. 있으면 블록 검사) */
  blocks?: FortuneBlock[];
  body: string;
  /** v4.2: period는 brief.areas와 같은 순서로 돌려받는다 (빠지면 brief 것으로 본다) */
  areas: { period?: AreaPeriod; area: AreaName; line: string }[];
  do: string;
  dont: string;
}

export const LIMITS = {
  headlineMax: 22,
  /** v4.16: 4~7문장, 2~3문단 */
  bodySentences: [4, 7] as const,
  bodyMax: 600,
  areaLineMax: 70,
  doDontMax: 45,
  /** v4.15 (코어 블록 규칙 8): 한 문장 12~85자. v4.16: 본문 문장에 적용 */
  sentenceMin: 12,
  sentenceMax: 85,
  blockSentences: 2,
  /** 같은 낱말(어절)은 본문에서 세 번까지 */
  wordMax: 3,
  /** v4.16: areas는 입력 가운데 최대 3개 */
  areasMax: 3,
  /** v4.16: 최근 7일 가운데 어느 하루와 태그가 이만큼 같으면 탈락 */
  tagSameMax: 2,
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
/** v4.4: 올해·10년 단위 운 언급. facts에 맥락 문장이 없는 날 headline·body·do·dont에 나오면 탈락 */
export const CONTEXT_MENTION_RE = /올해\s*(의\s*)?운|10년\s*단위/;
/** v4.13: 이달 운 언급. brief.month가 없는 날에만 막는다 */
export const MONTH_MENTION_RE = /(이달|이번 달)\s*(의\s*)?운/;
/** v4.13: 지시 대상 없는 추상어 */
export const ABSTRACT_RE = /(아쉽던|아쉬웠던|부족한|부족했던|모자란|모자랐던|넘치는|넘쳤던) (쪽|부분|자리)|넘치는 힘|힘이 (한곳|한 곳)(에|으로|로) 모이|(?<![을를] (?:\S+ )?)(채워|거들어|받쳐) 주는 (쪽|힘)|쪽으로 (작용|쓰이)|박자가 (안 맞|달라)/;
/** v4.13: 생·극 설명 */
export const SHENG_KE_RE = /누르|눌리|눌려|(?<![가-힣])[생극](하|해)|상생|상극/;
/**
 * v4.16 5항: 판정 문장 — 내부 판단은 결과로만 말한다. "맞는 편이에요·안 맞는 날·모자란 토·넉넉한 기운·실속을 챙기는 힘·기운이 거들어·채워지는 날" 탈락.
 * ("필요한" 홀로는 일상어라 두고, "기운"이 붙은 꼴만)
 */
export const JUDGEMENT_RE = /(맞는|안 맞는) (편|날|쪽)|(모자란|부족한|넉넉한|넘치는|필요한) (기운|힘|쪽)|(모자란|넉넉한|필요한) [목화토금수]\b|실속을 챙기는|기운(이|을|과|도)? ?(나를 |날 )?(거들|받쳐|채워|들어오|더해|보태|도와)|채워지는 (편|날)|거드는 (쪽|날)|받쳐 주는 (날|쪽)|과해지기 쉬|[목화토금수] 기운|[목화토금수]\((재성|관성|인성|비겁|식상)/;
/** v4.16 7항: 함축·비유 표현 → 실제 느낌·행동으로 */
export const FIGURATIVE_RE = /손에 (잘 )?붙|자리가 넓어|기운이 (움직|열리|도와)|실속이 (채워|쌓)|(좋은 )?신호가 (들어|와요)|돈 기운|흐름이 (열|트)|기회가 열/;
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

/** v4.14: 사유가 전부 한 칸짜리(areas[i]·do·dont)면 그 칸들을 돌려준다 */
export interface SlotIssues { areas: number[]; do: boolean; dont: boolean }
export function slotIssues(issues: string[]): SlotIssues | null {
  const out: SlotIssues = { areas: [], do: false, dont: false };
  for (const i of issues) {
    const m = i.match(/^areas\[(\d+)\] /);
    if (m) { const n = Number(m[1]); if (!out.areas.includes(n)) out.areas.push(n); continue; }
    if (/^do(가|는) |^do \d+자/.test(i)) { out.do = true; continue; }
    if (/^dont(가|는) |^dont \d+자/.test(i)) { out.dont = true; continue; }
    if (i.startsWith("예시 do·dont를 그대로 씀")) { out.do = true; out.dont = true; continue; }
    return null;
  }
  return issues.length ? out : null;
}

export const WORKPLACE_WORDS = ["거래처", "제안서", "보고서", "회의", "출근", "퇴근", "상사", "팀장", "동료", "업무"] as const;
export const CARE_DAY_REVERSAL_RE = /수월|순조|술술|(일이|막혀 있던 일이|막힌 일이|잘)\s?풀리/;
export const TIME_WORDS = ["아침", "점심", "저녁", "밤"] as const;

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

// ---- 문장 규칙 (v4.15 코어 블록 규칙 → v4.16 본문 전체) ----
export const BACKREF_RE = /앞에서 본|앞서 본|앞서 말한|앞에서 말한|앞 블록|아까 본|아까 말한|앞 이야기에서/;
export const PROMISE_HEAD_RE = /^(그러면|그럼|그렇게 하면|그리하면|그래야|그래서 결국)\s/;
export const PROMISE_TAIL_RE = /(면|으면)\s[^.!?]{0,40}(나아져요|편해져요|가벼워져요|또렷해져요|살아나요|풀려요|차올라요|돌아와요|쌓여요|이어져요|열려요|달라져요|바뀌어요|해져요|돼요)[.!?]?$/;
export const INTERNAL_WORDS = ["판정", "원국", "으로 나와요", "로 나와요", "사실표", "이 풀이는", "이 글은", "설계도", "근거 목록", "코어", "무대", "블록", "핵심 후보", "둘째 기운", "내부 판단"] as const;
export const METAPHOR_WORDS = ["손을 움직", "손으로 만든", "내 손에 있", "손수 ", "한낮의 해", "볕", "바위", "등불", "큰 산", "기름진 밭", "큰 강", "이슬", "덩굴", "큰 나무", "물통", "개울", "숲이", "두터운 흙", "열기가", "열기를", "빛을 품", "빛이 속", "불씨", "불꽃", "타오르", "따뜻한 볕", "불이 밖"] as const;
export const DEFINITION_RE = /(와|과)\s?[가-힣]{2,3}(을|를)\s?(합쳐|묶어|아울러)\s?[가-힣]{2,3}(이라|라)\s?(해요|하는데|부르|불러)|합쳐 부르는 말|묶어 부르는 말/;
export const PRESUME_RE = /있을 거예요|있으시죠|있으실 거예요|있잖아요|겪어 보셨/;
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
/** 꼭 쓰는 말의 어간 (v4.15 호환 — v4.16에선 이름이 금지라 거의 비어 있다) */
export function mandatedStems(b: Partial<Pick<FortuneBrief, "today" | "me">> & { sheet?: { today?: string; me?: string } }): Set<string> {
  const src = [b.sheet?.today ?? "", b.sheet?.me ?? "", b.today?.tenGods ?? "", b.me?.need ?? ""].join(" ");
  const out = new Set<string>(["오늘", "오늘은", "내게", "이라", "날이", "편이", "쪽이", "힘을", "힘이", "함께", "와요", "뜻하", "뜻하는"]);
  for (const w of src.replace(/[=(),·.]/g, " ").split(/\s+/)) if (w.length >= 2) out.add(w.slice(0, 2));
  return out;
}
export function freeOverlap(a: string, b: string, mandated: Set<string>): number {
  const strip = (s: string) => tokensOf(s).filter((t) => !mandated.has(t.slice(0, 2)));
  const ta = strip(a), tb = new Set(strip(b));
  if (ta.length < 3) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

/** 본문 문장 규칙 — 결과 약속·되받기·정의문·비유 낱말·내부 말투·문장 길이·같은 낱말. v4.15 블록 검사에서 본문으로 옮겼다 */
export function validateProse(body: string, extraStop: Iterable<string> = []): string[] {
  const issues: string[] = [];
  const add = (s: string) => issues.push(s);
  const flat = body.replace(/\n+/g, " ");
  for (const s of splitSentences(flat)) {
    if (s.length > LIMITS.sentenceMax) add(`문장 ${s.length}자 "${s.slice(0, 20)}…" (${LIMITS.sentenceMax}자 안)`);
    else if (s.length < LIMITS.sentenceMin) add(`문장 ${s.length}자 "${s}" (${LIMITS.sentenceMin}자 이상)`);
    if (PROMISE_HEAD_RE.test(s)) add(`결과를 약속하는 문장 "${s.slice(0, 30)}…" ('그러면 ~해져요' 꼴은 쓰지 않음)`);
  }
  const back = flat.match(BACKREF_RE); if (back) add(`되받는 말 "${back[0]}"`);
  const def = flat.match(DEFINITION_RE); if (def) add(`정의문 "${def[0]}"`);
  const inner = INTERNAL_WORDS.find((w) => flat.includes(w)); if (inner) add(`속으로 쓰는 말 "${inner}"`);
  const meta = METAPHOR_WORDS.find((w) => flat.includes(w)); if (meta) add(`비유 낱말 "${meta}" (사물 그림으로 이유를 대지 않음)`);
  const pres = flat.match(PRESUME_RE); if (pres) add(`넘겨짚는 말 "${pres[0]}"`);
  const over = overusedWords(flat, LIMITS.wordMax, extraStop);
  if (over.length) add(`같은 낱말 되풀이 ${over.join(", ")} (본문에서 ${LIMITS.wordMax}번까지)`);
  return issues;
}

/** v4.15 블록 검사 (blocks가 있을 때만 — v4.16 모델은 보내지 않는다) */
export function validateBlocks(blocks: FortuneBlock[] | undefined, b: { stage?: { name: string; hints: readonly string[] } } & Partial<Pick<FortuneBrief, "recent" | "today" | "me">> & { sheet?: { today?: string; me?: string } }): string[] {
  const issues: string[] = [];
  if (!blocks) return issues;
  const add = (s: string) => issues.push(s);
  if (!Array.isArray(blocks) || blocks.length !== 4) return [`blocks가 ${Array.isArray(blocks) ? blocks.length : 0}개 (근거 1 · 원리 또는 성향 1 · 사례 1 · 처방 1 = 4개)`];
  const kinds = blocks.map((x) => x?.kind);
  const count = (k: string) => kinds.filter((x) => x === k).length;
  if (count("근거") !== 1 || count("사례") !== 1 || count("처방") !== 1 || count("원리") + count("성향") !== 1) add(`블록 종류가 [${kinds.join("·")}] — 근거 1 · 원리 또는 성향 1 · 사례 1 · 처방 1이어야 함`);
  if (kinds[0] === "처방") add("처방이 첫 블록 (처방은 근거·원리·사례 뒤에)");
  blocks.forEach((blk, i) => {
    const at = `blocks[${i}](${blk?.kind})`;
    const text = String(blk?.text ?? "").trim();
    if (!text) { add(`${at} 글이 비어 있음`); return; }
    const ss = splitSentences(text);
    if (ss.length > LIMITS.blockSentences) add(`${at} ${ss.length}문장 — 블록 하나는 1~${LIMITS.blockSentences}문장`);
    for (const s of ss) {
      if (s.length > LIMITS.sentenceMax) add(`${at} 문장 ${s.length}자 "${s.slice(0, 20)}…" (${LIMITS.sentenceMax}자 안)`);
      else if (s.length < 20) add(`${at} 문장 ${s.length}자 "${s}" (20자 이상 — 뜻과 이유를 한 문장에)`);
      if (PROMISE_HEAD_RE.test(s)) add(`${at} 결과를 약속하는 문장 "${s.slice(0, 30)}…" ('그러면 ~해져요' 꼴은 쓰지 않음)`);
      else if (blk.kind === "처방" && PROMISE_TAIL_RE.test(s)) add(`${at} 처방 뒤의 결과 약속 "${s.slice(0, 30)}…" (처방은 '언제 + 무엇' 한 문장까지)`);
    }
    const back = text.match(BACKREF_RE); if (back) add(`${at} 되받는 말 "${back[0]}"`);
    const def = text.match(DEFINITION_RE); if (def) add(`${at} 정의문 "${def[0]}" ('○○은 ~하는 힘이라'처럼 뜻과 이유를 한 문장에)`);
    const inner = INTERNAL_WORDS.find((w) => text.includes(w)); if (inner) add(`${at} 속으로 쓰는 말 "${inner}"`);
    const meta = METAPHOR_WORDS.find((w) => text.includes(w)); if (meta) add(`${at} 비유 낱말 "${meta}" (사물 그림으로 이유를 대지 않음)`);
    if (blk.kind === "사례") {
      if (!/^예를 들면/.test(text)) add(`${at} "예를 들면"으로 시작하지 않음`);
      const pres = text.match(PRESUME_RE); if (pres) add(`${at} 넘겨짚는 말 "${pres[0]}"`);
      if (b.stage && !b.stage.hints.some((h) => text.includes(h))) add(`${at} 무대 "${b.stage.name}" 낱말이 없음 (${b.stage.hints.join("·")} 가운데 하나)`);
    }
  });
  const joined = blocks.map((x) => String(x?.text ?? "")).join(" ");
  if (/이달|이번 달/.test(joined)) add("본문에 이달 운 (이달은 areas의 이달 줄에서만)");
  const mandated = mandatedStems(b);
  outer: for (const r of b.recent ?? []) {
    for (const line of r.lines ?? []) for (const s of splitSentences(joined)) {
      if (freeOverlap(s, line, mandated) >= 0.6) { add(`최근(${r.date}) 문장과 겹침 "${s.slice(0, 24)}…" (같은 뜻을 다른 꼴로)`); break outer; }
    }
  }
  const over = overusedWords(joined, LIMITS.wordMax, mandated);
  if (over.length) add(`같은 낱말 되풀이 ${over.join(", ")} (본문에서 ${LIMITS.wordMax}번까지)`);
  return issues;
}

// ---- v4.16 의미 태그 비교 (9항: 문장이 아니라 뜻을 비교) ----
/** 유의어 묶음 — 같은 묶음의 낱말이 들면 같은 뜻으로 본다. 단순 동의어 교체("생각이 많아져요"/"고민이 길어져요")를 새 내용으로 치지 않는다 */
const SYNONYMS: [string, string[]][] = [
  ["생각", ["생각", "고민", "곱씹", "걱정", "망설", "결정이 늦", "판단이 길"]],
  ["돈", ["돈", "지출", "결제", "통장", "잔액", "소비", "장보", "할인", "구독", "살 것", "사고 싶"]],
  ["말", ["말", "답장", "메시지", "대화", "전화", "연락", "톡", "말투", "지적", "반박"]],
  ["몸", ["몸", "피로", "피곤", "잠", "컨디션", "체력", "건강", "쉬", "휴식", "회복", "식사", "밥"]],
  ["일정", ["약속", "일정", "계획", "마감", "날짜"]],
  ["혼자", ["혼자", "홀로", "스스로", "직접"]],
  ["정리", ["정리", "마무리", "끝내", "처리", "매듭", "미뤄 둔", "미룬"]],
  ["사람", ["사람", "관계", "친구", "가족", "상대", "주변", "가까운"]],
  ["일", ["일", "업무", "공부", "과제", "할 일", "하던 일"]],
  ["새일", ["기회", "제안", "새로운", "새 일", "시작", "벌이", "호기심", "정보"]],
  ["서두름", ["서두", "급하", "빨리", "조급", "속도", "밀어붙"]],
  ["감정", ["감정", "기분", "서운", "예민", "짜증", "화가", "욱", "불안"]],
  ["욕심", ["욕심", "한꺼번에", "여러 개", "욕심"]],
  ["확인", ["확인", "점검", "다시 보", "한 번 더"]],
];
/** 태그 문장 → 뜻 묶음 집합 */
export function meaningKeys(tag: string): Set<string> {
  const out = new Set<string>();
  for (const [key, words] of SYNONYMS) if (words.some((w) => tag.includes(w))) out.add(key);
  return out;
}
const normTag = (s: string): string => s.replace(/[\s.,!?'"()·]/g, "");
/** 두 태그가 같은 뜻인가: 글자가 같거나, 뜻 묶음이 겹치면서 겹치는 묶음이 둘 쪽 모두의 전부인 경우 */
export function sameMeaning(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  if (normTag(a) === normTag(b)) return true;
  const ka = meaningKeys(a), kb = meaningKeys(b);
  if (!ka.size || !kb.size) return false;
  const shared = [...ka].filter((k) => kb.has(k));
  // 겹치는 뜻 묶음이 큰 쪽의 절반 이상이면 같은 뜻 ("미뤄 둔 돈 정리" {돈·정리} ↔ "지출 점검" {돈·확인})
  return shared.length > 0 && shared.length / Math.max(ka.size, kb.size) >= 0.5;
}

/** v4.16: 판단·태그 모양과 최근 태그 겹침 */
export function validateMeaning(t: Pick<ModelText, "판단" | "태그" | "headline">, b: Pick<FortuneBrief, "avoid">): string[] {
  const issues: string[] = [];
  const add = (s: string) => issues.push(s);
  const j = t.판단;
  if (!j || typeof j !== "object") add("판단 칸이 없음 (후보 3~5 → 핵심 → 이유 → 구조 A~E)");
  else {
    if (!Array.isArray(j.후보) || j.후보.length < 3 || j.후보.length > 5) add(`판단.후보가 ${Array.isArray(j.후보) ? j.후보.length : 0}개 (3~5개)`);
    if (!j.핵심?.trim()) add("판단.핵심이 비어 있음");
    if (!["A", "B", "C", "D", "E"].includes(j.구조)) add(`판단.구조 "${j.구조}" (A~E 가운데 하나)`);
  }
  const tags = t.태그;
  if (!tags || typeof tags !== "object") { add("태그 칸이 없음 (주제·감정·상황·영역·장면·권장·피할·제목뜻)"); return issues; }
  for (const k of TAG_KEYS) {
    const v = tags[k];
    if (typeof v !== "string" || !v.trim()) add(`태그.${k}가 비어 있음`);
    else if (v.length > 40) add(`태그.${k} ${v.length}자 (40자 안 — 짧은 명사구)`);
  }
  if (issues.length) return issues;
  // 최근 7일: 어느 하루와 2칸 이상 같은 뜻이면 다른 각도로. 3차 말뭉치(2026-10-24): 영역 태그는 일곱 가지뿐이라 거의 늘 겹쳐 템플릿을 만들었다 → 영역은 세지 않는다(주제·감정·상황·장면·권장·피할 여섯 칸)
  for (const r of b.avoid?.tags ?? []) {
    const same = TAG_KEYS.filter((k) => k !== "제목뜻" && k !== "영역" && sameMeaning(tags[k], r.tags[k]));
    if (same.length >= LIMITS.tagSameMax) add(`최근(${r.date})과 뜻이 같음: ${same.map((k) => `${k}("${r.tags[k]}")`).join(" · ")} — 다른 생활 영역·장면·행동으로 다시`);
    if (sameMeaning(tags.제목뜻, r.tags.제목뜻)) add(`최근(${r.date}) 제목과 뜻이 같음 "${r.tags.제목뜻}" — 제목의 각도를 바꾸기`);
  }
  return issues;
}

export function validateFortuneText(t: ModelText | null | undefined, b: FortuneBrief): string[] {
  const issues: string[] = [];
  const add = (s: string) => issues.push(s);
  if (!t || typeof t !== "object") return ["JSON이 아님"];
  for (const k of ["headline", "body", "do", "dont"] as const) {
    if (typeof t[k] !== "string" || !t[k].trim()) add(`${k}가 비어 있음`);
  }
  if (!Array.isArray(t.areas)) add("areas가 배열이 아님");
  if (issues.length) return issues;

  const areaLines = t.areas.map((a) => String(a?.line ?? ""));
  const everything = [t.headline, t.body, ...areaLines, t.do, t.dont].join(" ");

  // 금지어 · 전문용어 · 한자 · 이모지
  const plain = stripCommon(everything);
  for (const w of b.banned) if (plain.includes(w)) add(`금지어 "${w}"`);
  for (const w of b.jargon) if (plain.includes(w)) add(`전문용어 "${w}"`);
  if (HANJA_RE.test(everything)) add("한자가 있음 (글은 한글로만)");
  if (EMOJI_RE.test(everything)) add("이모지가 있음");

  // v4.16: 이론은 내부 판단으로만 — 십신 이름·오행 기운·판정 문장·비유가 글 어디에도 없어야 한다 (옛 블록 꼴은 v4.15 규칙으로)
  const legacy = !t.판단;   // 판단 칸이 없으면 옛 꼴(v4.13~4.15 테스트 글): 이름 한 번 + 뜻 규칙으로 본다. 운영 모델 출력은 스키마가 판단·태그를 강제한다
  if (!legacy) {
    const names = TEN_GOD_NAMES.filter((n) => plain.includes(n));
    if (names.length) add(`십신 이름 ${names.map((n) => `"${n}"`).join("·")} (이론은 내부 판단으로만 — 그 결과로 나타나는 마음·행동·상황을 쓰기)`);
    const jm = everything.match(JUDGEMENT_RE);
    if (jm) add(`판정 문장 "${jm[0]}" (맞는 편·모자란·넉넉한·실속·기운이 거든다는 말 대신 실제 결과로)`);
    const fg = everything.match(FIGURATIVE_RE);
    if (fg) add(`비유 "${fg[0]}" (사람이 실제로 느끼거나 하는 말로)`);
    for (const l of ABSTRACT_LABELS) if (everything.includes(l)) add(`추상 이름 "${l}"을 그대로 씀 (성격 이름 대신 생활 속 마음·행동으로)`);
    for (const s of validateProse(t.body)) add(s);
    for (const s of validateMeaning(t, b)) add(s);
  } else {
    // v4.15 호환: 이름 한 번 + 뜻. 블록 검사
    const todayNames = (b.today?.tenGods ?? "").split("·").filter(Boolean);
    if (todayNames.length) {
      const inBody = TEN_GOD_NAMES.filter((n) => plain.includes(n));
      for (const n of inBody) if (!todayNames.includes(n)) add(`오늘 기운이 아닌 이름 "${n}" (brief.today.tenGods에 있는 것만)`);
      for (const n of inBody) { const c = plain.split(n).length - 1; if (c > 3) add(`이름 "${n}"이 ${c}번 (용어는 한 번, 바로 뒤에 뜻 한 줄)`); }
    }
    for (const sent of splitSentences(t.body.replace(/\n+/g, " "))) for (const l of ABSTRACT_LABELS) if (sent.includes(l) && !TEN_GOD_NAMES.some((n) => sent.includes(n))) add(`추상 이름 "${l}"을 그대로 씀 (기운 이름 뒤의 뜻으로만, 아니면 생활 속 마음·행동으로)`);
    for (const s of validateBlocks(t.blocks, b as unknown as Parameters<typeof validateBlocks>[1])) add(s);
  }

  const sentenceOf = (hit: string): string => { const s = splitSentences(everything.replace(/\n+/g, " ")).find((x) => x.includes(hit)) ?? ""; return s.length > 40 ? s.slice(0, 40) + "…" : s; };
  const ab = everything.match(ABSTRACT_RE);
  if (ab) add(`추상어 "${ab[0]}" (무엇이 모자라고 넘치는지 이름 없는 말; 문장 "${sentenceOf(ab[0])}")`);
  const sk = everything.match(SHENG_KE_RE);
  if (sk) add(`생·극 설명 "${sk[0]}" (문장 "${sentenceOf(sk[0])}")`);
  if (!b.month && MONTH_MENTION_RE.test([t.headline, t.body, t.do, t.dont].join(" "))) add("이달 운 재료(brief.month)가 없는데 이달 운을 말함");

  // 구조 서술 (headline은 제외)
  const prose = [t.body, ...areaLines, t.do, t.dont].join(" ");
  for (const w of STRUCTURE_WORDS) if (prose.includes(w)) add(`구조 서술 "${w}"`);

  // 숫자: brief에 있는 것만
  const allowed = new Set(b.allowedNumbers);
  const scoreValue = b.score?.value;
  const nums = [...new Set((everything.match(NUMBER_RE) ?? []).map(Number))];
  const bad = nums.filter((n) => !allowed.has(n) && n !== scoreValue);
  if (bad.length) add(`사실에 없는 숫자 ${bad.join(", ")}`);
  if (scoreValue !== undefined && !allowed.has(scoreValue) && nums.includes(scoreValue)) add(`점수 숫자 ${scoreValue} (점수는 화면에 있으니 글에 쓰지 않기)`);
  if (SCORE_PHRASE_RE.test(everything)) add('점수 숫자 ("N점 만점" 꼴 — 점수는 화면에 있으니 글에 쓰지 않기)');

  // 직장 가정 · 주의인 날 반전 · 시간대 나열 · 절기
  const own = [t.body, t.do, t.dont].join(" ");
  for (const w of WORKPLACE_WORDS) if (own.includes(w)) add(`직장 장면 "${w}" (직업과 무관한 장면으로)`);
  const todayOnly = splitSentences(t.body.replace(/\n+/g, " ")).filter((s) => !/이달|이번 달|올해|10년/.test(s)).join(" ");
  if (b.score?.band === "주의" && CARE_DAY_REVERSAL_RE.test(todayOnly)) add(`주의인 날 본문에 반전 말 "${todayOnly.match(CARE_DAY_REVERSAL_RE)![0]}"`);
  const times = TIME_WORDS.filter((w) => t.body.includes(w));
  if (times.length >= 3) add(`시간대 나열 (${times.join("·")}) — 장면 1~2개만`);
  if (b.today && b.today.useSolarTerm === false && b.today.solarTermName && everything.includes(b.today.solarTermName)) add(`절기 이름 "${b.today.solarTermName}" (절기 첫날에만)`);

  // 예시 베낌
  const exSentences = legacy ? [] : FORTUNE_EXAMPLES.flatMap((e) => splitSentences(e.text.body.replace(/\n+/g, " ")));   // 옛 꼴 테스트 글은 예시 베낌을 보지 않는다(예시가 v4.16 꼴)
  for (const e of FORTUNE_EXAMPLES) {
    if (t.headline.trim() === e.text.headline) add(`예시 headline을 그대로 씀 "${e.text.headline}"`);
    if (t.do.trim() === e.text.do || t.dont.trim() === e.text.dont) add("예시 do·dont를 그대로 씀");
  }
  for (const sent of splitSentences(t.body.replace(/\n+/g, " "))) if (exSentences.some((x) => tokenOverlap(sent, x) >= 0.7)) add(`예시 문장을 베낌 "${sent.slice(0, 20)}…"`);   // v4.16: 0.8 → 0.7 (3차 말뭉치에서 예시 1을 낱말만 바꿔 옮긴 첫날 글이 통과)
  // v4.16: 최근 7일 본문 문장과 60% 이상 겹치는 본문 문장 — 표현 풀 문장을 그대로 옮겨 적는 것을 막는다 (검사기용 avoid.lines, 모델에는 안 보냄)
  if (!legacy) {
    outer: for (const r of b.avoid?.lines ?? []) for (const line of r.lines) for (const sent of splitSentences(t.body.replace(/\n+/g, " "))) {
      if (tokenOverlap(sent, line) >= 0.6) { add(`최근(${r.date}) 문장과 겹침 "${sent.slice(0, 24)}…" (같은 뜻이라도 다른 장면·다른 말로)`); break outer; }
    }
  }

  // 최근 3일: 헤드라인·첫 두 문장 글자 겹침 (뜻 비교는 validateMeaning)
  const startNow = splitSentences(t.body.replace(/\n+/g, " ")).slice(0, 2).join(" ");
  for (const r of b.recent ?? []) {
    if (t.headline.trim() === r.headline.trim() || tokenOverlap(t.headline, r.headline) >= 0.6) add(`최근(${r.date}) 헤드라인과 겹침 "${r.headline}"`);
    if (tokenOverlap(startNow, r.start) >= 0.5) add(`최근(${r.date}) 운세 첫 문장과 겹침`);
    for (const line of r.areas ?? []) t.areas.forEach((a, i) => {
      if (a?.period && a.period !== "오늘" && (String(a.line).trim() === line.trim() || tokenOverlap(String(a.line), line) >= 0.6)) add(`areas[${i}] ${a.period} 줄이 최근(${r.date}) 줄과 겹침 "${line.slice(0, 18)}…"`);
    });
  }
  // v4.16: 최근 14일 제목과 글자 겹침
  for (const h of b.avoid?.headlines ?? []) if (t.headline.trim() === h.trim()) add(`최근 14일 제목과 같음 "${h}"`);

  if (PROMISE_RE.test(everything)) add("기간 약속 (\"N일 더 쓰면\" 꼴)");
  if (CERTAIN_RE.test(everything)) add("길흉 단정 표현");
  const ownProse = [t.headline, t.body, t.do, t.dont].join(" ");
  if (!hasContextFact(b.facts ?? []) && CONTEXT_MENTION_RE.test(ownProse)) add("오늘만: facts에 없는 올해·10년 단위 운을 말함");

  // 어미
  const sentences = [...splitSentences(t.body), ...areaLines.flatMap(splitSentences), ...splitSentences(t.do), ...splitSentences(t.dont)];
  const badEnd = sentences.filter((s) => BAD_ENDING_RE.test(s));
  if (badEnd.length) add(`명령조·반말·"~니다" 어미: "${badEnd[0]}"`);
  const good = sentences.filter((s) => GOOD_ENDING_RE.test(s)).length;
  if (sentences.length && good / sentences.length < 0.8) add(`"~어요" 어미 비율 ${good}/${sentences.length}`);
  for (const [k, v] of [["do", t.do], ["dont", t.dont], ...areaLines.map((l, i) => [`areas[${i}]`, l] as [string, string])] as [string, string][]) {
    if (v.trim() && !GOOD_ENDING_RE.test(v.trim())) add(`${k}가 "~요"로 끝나지 않음 "${v.trim().slice(-8)}"`);
  }

  // 분량
  if (t.headline.length > LIMITS.headlineMax) add(`headline ${t.headline.length}자 (${LIMITS.headlineMax}자 안)`);
  const bodyN = splitSentences(t.body.replace(/\n+/g, " ")).length;
  const [minS, maxS] = legacy ? [4, 6] : LIMITS.bodySentences;
  if (bodyN < minS || bodyN > maxS) add(`본문 ${bodyN}문장 (${minS}~${maxS}문장)`);
  const maxBody = legacy ? 480 : LIMITS.bodyMax;
  if (t.body.length > maxBody) add(`본문 ${t.body.length}자 (${maxBody}자 안)`);
  if (!legacy) { const paras = t.body.split(/\n{2,}/).filter((p) => p.trim()).length; if (paras < 2 || paras > 3) add(`본문 ${paras}문단 (2~3문단, 빈 줄로 나눔)`); }
  for (const k of ["do", "dont"] as const) {
    if (splitSentences(t[k]).length !== 1) add(`${k}는 1문장`);
    if (t[k].length > LIMITS.doDontMax) add(`${k} ${t[k].length}자 (${LIMITS.doDontMax}자 안)`);
  }

  // 영역: v4.16 — 입력의 부분집합 0~3개, 순서 유지. (옛 꼴은 개수·순서 일치)
  const want = b.areas.map((a) => a.area);
  const got = t.areas.map((a) => a?.area);
  const wantPeriod = b.areas.map((a) => a.period);
  const gotPeriod = t.areas.map((a, i) => a?.period ?? wantPeriod[i]);
  if (legacy) {
    if (want.length !== got.length || want.some((a, i) => a !== got[i])) add(`areas 불일치: 기대 [${want.join(",")}] / 받음 [${got.join(",")}]`);
    if (want.length === got.length && wantPeriod.some((p, i) => p !== undefined && p !== gotPeriod[i])) add(`areas period 불일치: 기대 [${wantPeriod.join(",")}] / 받음 [${gotPeriod.join(",")}]`);
  } else {
    if (got.length > LIMITS.areasMax) add(`areas ${got.length}개 (오늘 핵심에 맞는 ${LIMITS.areasMax}개까지)`);
    let cursor = 0;
    t.areas.forEach((a, i) => {
      const idx = b.areas.findIndex((x, j) => j >= cursor && x.area === a?.area && (!a?.period || x.period === a.period));
      if (idx < 0) add(`areas[${i}] ${a?.period ?? ""} ${a?.area}는 입력 areas에 없거나 순서가 다름 (입력: ${b.areas.map((x) => `${x.period} ${x.area}`).join(", ")})`);
      else cursor = idx + 1;
    });
  }
  const firstSentence = splitSentences(t.body)[0] ?? "";
  const bodySents = splitSentences(t.body.replace(/\n+/g, " "));
  t.areas.forEach((a, i) => {
    const line = String(a?.line ?? "");
    if (!line.trim()) add(`areas[${i}] line 비어 있음`);
    else if (splitSentences(line).length !== 1) add(`areas[${i}] line은 1문장`);
    if (line.length > LIMITS.areaLineMax) add(`areas[${i}] line ${line.length}자 (${LIMITS.areaLineMax}자 안)`);
    if (firstSentence && tokenOverlap(line, firstSentence) >= AREA_OVERLAP_MAX) add(`areas[${i}] line이 본문 첫 문장과 겹침`);
    else { const hit = repeatedSentence(line, bodySents); if (hit) add(`areas[${i}] line이 본문 문장을 되풀이함 ${quoteHit(hit)}`); }
  });
  const doHit = repeatedSentence(t.do, bodySents);
  if (doHit) add(`do가 본문 문장을 되풀이함 ${quoteHit(doHit)}`);
  const dontHit = repeatedSentence(t.dont, bodySents);
  if (dontHit) add(`dont가 본문 문장을 되풀이함 ${quoteHit(dontHit)}`);
  if (/^(그래서|그러니|그러니까|그런데|그러다 보니)/.test(firstSentence)) add(`첫 문장이 이음말로 시작 "${firstSentence.slice(0, 12)}…"`);
  const sosCount = (t.body.match(/그래서/g) ?? []).length;
  if (sosCount > 1) add(`'그래서'가 ${sosCount}번 (본문에 한 번까지)`);
  const connectiveStarts = bodySents.filter((s) => /^(그래서|그러니|그러니까|그런데|그래도|그러다 보니|하지만)/.test(s)).length;
  if (bodySents.length >= 4 && connectiveStarts >= 3) add(`이음말로 시작하는 문장이 ${connectiveStarts}개`);

  // v4.17: 내 기록 숫자 문장 금지 — 어느 칸에도 "기록했·평균·N번·N점"이 없어야 한다 (v4.2~4.16은 기록이 있으면 꼭 넣게 했다.
  // 2026-10-24 실제 사용자 글에 "신이나 미가 든 날엔 2번 기록했는데 평균 7.5점"으로 지지 이름·점수가 새어 나옴. 내 기록 숫자는 카드가 보여 준다)
  const everyField = [t.headline, t.body, t.do, t.dont, ...t.areas.map((a) => String(a?.line ?? ""))].join(" ");
  if (/기록(했|이|을|한)|평균|\d+\s*번\s*(기록|썼|적)/.test(everyField)) add("기록·평균 이야기 (내 기록 숫자는 카드가 보여 준다 — 글에 쓰지 않기)");

  return issues;
}
