// 나 탭 만세력 화면(/me/saju)의 계산 (2026-10-31 사용자 결정). 서버 전용 — 엔진·코어 판정을 부른다.
// 표: 기둥 넷 × (천간 십신 / 천간 / 지지 / 지지 십신 / 지장간 / 십이운성 / 12신살)
// 특별한 신살 칩, 중심 기운(신강약·중심·격국), 용신(용·희·기), 지금 대운과 다음 대운.
//
// 해석 원칙: 십이운성·신살은 이름과 한 줄 뜻만 보이고 길흉을 말하지 않는다. 유료 풀이(사주 코어) 규칙이
// "노트가 비판적이고 근거가 약하다"며 판정에서 뺀 것들이라, 앱이 단정하지 않는다(규칙/부가태그.md).
// 중심 기운·용신·격국은 운세(fortune/core.ts)와 같은 코어 판정(@saju/core-rules)을 쓴다 — 오늘 운세와 말이 어긋나지 않게.
// 세력은 유료 풀이와 같은 DEFAULT_POWER_METHOD로 센다(코어 4f795ca, 2026-10-31) — 무료 만세력과 유료 풀이의 용신이 같게.
import "server-only";
import { BRANCH_META, ELEMENT_KO_TO_EN, ELEMENT_ORDER, STEM_META, calculateElementDistribution, calculateHiddenStems, getTenGod, type Element, type StemHanja } from "@saju/engine";
import { DEFAULT_POWER_METHOD, balance, currentLuckContext, extraTags, fromBirth, gyeokguk, relations, toCorePillars, toKo, yongsin as coreYongsin, type Group } from "@saju/core-rules";
import { resolveYongsin, toBirthInput } from "@/lib/fortune/core";
import type { BirthProfile, PillarSnapshot, PillarsSnapshot } from "@/lib/profile";

export type PillarPos = "hour" | "day" | "month" | "year";
const POS_KO: Record<PillarPos, string> = { hour: "시주", day: "일주", month: "월주", year: "연주" };
/** 코어 Pillars 순서(연·월·일·시) → 위치 */
const CORE_POS: PillarPos[] = ["year", "month", "day", "hour"];
const CORE_POS_KO = ["연", "월", "일", "시"];

// ---- 십이운성 ----------------------------------------------------------------
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
export const UNSEONG = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"] as const;
export type Unseong = (typeof UNSEONG)[number];
/** 각 천간의 장생 자리. 양간은 순행, 음간은 역행 (표준 십이운성표) */
const JANGSAENG: Record<string, { at: string; forward: boolean }> = {
  甲: { at: "亥", forward: true }, 丙: { at: "寅", forward: true }, 戊: { at: "寅", forward: true }, 庚: { at: "巳", forward: true }, 壬: { at: "申", forward: true },
  乙: { at: "午", forward: false }, 丁: { at: "酉", forward: false }, 己: { at: "酉", forward: false }, 辛: { at: "子", forward: false }, 癸: { at: "卯", forward: false },
};
/** 천간(보통 일간)이 그 지지에서 어느 운성인지 */
export function unseongOf(stem: string, branch: string): Unseong | null {
  const j = JANGSAENG[stem];
  const b = BRANCHES.indexOf(branch);
  if (!j || b < 0) return null;
  const s = BRANCHES.indexOf(j.at);
  return UNSEONG[j.forward ? (b - s + 12) % 12 : (s - b + 12) % 12]!;
}
/** 한 줄 뜻 — 기운의 흐름을 사람의 한살이에 빗댄 이름일 뿐, 좋고 나쁨이 아니다 */
export const UNSEONG_NOTE: Record<Unseong, string> = {
  장생: "새로 태어나 시작하는 힘",
  목욕: "꾸미고 드러내며 흔들리는 때",
  관대: "자라서 바깥으로 나서는 힘",
  건록: "제 몫을 해내는 단단한 힘",
  제왕: "가장 왕성하게 차오른 힘",
  쇠: "정점을 지나 노련해지는 때",
  병: "힘을 아끼며 안으로 드는 때",
  사: "멈추고 정리하는 때",
  묘: "거두어 안에 담아 두는 힘",
  절: "끊고 새로 여는 때",
  태: "새 싹을 품은 때",
  양: "품은 것을 기르는 때",
};

// ---- 신살 -------------------------------------------------------------------
/** 칩으로 보이는 신살과 한 줄 뜻 (사용자 결정 2026-10-31). 12신살은 표의 한 줄로, 그 밖의 형·파·해는 보이지 않는다 */
export const SPECIAL_SINSAL: Record<string, string> = {
  천을귀인: "도와주는 사람이 붙는 자리",
  도화: "사람을 끄는 매력",
  역마: "움직이고 옮겨 다니는 기운",
  화개: "혼자 깊이 파고드는 힘",
  백호: "세고 거침없는 추진력",
  괴강: "강한 결단과 고집",
  공망: "비어 있어 채워 가는 자리",
  원진: "서로 껄끄러운 글자 한 쌍",
  귀문: "예민하고 섬세한 감각",
};

export interface SinsalChip {
  name: string;
  /** "일지 午" · "子未" */
  where: string;
  note: string;
}

// ---- 쉬운 말 ------------------------------------------------------------------
export const GROUP_PLAIN: Record<Group, string> = {
  비겁: "나와 같은 기운 — 자기 힘·동료",
  식상: "표현하고 만들어 내는 기운",
  재성: "현실을 다루고 거두는 기운",
  관성: "규칙과 책임의 기운",
  인성: "배우고 받아들이는 기운",
};
const STRENGTH_PLAIN = { 신강: "기운이 센 편", 중화: "기운이 고른 편", 신약: "기운이 여린 편" } as const;

// ---- 결과 -------------------------------------------------------------------
export interface ChartColumn {
  pos: PillarPos;
  label: string;
  /** 시간을 모르면 시주는 비어 있다 */
  unknown: boolean;
  stem: string;
  branch: string;
  stemElement: Element | null;
  branchElement: Element | null;
  /** 천간 십신. 일간은 "나" */
  stemGod: string;
  /** 지지 정기 십신 */
  branchGod: string;
  /** 지장간(여기·중기·정기 순) 한자 */
  hidden: string[];
  /** 일간 기준 십이운성 */
  unseong: Unseong | null;
  /** 12신살 (연지 삼합 기준) */
  sal12: string | null;
}

export interface SajuChart {
  /** 시·일·월·연 순 (만세력 관례) */
  columns: ChartColumn[];
  specials: SinsalChip[];
  center: {
    strength: "신강" | "중화" | "신약";
    strengthPlain: string;
    /** 비겁+인성 % */
    inbi: number;
    centerGroup: Group;
    centerPlain: string;
    gyeok: string | null;
    /** 성격·파격 등 (원전 기준) */
    gyeokVerdict: string | null;
  };
  /** 용신을 못 정했으면(시간 모름 다수결 실패) null */
  yongsin: { use: Element; hee: Element; gi: Element; useGroup: Group; heeGroup: Group; giGroup: Group; unstable: boolean } | null;
  daeun: { current: { ganjiKo: string; ganji: string; until: string | null } | null; next: { ganjiKo: string; ganji: string; from: string | null; age: number } | null } | null;
  hourUnknown: boolean;
  /** 오행 분포율 (엔진 calculateElementDistribution — 합·조후 반영). 목화토금수 순, 정수 % */
  elements: { el: Element; ko: string; pct: number }[];
}

const EL_EN: Record<string, Element> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" };

function columnOf(pos: PillarPos, p: PillarSnapshot | null, dayStem: string, branchGod: string, hidden: string[], sal12: string | null): ChartColumn {
  if (!p) {
    return { pos, label: POS_KO[pos], unknown: true, stem: "", branch: "", stemElement: null, branchElement: null, stemGod: "", branchGod: "", hidden: [], unseong: null, sal12: null };
  }
  return {
    pos,
    label: POS_KO[pos],
    unknown: false,
    stem: p.stem,
    branch: p.branch,
    stemElement: STEM_META[p.stem as StemHanja]?.element ?? null,
    branchElement: BRANCH_META[p.branch as keyof typeof BRANCH_META]?.element ?? null,
    stemGod: pos === "day" ? "나" : getTenGod(dayStem as StemHanja, p.stem as StemHanja),
    branchGod,
    hidden,
    unseong: unseongOf(dayStem, p.branch),
    sal12,
  };
}

/** 원국·생년월일·기준일(오늘) → 만세력 화면 한 장 */
export function sajuChart(pillars: PillarsSnapshot, birth: BirthProfile, today: string): SajuChart {
  const dayStem = pillars.day.stem;
  // 지장간·지지 십신 (엔진)
  const toInput = (p: PillarSnapshot) => ({ stem: { hanja: p.stem }, branch: { hanja: p.branch }, ganji: `${p.stem}${p.branch}` });
  const hs = calculateHiddenStems({
    year: toInput(pillars.year),
    month: toInput(pillars.month),
    day: toInput(pillars.day),
    hour: pillars.hour ? toInput(pillars.hour) : null,
  });
  const hiddenOf: Partial<Record<PillarPos, { stems: string[]; god: string }>> = {};
  for (const item of hs.items) {
    const ordered = [...item.hiddenStems].sort((a, b) => a.order - b.order);
    const main = item.hiddenStems.find((h) => h.role === "main") ?? ordered[ordered.length - 1];
    hiddenOf[item.pillar] = { stems: ordered.map((h) => h.stem), god: main?.tenGod ?? "" };
  }

  // 코어 판정
  const p = toCorePillars(pillars);
  const tags = extraTags(p);
  const sal12: Partial<Record<PillarPos, string>> = {};
  const specials: SinsalChip[] = [];
  for (const t of tags) {
    if (t.태그.startsWith("12신살 ")) {
      const posKo = t.대상.slice(0, 1);
      const pos = CORE_POS[CORE_POS_KO.indexOf(posKo)];
      if (pos) sal12[pos] = t.태그.slice(5);
      continue;
    }
    const name = t.태그.replace(/\(.*\)$/, "");
    const note = SPECIAL_SINSAL[name];
    if (!note) continue;
    // 도화·역마·화개는 연지·일지 두 기준에서 같은 글자가 두 번 나올 수 있다 — 한 번만
    if (specials.some((s) => s.name === name && s.where === t.대상)) continue;
    specials.push({ name, where: t.대상, note });
  }

  const b = balance(p, DEFAULT_POWER_METHOD);
  const { y } = resolveYongsin(p, b);
  const g = gyeokguk(p, b, relations(p, b, y ?? coreYongsin(p, b)));
  const roleEl = (role: string) => {
    if (!y) return null;
    const grp = (Object.keys(y.역할) as Group[]).find((k) => y.역할[k] === role)!;
    return { el: EL_EN[b.그룹오행[grp]]!, grp };
  };
  const use = roleEl("용"), hee = roleEl("희"), gi = roleEl("기");

  // 대운 (코어 fromBirth — 운세와 같은 계산)
  let daeun: SajuChart["daeun"] = null;
  try {
    const birthResult = fromBirth(toBirthInput(birth));
    const ctx = currentLuckContext(birthResult, today);
    const list = birthResult.대운.목록;
    const cur = ctx.현재대운;
    const nextItem = cur ? list.find((d) => d.순서 === cur.순서 + 1) : list[0];
    daeun = {
      current: cur ? { ganji: cur.간지, ganjiKo: toKo(cur.간지), until: cur.다음전환?.slice(0, 10) ?? null } : null,
      next: nextItem ? { ganji: nextItem.간지, ganjiKo: toKo(nextItem.간지), from: nextItem.시작일?.slice(0, 10) ?? null, age: nextItem.시작나이 } : null,
    };
  } catch (e) {
    console.warn("[saju chart] 대운 계산 실패", e);
  }

  const col = (pos: PillarPos) => columnOf(pos, pillars[pos], dayStem, hiddenOf[pos]?.god ?? "", hiddenOf[pos]?.stems ?? [], sal12[pos] ?? null);
  return {
    columns: [col("hour"), col("day"), col("month"), col("year")],
    specials,
    center: {
      strength: b.신강약,
      strengthPlain: STRENGTH_PLAIN[b.신강약],
      inbi: Math.round(b.인비),
      centerGroup: b.중심기운,
      centerPlain: GROUP_PLAIN[b.중심기운],
      gyeok: g?.격 ?? null,
      gyeokVerdict: g?.원전판정.판정 ?? null,
    },
    yongsin: use && hee && gi ? { use: use.el, hee: hee.el, gi: gi.el, useGroup: use.grp, heeGroup: hee.grp, giGroup: gi.grp, unstable: y!.판정불안정 } : null,
    daeun,
    hourUnknown: !pillars.hour,
    elements: elementPercents(pillars),
  };
}

function elementPercents(pillars: PillarsSnapshot): SajuChart["elements"] {
  const order = [pillars.hour, pillars.day, pillars.month, pillars.year].filter((p): p is PillarSnapshot => p !== null);
  const d = calculateElementDistribution(order.map((p) => p.ko.slice(0, 1)).join(""), order.map((p) => p.ko.slice(1, 2)).join(""));
  return ELEMENT_ORDER.map((ko) => ({ el: ELEMENT_KO_TO_EN[ko], ko, pct: Math.round(d.percentage[ko]) }));
}
