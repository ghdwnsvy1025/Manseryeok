// 3단계 — 글의 재료(brief). 모델에게 가는 유일한 입력이고, 검사기(validate.ts)는 "brief에 없는 것이 글에 나왔는가"를 이 묶음으로 판단한다.
// 사주 코어 content/src/brief.ts의 축소판: 사실 + 낱말 + 금지 사항 + 분량 규칙. 설계: docs/FORTUNE_V4.md "3단계 — 글".
import type { TenGod } from "@saju/engine";
import { TEN_GOD_THEME } from "./base";
import { AREA_WORD } from "./core";
import { solarTermOf } from "./solarTerms";
import { BANNED, batchim } from "./text";
import type { AreaName, AreaPeriod, AreaSignal, CoreFortune, PersonalAdjustment } from "./types";

/** 사주 코어 content/validate.ts의 COMMON_BAN·HEALTH_BAN 복사. 하루 운세에서도 같은 선을 지킨다 */
export const CORE_BANNED = [
  "죽음", "사망", "단명", "요절", "이혼", "사별", "파산", "부도", "불륜", "암에", "암이", "수술", "교통사고", "사고를 당", "우울증", "공황", "자살",
  "반드시", "틀림없이", "무조건", "100% 확실", "백프로", "절대로", "팔자가 세", "팔자가 사나",
  "진단", "처방", "영양제", "검진", "치료", "질환", "병원", "복용", "증상", "약을 드", "건강검진",
];
/** 글에 쓰면 안 되는 말 전부 (text.ts BANNED + 코어 금지 낱말) */
export const BANNED_ALL: readonly string[] = [...new Set([...BANNED, ...CORE_BANNED])];

/** 전문용어. 괄호 안에서도 쓰지 않는다. ("상관"은 일상어와 겹쳐 뺀다 — validate가 문맥으로 본다) */
export const JARGON = ["윗글자", "아랫글자", "오늘 글자", "내 글자", 
  "십신", "용신", "기신", "희신", "구신", "한신", "일간", "일지", "월지", "연지", "시지", "천간", "지지", "오행",
  "삼합", "육합", "반합", "방합", "상충", "대운", "세운", "월운", "일진", "사주팔자", "신강", "신약",
  "비견", "겁재", "식신", "편재", "정재", "편관", "정관", "편인", "정인", "비겁", "식상", "재성", "관성", "인성", "칠살",
];

const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥", S_KO = "갑을병정무기경신임계", B_KO = "자축인묘진사오미신유술해";
const TEN_GODS: TenGod[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];

/** 한자 간지를 한글 읽기로 ("丙午" → "병오", "壬" → "임"). 글은 한글로만 쓰므로 brief에서 먼저 바꾼다 */
export function hanjaToKo(s: string): string {
  return [...s].map((ch) => (STEMS.includes(ch) ? S_KO[STEMS.indexOf(ch)]! : BRANCHES.includes(ch) ? B_KO[BRANCHES.indexOf(ch)]! : ch)).join("");
}

/** 사실 문장에서 괄호 속 십신 이름을 뗀다: "'표현'(식신) 쪽" → "'표현' 쪽". 모델이 전문용어를 따라 쓰지 않게 */
export function plainFact(f: string): string {
  const re = new RegExp(`'([^']+)'\\((${TEN_GODS.join("|")})\\)`, "g");
  return hanjaToKo(f.replace(re, "'$1'"));
}

export interface BriefInput {
  core: CoreFortune;
  personal: PersonalAdjustment;
  today: { ko: string; hanja: string; stemKo: string; branchKo: string };
  /** YYYY-MM-DD */
  date: string;
  weekday: string;
  score10: number;
  band: "좋음" | "무난" | "주의";
}

/** v4.4: facts 안의 맥락 문장(올해·이달·10년 단위 운). 이것이 있을 때만 글이 그 운을 말할 수 있다 — validate가 같은 정규식으로 본다 */
export const CONTEXT_FACT_RE = /^(올해 운|이달 운|지금 10년 단위 운)/;
export const hasContextFact = (facts: readonly string[]): boolean => facts.some((f) => CONTEXT_FACT_RE.test(f));

/** v4.5: 본문에 그대로 쓰면 추상적으로 읽히는 성격 이름("경쟁과 추진" 같은 'A과 B' 꼴). 생활 속 마음·행동으로 풀어 써야 한다 — 검사기가 본다 */
export const ABSTRACT_LABELS: readonly string[] = Object.values(TEN_GOD_THEME).filter((t) => /[과와] /.test(t));

/** v4.6: 오늘의 짜임. change = 운이 바뀌거나 내 사주와 부딪히는 날(변동 대비) · focus = 한 생활 영역에 신호가 뚜렷한 날 · calm = 큰 신호 없는 날(담백하게) */
export type FortuneAngle = "change" | "focus" | "calm";

/** 엔진 결과로 오늘의 짜임을 고른다. 같은 입력이면 늘 같은 짜임 */
export function angleOf(core: Pick<CoreFortune, "relations" | "areas" | "facts">): { angle: FortuneAngle; focus: AreaName | null } {
  const changing = core.relations.hits.some((h) => h.kind === "충") || hasContextFact(core.facts);
  if (changing) return { angle: "change", focus: null };
  const strong = core.areas.find((a) => a.period === "오늘" && a.signal !== "→");
  if (strong) return { angle: "focus", focus: strong.area };
  return { angle: "calm", focus: null };
}

export interface FortuneBrief {
  /** v4.4: solarTerm = 그날이 속한 24절기와 며칠째 ("한로 사흘째"). v4.5: 글에 쓸 수 있는 건 절기 첫날(useSolarTerm)뿐 — 매일 "한로 사흘째…"로 시작하던 것 */
  today: { date: string; weekday: string; ganji: string; solarTerm: string; useSolarTerm: boolean; solarTermName: string };
  score: { value: number; band: string; word: string };
  /** v4.6: 오늘의 짜임과 중심 영역(focus일 때만, 생활어 "돈"·"사람"…) */
  angle: FortuneAngle;
  focusArea: string | null;
  /** v4.6: 원인 → 나와의 관계 → 합친 결과. 본문 둘째 단계가 이 순서로 "~라서 ~해요"를 잇는다 */
  chain: string[];
  /** 사용자용 낱말로 바뀐 사실 문장 (한자·십신 없음) */
  facts: string[];
  /** 신호 있는 영역. 이 순서·개수·period·area대로 areas 줄을 쓴다. v4.2: 오늘(≤2) → 이달(1) → 올해(1) */
  areas: { period: AreaPeriod; area: AreaName; word: string; signal: AreaSignal; why: string }[];
  keywords: { positive: string[]; negative: string[] };
  caveats: string[];
  /** 내 기록 숫자. 기록이 없으면 null */
  personal: { n: number; mean: number; sameGanjiCount: number; sameGanjiMean: number | null } | null;
  /** 본문에 넣어야 하는 "내 숫자 한 문장"의 재료. 기록이 없으면 null이고 그때는 기록 이야기를 하지 않는다 */
  mine: string | null;
  /** 글에 써도 되는 숫자 전부. 이 밖의 숫자는 날조로 본다. v4.2: 점수(score.value)는 들어 있지 않다 — 점수는 화면이 보여 준다 */
  allowedNumbers: number[];
  banned: readonly string[];
  jargon: readonly string[];
  rules: {
    headline: string;
    body: string;
    areas: string;
    doDont: string;
    numbers: string;
    mine: string;
    /** v4.4: 요일·절기 장면 규칙 */
    scene: string;
    /** v4.4: 올해·이달·10년 단위 운은 facts에 그 문장이 있을 때만 */
    context: string;
  };
}

export const BAND_WORD = { 좋음: "수월한 편", 무난: "보통", 주의: "조심할 편" } as const;

/** 글자열 묶음에서 숫자(정수·소수)를 모두 뽑는다. 검사기와 같은 정규식을 쓴다 */
export const NUMBER_RE = /\d+(?:\.\d+)?/g;
export function extractNumbers(texts: string[]): number[] {
  const out = new Set<number>();
  for (const t of texts) for (const m of t.match(NUMBER_RE) ?? []) out.add(Number(m));
  return [...out].sort((a, b) => a - b);
}

export function buildBrief(input: BriefInput): FortuneBrief {
  const { core, personal, today } = input;
  const facts = core.facts.map(plainFact);
  const caveats = core.caveats.map(hanjaToKo);
  const areas = core.areas.map((a) => ({ period: a.period, area: a.area, word: AREA_WORD[a.area], signal: a.signal, why: plainFact(a.why) }));

  let mine: string | null = null;
  let personalOut: FortuneBrief["personal"] = null;
  if (personal.n > 0 && personal.mean !== null) {
    personalOut = { n: personal.n, mean: personal.mean, sameGanjiCount: personal.sameGanjiCount, sameGanjiMean: personal.sameGanjiMean };
    mine =
      personal.sameGanjiCount > 0 && personal.sameGanjiMean !== null
        ? `지난 ${today.ko}일에 ${personal.sameGanjiCount}번 기록했고 평균 ${personal.sameGanjiMean}점이었어요`
        : `${today.stemKo}${batchim(today.stemKo) ? "이나" : "나"} ${today.branchKo}${batchim(today.branchKo) ? "이" : "가"} 든 날에 ${personal.n}번 기록했고 평균 ${personal.mean}점이었어요`;
  }

  const [y, m, d] = input.date.split("-").map(Number) as [number, number, number];
  const term = solarTermOf(input.date);
  const solarTerm = term.label;
  const allowedNumbers = extractNumbers([
    ...facts,
    ...caveats,
    ...areas.map((a) => a.why),
    ...(mine ? [mine] : []),
    solarTerm,
    String(y), String(m), String(d),
  ]);
  const withContext = hasContextFact(facts);
  const ang = angleOf(core);

  return {
    today: { date: input.date, weekday: input.weekday, ganji: `${today.ko}일`, solarTerm, useSolarTerm: term.isTermDay, solarTermName: term.name },
    score: { value: input.score10, band: input.band, word: BAND_WORD[input.band] },
    angle: ang.angle,
    focusArea: ang.focus ? AREA_WORD[ang.focus] : null,
    chain: facts.slice(0, 3),
    facts,
    areas,
    keywords: core.keywords,
    caveats,
    personal: personalOut,
    mine,
    allowedNumbers,
    banned: BANNED_ALL,
    jargon: JARGON,
    rules: {
      headline: "12자 안팎, 한 구절. 오늘 하루의 느낌을 사실 하나와 묶어서",
      body: "4~6문장, 두 문단(빈 줄로 나눔). 사실들을 나열하지 말고 오늘의 성격·장면·내 기록으로만 쓰기. 첫 문단은 공감 한 문장 + chain 순서대로 원인→결과, 둘째 문단은 생활 장면 1~2개 + 마무리. 시간대를 차례로 늘어놓지 않기. 같은 문형 반복 금지. 같은 성격이 두 번 온 날은 \"겹친다\" 대신 \"아주 강하다/세다\"로",
      areas: areas.length
        ? `areas 배열은 ${areas.length}개, 순서·period·area 이름은 입력과 똑같이. 각 line은 1문장. period가 "이달"이면 "이달엔", "올해"면 "올해는"으로 시작하는 1문장. line은 본문 첫 문장을 되풀이하지 않기`
        : "areas는 빈 배열 []",
      doDont: "do(하면)와 dont(피해요)는 각각 1문장, 구체적 행동. '~해요/~않아요' 꼴",
      numbers: "숫자는 allowedNumbers에 있는 것만. 사실에 없는 숫자·사건·시간·금액을 만들지 않기. 점수는 화면에 있으니 글에 쓰지 않기 (\"N점\", \"N점 만점\" 금지)",
      mine: mine
        ? `본문 어딘가에 내 숫자 한 문장을 꼭 넣기 (재료: "${mine}"). 숫자는 그대로 쓰기`
        : "기록이 없으니 내 기록 이야기를 하지 않기 (기록했다는 말, 평균, 횟수 모두 금지)",
      scene: term.isTermDay
        ? `오늘은 ${input.weekday}, ${term.name}${batchim(term.name) ? "이" : "가"} 시작하는 날. 절기 이름은 한 번만 써도 되고, 요일도 한 번만. 직장·회사 장면(거래처·제안서·회의·출근·상사)은 쓰지 않기. "특별한·남다른·다른 날과 달리·차별" 금지`
        : `오늘은 ${input.weekday}. 절기 이름(${term.name})은 쓰지 않기. 요일은 꼭 필요할 때만 한 번. 직장·회사 장면(거래처·제안서·회의·출근·상사)은 쓰지 않기. "특별한·남다른·다른 날과 달리·차별" 금지`,
      context: withContext
        ? "facts에 올해·이달·10년 단위 운 문장이 있는 날이니 그 문장만 한 번 생활어로 풀어 넣기 (없는 운은 말하지 않기)"
        : "facts에 올해·이달·10년 단위 운 문장이 없으니 올해 운·이달 운·10년 단위 운을 말하지 않기 (areas의 이달·올해 줄은 예외)",
    },
  };
}

/** 모델에 보내는 user 메시지 본문. brief를 그대로 JSON으로 */
export function renderBrief(b: FortuneBrief): string {
  return JSON.stringify(b);
}
