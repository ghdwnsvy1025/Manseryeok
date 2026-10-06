// 원본: 사주 코어 core/src/areas.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/영역.md — 새 판정이 아니라 기존 판정을 영역별로 묶는 규칙 (E-00~E-11)
import {
  type Element, type Group, type Pillars, type Role, type TenGod, type Node,
  GROUPS, ELEMENTS, STEM_EL, HIDDEN, CTRL, GEN, nodesOf, adjacent, isDayStem, nodeName, tenGod, mainStem, groupMap,
} from "./base";
import { type Balance, type Yongsin, type Luck, type Amount, groupLetters } from "./yongsin";
import { rootGrade, isolatedCandidates, tzone, type RootGrade } from "./structure";
import type { Relations } from "./relations";
import type { Gyeok } from "./gyeokguk";

const COMBINE: Record<string, string> = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };
export type Options = { 성별?: "남" | "여"; 배우자성?: "전통" | "사용 안 함" };

export type StateCard = {
  그룹: Group; 오행: Element; 퍼센트: number; 양: Amount; 정편: TenGod[]; 글자: string[];
  자리: "T존" | "그 밖" | "지장간에만" | "없음"; 뿌리: RootGrade | null; 처지: string[]; 역할: Role | null;
  쓸수있음: boolean; 선명함: boolean;
};

/** E-00 십신 상태 카드 */
export function stateCards(p: Pillars, b: Balance, y: Yongsin | null): Record<Group, StateCard> {
  const N = nodesOf(p); const day = p[2][0]; const letters = groupLetters(p); const iso = isolatedCandidates(p);
  const inT = (n: Node) => (n.kind === "간" && (n.pos === 1 || n.pos === 3)) || (n.kind === "지" && n.pos === 2);
  const order: RootGrade[] = ["강", "중", "약", "무근"];
  return Object.fromEntries(GROUPS.map((g) => {
    const ls = letters[g]; const el = b.그룹오행[g];
    const hiddenOnly = !ls.length && p.some((q) => q && [...HIDDEN[q[1]]].some((h) => STEM_EL[h] === el));
    const stems = ls.filter((n) => n.kind === "간"); const roots = stems.map((n) => rootGrade(p, n.pos).등급).sort((a, c) => order.indexOf(a) - order.indexOf(c));
    const attacked = (n: Node) => N.some((m) => adjacent(n, m) && CTRL[m.el] === n.el), fed = (n: Node) => N.some((m) => adjacent(n, m) && GEN[m.el] === n.el);
    const 처지: string[] = [];
    if (ls.length && ls.every(attacked)) 처지.push("극당함"); else if (ls.some(attacked)) 처지.push("일부 극당함");
    if (ls.some(fed)) 처지.push("옆에서 생받음");
    if (stems.some((n) => N.some((m) => m.kind === "간" && adjacent(n, m) && COMBINE[n.ch] === m.ch))) 처지.push("합으로 묶임");
    if (ls.some((n) => iso.includes(n))) 처지.push("고립 후보");
    const 쓸수있음 = b.양[g] !== "없음" && !처지.includes("극당함") && !(ls.length > 0 && ls.every((n) => iso.includes(n)));
    const 선명함 = stems.some((n) => (n.pos === 1 || n.pos === 3) && ["강", "중"].includes(rootGrade(p, n.pos).등급));
    const card: StateCard = {
      그룹: g, 오행: el, 퍼센트: b.그룹퍼센트[g], 양: b.양[g], 정편: [...new Set(ls.map((n) => tenGod(day, n.kind === "간" ? n.ch : mainStem(n.ch)).god))], 글자: ls.map(nodeName),
      자리: ls.some(inT) ? "T존" : ls.length ? "그 밖" : hiddenOnly ? "지장간에만" : "없음", 뿌리: roots[0] ?? null, 처지, 역할: y ? y.역할[g] : null, 쓸수있음, 선명함,
    };
    return [g, card];
  })) as Record<Group, StateCard>;
}

const WORK: Record<TenGod, string> = {
  비견: "자기 영역·독립·몸을 쓰는 일", 겁재: "경쟁·승부·투기성", 식신: "연구·궁리·생산·돌봄", 상관: "말·표현·교섭·재능", 편재: "넓은 활동·사업·중개·공간 감각",
  정재: "꼼꼼한 관리·회계·안정 수입", 편관: "명령 체계·위기 대응·리더", 정관: "질서·행정·조직·학자형", 편인: "특수 기술·직관·활인·예술", 정인: "인문·가르침·공공성",
};
/** E-02 직업 합성: 십신마다 "조직(+) ↔ 독립(−)" 방향값과 일하는 방식. 값은 노트 입문 9~12강의 직업 TYPE에서 추린 [가설] */
const ORG: Record<TenGod, number> = { 정관: 2, 편관: 2, 정인: 1, 정재: 1, 식신: 0, 편재: -1, 편인: -1, 상관: -2, 비견: -2, 겁재: -2 };
const ORG_GROUP: Record<Group, number> = { 관성: 2, 인성: 1, 재성: 0, 식상: -1, 비겁: -2 };
const MODE: Record<TenGod, string> = { 비견: "몸을 쓰고 자기 영역을 지키는 방식", 겁재: "경쟁하고 승부를 거는 방식", 식신: "연구하고 만들어 내는 방식", 상관: "말하고 표현하고 교섭하는 방식", 편재: "넓게 움직이며 사업을 벌이는 방식",
  정재: "꼼꼼히 관리하고 숫자를 다루는 방식", 편관: "지휘하고 위기에 대응하는 방식", 정관: "질서와 절차를 세우는 방식", 편인: "특수한 기술과 직관을 쓰는 방식", 정인: "배우고 가르치고 문서를 다루는 방식" };
const FAMILY: [string, Group][] = [["어머니·윗사람·스승", "인성"], ["아버지", "재성"], ["형제·자매", "비겁"], ["아랫사람·부하", "식상"]];
const LUCK_AREA: Record<Group, string[]> = { 비겁: ["대인", "재물"], 식상: ["직업", "학업"], 재성: ["재물", "연애(남·전통)", "대인"], 관성: ["직업", "연애(여·전통)"], 인성: ["학업", "가족", "건강"] };

export function areas(p: Pillars, b: Balance, y: Yongsin | null, rel: Relations, g: Gyeok, opt: Options = {}) {
  const cards = stateCards(p, b, y); const N = nodesOf(p); const day = p[2][0]; const T = tzone(p); const 시주없음 = !p[3];
  const lettersOf = groupLetters(p); const near = (a: Node[], c: Node[]) => a.some((x) => c.some((z) => adjacent(x, z)));
  // 1. 직업 (E-01~E-03)
  const toolStems = T.항목.filter((t) => t.자리 !== "일지"); const ilji = T.항목.find((t) => t.자리 === "일지")!;
  const gw = cards["관성"]; const gwInPlace = lettersOf["관성"].some((n) => (n.kind === "간" && (n.pos === 1 || n.pos === 3)) || (n.kind === "지" && (n.pos === 1 || n.pos === 2)));
  const gwHitBySik = near(lettersOf["관성"], lettersOf["식상"]);
  // E-02 (2026-09-22 개정): 한 조건으로 단정하지 않고 재료마다 비중×방향을 합산. 어긋나는 재료는 '긴장'으로 따로 냄
  const env = b.양["관성"] === "없음" ? -2 : gw.쓸수있음 && gwInPlace && !gwHitBySik ? 2 : gwHitBySik ? -1 : 0;
  const parts: { 재료: string; 비중: number; 방향: number; 방식?: string }[] = [
    ...toolStems.map((t) => ({ 재료: `${t.자리} ${t.십신}`, 비중: t.자리 === "월간" ? 3 : 2, 방향: ORG[t.십신], 방식: MODE[t.십신] })),
    { 재료: `일지 ${ilji.십신}`, 비중: 2, 방향: ORG[ilji.십신], 방식: MODE[ilji.십신] },
    { 재료: `중심기운 ${b.중심기운}`, 비중: 2, 방향: ORG_GROUP[b.중심기운] },
    { 재료: `조직 환경 (관성 ${gw.양}${gwInPlace ? "·월지/T존" : ""}${gwHitBySik ? "·식상에게 눌림" : ""})`, 비중: 2, 방향: env },
  ];
  const 점수 = Math.round((parts.reduce((a, x) => a + x.비중 * x.방향, 0) / parts.reduce((a, x) => a + x.비중, 0)) * 100) / 100;
  const 조직독립 = 점수 >= 0.6 ? "조직형" : 점수 <= -0.6 ? "독립형" : "혼합형";
  const toolAvg = toolStems.length ? toolStems.reduce((a, t) => a + ORG[t.십신], 0) / toolStems.length : 0; const 긴장: string[] = [];
  if (toolAvg <= -1 && env > 0) 긴장.push("도구는 독립 성향인데 환경은 조직 쪽 → 조직에 속하되 자기 영역·재량이 큰 자리(전문가·계약·프로젝트 단위)가 맞음");
  if (toolAvg >= 1 && env < 0) 긴장.push("도구는 조직 성향인데 조직과의 인연(관성)이 약함 → 스스로 규율과 체계를 만들어 일하는 쪽");
  if (ORG[ilji.십신] * toolAvg < 0 && Math.abs(toolAvg) >= 1) 긴장.push("쓰는 도구와 일을 대하는 태도(일지)의 방향이 다름 → 겉으로 하는 일과 속으로 편한 방식이 다를 수 있음");
  for (const t of toolStems.filter((t) => t.극당함)) 긴장.push(`${t.자리} ${t.십신}은(는) ${(t.극한글자 ?? []).join("·") || "붙어 있는 글자"}에게 눌려 쓰려면 힘이 듦`);
  const 직업 = {
    주도구: toolStems.map((t) => ({ 자리: t.자리, 십신: t.십신, 통근: t.통근, 일의성격: WORK[t.십신] })),
    일지: { 십신: ilji.십신, 일의성격: WORK[ilji.십신] }, 중심기운: b.중심기운, 격: g.격, 유형: 조직독립,
    합성: { 점수, 설명: "+2 조직 ↔ −2 독립. ±0.6 안쪽은 혼합형", 재료: parts, 일하는방식: [...new Set(parts.map((x) => x.방식).filter(Boolean))] as string[], 긴장 },
    근거: [`관성 ${gw.양}${gw.쓸수있음 ? "·쓸 수 있음" : ""}${gwInPlace ? "·T존/월지" : ""}${gwHitBySik ? "·식상과 인접" : ""}`, `비겁 ${b.양["비겁"]}, 식상 ${b.양["식상"]}`],
  };
  // 2. 재물 (E-04·E-05)
  const jae = cards["재성"]; const jl = lettersOf["재성"]; const 재물태그: string[] = [];
  if (jl.length) 재물태그.push(jae.자리 === "T존" ? "손 닿는 재성" : jl.every((n) => n.pos === 0) ? "먼 재성" : "재성이 T존 밖에 있음");
  if (near(jl, lettersOf["식상"])) 재물태그.push("버는 통로 있음");
  if (b.양["비겁"] === "강함" && b.양["재성"] === "약함" && near(jl, [...lettersOf["비겁"], N.find(isDayStem)!])) 재물태그.push("나눠 갖는 구조");
  if (b.양["재성"] === "없음") 재물태그.push("재물 욕구 자체가 낮은 편");
  else if (b.신강약 === "신약" && b.양["재성"] === "강함") 재물태그.push("기회는 많으나 감당이 과제");
  else if (b.신강약 === "신강" && y?.용신그룹 === "재성" && jae.쓸수있음) 재물태그.push("재성을 쓸 힘이 있음");
  else if (b.신강약 === "신강" && !jae.쓸수있음) 재물태그.push("힘은 있는데 쓸 곳이 막힘");
  const 정편 = jae.정편; const 재물성향 = 정편.includes("정재") && !정편.includes("편재") ? "가까운 곳에서 깊고 좁게 쌓는 형" : 정편.includes("편재") && !정편.includes("정재") ? "넓게 연결하며 굴리는 형" : 정편.length ? "두 성향이 섞임" : null;
  // 3. 연애 (E-06)
  const 연애태그: string[] = []; const iljiRole = y ? y.오행역할[nodesOf(p).find((n) => n.kind === "지" && n.pos === 2)!.el] : null;
  for (const c of rel.충) if (!c.풀림 && c.자리.includes("일지")) 연애태그.push(c.자리.includes("월지") ? "생활 기반이 흔들리는 구조" : c.자리.includes("시지") ? "가까운 관계의 거리 조절이 과제" : "일지가 충을 맞음");
  const dayCombos = [1, 3].filter((i) => p[i] && COMBINE[day] === p[i]![0]);
  if (dayCombos.length === 2) 연애태그.push("끌림이 분산 (쟁합)"); else if (dayCombos.length === 1) 연애태그.push("정재·정관에 강하게 끌리는 성향 (일간 합)");
  if (["丁亥", "戊子", "辛巳", "壬午"].includes(p[2])) 연애태그.push("드러내지 않는 애정 (간지암합)");
  if (b.양["비겁"] === "강함") 연애태그.push("배우자 인연이 늦거나 약한 편");
  연애태그.push(b.신강약 === "신약" ? "확신과 표현을 필요로 함" : b.신강약 === "신강" ? "주관이 강해 맞춰 주는 연습이 과제" : "관계 태도는 중간");
  const useSpouse = (opt.배우자성 ?? "전통") === "전통" && !!opt.성별;
  const 배우자성 = useSpouse ? cards[opt.성별 === "남" ? "재성" : "관성"] : null;
  // 4. 건강·에너지 (E-07)
  const iso = isolatedCandidates(p);
  const pressed = iso[0]?.el ?? [...ELEMENTS].filter((e) => N.some((n) => n.el === e && N.some((m) => adjacent(n, m) && CTRL[m.el] === e))).sort((a, c) => b.판정용퍼센트[a] - b.판정용퍼센트[c])[0] ?? null;
  const 건강 = { 의료아님: true, 가장눌린오행: pressed, 과다오행: b.양[b.중심기운] === "강함" ? b.그룹오행[b.중심기운] : null,
    에너지: b.신강약 === "신약" ? "쉽게 방전, 회복이 우선" : b.신강약 === "신강" ? "과열, 발산이 필요" : "치우침 적음" };
  // 5. 대인 (E-08)
  const TYPE: Record<Group, string> = { 비겁: "주도형", 재성: "연결형", 관성: "눈치형", 식상: "표현형", 인성: "수용형" };
  const gi = y ? GROUPS.find((x) => y.역할[x] === "기")! : null;
  const 대인 = { 유형: TYPE[b.중심기운], 없는그룹: GROUPS.filter((x) => b.양[x] === "없음"), 한발떨어질관계: gi };
  // 6. 가족 (E-09)
  const fam = [...FAMILY]; if (useSpouse) fam.push(["자식", opt.성별 === "남" ? "관성" : "식상"]);
  const 가족 = fam.map(([대상, grp]) => ({ 대상, 그룹: grp, 양: cards[grp].양, 쓸수있음: cards[grp].쓸수있음, 역할: cards[grp].역할,
    두터움: rel.합.some((h) => h.십신그룹 === grp && ["삼합", "방합"].includes(h.종류)), 메모: grp === "인성" && b.양["인성"] === "강함" ? "윗사람의 영향이 큼, 자립이 과제" : null }));
  // 7. 학업 (E-10)
  const tg = new Set(T.항목.map((t) => t.그룹));
  const 학업 = tg.has("관성") && tg.has("인성") ? "제도권 학습에 강함" : b.양["식상"] === "강함" && b.양["인성"] !== "강함" ? "혼자 파고드는 학습" : b.양["인성"] === "강함" && b.양["식상"] !== "강함" ? "생각은 깊으나 실행이 과제" : null;
  return { 상태카드: cards, 직업, 재물: { 카드: jae, 태그: 재물태그, 성향: 재물성향 }, 연애: { 일지: { 십신: ilji.십신, 역할: iljiRole }, 태그: 연애태그, 배우자성 },
    건강, 대인, 가족, 학업, 시주없음 };
}

/** E-11 운 글자의 십신 → 건드리는 영역. 월·일운은 확신도 항상 "낮음" */
export function luckAreas(l: Luck, unit: "대운" | "세운" | "월운" | "일운" = "대운") {
  const rows = [l.천간, l.지지].map((x) => ({ 글자: x.글자, 십신: x.십신, 영역: LUCK_AREA[x.그룹], 판정: x.판정 }));
  return { 신호: rows, 확신도: unit === "월운" || unit === "일운" ? "낮음" : l.확신도 };
}
export { groupMap };
