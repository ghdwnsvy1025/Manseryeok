// 3단계 — 글의 재료(brief). 모델에게 가는 유일한 입력이고, 검사기(validate.ts)는 "brief에 없는 것이 글에 나왔는가"를 이 묶음으로 판단한다.
// 사주 코어 content/src/brief.ts의 축소판: 사실 + 낱말 + 금지 사항 + 분량 규칙. 설계: docs/FORTUNE_V4.md "3단계 — 글".
import type { TenGod } from "@saju/engine";
import { AREA_WORD } from "./core";
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

export interface FortuneBrief {
  today: { date: string; weekday: string; ganji: string };
  score: { value: number; band: string; word: string };
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
  const allowedNumbers = extractNumbers([
    ...facts,
    ...caveats,
    ...areas.map((a) => a.why),
    ...(mine ? [mine] : []),
    String(y), String(m), String(d),
  ]);

  return {
    today: { date: input.date, weekday: input.weekday, ganji: `${today.ko}일` },
    score: { value: input.score10, band: input.band, word: BAND_WORD[input.band] },
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
      body: "4~6문장. 사실들을 나열하지 말고 하나의 하루 흐름으로 잇기. 아침·점심·저녁 중 한 장면을 구체적으로 하나 넣기. 같은 문형 반복 금지. 같은 성격이 두 번 온 날은 \"겹친다\" 대신 \"아주 강하다/세다\"로",
      areas: areas.length
        ? `areas 배열은 ${areas.length}개, 순서·period·area 이름은 입력과 똑같이. 각 line은 1문장. period가 "이달"이면 "이달엔", "올해"면 "올해는"으로 시작하는 1문장. line은 본문 첫 문장을 되풀이하지 않기`
        : "areas는 빈 배열 []",
      doDont: "do(하면)와 dont(피해요)는 각각 1문장, 구체적 행동. '~해요/~않아요' 꼴",
      numbers: "숫자는 allowedNumbers에 있는 것만. 사실에 없는 숫자·사건·시간·금액을 만들지 않기. 점수는 화면에 있으니 글에 쓰지 않기 (\"N점\", \"N점 만점\" 금지)",
      mine: mine
        ? `본문 어딘가에 내 숫자 한 문장을 꼭 넣기 (재료: "${mine}"). 숫자는 그대로 쓰기`
        : "기록이 없으니 내 기록 이야기를 하지 않기 (기록했다는 말, 평균, 횟수 모두 금지)",
    },
  };
}

/** 모델에 보내는 user 메시지 본문. brief를 그대로 JSON으로 */
export function renderBrief(b: FortuneBrief): string {
  return JSON.stringify(b);
}
