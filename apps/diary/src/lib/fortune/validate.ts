// 3단계 — 출력 검사기. "brief에 없는 것은 글에 나올 수 없다"를 기계로 확인한다. 사유가 하나라도 있으면 그 글은 쓰지 않는다(1회 재작성 → 템플릿).
// 검사 항목: 금지어 · 전문용어 · 한자 · 이모지 · 숫자 날조 · 어미(~어요) · 명령조 · 기간 약속 · 문장 수 · 영역 일치 · 길이 상한 · 내 숫자 문장 · 구조 서술(v4.1) · 맥락 없는 운 언급(v4.4)
//           · 점수 숫자(v4.2: "6.3점", "N점 만점") · 영역 period 일치 · 영역 줄이 본문 첫 문장과 60% 이상 겹침(v4.2). "이달엔/올해는" 접두는 모델 지시일 뿐 검사하지 않는다(템플릿 줄에는 접두가 없다).
import type { FortuneBrief } from "./brief";
import { hasContextFact, NUMBER_RE } from "./brief";
import type { AreaName, AreaPeriod } from "./types";

/** 모델이 돌려주는 JSON */
export interface ModelText {
  headline: string;
  body: string;
  /** v4.2: period는 brief.areas와 같은 순서로 돌려받는다 (빠지면 brief 것으로 본다) */
  areas: { period?: AreaPeriod; area: AreaName; line: string }[];
  do: string;
  dont: string;
}

export const LIMITS = {
  headlineMax: 20,
  bodySentences: [4, 6] as const,
  bodyMax: 420,
  areaLineMax: 70,
  doDontMax: 45,
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
/** v4.1 ⑤ 구조 서술: 사주 구조("글자"가 짝이 되고 부딪히고…)를 설명하는 말. 결과만 생활어로 말해야 한다. body·areas·do·dont에서 본다 (brief.jargon과 별개) */
export const STRUCTURE_WORDS = ["글자", "짝이 되", "짝이 맞", "부딪히", "맞서", "한편이", "위아래", "윗글", "아랫글"] as const;
/** v4.2: 점수는 화면에 있으니 글에 쓰지 않는다. "N점 만점" 꼴은 숫자와 상관없이 탈락 */
const SCORE_PHRASE_RE = /점\s*만점|만점에/;
/** v4.4: 올해·이달·10년 단위 운 언급. brief.facts에 맥락 문장이 없는 날 headline·body·do·dont에 나오면 탈락 (areas의 "이달엔/올해는" 줄은 예외) */
export const CONTEXT_MENTION_RE = /(올해|이달|이번 달|10년 단위)\s*(의\s*)?운|10년\s*단위/;
/** v4.2: 영역 줄이 본문 첫 문장을 되풀이하면 탈락 — 토큰(띄어쓰기 단위, 문장부호 제거) 겹침 비율 */
export const AREA_OVERLAP_MAX = 0.6;
const tokensOf = (s: string): string[] => s.replace(/[.,!?'"()]/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
export function tokenOverlap(a: string, b: string): number {
  const ta = tokensOf(a), tb = new Set(tokensOf(b));
  if (ta.length < 3) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

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
    // "넘기지지 않-", "느껴지지 않-"처럼 '-지지 않/말/도/는' 꼴은 일상어
    .replace(/지지\s?(않|말|도\s?않|는\s?않|요)/g, "")
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
  for (const w of b.banned) if (everything.includes(w)) add(`금지어 "${w}"`);
  const plain = stripCommon(everything);
  for (const w of b.jargon) if (plain.includes(w)) add(`전문용어 "${w}"`);
  if (/상관(이|은|을|과|의)\s/.test(plain)) add(`전문용어 "상관"`);
  if (HANJA_RE.test(everything)) add("한자가 있음 (글은 한글로만)");
  if (EMOJI_RE.test(everything)) add("이모지가 있음");

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

  // 단정 · 기간 약속 · 명령조
  if (PROMISE_RE.test(everything)) add("기간 약속 (\"N일 더 쓰면\" 꼴)");
  if (CERTAIN_RE.test(everything)) add("길흉 단정 표현");

  // v4.4: 맥락 문장이 없는 날에 올해·이달·10년 단위 운을 말하면 탈락 (영역 줄은 제외)
  const ownProse = [t.headline, t.body, t.do, t.dont].join(" ");
  if (!hasContextFact(b.facts ?? []) && CONTEXT_MENTION_RE.test(ownProse)) add("오늘만: facts에 없는 올해·이달·10년 단위 운을 말함");

  // 어미: 본문·영역 줄·하면/피해요의 모든 문장이 "~요"로 끝나야 하고, 명령조·반말 어미는 하나도 없어야 한다
  const sentences = [...splitSentences(t.body), ...areaLines.flatMap(splitSentences), ...splitSentences(t.do), ...splitSentences(t.dont)];
  const badEnd = sentences.filter((s) => BAD_ENDING_RE.test(s));
  if (badEnd.length) add(`명령조·반말·"~니다" 어미: "${badEnd[0]}"`);
  const good = sentences.filter((s) => GOOD_ENDING_RE.test(s)).length;
  if (sentences.length && good / sentences.length < 0.8) add(`"~어요" 어미 비율 ${good}/${sentences.length}`);

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
  t.areas.forEach((a, i) => {
    const line = String(a?.line ?? "");
    if (!line.trim()) add(`areas[${i}] line 비어 있음`);
    else if (splitSentences(line).length !== 1) add(`areas[${i}] line은 1문장`);
    if (line.length > LIMITS.areaLineMax) add(`areas[${i}] line ${line.length}자 (${LIMITS.areaLineMax}자 안)`);
    if (firstSentence && tokenOverlap(line, firstSentence) >= AREA_OVERLAP_MAX) add(`areas[${i}] line이 본문 첫 문장과 겹침`);
  });

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
