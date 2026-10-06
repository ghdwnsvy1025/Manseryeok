// 모델 없이 만드는 운세 문장. 1~7일차 즉시 표시와 모델 실패 시 대체용.
// 규칙: 어미 "~어요", 전문용어 없음, 금지어(기운·흐름·두근·"결을/결이") 없음, 사건 단정 없음.
import type { TenGod } from "@saju/engine";
import type { AreaName, AreaSignal, BaseFortune, CoreFortune, PersonalAdjustment } from "./types";

/** 사용자 문장에 쓰면 안 되는 말. 테스트가 전 조합을 검사한다 */
export const BANNED = ["기운", "흐름", "두근", "결을", "결이 ", "결로", "용신", "기신", "십신", "일간", "일지"];

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

const RELATION_LINE = {
  육합: "내 사주와 잘 맞물리는 글자가 들어와서 사람 일이 순한 편이에요.",
  삼합: "내 사주와 한편이 되는 글자라 도움을 받기 쉬워요.",
  충: "내 사주와 부딪히는 글자라 예정이 틀어지거나 마음이 들썩일 수 있어요.",
  복음: "내 사주와 같은 글자가 겹치는 날이라 익숙한 하루가 돼요.",
} as const;

const YONGSIN_LINE = {
  용신: "내 사주에 모자란 쪽을 채워 주는 날이라 평소보다 힘이 덜 들어요.",
  기신: "내 사주에 이미 많은 쪽이 더해지는 날이라 과해지기 쉬워요.",
} as const;

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
  /** v4 영역 줄 (신호 있는 영역만) */
  areas?: { area: AreaName; signal: AreaSignal; line: string }[];
}

/** 영역 × 신호 템플릿 한 줄. 아이콘 없이 글자 화살표만 (디자인 명세 02) */
const AREA_LINE: Record<AreaName, Record<AreaSignal, string>> = {
  대인: { "↑": "사람 일이 순한 편이라 먼저 연락해도 좋아요.", "→": "사람 일은 평소와 비슷해요.", "↓": "사람 사이 말이 엇갈리기 쉬워 짧게 말해요." },
  재물: { "↑": "돈 쓰는 일은 계획대로 가요.", "→": "돈 일은 평소와 비슷해요.", "↓": "지출을 하루 미뤄도 손해가 없어요." },
  직업: { "↑": "하던 일을 마무리하기 좋아요.", "→": "일은 평소 속도로 가요.", "↓": "일에서 새로 벌이지 않고 정리만 해요." },
  학업: { "↑": "읽고 배우는 일이 잘 붙어요.", "→": "배우는 일은 평소와 비슷해요.", "↓": "새 내용보다 복습이 맞아요." },
  연애: { "↑": "가까운 사람에게 마음을 보이기 좋아요.", "→": "관계는 평소와 비슷해요.", "↓": "가까운 사람과는 말을 아껴요." },
  가족: { "↑": "집안 일을 챙기기 좋아요.", "→": "가족 일은 평소와 비슷해요.", "↓": "가족 사이 사소한 말에 걸리기 쉬워요." },
  건강: { "↑": "몸이 가벼운 편이에요.", "→": "몸 상태는 평소와 비슷해요.", "↓": "일찍 쉬는 게 남는 날이에요." },
};

/** 템플릿이 쓰는 재료. v3 BaseFortune도 그대로 들어간다 */
export type TemplateInput = Pick<BaseFortune, "tenGod" | "relation" | "yongsin"> & {
  areas?: { area: AreaName; signal: AreaSignal }[];
  /** 맞춤도 옆 안내 (예: 시간 모름) */
  fitNote?: string;
};

export function templateText(
  base: TemplateInput,
  personal: PersonalAdjustment,
  today: { ko: string; stemKo: string; branchKo: string },
): TemplateText {
  const t = BY_TEN_GOD[base.tenGod];
  const lines = [t.lead];
  if (base.relation) lines.push(RELATION_LINE[base.relation]);
  if (base.yongsin) lines.push(YONGSIN_LINE[base.yongsin]);
  const mine = personalLine(personal, today.ko, today.stemKo, today.branchKo);
  if (mine) lines.push(mine);
  if (base.fitNote) lines.push(base.fitNote);
  const areas = (base.areas ?? []).map((a) => ({ area: a.area, signal: a.signal, line: AREA_LINE[a.area][a.signal] }));
  return { headline: t.headline, body: lines.join(" "), do: t.do, dont: t.dont, ...(areas.length ? { areas } : {}) };
}

/** v4 core → 템플릿 재료. 관계는 태어난 날 글자(일지)와의 것만, 용신 표시는 합계 방향으로 */
export function templateInputFromCore(core: CoreFortune): TemplateInput {
  const dayHit = core.relations.hits.find((h) => h.pos === "일" && h.kind !== "복음") ?? core.relations.hits.find((h) => h.pos === "일");
  const relation: BaseFortune["relation"] = !dayHit ? null : dayHit.kind === "충" ? "충" : dayHit.kind === "육합" ? "육합" : dayHit.kind === "복음" ? "복음" : "삼합";
  const labels = [core.dayLuck.stem.label, core.dayLuck.branch.label];
  const yongsin: BaseFortune["yongsin"] =
    core.dayLuck.raw > 0 && labels.some((x) => x === "용" || x === "희") ? "용신" : core.dayLuck.raw < 0 && labels.some((x) => x === "기" || x === "구") ? "기신" : null;
  const fitNote = core.caveats.some((c) => c.startsWith("시간 모름")) && core.dayLuck.method === "용신 없음" ? "태어난 시간을 모르면 운세의 폭이 넓어져요." : undefined;
  return { tenGod: core.dayLuck.stem.tenGod, relation, yongsin, areas: core.areas, ...(fitNote ? { fitNote } : {}) };
}

export function findBanned(text: string): string[] {
  return BANNED.filter((w) => text.includes(w));
}
