// 오늘의 개운 (v4.7, 2026-10-12 사용자 결정 Q1~Q6). 정해진 전통 오행 대응표로 앱이 직접 고른다 — 모델 호출·지어냄 없음.
// 기준(Q2 = B): 오늘 들어오는 글자가 나에게 용·희(도움)면 그 오행을 더 살리고, 기·구(넘침·어긋남)·한이면 내 용신 오행으로 균형.
// 근거: 색·방위·장소는 사주 코어 content/src/brief.ts EL_LUCK(입문 3강 표). 맛·시간대는 널리 쓰이는 오행 대응(맛 = 오미, 시간 = 지지 시각).
// 시간 모름으로 용신이 확정되지 않으면 null (Q5 = A: 근거 없이 권하지 않는다).
import { BRANCH_META, ELEMENT_EN_TO_KO, ELEMENT_WORD, STEM_META, type ElementKo, type StemHanja } from "@saju/engine";
import type { CoreFortune } from "./types";

export type El = ElementKo;
const EN_TO_EL: Record<string, El> = ELEMENT_EN_TO_KO;
export const EL_WORD: Record<El, string> = ELEMENT_WORD;

interface Table {
  colors: { name: string; hex: string }[];
  /** 맛 이름 + 예시 음식들 */
  taste: string;
  foods: string[];
  time: string;
  activities: string[];
}

export const GAEWOON_TABLE: Record<El, Table> = {
  목: {
    colors: [{ name: "초록", hex: "#4f7a4a" }, { name: "연두", hex: "#8fb36a" }, { name: "청록", hex: "#3f7f78" }],
    taste: "새콤한 맛",
    foods: ["귤 한 알", "레몬을 띄운 물", "새콤한 나물무침"],
    time: "이른 아침 (5~9시)",
    activities: ["나무 있는 길 걷기", "화분에 물 주기", "아침 스트레칭"],
  },
  화: {
    colors: [{ name: "붉은색", hex: "#b5473a" }, { name: "주황", hex: "#d0773a" }, { name: "분홍", hex: "#d9879b" }],
    taste: "쌉쌀한 맛",
    foods: ["녹차 한 잔", "다크초콜릿 한 조각", "쌉쌀한 나물"],
    time: "한낮 (11~13시)",
    activities: ["햇볕 쬐며 걷기", "좋아하는 노래 크게 듣기", "밝은 곳에서 사람 만나기"],
  },
  토: {
    colors: [{ name: "노랑", hex: "#d6b04a" }, { name: "황토색", hex: "#b8894a" }, { name: "베이지", hex: "#cdb48a" }],
    taste: "달큰한 맛",
    foods: ["군고구마", "단호박", "따뜻한 대추차"],
    time: "점심 뒤 (13~15시)",
    activities: ["방 한 칸 정리", "공원 벤치에 앉아 쉬기", "따뜻한 차 마시며 쉬기"],
  },
  금: {
    colors: [{ name: "흰색", hex: "#f4efe4" }, { name: "은회색", hex: "#a7a9ad" }, { name: "금빛", hex: "#c99a2e" }],
    taste: "알싸한 맛",
    foods: ["생강차", "무생채", "칼칼한 국"],
    time: "늦은 오후 (15~19시)",
    activities: ["책상 위 정리", "가방 속 정리", "짧고 굵게 운동"],
  },
  수: {
    colors: [{ name: "남색", hex: "#26365a" }, { name: "검정", hex: "#2b2b2e" }, { name: "짙은 파랑", hex: "#2f5d8a" }],
    taste: "짭짤한 맛",
    foods: ["미역국", "김 한 장", "된장국"],
    time: "밤 (21~23시)",
    activities: ["따뜻한 물로 씻기", "물 한 잔 천천히 마시기", "물가나 강변 걷기"],
  },
};

export interface Gaewoon {
  el: El;
  /** 왜 이 오행인지 한 줄 */
  reason: string;
  color: { name: string; hex: string };
  food: string;
  time: string;
  activity: string;
}

/** 날짜로 고르는 순번 (같은 날이면 늘 같다) */
function dayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

const josaIga = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return c >= 0 && c % 28 !== 0 ? "이" : "가";
};

export function gaewoonOf(core: Pick<CoreFortune, "dayLuck" | "luckEls">, date: string): Gaewoon | null {
  const le = core.luckEls;
  if (!le) return null;
  const stemEl = EN_TO_EL[STEM_META[core.dayLuck.stem.char as StemHanja]?.element ?? ""];
  const branchEl = EN_TO_EL[BRANCH_META[core.dayLuck.branch.char as keyof typeof BRANCH_META]?.element ?? ""];
  const parts = [
    { el: stemEl, label: core.dayLuck.stem.label },
    { el: branchEl, label: core.dayLuck.branch.label },
  ];
  const helping = parts.find((p) => p.el && (p.label === "용" || p.label === "희"));
  const heavy = parts.find((p) => p.el && (p.label === "기" || p.label === "구"));
  let el: El;
  let reason: string;
  if (helping) {
    el = helping.el!;
    reason = `오늘 들어오는 ${EL_WORD[el]}${josaIga(EL_WORD[el])} 나를 도와서, 그 쪽을 더 살려요`;
  } else if (heavy) {
    el = le.용;
    reason = `오늘은 ${EL_WORD[heavy.el!]}${josaIga(EL_WORD[heavy.el!])} 세서, ${EL_WORD[el]} 쪽으로 균형을 잡아요`;
  } else {
    el = le.용;
    reason = `오늘은 나에게 필요한 ${EL_WORD[el]} 쪽을 조금 보태요`;
  }
  const t = GAEWOON_TABLE[el];
  const i = dayIndex(date);
  return { el, reason, color: t.colors[i % t.colors.length]!, food: `${t.taste}, ${t.foods[i % t.foods.length]}`, time: t.time, activity: t.activities[(i + 1) % t.activities.length]! };
}
