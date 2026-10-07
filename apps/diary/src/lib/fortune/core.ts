// 오늘의 운세 v4 — 사주 코어 판정(@saju/core-rules) 위에서 하루 판정을 조립한다. 설계: docs/FORTUNE_V4.md
//
//   원국(일기 앱 pillars 스냅샷) → balance → yongsin(현묘표) → relations
//   맥락: fromBirth(BirthInput) → currentLuckContext = 현재 대운 · 세운(입춘 전이면 전년) · 월운
//   일진: luck + luckRelations + luckAreas("일운") · 중첩: luckClash(대운·세운·월운, 일진)
//   점수: score01 = clamp(0.5 + (raw + rel + ctx) / 12, 0.12, 0.92)
//   v4.1: 한·한 일진은 판정 "보통", 한신도 영역 "→", ctx에 대운·세운 판정 소폭(×0.2, ×0.15), 월운·대운 플래그 문장 항상
//   v4.2 (코어 240c91d, 2026-10-07 동기화): 전왕표(Y-08) 없음. Y-12 — 비겁 중심 신강의 관성 운은 라벨 "한"이지만 코어가 희신급 점수로 올린다(플래그 "Y-12").
//        코어 규칙이 우선이므로 그 글자는 v4.1 ①②(한·한 → 보통, 한신 영역 →)에서 빼고 문장도 희신 말로 쓴다.
//   v4.2 합: 코어대로 점수 없음, 플래그만 (규칙/00_읽는법.md 원칙 4, 삼합.md S-05·S-08, 용신.md Y-09 "함께 내는 상호작용 플래그").
//        rel에는 충만 남고(방향은 코어 luckRelations), 합은 hits에 direction "중립"·점수 0.
//   v4.2 영역: 오늘(일운 ≤2) + 이달(월운 1) + 올해(세운 1), 모두 코어 luckAreas. "위아래" 문장 없음.
//   v4.3: 합 문장 0개 — 어댑터의 "용신 손상 … 합으로 묶음" 판정과 "묶여…"/"누그러져요" 문장 삭제(합은 hits에만 남는다. 코어 luck()이 내는 플래그는 flags에 그대로 두되 문장은 만들지 않는다).
//        같은 십신이면 첫 문장은 "두 번 겹쳐요" 대신 "아주 강해요". 일진 facts = 십신 성격 · 용신 역할 · 합계 판정 · 충(있을 때) · 대운/세운/월운 판정 · 대운 플래그.
//   v4.4 (운세 글 — 오늘만, 00-톤.md v3.6): 대운·세운·월운 판정 문장과 대운 플래그 문장은 facts에서 빼고 contextFacts(근거 표시용, 항상)로 옮긴다.
//        facts에는 바뀌는 날에만 한 문장 — (a) 월운이 바뀐 날(절기 입절일 = monthGanjiList 시작일) 이달 운, (b) 입춘일 올해 운, (c) 대운 교체일(현재 대운 시작일) 10년 운,
//        (d) 운↔일진 충(최고경보 포함)이 있는 날 그 운. 점수·영역·context 데이터는 그대로.
//
// 모델 호출은 없다. 문장은 쓰지 않고(facts는 글 재료) 숫자는 영역에 만들지 않는다(코어: 일운 확신도 "낮음").
import type { TenGod } from "@saju/engine";
import { getSolarTermKSTIso, getTenGod, type StemHanja } from "@saju/engine";
import {
  balance,
  currentLuckContext,
  fromBirth,
  luck,
  luckAreas,
  luckClash,
  luckKeywords,
  luckRelations,
  monthGanjiList,
  relations,
  toCorePillars,
  unknownHour,
  yearGanji,
  yongsin,
  type Balance,
  type BirthInput,
  type Luck,
  type Pillars,
  type Yongsin,
} from "@saju/core-rules";
import { CITIES } from "../cities";
import type { BirthProfile, PillarsSnapshot } from "../profile";
import { FAMILY_OF, TEN_GOD_THEME } from "./base";
import { batchim } from "./text";
import type {
  AreaName,
  AreaPeriod,
  AreaSignal,
  CoreFortune,
  CoreLuckContextItem,
  CoreLuckPart,
  CoreRelationHit,
  RoleLabel,
  Verdict5,
} from "./types";

// ---------- 계수 (가설. 백테스트로 조정. docs/FORTUNE_V4.md "10점 환산") ----------
export const COEF = {
  /** (raw + rel + ctx)를 0~1로 펼 때 나누는 수 */
  scale: 12,
  /** 충 한 건: ±0.5 × 강도(자리 비중), 합계 상한. v4.2: 합은 점수 없음(플래그만) */
  rel: 0.5,
  relMax: 1.5,
  /** 용신이 확정되지 않았을 때(시간 모름) 충을 방향 없이 빼는 크기 */
  relNoYongsin: 0.25,
  daeunClash: -0.8,
  daeunClashAlert: -1.2,
  seunClash: -0.5,
  wolunClash: -0.3,
  /** v4.1 ③: 대운·세운 자체의 판정(luck 합계점수)을 소폭 반영. 월운은 0 */
  daeunVerdict: 0.2,
  seunVerdict: 0.15,
  min: 0.12,
  max: 0.92,
} as const;

/** 시간 모름(Y-10): 12개 시주 중 이 개수 이상에서 용신 오행이 같아야 그 용신을 쓴다 */
export const UNKNOWN_HOUR_MIN = 10;

// ---------- 글자표 (코어 base.ts와 같은 값. 코어 index가 export하지 않는 상수만 여기 둔다) ----------
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
/** 지지 정기 */
const MAIN_STEM: Record<string, string> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" };
const YUKHAP: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
const SAMHAP: { 글자: string; 오행: "목" | "화" | "토" | "금" | "수" }[] = [
  { 글자: "申子辰", 오행: "수" }, { 글자: "亥卯未", 오행: "목" }, { 글자: "寅午戌", 오행: "화" }, { 글자: "巳酉丑", 오행: "금" },
];
const POS: CoreRelationHit["pos"][] = ["연", "월", "일", "시"];
const hourPillar = (dayStem: string, i: number): string => STEMS[([0, 2, 4, 6, 8][STEMS.indexOf(dayStem) % 5]! + i) % 10]! + BRANCHES[i]!;

// ---------- 사용자용 낱말 (text.ts BANNED를 지킨다: 기운·흐름·용신·기신·십신·일간·일지 금지) ----------
const POS_WORD: Record<CoreRelationHit["pos"], string> = { 연: "태어난 해 글자", 월: "태어난 달 글자", 일: "태어난 날 글자", 시: "태어난 시 글자" };
const LABEL_WORD: Record<Exclude<RoleLabel, null>, string> = {
  용: "내 사주에 모자란 쪽을 채워 줘요",
  희: "모자란 쪽에 힘을 보태요",
  한: "기울지 않고 그 성격대로 가요",
  구: "조금 거슬리는 쪽이에요",
  기: "내 사주에 이미 많은 쪽을 더 보태요",
};
const LABEL_SHORT: Record<Exclude<RoleLabel, null>, string> = { 용: "모자란 쪽을 채워요", 희: "힘을 보태요", 한: "기울지 않아요", 구: "조금 거슬려요", 기: "이미 많은 쪽을 더해요" };
const VERDICT_WORD: Record<Verdict5, string> = { "매우 유리": "꽤 수월한 편", 유리: "수월한 편", 보통: "보통", 주의: "조심할 편", 어려움: "힘이 드는 편" };
const AREA_WORD: Record<AreaName, string> = { 대인: "사람", 재물: "돈", 직업: "일", 학업: "배움", 연애: "연애", 가족: "가족", 건강: "몸" };

export interface CoreInput {
  /** 원국. 일기 앱 엔진 스냅샷을 믿는다 */
  pillars: PillarsSnapshot;
  /** 대운 목록용. 없으면 대운 없이 세운·월운만 */
  profile: BirthProfile | null;
  /** YYYY-MM-DD */
  date: string;
  /** 오늘 일진 (한자 두 글자) */
  todayHanja: string;
}

/** ProfileInput → 코어 BirthInput. 도시는 코어 출생지 이름으로, 없으면 경도를 직접 */
export function toBirthInput(p: BirthProfile): BirthInput {
  const city: { coreName?: string; longitude: number } = CITIES.find((c) => c.id === p.city) ?? CITIES[0];
  return {
    year: p.birthYear,
    month: p.birthMonth,
    day: p.birthDay,
    ...(p.birthHour === null ? {} : { hour: p.birthHour, minute: p.birthMinute ?? 0 }),
    달력: p.calendar === "lunar" ? "음력" : "양력",
    윤달: p.isLeapMonth,
    성별: p.gender === "male" ? "남" : "여",
    ...(city.coreName ? { 출생지: city.coreName } : { 경도: city.longitude }),
  };
}

/** 입춘(황경 315°) 날짜. 그날부터 그 해의 세운 */
export function ipchunDate(year: number): string {
  return getSolarTermKSTIso(year, 315).slice(0, 10);
}

/** 오늘 날짜의 세운 간지 — 입춘 전(1월 1일 ~ 입춘 전날)은 전년 */
export function seunOf(date: string): { 해: number; 간지: string; 입춘전: boolean } {
  const y = Number(date.slice(0, 4));
  const 입춘전 = date < ipchunDate(y);
  const 해 = 입춘전 ? y - 1 : y;
  return { 해, 간지: yearGanji(해), 입춘전 };
}

/** 시간 모름(Y-10): 12개 시주를 넣어 용신이 UNKNOWN_HOUR_MIN개 이상 모이면 그 용신, 아니면 null */
export function resolveYongsin(p: Pillars, b: Balance): { y: Yongsin | null; votes: number | null } {
  if (p[3]) return { y: yongsin(p, b), votes: null };
  const uh = unknownHour(p);
  const el = uh.용신오행.값;
  if (!el || uh.용신오행.표 < UNKNOWN_HOUR_MIN) return { y: null, votes: uh.용신오행.표 };
  for (let i = 0; i < 12; i++) {
    const q: Pillars = [p[0], p[1], p[2], hourPillar(p[2][0]!, i)];
    const yq = yongsin(q, balance(q));
    if (yq.용신오행 === el) return { y: yq, votes: uh.용신오행.표 };
  }
  return { y: null, votes: uh.용신오행.표 };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

function partOf(dayStem: string, ch: string, isStem: boolean, l: Luck | null): CoreLuckPart {
  const stem = isStem ? ch : MAIN_STEM[ch]!;
  const tenGod = getTenGod(dayStem as StemHanja, stem as StemHanja);
  const lp = l ? (isStem ? l.천간 : l.지지) : null;
  return { char: ch, tenGod, family: FAMILY_OF[tenGod], label: lp ? lp.라벨 : null, score: lp ? lp.점수 : 0 };
}

/** 두 지지가 합인가 — 육합이면 그대로, 삼합 짝이면 그 오행이 용·희일 때. v4.2: 표시용 플래그일 뿐 점수에는 넣지 않는다 */
function unionOf(a: string, b: string, y: Yongsin | null): "육합" | "삼합" | undefined {
  if (YUKHAP[a] === b) return "육합";
  const s = SAMHAP.find((g) => g.글자.includes(a) && g.글자.includes(b) && a !== b);
  if (s && y && "용희".includes(y.오행역할[s.오행])) return "삼합";
  return undefined;
}

export function computeCoreFortune(input: CoreInput): CoreFortune {
  const p = toCorePillars(input.pillars);
  const dayStem = p[2][0]!;
  const g = input.todayHanja;
  const b = balance(p);
  const caveats: string[] = [];
  const facts: string[] = [];

  // ---- 용신 (시간 모름 처리) ----
  const { y, votes } = resolveYongsin(p, b);
  const yRel = y ?? yongsin(p, b); // 충·합 방향 계산용. y가 없으면 방향은 쓰지 않는다
  const hourUnknown = !p[3];
  if (hourUnknown) {
    caveats.push(y ? `시간 모름 (12개 시주 중 ${votes}개에서 같은 판정이라 그대로 계산)` : `시간 모름 (12개 시주 중 ${votes ?? 0}개만 같아 유불리 축을 뺌)`);
  }

  // ---- 원국 관계 ----
  const rel = relations(p, b, yRel);

  // ---- 일진 판정 ----
  const l = y ? luck(p, g, b, y) : null;
  const stem = partOf(dayStem, g[0]!, true, l);
  const branch = partOf(dayStem, g[1]!, false, l);
  const raw = l ? l.합계 : 0;
  // v4.2: 코어 Y-12 보조 용신 — 비겁 중심 신강(또는 인비 혼합)에서 관성 운은 라벨 "한"인 채 점수만 희신급. 플래그 "(Y-12)"로 안다
  const assisted = !!l && l.플래그.some((f) => f.includes("(Y-12)"));
  const boosted = (part: CoreLuckPart): boolean => assisted && part.label === "한" && part.family === "관성";
  /** 문장용 라벨 — 코어가 희신급으로 올린 한신은 희신 말로 (코어 규칙 우선) */
  const wordLabel = (part: CoreLuckPart): Exclude<RoleLabel, null> | null => (boosted(part) ? "희" : part.label);
  // v4.1 ①: 천간·지지가 모두 한신이면 코어 Y-09("0 = 보통, 십신 방향성만")에 맞춰 판정은 "보통". 점수(한 +0.5)는 그대로 둔다
  //         v4.2: 코어가 올린(Y-12) 한신은 제외 — 그때는 코어 판정 그대로
  const bothNeutral = stem.label === "한" && branch.label === "한" && !boosted(stem) && !boosted(branch);
  const total: Verdict5 = !l ? "보통" : bothNeutral ? "보통" : l.판정;
  const method: CoreFortune["dayLuck"]["method"] = l ? l.방식 : "용신 없음";

  // ---- 일진 ↔ 원국 충·합 ----
  const lr = luckRelations(p, g, b, yRel, rel);
  const hits: CoreRelationHit[] = [];
  for (const c of lr.충) {
    const pos = POS[["연지", "월지", "일지", "시지"].indexOf(c.자리)] ?? "일";
    const direction: CoreRelationHit["direction"] = !y ? "중립" : c.방향 === "유리" ? "유리" : c.방향 === "불리" ? "불리" : "중립";
    hits.push({ pos, kind: "충", direction, strength: c.강도, chars: c.상대 });
  }
  const natalBranches = p.map((x, i) => (x ? { pos: POS[i]!, ch: x[1]! } : null)).filter((x): x is { pos: CoreRelationHit["pos"]; ch: string } => !!x);
  // v4.2: 합은 점수 없이 표시만 (코어 00_읽는법 원칙 4 · 삼합 S-05·S-08). direction은 항상 "중립", strength는 단계 표시용
  // v4.3: 어댑터 "용신 손상 … 합으로 묶음" 판정은 없다 — 합은 hits에만 남고 flags·facts에 합 문장은 0개
  for (const h of lr.합) {
    if (h.단계 === "불성립") continue;
    const strength = h.단계 === "강" ? 2 : h.단계 === "중" ? 1 : 0.5;
    const natal = natalBranches.find((nb) => nb.ch !== g[1] && h.글자.includes(nb.ch)) ?? natalBranches.find((nb) => h.글자.includes(nb.ch));
    hits.push({ pos: natal?.pos ?? "일", kind: h.종류 as CoreRelationHit["kind"], direction: "중립", strength, chars: h.글자 });
  }
  for (const nb of natalBranches) if (nb.ch === g[1]) hits.push({ pos: nb.pos, kind: "복음", direction: "중립", strength: 0, chars: nb.ch });
  let relScore = 0;
  for (const h of hits) {
    if (h.kind !== "충") continue; // 합·복음은 0
    // 용신 없음: 방향은 말하지 않되 충은 조금 뺀다
    relScore += !y ? -COEF.relNoYongsin * h.strength : h.direction === "유리" ? COEF.rel * h.strength : h.direction === "불리" ? -COEF.rel * h.strength : 0;
  }
  relScore = clamp(relScore, -COEF.relMax, COEF.relMax);
  const flags = [...(l?.플래그 ?? []), ...lr.플래그];

  // ---- 맥락: 대운·세운·월운 ----
  const seun = seunOf(input.date);
  if (seun.입춘전) caveats.push("입춘 전이라 세운은 전년 글자로 봄");
  const ctxLucks = new Map<string, Luck>();
  const ctxItem = (gj: string): CoreLuckContextItem => {
    const lk = y ? luck(p, gj, b, y) : null;
    if (lk) ctxLucks.set(gj, lk);
    const clash = luckClash(gj, g);
    const union = unionOf(gj[1]!, g[1]!, y);
    return {
      간지: gj,
      판정: lk ? lk.판정 : null,
      ...(lk ? { 합계: lk.합계, 플래그: lk.플래그 } : {}),
      ...(clash.충 ? { clash: { 강도: clash.강도, 최고경보: clash.최고경보 } } : {}),
      ...(union ? { union } : {}),
    };
  };
  let daeun: CoreFortune["context"]["daeun"];
  /** v4.4 (c): 오늘이 현재 대운의 시작일(교체일)인가 */
  let daeunStartsToday = false;
  if (input.profile) {
    try {
      const birth = fromBirth(toBirthInput(input.profile));
      const same = birth.pillars.every((x, i) => x === p[i] || (i === 3 && !p[3]));
      if (!same) console.warn("[fortune v4] 원국 불일치: 일기 앱", p.join(" "), "/ 코어", birth.pillars.join(" "), "→ 일기 앱 스냅샷을 믿음");
      const lc = currentLuckContext(birth, input.date);
      if (lc.현재대운) {
        daeun = { 순서: lc.현재대운.순서, ...ctxItem(lc.현재대운.간지) };
        const cur = birth.대운.목록.find((d) => d.순서 === lc.현재대운!.순서);
        daeunStartsToday = !!cur?.시작일 && cur.시작일.slice(0, 10) === input.date;
      }
    } catch (e) {
      console.warn("[fortune v4] 대운 계산 실패, 대운 없이 진행:", e instanceof Error ? e.message : e);
    }
  }
  const seunItem = { 해: seun.해, ...ctxItem(seun.간지) };
  const wol = monthGanjiList(input.date, 1)[0];
  const wolun = wol ? ctxItem(wol.간지) : undefined;
  let ctxScore = 0;
  if (daeun?.clash) ctxScore += daeun.clash.최고경보 ? COEF.daeunClashAlert : COEF.daeunClash;
  if (seunItem.clash) ctxScore += COEF.seunClash;
  if (wolun?.clash) ctxScore += COEF.wolunClash;
  // v4.2: 운 지지 ↔ 오늘 지지의 합(union)은 점수에 넣지 않는다 (합은 플래그만)
  // v4.1 ③: 대운·세운 자체 판정을 소폭 반영 (월운은 0)
  ctxScore += (daeun?.합계 ?? 0) * COEF.daeunVerdict + (seunItem.합계 ?? 0) * COEF.seunVerdict;

  // ---- 점수 ----
  const score01 = clamp(0.5 + (raw + relScore + ctxScore) / COEF.scale, COEF.min, COEF.max);

  // ---- 영역 (숫자 없음, 신호만) — v4.2: 오늘(일운 ≤2) → 이달(월운 1) → 올해(세운 1), 전부 코어 luckAreas ----
  const gender = input.profile?.gender;
  /** 한 운(luck)의 luckAreas 신호를 영역별로 합산해 |합|이 큰 순으로 max개. 한신은 0으로 들어가 "→" (v4.1 ②), 코어가 올린(Y-12) 한신 관성은 점수 그대로 */
  const areasOf = (lk: Luck, unit: "일운" | "월운" | "세운", period: AreaPeriod, max: number): CoreFortune["areas"] => {
    const assistedHere = lk.플래그.some((f) => f.includes("(Y-12)"));
    const acc = new Map<AreaName, { sum: number; mixed: boolean; whys: string[] }>();
    for (const row of luckAreas(lk, unit).신호) {
      const part = row.글자 === lk.천간.글자 ? lk.천간 : lk.지지;
      if (part.점수 === 0) continue;
      const boostedHere = assistedHere && part.라벨 === "한" && part.그룹 === "관성";
      const eff = part.라벨 === "한" && !boostedHere ? 0 : part.점수;
      const theme = TEN_GOD_THEME[row.십신 as TenGod];
      const why = `'${theme}'(${row.십신}) 글자가 ${LABEL_SHORT[boostedHere ? "희" : part.라벨]}`;
      for (const name of row.영역) {
        let area: AreaName | null = null;
        if (name === "연애(남·전통)") area = gender === "male" ? "연애" : null;
        else if (name === "연애(여·전통)") area = gender === "female" ? "연애" : null;
        else area = name as AreaName;
        if (!area) continue;
        const cur = acc.get(area) ?? { sum: 0, mixed: false, whys: [] };
        if (cur.sum !== 0 && eff !== 0 && Math.sign(cur.sum) !== Math.sign(eff)) cur.mixed = true;
        cur.sum += eff;
        cur.whys.push(why);
        acc.set(area, cur);
      }
    }
    const out: CoreFortune["areas"] = [];
    for (const [area, v] of [...acc.entries()].sort((a, c) => Math.abs(c[1].sum) - Math.abs(a[1].sum))) {
      const signal: AreaSignal = v.sum >= 1 ? "↑" : v.sum <= -1 ? "↓" : "→";
      out.push({ period, area, signal, why: v.mixed && signal === "→" ? "두 글자가 서로 다른 쪽으로 당겨 비슷해요" : v.whys[0]! });
      if (out.length === max) break;
    }
    return out;
  };
  const areas: CoreFortune["areas"] = [];
  if (l) {
    areas.push(...areasOf(l, "일운", "오늘", 2));
    const wl = wol ? ctxLucks.get(wol.간지) : undefined;
    if (wl) areas.push(...areasOf(wl, "월운", "이달", 1));
    const sl = ctxLucks.get(seun.간지);
    if (sl) areas.push(...areasOf(sl, "세운", "올해", 1));
  }
  const todayAreas = areas.filter((a) => a.period === "오늘");

  // ---- 키워드 ----
  const keywords = { positive: [] as string[], negative: [] as string[] };
  if (l) {
    for (const k of luckKeywords(l)) {
      for (const pick of k.고르기) {
        const words = (pick.낱말 ?? []).slice(0, pick.상한);
        const target = pick.칸.endsWith("운_긍정") ? keywords.positive : keywords.negative;
        for (const w of words) if (!target.includes(w)) target.push(w);
      }
    }
  }

  // ---- 사실 문장 (글 재료, 6~10개) ----
  const ko = (gj: string) => gj; // 간지는 한자 그대로 둔다. 한글로 바꾸는 건 3단계(글)의 일
  // v4.2: 첫 문장은 구조(윗글자·아랫글자·위아래) 없이 성격만. 같은 십신이면 "아주 강해요"(v4.3, 전엔 "두 번 겹쳐요"), 다르면 "함께 와요"
  const st = TEN_GOD_THEME[stem.tenGod], bt = TEN_GOD_THEME[branch.tenGod];
  if (stem.tenGod === branch.tenGod) facts.push(`오늘은 '${st}'(${stem.tenGod})의 성격이 아주 강해요.`);
  else facts.push(`오늘은 '${st}'(${stem.tenGod})${batchim(st) ? "과" : "와"} '${bt}'(${branch.tenGod})${batchim(bt) ? "이" : "가"} 함께 와요.`);
  // 라벨 문장은 같은 것이면 한 번만
  const labelFacts = new Set<string>();
  for (const part of [stem, branch]) { const wl = wordLabel(part); if (wl) labelFacts.add(`'${TEN_GOD_THEME[part.tenGod]}' 글자는 ${LABEL_WORD[wl]}.`); }
  facts.push(...labelFacts);
  if (l) facts.push(`둘을 합치면 오늘은 ${VERDICT_WORD[total]}이에요.`);
  else facts.push("태어난 시간을 몰라 오늘이 수월한지 힘든지는 단정하지 않고, 글자의 성격과 부딪힘만 봐요.");
  for (const h of hits) {
    // 전문용어(충·반합 등)는 relations.hits에 있으므로 문장에는 넣지 않는다. v4.2: 합 문장("짝이 돼요/한편이 돼요")은 없다 — 합은 아래 플래그 문장 두 종류만
    if (h.kind === "충") {
      const dir = h.direction === "불리" ? " 흔들리는 쪽이라 예정이 틀어지기 쉬워요." : h.direction === "유리" ? " 묵은 것이 풀리는 쪽이에요." : "";
      facts.push(`오늘 아랫글자 ${g[1]}는 내 ${POS_WORD[h.pos]} ${h.chars}와 부딪혀요.${dir}`);
    } else if (h.kind === "복음") {
      facts.push(`오늘 아랫글자 ${g[1]}는 내 ${POS_WORD[h.pos]}와 같은 글자예요.`);
    }
  }
  // 오늘 플래그 문장 (같은 문장은 한 번만). 맥락 문장보다 앞 — 10문장 상한에서 오늘 것이 먼저 남는다.
  // v4.3: 합 관련 플래그("… 합으로 묶음", "긴장이 풀리는 시기")는 문장을 만들지 않는다 — 큰 특징만 나열
  const flagFacts = new Set<string>();
  for (const f of flags) {
    if (f.startsWith("용신 손상") && !f.includes("묶음")) flagFacts.add("오늘 글자가 내 사주에 모자란 쪽 글자를 누르는 날이라 평소보다 힘이 들 수 있어요.");
    else if (f.startsWith("운 내부 상충")) flagFacts.add("오늘은 겉과 속이 달라 힘이 한곳에 모이지 않아요.");
    else if (f.startsWith("중화 사주")) flagFacts.add("내 사주는 치우침이 적어 운의 좋고 나쁨보다 하는 일의 성격이 더 크게 작용해요.");
  }
  facts.push(...flagFacts);

  // ---- 맥락 문장 (v4.4): 근거 표시용 contextFacts에는 항상, 글 재료 facts에는 바뀌는 날·충인 날에만 ----
  const contextFacts: string[] = [];
  const daeunFact = daeun
    ? `지금 10년 단위 운 ${ko(daeun.간지)}은 ${daeun.판정 ? VERDICT_WORD[daeun.판정] : "판정 보류"}${daeun.clash ? "이고, 오늘 글자와 부딪혀 변동이 겹치는 날이에요" : "이에요"}.`
    : null;
  const seunFact = `올해 운 ${ko(seunItem.간지)}은 ${seunItem.판정 ? VERDICT_WORD[seunItem.판정] : "판정 보류"}${seunItem.clash ? "이고, 오늘 글자와 부딪혀요" : "이에요"}.`;
  const wolunFact = wolun ? `이달 운 ${ko(wolun.간지)}은 ${wolun.판정 ? VERDICT_WORD[wolun.판정] : "판정 보류"}${wolun.clash ? "이고, 오늘 글자와 부딪혀요" : "이에요"}.` : null;
  if (daeunFact) {
    contextFacts.push(daeunFact);
    // 대운 플래그(용신 손상 · 운 내부 상충) 문장은 근거에만 (v4.1 ③ → v4.4)
    const df = daeun?.플래그 ?? [];
    if (df.some((f) => f.startsWith("용신 손상"))) contextFacts.push("지금 10년 단위 운이 내게 모자란 쪽을 누르고 있어요.");
    if (df.some((f) => f.startsWith("운 내부 상충"))) contextFacts.push("지금 10년 단위 운은 겉과 속이 달라요.");
  }
  contextFacts.push(seunFact);
  if (wolunFact) contextFacts.push(wolunFact);
  // (c) 대운 교체일 · (d) 대운 충
  if (daeunFact && (daeunStartsToday || daeun?.clash)) facts.push(daeunFact);
  // (b) 입춘일 · (d) 세운 충
  const ipchunToday = ipchunDate(Number(input.date.slice(0, 4))) === input.date;
  if (ipchunToday || seunItem.clash) facts.push(seunFact);
  // (a) 월운이 바뀐 날 = 절기 입절일(코어 monthGanjiList의 시작일, KST) · (d) 월운 충
  const wolunStartsToday = !!wol && wol.시작.slice(0, 10) === input.date;
  if (wolunFact && (wolunStartsToday || wolun?.clash)) facts.push(wolunFact);

  // v4.4: 맥락 문장이 빠져 채움 문장이 자주 쓰이므로 다른 facts처럼 "~요"로 끝낸다
  if (facts.length < 6 && keywords.positive.length) facts.push(`오늘 글자에는 '${keywords.positive.slice(0, 3).join(", ")}' 같은 말이 잘 붙어요.`);
  if (facts.length < 6 && keywords.negative.length) facts.push(`오늘 글자에서는 '${keywords.negative.slice(0, 3).join(", ")}' 같은 말을 조심해요.`);
  if (facts.length < 6) facts.push(`오늘은 ${AREA_WORD[todayAreas[0]?.area ?? "대인"]} 쪽에 신호가 ${todayAreas.length ? "있어요" : "뚜렷하지 않아요"}.`);
  facts.splice(10);

  return {
    dayLuck: { stem, branch, total, method, raw },
    relations: { hits, flags },
    context: { ...(daeun ? { daeun } : {}), seun: seunItem, ...(wolun ? { wolun } : {}), 입춘전: seun.입춘전 },
    areas,
    facts,
    contextFacts,
    keywords,
    caveats,
    parts: { raw: round2(raw), rel: round2(relScore), ctx: round2(ctxScore), score01: round2(score01) },
  };
}

/** 영역 신호 한 줄 라벨 ("사람 ↑") */
export const areaLabel = (a: { area: AreaName; signal: AreaSignal }): string => `${AREA_WORD[a.area]} ${a.signal}`;
export { AREA_WORD };
