// 모델 없이 만드는 운세 문장. 1~7일차 즉시 표시와 모델 실패 시 대체용.
// 규칙: 어미 "~어요", 구조 전문용어 없음, 금지어(흐름·두근·"결을/결이") 없음, 사건 단정 없음.
// v4.13 (글품질 검수 2026-10-15 §10·§11-6): 템플릿도 라벨(용·희/한/구·기)을 본다 — '구'·'기'인 날은 headline·lead·do·dont를 뒤집고(BY_TEN_GOD_REVERSED),
//   이달 한 줄·오늘 기운 이름·맞는지 한 문장을 넣으며, 같은 영역 줄이 두 번 나오면 둘째 변형을 쓴다. 기운 이름 재료(namesFromCore)는 brief도 같이 쓴다.
import { BRANCH_META, ELEMENT_EN_TO_KO, STEM_META, type TenGod } from "@saju/engine";
import { GROUP_POWER, TEN_GOD_THEME, VERDICT_WORD } from "./base";
import type { AreaName, AreaPeriod, AreaSignal, BaseFortune, CoreFortune, PersonalAdjustment, RoleLabel } from "./types";

/** 사용자 문장에 쓰면 안 되는 말. 테스트가 전 조합을 검사한다. v4.4: "특별한·남다른·다른 날과 달리·차별"(날마다 다르다고 우기는 말) 추가.
 *  v4.13: "기운"·"용신"을 풀었다 — 기운 이름을 한 번 대고 맞는지 말하는 글이 되면서(00_공통기준 "용어 한 번 + 뜻 한 줄") 금지할 이유가 없어졌다 */
export const BANNED = ["흐름", "두근", "결을", "결이 ", "결로", "기신", "십신", "일간", "일지", "특별한", "남다른", "다른 날과 달리", "차별"];

/** v4.13: 글·템플릿이 이름을 대기 위한 재료. 엔진 결과(core)에서만 만든다 — 한자는 여기서 한글로 */
export interface FortuneNames {
  /** 오늘 천간·지지의 십신 ("편관·식신"). 같은 십신이면 하나만 ("편관") */
  tenGods: string;
  tenGodList: [TenGod, TenGod];
  /** 오늘 글자의 오행 ("임=수, 술=토") */
  elements: string;
  /** 오늘 기운이 나에게: 맞는 편 · 보통 · 안 맞는 편 · 판단 보류(용신 없음) */
  fit: "맞는 편" | "보통" | "안 맞는 편" | "판단 보류";
  /** 내게 필요한 기운. 용신이 없으면 null */
  need: { el: string; group: string; power: string; label: string } | null;
  /** 이달 운 한 줄(매일). 월운이 없으면 null */
  month: { ganji: string; elements: string; verdict: string; line: string } | null;
}
const ganjiKo = (gj: string): string => [...gj].map((ch) => STEM_META[ch]?.ko ?? BRANCH_META[ch]?.ko ?? ch).join("");
const elOf = (ch: string): string => { const m = STEM_META[ch] ?? BRANCH_META[ch]; return m ? ELEMENT_EN_TO_KO[m.element] : "?"; };
const elementsOf = (gj: string): string => [...gj].map((ch) => `${ganjiKo(ch)}=${elOf(ch)}`).join(", ");
export function namesFromCore(core: Pick<CoreFortune, "dayLuck" | "context"> & { need?: CoreFortune["need"] }): FortuneNames {
  const { stem, branch, total, method } = core.dayLuck;
  const tenGodList: [TenGod, TenGod] = [stem.tenGod, branch.tenGod];
  const fit: FortuneNames["fit"] = method === "용신 없음" ? "판단 보류" : total === "매우 유리" || total === "유리" ? "맞는 편" : total === "보통" ? "보통" : "안 맞는 편";
  const need = core.need ? { el: core.need.오행, group: core.need.그룹, power: GROUP_POWER[core.need.그룹], label: `${core.need.오행}(${core.need.그룹}) · ${GROUP_POWER[core.need.그룹]}` } : null;
  const w = core.context.wolun;
  const month = w
    ? (() => {
        const ganji = `${ganjiKo(w.간지)}월`;
        const verdict = w.판정 ? VERDICT_WORD[w.판정] : null;
        const line = verdict ? `이달 ${ganji}은 ${verdict}${w.clash ? "이고, 오늘과 어긋나 변동이 생기기 쉬워요" : "이에요"}.` : `이달 ${ganji}은 수월한지 힘든지 단정하지 않아요.`;
        return { ganji, elements: elementsOf(w.간지), verdict: verdict ?? "판정 보류", line };
      })()
    : null;
  return { tenGods: stem.tenGod === branch.tenGod ? stem.tenGod : `${stem.tenGod}·${branch.tenGod}`, tenGodList, elements: elementsOf(stem.char + branch.char), fit, need, month };
}

const BY_TEN_GOD: Record<TenGod, { headline: string; lead: string; do: string; dont: string }> = {
  비견: {
    headline: "내 속도대로 가는 날이에요",
    lead: "오늘은 남보다 내 순서가 먼저인 날이에요.",
    do: "내 할 일을 내 순서로 처리해요.",
    dont: "남 일에 끌려다니지 않아요.",
  },
  겁재: {
    headline: "속도는 나는데 욕심이 붙는 날이에요",
    lead: "밀어붙이는 힘은 있는데 한꺼번에 여러 개를 잡고 싶어져요.",
    do: "하나만 골라 끝까지 밀어붙여요.",
    dont: "돈과 시간을 한 번에 걸지 않아요.",
  },
  식신: {
    headline: "표현이 잘 풀리는 날이에요",
    lead: "말이든 글이든 꺼내 놓으면 평소보다 자연스럽게 나가요.",
    do: "미뤄 둔 말이나 글을 꺼내요.",
    dont: "먹고 쉬는 시간을 거르지 않아요.",
  },
  상관: {
    headline: "말이 세지기 쉬운 날이에요",
    lead: "눈에 거슬리는 게 잘 보이고 지적하고 싶어져요.",
    do: "할 말은 짧게, 결론부터 해요.",
    dont: "회의나 메시지에서 톤을 올리지 않아요.",
  },
  편재: {
    headline: "기회가 눈에 들어오는 날이에요",
    lead: "새 제안이나 사고 싶은 게 눈에 자꾸 들어와요.",
    do: "들어온 제안은 적어 두고 하루 묵혀요.",
    dont: "충동 지출을 하지 않아요.",
  },
  정재: {
    headline: "차곡차곡 쌓이는 날이에요",
    lead: "크게 벌이기보다 하던 일을 마무리할 때 성과가 나요.",
    do: "작은 일을 끝까지 마무리해요.",
    dont: "큰 변화를 새로 벌이지 않아요.",
  },
  편관: {
    headline: "책임이 무겁게 느껴지는 날이에요",
    lead: "해야 할 일이 압박으로 다가오기 쉬워요.",
    do: "해야 할 일 하나에 기준을 세워요.",
    dont: "무리한 약속을 새로 하지 않아요.",
  },
  정관: {
    headline: "약속과 역할이 중요한 날이에요",
    lead: "정해진 틀 안에서 움직일 때 일이 순해요.",
    do: "정해진 시간과 절차를 지켜요.",
    dont: "체면 때문에 억지로 떠맡지 않아요.",
  },
  편인: {
    headline: "혼자 생각할 때 답이 나오는 날이에요",
    lead: "사람 속보다 혼자 있는 시간에 머리가 맑아져요.",
    do: "30분이라도 혼자 있는 시간을 만들어요.",
    dont: "남의 평가에 하루를 걸지 않아요.",
  },
  정인: {
    headline: "배우고 쉬어도 되는 날이에요",
    lead: "새로 배우거나 기초를 다지는 일이 잘 붙어요.",
    do: "읽거나 배우는 일에 시간을 써요.",
    dont: "쉬는 걸 미루지 않아요.",
  },
};

/** v4.13: 그 기운이 지금 나와 맞지 않는 날('구'·'기')의 headline·lead·do·dont — BY_TEN_GOD는 "그 성격대로 가라"는 말이라 엔진과 반대 조언이 됐다(검수 §10 B 10-17 "혼자 있는 시간을 만들어요") */
const BY_TEN_GOD_REVERSED: Record<TenGod, { headline: string; lead: string; do: string; dont: string }> = {
  비견: { headline: "내 속도만 고집하기 쉬운 날이에요", lead: "내 순서가 먼저라는 마음이 커져서 남 말이 잘 안 들려요.", do: "정하기 전에 가까운 사람에게 한마디 물어봐요.", dont: "남의 순서를 제치고 내 것부터 밀지 않아요." },
  겁재: { headline: "욕심이 앞서 흩어지기 쉬운 날이에요", lead: "한꺼번에 여러 개를 잡고 싶은 마음이 평소보다 커져요.", do: "오늘 쓸 돈과 시간은 아침에 정한 만큼만 써요.", dont: "새 일을 또 벌이지 않아요." },
  식신: { headline: "말이 길어지고 늘어지기 쉬운 날이에요", lead: "말이든 먹는 것이든 멈출 때를 놓치기 쉬워요.", do: "할 말은 세 줄 안에서 끝내요.", dont: "먹고 쉬는 데 하루를 다 쓰지 않아요." },
  상관: { headline: "지적이 세게 나가기 쉬운 날이에요", lead: "눈에 거슬리는 게 더 잘 보이고 그냥 넘기기 어려워요.", do: "거슬리는 말은 하루 묵혀 두고 내일 다시 봐요.", dont: "상대 말에 바로 토를 달지 않아요." },
  편재: { headline: "눈에 띄는 것마다 손이 가는 날이에요", lead: "사고 싶은 것과 새 제안이 자꾸 눈에 들어오는데 오늘은 고르는 눈이 무뎌요.", do: "장바구니만 채우고 결제는 내일로 미뤄요.", dont: "새 제안에 그 자리에서 답하지 않아요." },
  정재: { headline: "작은 것에 매여 느려지기 쉬운 날이에요", lead: "하나하나 챙기려다 작은 것에 오래 머물기 쉬워요.", do: "오늘 꼭 끝낼 하나만 정하고 나머지는 접어요.", dont: "사소한 계산에 오래 붙들리지 않아요." },
  편관: { headline: "압박이 실제보다 크게 느껴지는 날이에요", lead: "해야 할 일이 실제보다 크게 다가와 숨이 짧아져요.", do: "해야 할 일을 적어 두고 하나씩 지워요.", dont: "남이 미는 속도에 억지로 맞추지 않아요." },
  정관: { headline: "틀에 맞추느라 지치기 쉬운 날이에요", lead: "정해진 틀을 지키려다 몸이 먼저 지쳐요.", do: "정해진 일 하나만 지키고 나머지는 느슨하게 둬요.", dont: "체면 때문에 새 약속을 떠맡지 않아요." },
  편인: { headline: "혼자 생각이 길어지기 쉬운 날이에요", lead: "혼자 생각이 길어져서 결론이 자꾸 미뤄져요.", do: "혼자 끙끙대기보다 한마디 묻고 넘어가요.", dont: "혼자 결론 내고 밀어붙이지 않아요." },
  정인: { headline: "배우고 쉬는 데만 머물기 쉬운 날이에요", lead: "배우고 쉬고 싶은 마음은 큰데 손에 잡히는 건 적어요.", do: "읽은 것 중 하나만 오늘 바로 써 봐요.", dont: "쉬어야 한다는 핑계로 할 일을 미루지 않아요." },
};

// v4.1: 템플릿도 검사기의 구조 서술 검사("글자·부딪히·한편이…")를 지킨다
const RELATION_LINE = {
  육합: "내 사주와 잘 맞물리는 날이라 사람 일이 순한 편이에요.",
  삼합: "내 사주와 힘을 합치는 날이라 도움을 받기 쉬워요.",
  충: "내 사주와 어긋나는 날이라 예정이 틀어지거나 마음이 들썩일 수 있어요.",
  복음: "내 사주와 같은 성격이 아주 세지는 날이라 익숙한 하루가 돼요.",
} as const;

/** v4.13: 라벨별 "맞는지 한 문장". 용·희는 내게 필요한 기운의 이름을 댄다(이름이 없으면 "힘"). 검사기의 추상어 금칙("모자란 쪽·채워 주는 힘")을 지킨다 */
export function fitLine(role: Exclude<RoleLabel, null | "한">, need: FortuneNames["need"]): string {
  const what = need ? `${need.el}(${need.power})` : "힘";
  switch (role) {
    case "용": return `내게 모자란 ${what}을 채우는 날이라 오늘은 잘 맞는 날이에요.`;
    case "희": return `내게 모자란 ${what}을 옆에서 거드는 날이라 오늘은 맞는 편이에요.`;
    case "구": return "지금 나와 맞지 않는 쪽이라 오래 붙들면 지쳐요.";
    case "기": return "내게 이미 넉넉한 쪽이 더해지는 날이라 과해지기 쉬워요.";
  }
}

/** 마지막 글자에 받침이 있는가 (조사 고르기: 경이나/무나, 신이/자가) */
export const batchim = (s: string): boolean => {
  const k = s.charCodeAt(s.length - 1) - 0xac00;
  return k >= 0 && k < 11172 && k % 28 !== 0;
};

export function personalLine(p: PersonalAdjustment, todayKo: string, stemKo: string, branchKo: string): string | null {
  if (p.sameGanjiCount > 0 && p.sameGanjiMean !== null) {
    return `${todayKo}일에 ${p.sameGanjiCount}번 기록했고 평균 행복도는 ${p.sameGanjiMean.toFixed(1)}이었어요.`;
  }
  if (p.n > 0 && p.mean !== null) {
    return `${stemKo}${batchim(stemKo) ? "이나" : "나"} ${branchKo}${batchim(branchKo) ? "이" : "가"} 든 날에 ${p.n}번 기록했고 평균 행복도는 ${p.mean.toFixed(1)}이었어요.`;
  }
  return null;
}

export interface TemplateText {
  headline: string;
  body: string;
  do: string;
  dont: string;
  /** v4 영역 줄 (신호 있는 영역만). v4.2: period는 데이터로만 — line에 "이달엔/올해는" 접두를 붙이지 않는다 */
  areas?: { period: AreaPeriod; area: AreaName; signal: AreaSignal; line: string }[];
}

/** 영역 × 신호 템플릿 줄. 아이콘 없이 글자 화살표만 (디자인 명세 02). 기간(오늘·이달·올해)은 문장에 넣지 않는다 — period 데이터가 말한다.
 *  v4.13: 둘째 변형 — 오늘 줄과 이달 줄이 같은 영역·같은 신호면(검수 §10 "하던 일을 마무리하기 좋아요" 두 번) 둘째 것을 쓴다 */
const AREA_LINE: Record<AreaName, Record<AreaSignal, [string, string]>> = {
  대인: { "↑": ["사람 일이 순한 편이라 먼저 연락해도 좋아요.", "오래 미룬 안부를 묻기에 맞는 때예요."], "→": ["사람 일은 평소와 비슷해요.", "사람 일은 늘 하던 만큼이면 돼요."], "↓": ["사람 사이 말이 엇갈리기 쉬워 짧게 말해요.", "사람 사이 오해가 생기기 쉬워 답은 짧게 해요."] },
  재물: { "↑": ["돈 쓰는 일은 계획대로 가요.", "미뤄 둔 돈 정리를 하기 좋아요."], "→": ["돈 일은 평소와 비슷해요.", "돈은 들어온 만큼만 써요."], "↓": ["지출을 하루 미뤄도 손해가 없어요.", "사고 싶은 것은 적어만 두고 결제는 미뤄요."] },
  직업: { "↑": ["하던 일을 마무리하기 좋아요.", "손에 든 일에 힘이 실려요."], "→": ["일은 평소 속도로 가요.", "일은 하던 순서대로 가면 돼요."], "↓": ["일에서 새로 벌이지 않고 정리만 해요.", "일은 맡은 것만 지키고 새로 맡지 않아요."] },
  학업: { "↑": ["읽고 배우는 일이 잘 붙어요.", "새로 배우는 내용이 머리에 잘 남아요."], "→": ["배우는 일은 평소와 비슷해요.", "배우는 건 하던 만큼이면 돼요."], "↓": ["새 내용보다 복습이 맞아요.", "새 책을 펴기보다 본 것을 다시 봐요."] },
  연애: { "↑": ["가까운 사람에게 마음을 보이기 좋아요.", "가까운 사람과 짧은 약속을 잡기 좋아요."], "→": ["관계는 평소와 비슷해요.", "관계는 하던 대로 가면 돼요."], "↓": ["가까운 사람과는 말을 아껴요.", "가까운 사람 말을 끝까지 듣고 답해요."] },
  가족: { "↑": ["집안 일을 챙기기 좋아요.", "가족에게 먼저 연락하기 좋아요."], "→": ["가족 일은 평소와 비슷해요.", "가족 일은 하던 만큼이면 돼요."], "↓": ["가족 사이 사소한 말에 걸리기 쉬워요.", "집에서 같은 말을 되풀이하지 않아요."] },
  건강: { "↑": ["몸이 가벼운 편이에요.", "몸을 움직이기 좋은 때예요."], "→": ["몸 상태는 평소와 비슷해요.", "몸은 평소대로 돌보면 돼요."], "↓": ["일찍 쉬는 게 남는 날이에요.", "무리한 일정은 하나 빼요."] },
};

/** 템플릿이 쓰는 재료. v3 BaseFortune도 그대로 들어간다 */
export type TemplateInput = Pick<BaseFortune, "tenGod" | "relation" | "yongsin"> & {
  areas?: { period?: AreaPeriod; area: AreaName; signal: AreaSignal }[];
  /** 맞춤도 옆 안내 (예: 시간 모름) */
  fitNote?: string;
  /** v4.13: 오늘의 라벨(합계 방향 쪽). 구·기면 headline·lead·do·dont를 뒤집는다. 없으면 yongsin(v3)으로 짐작 */
  role?: Exclude<RoleLabel, "한">;
  /** v4.13: 이달 한 줄·오늘 기운 이름·내게 필요한 기운. v3 경로엔 없다 */
  names?: FortuneNames;
};

/** v4.13: 오늘 기운 이름 한 문장 — 이름 한 번 + 뜻(괄호) */
function nameLine(names: FortuneNames): string {
  const [a, b] = names.tenGodList;
  return a === b ? `오늘은 ${a}(${TEN_GOD_THEME[a]})이 아주 센 날이에요.` : `오늘은 ${a}(${TEN_GOD_THEME[a]})과 ${b}(${TEN_GOD_THEME[b]})이 함께 오는 날이에요.`;
}

export function templateText(
  base: TemplateInput,
  personal: PersonalAdjustment,
  today: { ko: string; stemKo: string; branchKo: string },
): TemplateText {
  const role = base.role ?? (base.yongsin === "용신" ? "용" : base.yongsin === "기신" ? "기" : undefined);
  const reversed = role === "구" || role === "기";
  const t = (reversed ? BY_TEN_GOD_REVERSED : BY_TEN_GOD)[base.tenGod];
  const lines: string[] = [];
  if (base.names?.month) lines.push(base.names.month.line);
  if (base.names) lines.push(nameLine(base.names));
  lines.push(t.lead);
  if (role) lines.push(fitLine(role, base.names?.need ?? null));
  if (base.relation) lines.push(RELATION_LINE[base.relation]);
  const mine = personalLine(personal, today.ko, today.stemKo, today.branchKo);
  if (mine) lines.push(mine);
  if (base.fitNote) lines.push(base.fitNote);
  const seen = new Map<string, number>();
  const areas = (base.areas ?? []).map((a) => {
    const key = `${a.area}${a.signal}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return { period: a.period ?? "오늘", area: a.area, signal: a.signal, line: AREA_LINE[a.area][a.signal][Math.min(n, 1)]! };
  });
  return { headline: t.headline, body: lines.join(" "), do: t.do, dont: t.dont, ...(areas.length ? { areas } : {}) };
}

/** v4 core → 템플릿 재료. 관계는 태어난 날 글자(일지)와의 것만, 용신 표시는 합계 방향으로. v4.13: 라벨(role)과 이름 재료(names)도 */
export function templateInputFromCore(core: CoreFortune): TemplateInput {
  const dayHit = core.relations.hits.find((h) => h.pos === "일" && h.kind !== "복음") ?? core.relations.hits.find((h) => h.pos === "일");
  const relation: BaseFortune["relation"] = !dayHit ? null : dayHit.kind === "충" ? "충" : dayHit.kind === "육합" ? "육합" : dayHit.kind === "복음" ? "복음" : "삼합";
  const labels = [core.dayLuck.stem.label, core.dayLuck.branch.label];
  const has = (...ls: RoleLabel[]) => labels.find((x) => ls.includes(x)) as Exclude<RoleLabel, "한"> | undefined;
  // 합계가 +면 용·희 중 있는 것(용 우선), −면 기·구 중 있는 것(기 우선). 0이거나 라벨이 없으면 없음
  const role = core.dayLuck.raw > 0 ? (has("용") ?? has("희")) : core.dayLuck.raw < 0 ? (has("기") ?? has("구")) : undefined;
  const yongsin: BaseFortune["yongsin"] = role === "용" || role === "희" ? "용신" : role === "기" || role === "구" ? "기신" : null;
  const fitNote = core.caveats.some((c) => c.startsWith("시간 모름")) && (core.dayLuck.method === "용신 없음" || (core.dayLuck.agreement ?? 1) < 1) ? "태어난 시간을 모르면 운세의 폭이 넓어져요." : undefined;
  return { tenGod: core.dayLuck.stem.tenGod, relation, yongsin, areas: core.areas, names: namesFromCore(core), ...(role ? { role } : {}), ...(fitNote ? { fitNote } : {}) };
}

export function findBanned(text: string): string[] {
  return BANNED.filter((w) => text.includes(w));
}
