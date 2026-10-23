// 3단계 — 출력 검사기. "brief에 없는 것은 글에 나올 수 없다"를 기계로 확인한다. 사유가 하나라도 있으면 그 글은 쓰지 않는다(1회 재작성 → 템플릿).
// 검사 항목: 금지어 · 전문용어 · 한자 · 이모지 · 숫자 날조 · 어미(~어요) · 명령조 · 기간 약속 · 문장 수 · 영역 일치 · 길이 상한 · 내 숫자 문장 · 구조 서술(v4.1) · 맥락 없는 운 언급(v4.4)
//           · 점수 숫자(v4.2: "6.3점", "N점 만점") · 영역 period 일치 · 영역 줄이 본문 첫 문장과 60% 이상 겹침(v4.2). "이달엔/올해는" 접두는 모델 지시일 뿐 검사하지 않는다(템플릿 줄에는 접두가 없다).
//           · v4.13 (글품질 검수 2026-10-15): 이름 없는 추상어("부족한 쪽") · 생·극 설명("누르다") · 오늘 기운 이름이 본문에 없음 / 오늘 것이 아닌 이름 / 같은 이름 3번 · 이달 한 줄 없음.
//             주의인 날 반전 말은 이달·올해·10년 운을 말하는 문장은 빼고 본다(10-b: 맥락 문장의 "수월한 편"을 옮겨 적은 글이 템플릿으로 떨어지던 충돌).
//           · v4.14 (10-c): 사유가 한 칸(areas[i]·do·dont)에만 있으면 slotIssues()가 그 칸을 돌려주고, llm.ts는 글 전체 대신 그 칸만 다시 쓰게 한다(통과한 본문을 버리지 않는다).
import type { FortuneBrief } from "./brief";
import { ABSTRACT_LABELS, hasContextFact, NUMBER_RE, TEN_GOD_NAMES } from "./brief";
import { FORTUNE_EXAMPLES, joinBlocks, type FortuneBlock } from "./examples";
import type { AreaName, AreaPeriod } from "./types";

/** 모델이 돌려주는 JSON */
export interface ModelText {
  /** v4.10: 뼈대 한 줄 — 모델이 글을 쓰기 전에 먼저 정하는 "오늘 들어오는 성격 → 나와의 관계 → 그래서 생기는 마음·행동". 화면에는 안 나가고 검수와 기록에만 쓴다 */
  핵심?: string;
  headline: string;
  /** v4.15: 본문 블록 4개(근거·원리/성향·사례·처방). 모델은 이것만 돌려주고 body는 joinBlocks로 만든다. 옛 꼴(블록 없음)도 검사기는 받는다 */
  blocks?: FortuneBlock[];
  body: string;
  /** v4.2: period는 brief.areas와 같은 순서로 돌려받는다 (빠지면 brief 것으로 본다) */
  areas: { period?: AreaPeriod; area: AreaName; line: string }[];
  do: string;
  dont: string;
}

export const LIMITS = {
  headlineMax: 20,
  bodySentences: [4, 6] as const,
  /** v4.13: 이달 한 줄 + 이름·뜻·판정이 들어가 420 → 480 */
  bodyMax: 480,
  areaLineMax: 70,
  doDontMax: 45,
  /** v4.15 (코어 블록 규칙 8): 한 문장 20~70자, 80자를 넘기지 않는다. 블록 하나는 1~2문장 */
  sentenceMin: 20,
  sentenceMax: 80,
  blockSentences: 2,
  /** v4.15: 같은 낱말(어절)은 본문에서 세 번까지 */
  wordMax: 3,
} as const;

// ---- v4.15 블록 검사 (사주 코어 블록.ts V71~V77의 하루 운세판) ----
/** 되받기: 앞 글을 가리키는 말 (V71) */
export const BACKREF_RE = /앞에서 본|앞서 본|앞서 말한|앞에서 말한|앞 블록|아까 본|아까 말한|앞 이야기에서/;
/** 결과 약속 (V72): "그러면 ~해져요" 머리, 처방 뒤의 "~면 … 나아져요" 꼬리 */
export const PROMISE_HEAD_RE = /^(그러면|그럼|그렇게 하면|그리하면|그래야|그래서 결국)\s/;
export const PROMISE_TAIL_RE = /(면|으면)\s[^.!?]{0,40}(나아져요|편해져요|가벼워져요|또렷해져요|살아나요|풀려요|차올라요|돌아와요|쌓여요|이어져요|열려요|달라져요|바뀌어요|해져요|돼요)[.!?]?$/;
/** 내부 말투 (V73): 속으로 쓰는 말 */
export const INTERNAL_WORDS = ["판정", "원국", "으로 나와요", "로 나와요", "사실표", "이 풀이는", "이 글은", "설계도", "근거 목록", "코어", "무대", "블록"] as const;
/** 비유 낱말 (V74): 사물 그림으로 이유를 대는 말 */
export const METAPHOR_WORDS = ["손을 움직", "손으로 만든", "내 손에 있", "손수 ", "한낮의 해", "볕", "바위", "등불", "큰 산", "기름진 밭", "큰 강", "이슬", "덩굴", "큰 나무", "물통", "개울", "숲이", "두터운 흙", "열기가", "열기를", "빛을 품", "빛이 속", "불씨", "불꽃", "타오르", "따뜻한 볕", "불이 밖"] as const;
/** 정의문 (V77): "A와 B를 합쳐 C라 해요" */
export const DEFINITION_RE = /(와|과)\s?[가-힣]{2,3}(을|를)\s?(합쳐|묶어|아울러)\s?[가-힣]{2,3}(이라|라)\s?(해요|하는데|부르|불러)|합쳐 부르는 말|묶어 부르는 말/;
/** 넘겨짚기 (코어 규칙 10): 사례에서 독자의 경험을 단정하는 꼴 */
export const PRESUME_RE = /있을 거예요|있으시죠|있으실 거예요|있잖아요|겪어 보셨/;
/** 같은 낱말 세기에서 빼는 어간(앞 두 글자): 글마다 늘 나오는 말 */
const WORD_STOP = new Set(["오늘", "내게", "내가", "나에", "그래", "그런", "그렇", "다만", "조금", "한번", "평소", "이에", "에요", "해요"]);
/** v4.15: 본문(블록 글)에서 세 번 넘게 나온 낱말. 조사가 붙어 어절이 달라도("마음이·마음을") 앞 두 글자가 같으면 같은 낱말로 센다. extraStop = 오늘 꼭 써야 하는 말(기운 이름·뜻 — 2차 말뭉치에서 "혼자 생각"의 '생각'이 걸렸다) */
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
/**
 * v4.15 2차: 오늘 꼭 나와야 하는 말(기운 이름·그 뜻·내게 필요한 기운)의 어간. 최근 글과의 겹침은 이 말들을 뺀 나머지로 잰다 —
 * 같은 십신이 사흘 안에 다시 오면 근거 문장이 정당하게 비슷해지는데, 그것까지 "겹침"으로 떨어뜨려 템플릿이 됐다(2차 말뭉치 템플릿 12편 중 8편)
 */
export function mandatedStems(b: Partial<Pick<FortuneBrief, "sheet" | "today" | "me">>): Set<string> {
  const src = [b.sheet?.today ?? "", b.sheet?.me ?? "", b.today?.tenGods ?? "", b.me?.need ?? ""].join(" ");
  const out = new Set<string>(["오늘", "오늘은", "내게", "이라", "날이", "편이", "쪽이", "힘을", "힘이", "함께", "와요", "뜻하", "뜻하는"]);
  for (const w of src.replace(/[=(),·.]/g, " ").split(/\s+/)) if (w.length >= 2) out.add(w.slice(0, 2));
  return out;
}
/** 꼭 써야 하는 말을 뺀 토큰 겹침 비율 (a의 남은 토큰 가운데 b에도 있는 비율). 남은 토큰이 3개 미만이면 0 */
export function freeOverlap(a: string, b: string, mandated: Set<string>): number {
  const strip = (s: string) => tokensOf(s).filter((t) => !mandated.has(t.slice(0, 2)));
  const ta = strip(a), tb = new Set(strip(b));
  if (ta.length < 3) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

/**
 * v4.15 블록 검사. blocks가 없는 옛 꼴은 건너뛴다(테스트의 v4.5~v4.14 글).
 * 본다: 4개·종류 집합·처방이 첫 블록이 아님·블록당 1~2문장·사례 "예를 들면" + 무대 낱말·결과 약속·되받기·정의문·비유·내부 말투·문장 길이·같은 낱말·이달 언급.
 */
export function validateBlocks(blocks: FortuneBlock[] | undefined, b: Pick<FortuneBrief, "stage"> & Partial<Pick<FortuneBrief, "recent" | "sheet" | "today" | "me">>): string[] {
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
      else if (s.length < LIMITS.sentenceMin) add(`${at} 문장 ${s.length}자 "${s}" (${LIMITS.sentenceMin}자 이상 — 뜻과 이유를 한 문장에)`);
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
  // v4.15: 최근 3일 본문 문장과 겹치는 블록 문장 — 공식 문장이 날마다 박히지 않게 (한 편에 하나만 보고한다). 2차: 오늘 꼭 쓰는 말은 빼고 잰다
  const mandated = mandatedStems(b);
  outer: for (const r of b.recent ?? []) {
    for (const line of r.lines ?? []) for (const s of splitSentences(joined)) {
      if (freeOverlap(s, line, mandated) >= RECENT_LINE_OVERLAP_MAX) { add(`최근(${r.date}) 문장과 겹침 "${s.slice(0, 24)}…" (같은 뜻을 다른 꼴로 — brief.sheet.say)`); break outer; }
    }
  }
  const over = overusedWords(joined, LIMITS.wordMax, mandated);
  if (over.length) add(`같은 낱말 되풀이 ${over.join(", ")} (본문에서 ${LIMITS.wordMax}번까지)`);
  return issues;
}

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}]/u;
const HANJA_RE = /[㐀-鿿]/;
/** 명령조·반말·"~입니다" 어미 */
const BAD_ENDING_RE = /(세요|십시오|[하보가]자|라|다)[.!?]?$/;
const GOOD_ENDING_RE = /요[.!?]?$/;
/** 기간 약속: "3일 더 쓰면", "일주일만 기록하면", "열흘 뒤에는" */
const PROMISE_RE = /(\d+\s*(일|주|달|개월)|일주일|열흘|보름|한\s?달|며칠)\s*(더|만|쯤|정도)\s*(더\s*)?(쓰|기록|적으|지나|뒤|후)/;
/** 길흉 단정 */
const CERTAIN_RE = /(반드시|틀림없이|꼭\s*(이루어|성공|잘\s*될)|분명히\s*(좋|나쁘)|확실히\s*(좋|나쁘)|대박|망해)/;
/** v4.1 ⑤ 구조 서술: 사주 구조("글자"가 짝이 되고 부딪히고…)를 설명하는 말. 결과만 생활어로 말해야 한다. body·areas·do·dont에서 본다 (brief.jargon과 별개) */
export const STRUCTURE_WORDS = ["글자", "짝이 되", "짝이 맞", "부딪히", "맞서", "한편이", "위아래", "윗글", "아랫글"] as const;
/** v4.2: 점수는 화면에 있으니 글에 쓰지 않는다. "N점 만점" 꼴은 숫자와 상관없이 탈락 */
const SCORE_PHRASE_RE = /점\s*만점|만점에/;
/** v4.4: 올해·10년 단위 운 언급. brief.facts에 맥락 문장이 없는 날 headline·body·do·dont에 나오면 탈락 (areas의 "올해는" 줄은 예외). v4.13: 이달은 뺐다 — 이달 한 줄은 매일(brief.month) */
export const CONTEXT_MENTION_RE = /올해\s*(의\s*)?운|10년\s*단위/;
/** v4.13: 이달 운 언급. brief.month가 없는 날(월운 없음)에만 막는다 */
export const MONTH_MENTION_RE = /(이달|이번 달)\s*(의\s*)?운/;
/** v4.13: 지시 대상 없는 추상어 (검수 §0·§2: 추상 문장 24/67 전부 이 꼴). 무엇이 부족한지·넘치는지 이름을 대야 한다 */
/* "금을 거들어 주는 쪽"처럼 바로 앞에 목적어(을/를)가 있으면 이름이 있는 것이라 통과 — 첫 말뭉치(2026-10-16)에서 이름을 댄 문장까지 걸려 템플릿으로 떨어졌다.
   v4.14: 목적어와 동사 사이에 부사 한 어절("힘을 옆에서 거들어 주는 쪽", "힘을 든든하게 채워 주는 쪽")이 끼어도 통과 — brief 라벨 문장(core.ts "~을 옆에서 거들어 줘요")을 옮겨 적은 글이 4차 말뭉치에서 3번 걸려 템플릿 1편(C 10-17)을 만들었다 */
export const ABSTRACT_RE = /(아쉽던|아쉬웠던|부족한|부족했던|모자란|모자랐던|넘치는|넘쳤던) (쪽|부분|자리)|넘치는 힘|힘이 (한곳|한 곳)(에|으로|로) 모이|(?<![을를] (?:\S+ )?)(채워|거들어|받쳐) 주는 (쪽|힘)|쪽으로 (작용|쓰이)|박자가 (안 맞|달라)/;
/** v4.13: 생·극 설명 ("내 기운이 어느 기운을 누른다") — 사용자 결정: 기운 이름을 한 번 대고 맞는지만. "발생해·탄생해"처럼 앞에 글자가 붙은 것은 일상어 */
export const SHENG_KE_RE = /누르|눌리|눌려|(?<![가-힣])[생극](하|해)|상생|상극/;
/** v4.13: 같은 기운 이름은 글 전체에서 이만큼까지 (한 번 대고 뜻 한 줄 — 되풀이하면 용어 나열). v4.15: 근거에서 대고 원리에서 "정관은 ~하는 힘이라"로 받는 꼴이 정당해 2 → 3 */
export const TERM_MAX = 3;
/** v4.15: 블록 문장이 최근 3일 본문 문장과 이만큼 겹치면 탈락 — 같은 공식 문장("내게 모자란 토, 그러니까 …")이 날마다 박히던 것 */
export const RECENT_LINE_OVERLAP_MAX = 0.6;
/** v4.2: 영역 줄이 본문 첫 문장을 되풀이하면 탈락 — 토큰(띄어쓰기 단위, 문장부호 제거) 겹침 비율 */
export const AREA_OVERLAP_MAX = 0.6;
const tokensOf = (s: string): string[] => s.replace(/[.,!?'"()]/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
export function tokenOverlap(a: string, b: string): number {
  const ta = tokensOf(a), tb = new Set(tokensOf(b));
  if (ta.length < 3) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

/** v4.9: 칸마다 같은 말 반복 — "오늘" 영역 줄·do·dont가 본문 어느 문장과든 이만큼 겹치면 탈락 (어절 앞 두 글자 = 대략의 어간) */
export const REPEAT_OVERLAP_MAX = 0.5;
const REPEAT_STOP = new Set(["오늘", "오늘은", "이달엔", "올해는", "평소", "평소엔", "평소보다", "하루예요", "날이에요", "있어요", "좋아요", "해요", "편이", "쪽이", "쪽으로", "조금", "한결"]);
const stemsOf = (s: string): string[] => tokensOf(s).filter((t) => !REPEAT_STOP.has(t)).map((t) => t.slice(0, 2));
export function stemOverlap(a: string, b: string): number {
  const sa = stemsOf(a), sb = new Set(stemsOf(b));
  if (sa.length < 3) return 0;
  return sa.filter((t) => sb.has(t)).length / sa.length;
}
/** line이 되풀이하는 본문 문장 (가장 많이 겹치는 것). 없으면 null */
function repeatedSentence(line: string, bodySents: string[]): string | null {
  let best: string | null = null, bestScore = 0;
  for (const s of bodySents) { const o = stemOverlap(line, s); if (o >= REPEAT_OVERLAP_MAX && o > bestScore) { best = s; bestScore = o; } }
  return best;
}
const quoteHit = (s: string): string => `(본문 "${s.length > 28 ? s.slice(0, 28) + "…" : s}"와 같은 말 — 다른 장면·다른 행동으로)`;

/**
 * v4.14 (10-c): 탈락 사유가 전부 한 칸짜리(areas[i] 줄·do·dont)면 그 칸들을 돌려준다. 하나라도 본문·headline에 걸린 사유가 있으면 null (글 전체를 다시 쓴다).
 * 칸 사유의 꼴: "areas[N] …", "do가/do는/do N자 …", "dont가/dont는/dont N자 …", "예시 do·dont를 그대로 씀". "areas 불일치"·"areas period 불일치"는 배열 모양이라 칸이 아니다.
 */
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

/** v4.5: 직장인을 가정한 장면. 학생·주부·쉬는 사람은 공감하지 못한다 — 본문·하면·피해요에서 본다 (영역 "일" 줄은 제외) */
export const WORKPLACE_WORDS = ["거래처", "제안서", "보고서", "회의", "출근", "퇴근", "상사", "팀장", "동료", "업무"] as const;
/** v4.5: 주의인 날 본문에 나오면 앞뒤가 어긋나는 반전 말 */
/** "긴장이 풀려요"·"피로가 풀려요"는 위로라 괜찮다 — 일이 풀린다는 반전만 본다 */
export const CARE_DAY_REVERSAL_RE = /수월|순조|술술|(일이|막혀 있던 일이|막힌 일이|잘)\s?풀리/;
/** v4.5: 시간대를 차례로 늘어놓는 틀 (아침→점심→저녁→밤 중 3개 이상) */
export const TIME_WORDS = ["아침", "점심", "저녁", "밤"] as const;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 받침이 ㄴ인가 (같은·고른·드는) */
const hasNieun = (ch: string): boolean => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 && k % 28 === 4; };
/** 일상어와 겹치는 전문용어 꼴을 뗀다: "상관없어요/상관하지", "고른 편인데", "힘이 드는 편인 병오" (앞말이 ㄴ 받침 꾸밈말이면 '편 + 인') — 코어 validate.ts V06과 같은 규칙 */
function stripCommon(t: string): string {
  return t
    .replace(/상관\s?(없|하지|할 바|말고|이 없|안)/g, "")
    .replace(/편인(데|지)/g, "")
    // v4.5: "메시지"의 "시지", "연지곤지"류 일상어가 전문용어로 걸리던 것
    .replace(/메시지/g, "")
    // "지지해 주다·지지를 받다"(응원) 같은 일상어
    .replace(/지지(해|하|받|를\s?받|를\s?보내)/g, "")
    // "넘기지지 않-", "느껴지지 않-"처럼 '-지지 않/말/도/는' 꼴은 일상어
    .replace(/지지\s?(않|말|도\s?않|는\s?않|요)/g, "")
    // v4.13: "무슨 일지", "할 일지 모르", "일지라도"처럼 '-ㄹ 일지'·'일지 모르' 꼴은 일상어 (2차 말뭉치 C 10-18이 이 오탐으로 템플릿에 떨어졌다)
    .replace(/(할|될|올|갈|생길|있을|없을|모를|무슨|어떤|인) 일지/g, "")
    .replace(/일지(도|라도)?\s?모르/g, "")
    .replace(/(\S+) 편인/g, (m, w: string) => (hasNieun(w.at(-1)!) ? "" : m));
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

  // v4.13: 이름 없는 추상어 · 생·극 설명 — 모델 글뿐 아니라 brief 재료(core.ts)도 같은 말을 쓰지 않는다 (테스트가 본다)
  // v4.14: 걸린 문장을 인용한다 — 어느 칸의 어느 말이 걸렸는지 재작성과 분석에서 바로 보이게
  const sentenceOf = (hit: string): string => { const s = splitSentences(everything.replace(/\n+/g, " ")).find((x) => x.includes(hit)) ?? ""; return s.length > 40 ? s.slice(0, 40) + "…" : s; };
  const ab = everything.match(ABSTRACT_RE);
  if (ab) add(`추상어 "${ab[0]}" (무엇이 모자라고 넘치는지 기운 이름을 대기; 문장 "${sentenceOf(ab[0])}")`);
  const sk = everything.match(SHENG_KE_RE);
  if (sk) add(`생·극 설명 "${sk[0]}" (기운 이름을 한 번 대고 맞는지만 말하기; 문장 "${sentenceOf(sk[0])}")`);

  // v4.13: 오늘 기운 이름 — 본문에 오늘 것(brief.today.tenGods) 가운데 하나는 있어야 하고, 오늘 것이 아닌 이름은 날조, 같은 이름은 TERM_MAX번까지
  const todayNames = (b.today?.tenGods ?? "").split("·").filter(Boolean);
  if (todayNames.length) {
    const inBody = TEN_GOD_NAMES.filter((n) => plain.includes(n));
    if (!todayNames.some((n) => t.body.includes(n))) add(`오늘 기운 이름(${b.today.tenGods})이 본문에 없음 (이름 한 번 + 뜻 한 줄 + 맞는지 한 문장)`);
    for (const n of inBody) if (!todayNames.includes(n)) add(`오늘 기운이 아닌 이름 "${n}" (brief.today.tenGods에 있는 것만)`);
    for (const n of inBody) { const c = plain.split(n).length - 1; if (c > TERM_MAX) add(`이름 "${n}"이 ${c}번 (용어는 한 번, 바로 뒤에 뜻 한 줄)`); }
  }
  // v4.15: 이달 한 줄은 본문에서 빠졌다(areas의 이달 줄이 매일). month가 없는 날 이달 운을 말하면 여전히 탈락
  if (!b.month && MONTH_MENTION_RE.test([t.headline, t.body, t.do, t.dont].join(" "))) add("이달 운 재료(brief.month)가 없는데 이달 운을 말함");
  // v4.15: 블록 검사 (blocks가 있을 때만)
  for (const s of validateBlocks(t.blocks, b)) add(s);

  // 구조 서술 (headline은 제외: 본문·영역 줄·하면·피해요)
  const prose = [t.body, ...areaLines, t.do, t.dont].join(" ");
  for (const w of STRUCTURE_WORDS) if (prose.includes(w)) add(`구조 서술 "${w}"`);

  // 숫자: brief에 있는 것만. v4.2: 점수 숫자는 따로 이름 붙여 탈락 (allowedNumbers에 점수는 없다)
  const allowed = new Set(b.allowedNumbers);
  const scoreValue = b.score?.value;
  const nums = [...new Set((everything.match(NUMBER_RE) ?? []).map(Number))];
  const bad = nums.filter((n) => !allowed.has(n) && n !== scoreValue);
  if (bad.length) add(`사실에 없는 숫자 ${bad.join(", ")}`);
  if (scoreValue !== undefined && !allowed.has(scoreValue) && nums.includes(scoreValue)) add(`점수 숫자 ${scoreValue} (점수는 화면에 있으니 글에 쓰지 않기)`);
  if (SCORE_PHRASE_RE.test(everything)) add('점수 숫자 ("N점 만점" 꼴 — 점수는 화면에 있으니 글에 쓰지 않기)');

  // v4.5: 직장 가정 · 주의인 날 반전 · 시간대 나열 · 추상 이름 그대로 · 절기 첫날 아닌데 절기 이름
  const own = [t.body, t.do, t.dont].join(" ");
  for (const w of WORKPLACE_WORDS) if (own.includes(w)) add(`직장 장면 "${w}" (직업과 무관한 장면으로)`);
  // 10-b: 이달·올해·10년 운을 옮겨 적은 문장("이달 무술월은 수월한 편")은 오늘 이야기가 아니라 반전 검사에서 뺀다
  const todayOnly = splitSentences(t.body.replace(/\n+/g, " ")).filter((s) => !/이달|이번 달|올해|10년/.test(s)).join(" ");
  if (b.score?.band === "주의" && CARE_DAY_REVERSAL_RE.test(todayOnly)) add(`주의인 날 본문에 반전 말 "${todayOnly.match(CARE_DAY_REVERSAL_RE)![0]}"`);
  const times = TIME_WORDS.filter((w) => t.body.includes(w));
  if (times.length >= 3) add(`시간대 나열 (${times.join("·")}) — 장면 1~2개만`);
  // v4.13: 성격 이름("압박과 책임")은 기운 이름 바로 뒤의 뜻 한 줄로는 쓸 수 있다 — 같은 문장에 십신 이름이 없을 때만 추상
  for (const sent of splitSentences(t.body.replace(/\n+/g, " "))) for (const l of ABSTRACT_LABELS) if (sent.includes(l) && !TEN_GOD_NAMES.some((n) => sent.includes(n))) add(`추상 이름 "${l}"을 그대로 씀 (기운 이름 뒤의 뜻으로만, 아니면 생활 속 마음·행동으로)`);
  if (b.today && b.today.useSolarTerm === false && b.today.solarTermName && everything.includes(b.today.solarTermName)) add(`절기 이름 "${b.today.solarTermName}" (절기 첫날에만)`);

  // v4.5: 예시 베낌 — 예시 headline·do·dont와 같거나, 본문 문장이 예시 문장과 80% 이상 겹치면
  const exSentences = FORTUNE_EXAMPLES.flatMap((e) => splitSentences(joinBlocks(e.text.blocks)));
  for (const e of FORTUNE_EXAMPLES) {
    if (t.headline.trim() === e.text.headline) add(`예시 headline을 그대로 씀 "${e.text.headline}"`);
    if (t.do.trim() === e.text.do || t.dont.trim() === e.text.dont) add("예시 do·dont를 그대로 씀");
  }
  // v4.13: 이달 한 줄·이름+뜻 문장·판정 문장은 꼴이 정해진 문장이라(brief.month.line을 그대로 옮기면 예시와 같아진다) 베낌 검사에서 뺀다 — 장면·할 것 문장만 본다
  const formulaic = (s: string) => /이달|이번 달|맞는 (날|편)|안 맞는|보통 날/.test(s) || TEN_GOD_NAMES.some((n) => s.includes(n));
  for (const sent of splitSentences(t.body)) if (!formulaic(sent) && exSentences.some((x) => tokenOverlap(sent, x) >= 0.8)) add(`예시 문장을 베낌 "${sent.slice(0, 20)}…"`);

  // v4.8 기억: 최근 3일 헤드라인과 같거나 많이 겹치면, 첫 두 문장이 최근 첫 두 문장과 50% 이상 겹치면 탈락
  const startNow = splitSentences(t.body.replace(/\n+/g, " ")).slice(0, 2).join(" ");
  const mandatedForStart = t.blocks ? mandatedStems(b) : null;   // v4.15 2차: 블록 글은 꼭 쓰는 말(이름·뜻)을 빼고 잰다 — 근거가 첫 블록인 날 이름 문장끼리 "겹침"이 되던 것
  for (const r of b.recent ?? []) {
    if (t.headline.trim() === r.headline.trim() || tokenOverlap(t.headline, r.headline) >= 0.6) add(`최근(${r.date}) 헤드라인과 겹침 "${r.headline}"`);
    if ((mandatedForStart ? freeOverlap(startNow, r.start, mandatedForStart) : tokenOverlap(startNow, r.start)) >= 0.5) add(`최근(${r.date}) 운세 첫 문장과 겹침`);
    // v4.11: 이달·올해 영역 줄은 신호가 한 달·한 해 내내 같아 날마다 같은 문장이 되던 것(되풀이 검토 2026-10-14) — 뜻은 같아도 문장은 바꿔 쓰게
    for (const line of r.areas ?? []) t.areas.forEach((a, i) => {
      if (a?.period && a.period !== "오늘" && (String(a.line).trim() === line.trim() || tokenOverlap(String(a.line), line) >= 0.6)) add(`areas[${i}] ${a.period} 줄이 최근(${r.date}) 줄과 겹침 "${line.slice(0, 18)}…" (같은 뜻을 다른 장면·다른 말로)`);
    });
  }

  // 단정 · 기간 약속 · 명령조
  if (PROMISE_RE.test(everything)) add("기간 약속 (\"N일 더 쓰면\" 꼴)");
  if (CERTAIN_RE.test(everything)) add("길흉 단정 표현");

  // v4.4: 맥락 문장이 없는 날에 올해·10년 단위 운을 말하면 탈락 (영역 줄은 제외). v4.13: 이달은 매일이라 뺐다
  const ownProse = [t.headline, t.body, t.do, t.dont].join(" ");
  if (!hasContextFact(b.facts ?? []) && CONTEXT_MENTION_RE.test(ownProse)) add("오늘만: facts에 없는 올해·10년 단위 운을 말함");

  // 어미: 본문·영역 줄·하면/피해요의 모든 문장이 "~요"로 끝나야 하고, 명령조·반말 어미는 하나도 없어야 한다
  const sentences = [...splitSentences(t.body), ...areaLines.flatMap(splitSentences), ...splitSentences(t.do), ...splitSentences(t.dont)];
  const badEnd = sentences.filter((s) => BAD_ENDING_RE.test(s));
  if (badEnd.length) add(`명령조·반말·"~니다" 어미: "${badEnd[0]}"`);
  const good = sentences.filter((s) => GOOD_ENDING_RE.test(s)).length;
  if (sentences.length && good / sentences.length < 0.8) add(`"~어요" 어미 비율 ${good}/${sentences.length}`);
  // v4.15: do·dont·영역 줄은 한 문장이라 끝이 "~요"가 아니면 바로 탈락 — 1차 말뭉치에서 "않아요.eta", "아요.」" 같은 꼬리가 비율 검사를 빠져나갔다
  for (const [k, v] of [["do", t.do], ["dont", t.dont], ...areaLines.map((l, i) => [`areas[${i}]`, l] as [string, string])] as [string, string][]) {
    if (v.trim() && !GOOD_ENDING_RE.test(v.trim())) add(`${k}가 "~요"로 끝나지 않음 "${v.trim().slice(-8)}"`);
  }

  // 분량
  if (t.headline.length > LIMITS.headlineMax) add(`headline ${t.headline.length}자 (${LIMITS.headlineMax}자 안)`);
  const bodyN = splitSentences(t.body).length;
  if (bodyN < LIMITS.bodySentences[0] || bodyN > LIMITS.bodySentences[1]) add(`본문 ${bodyN}문장 (4~6문장)`);
  if (t.body.length > LIMITS.bodyMax) add(`본문 ${t.body.length}자 (${LIMITS.bodyMax}자 안)`);
  for (const k of ["do", "dont"] as const) {
    if (splitSentences(t[k]).length !== 1) add(`${k}는 1문장`);
    if (t[k].length > LIMITS.doDontMax) add(`${k} ${t[k].length}자 (${LIMITS.doDontMax}자 안)`);
  }

  // 영역: 개수·이름·순서(·period)가 brief와 같아야 하고 줄은 1문장. v4.2: 본문 첫 문장과 겹치면 탈락
  const want = b.areas.map((a) => a.area);
  const got = t.areas.map((a) => a?.area);
  if (want.length !== got.length || want.some((a, i) => a !== got[i])) add(`areas 불일치: 기대 [${want.join(",")}] / 받음 [${got.join(",")}]`);
  const wantPeriod = b.areas.map((a) => a.period);
  const gotPeriod = t.areas.map((a, i) => a?.period ?? wantPeriod[i]);
  if (want.length === got.length && wantPeriod.some((p, i) => p !== undefined && p !== gotPeriod[i])) add(`areas period 불일치: 기대 [${wantPeriod.join(",")}] / 받음 [${gotPeriod.join(",")}]`);
  const firstSentence = splitSentences(t.body)[0] ?? "";
  const bodySents = splitSentences(t.body.replace(/\n+/g, " "));
  t.areas.forEach((a, i) => {
    const line = String(a?.line ?? "");
    if (!line.trim()) add(`areas[${i}] line 비어 있음`);
    else if (splitSentences(line).length !== 1) add(`areas[${i}] line은 1문장`);
    if (line.length > LIMITS.areaLineMax) add(`areas[${i}] line ${line.length}자 (${LIMITS.areaLineMax}자 안)`);
    if (firstSentence && tokenOverlap(line, firstSentence) >= AREA_OVERLAP_MAX) add(`areas[${i}] line이 본문 첫 문장과 겹침`);
    else { const hit = a?.period === "오늘" ? repeatedSentence(line, bodySents) : null; if (hit) add(`areas[${i}] line이 본문 문장을 되풀이함 ${quoteHit(hit)}`); }
  });
  // v4.9: do·dont도 본문을 되풀이하면 탈락. v4.14: 어느 문장과 겹치는지 인용해 칸만 고쳐 쓸 때 피할 문장을 알게
  const doHit = repeatedSentence(t.do, bodySents);
  if (doHit) add(`do가 본문 문장을 되풀이함 ${quoteHit(doHit)}`);
  const dontHit = repeatedSentence(t.dont, bodySents);
  if (dontHit) add(`dont가 본문 문장을 되풀이함 ${quoteHit(dontHit)}`);
  // v4.10: 이음말 — 첫 문장이 '그래서·그러니·그런데'로 시작하면 받을 앞 문장이 없고(비약), '그래서'는 본문에 한 번까지(같은 이음말 되풀이)
  if (/^(그래서|그러니|그러니까|그런데|그러다 보니)/.test(firstSentence)) add(`첫 문장이 이음말로 시작 "${firstSentence.slice(0, 12)}…" (받을 앞 문장이 없음)`);
  const sosCount = (t.body.match(/그래서/g) ?? []).length;
  if (sosCount > 1) add(`'그래서'가 ${sosCount}번 (본문에 한 번까지 — 원인이 되는 앞 문장이 있을 때만)`);
  const connectiveStarts = bodySents.filter((s) => /^(그래서|그러니|그러니까|그런데|그래도|그러다 보니|하지만)/.test(s)).length;
  if (bodySents.length >= 4 && connectiveStarts >= 3) add(`이음말로 시작하는 문장이 ${connectiveStarts}개 (문장을 '~라서·~는데'로 한 문장에 묶거나 이음말 없이 잇기)`);

  // 내 숫자 문장: 기록이 있으면 횟수와 평균이 본문에 있어야 하고, 없으면 기록 이야기를 하면 안 된다
  const bodyNums = new Set((t.body.match(NUMBER_RE) ?? []).map(Number));
  if (b.personal) {
    const count = b.personal.sameGanjiCount > 0 && b.personal.sameGanjiMean !== null ? b.personal.sameGanjiCount : b.personal.n;
    const mean = b.personal.sameGanjiCount > 0 && b.personal.sameGanjiMean !== null ? b.personal.sameGanjiMean : b.personal.mean;
    if (!bodyNums.has(count) || !bodyNums.has(mean)) add(`내 숫자 문장 없음 (횟수 ${count}, 평균 ${mean}이 본문에 있어야 함)`);
  } else if (/기록(했|이|을|한)|평균/.test(t.body)) {
    add("기록이 없는데 기록·평균을 말함");
  }

  return issues;
}
