/**
 * 원국 고유 특징 3개 — 오늘의 운세가 “그 사람”으로 갈라지게 하는 고정 정체성.
 * ChatGPT식: 이론보다 먼저 이 사람의 차이를 잠근다.
 */
import type { SajuProfile } from "@/lib/diary/types";
import { STEM_META, BRANCH_META, type Element } from "@/lib/saju/constants";
import type { NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { TEN_GOD_PLAIN } from "@/lib/journal/fortune/natalDaySignal";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type BranchHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import { DAY_MASTER_STEM_DICT, TEN_GOD_DICT } from "@/lib/journal/fortune/dictionaries";

export const NATAL_SIGNATURE_VERSION = "natal-signature-v1.1.0";

export type NatalSignatureTrait = {
  id: string;
  /** 짧은 제목 */
  title: string;
  /** 생활어 특징 (이 사주만의 결) */
  body: string;
  /** 구조 근거 (전문용어 최소화) */
  why: string;
};

const ELEMENT_KO: Record<Element, string> = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

const GOD_LIFE: Partial<Record<TenGod, string>> = {
  비견: "자기 페이스와 동료·동류의 힘이 삶의 축이 되기 쉽다.",
  겁재: "경쟁·나누기·속도전이 성장을 자극하는 편이다.",
  식신: "만들고 표현하며 여유를 지키는 쪽이 본전에 가깝다.",
  상관: "날카로운 말·반발·예민함이 재능이자 소모 지점이 된다.",
  편재: "기회·이동·유연한 자원 감각이 두드러진다.",
  정재: "안정된 성취·관리·책임이 삶의 뼈대가 된다.",
  편관: "압박과 도전 속에서 실행력이 깨어나는 편이다.",
  정관: "역할·평가·질서·신뢰가 중요한 나침반이다.",
  편인: "직감·아이디어·비정형 배움이 길을 연다.",
  정인: "보호·학습·회복·근본을 쌓는 힘이 중심이다.",
};

function safeTenGod(day: StemHanja, target: string): TenGod | null {
  try {
    return getTenGod(day, target as StemHanja);
  } catch {
    return null;
  }
}

/** T존: 월간·일지(정기)·시간 — 바로 쓰기 쉬운 도구 */
function extractTZoneGods(profile: SajuProfile): TenGod[] {
  const dayStem = profile.pillars.day.stemHanja;
  if (!dayStem) return [];
  const gods: TenGod[] = [];
  const monthStem = profile.pillars.month?.stemHanja;
  if (monthStem) {
    const g = safeTenGod(dayStem as StemHanja, monthStem);
    if (g) gods.push(g);
  }
  const dayBranch = profile.pillars.day.branchHanja;
  if (dayBranch) {
    try {
      const hidden = getHiddenStemsByBranch(dayBranch as BranchHanja);
      const main = hidden.find((h) => h.role === "main") ?? hidden[0];
      if (main) {
        const g = safeTenGod(dayStem as StemHanja, main.stem);
        if (g) gods.push(g);
      }
    } catch {
      /* ignore */
    }
  }
  const hourStem = profile.pillars.hour?.stemHanja;
  if (hourStem) {
    const g = safeTenGod(dayStem as StemHanja, hourStem);
    if (g) gods.push(g);
  }
  return gods;
}

function countElements(profile: SajuProfile): Partial<Record<Element, number>> {
  const counts: Partial<Record<Element, number>> = {};
  const add = (el: Element | null | undefined) => {
    if (!el) return;
    counts[el] = (counts[el] ?? 0) + 1;
  };
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = profile.pillars[key];
    if (!p) continue;
    add(STEM_META[p.stemHanja]?.element);
    add(BRANCH_META[p.branchHanja]?.element);
  }
  return counts;
}

function rankedElements(
  counts: Partial<Record<Element, number>>
): { el: Element; n: number }[] {
  const all: Element[] = ["wood", "fire", "earth", "metal", "water"];
  return all
    .map((el) => ({ el, n: counts[el] ?? 0 }))
    .sort((a, b) => b.n - a.n);
}

/**
 * 원국에서 “이 사람만의” 특징 3개를 코드로 고정한다.
 * LLM이 길흉을 바꾸지 못하게, 정체성 재료로만 쓴다.
 */
export function buildNatalSignatures(
  profile: SajuProfile | null | undefined,
  natalDay: NatalDayInsight | null
): NatalSignatureTrait[] {
  if (!profile?.pillars?.day?.stemHanja) {
    return [
      {
        id: "fallback_generic",
        title: "오늘의 흐름 중심",
        body: "원국 정보가 부족해, 오늘 글자와 최근 기록 결을 중심으로 읽는다.",
        why: "프로필 일간이 없음",
      },
    ];
  }

  const dayStem = profile.pillars.day.stemHanja;
  const dayBranch = profile.pillars.day.branchHanja;
  const dayMeta = STEM_META[dayStem];
  const dayEl = dayMeta?.element ?? null;
  const dayStemKo = dayMeta?.ko ?? null;
  const traits: NatalSignatureTrait[] = [];

  // 1) 일간 본성 (천간별 사전 — 사례 복사 금지, 일간만으로 재산출)
  const dm = dayStemKo ? DAY_MASTER_STEM_DICT[dayStemKo] : null;
  if (dm) {
    const ganji =
      profile.pillars.day.ganjiKo ||
      `${dayStemKo}${BRANCH_META[dayBranch]?.ko ?? ""}`;
    traits.push({
      id: "day_master",
      title: `일주 ${ganji} · ${dm.title}`,
      body: `${dm.meaning}. 강점: ${dm.positive.join("·")}. 과하면: ${dm.risk.join("·")}.`,
      why: `일간 ${dayStemKo}${dayEl ? `(${ELEMENT_KO[dayEl]})` : ""}`,
    });
  }

  // 2) T존 (월간·일지·시간) — 바로 쓰기 쉬운 도구
  const tGods = extractTZoneGods(profile);
  const uniqueT = [...new Set(tGods)];
  if (uniqueT.length > 0) {
    const flow = uniqueT
      .map((g) => TEN_GOD_DICT[g].positive[0] ?? g)
      .slice(0, 3)
      .join(" → ");
    const risk = uniqueT
      .flatMap((g) => TEN_GOD_DICT[g].risk.slice(0, 1))
      .slice(0, 2)
      .join("·");
    traits.push({
      id: "t_zone",
      title: `가까운 도구 ${uniqueT.join("·")}`,
      body: `자료를 다루고(${flow}) 현실로 옮기는 흐름이 쓰기 쉽다. 과하면 ${risk}로 갈 수 있다.`,
      why: `T존(월간·일지·시간) 십신: ${uniqueT.join("·")}`,
    });
  } else {
    // T존 없으면 원국 상위 십신
    const topGod = (natalDay?.natalDominant?.[0] ?? null) as TenGod | null;
    if (topGod && GOD_LIFE[topGod]) {
      traits.push({
        id: "dominant_god",
        title: `${TEN_GOD_PLAIN[topGod].split("·")[0]?.trim() ?? "기운"}이 두드러짐`,
        body: GOD_LIFE[topGod]!,
        why: `원국에서 ${TEN_GOD_PLAIN[topGod]} 쪽이 비교적 강함`,
      });
    } else if (natalDay?.overallTraitPlain) {
      traits.push({
        id: "overall_trait",
        title: "원국의 기본 결",
        body: natalDay.overallTraitPlain,
        why: "원국 십신 분포 요약",
      });
    }
  }

  // 3) 오행 편중 또는 결핍 (차별점)
  const ranked = rankedElements(countElements(profile));
  const strong = ranked[0];
  const weak = ranked[ranked.length - 1];
  if (strong && weak && strong.el !== weak.el) {
    if (strong.n - weak.n >= 1) {
      traits.push({
        id: "element_balance",
        title: `${ELEMENT_KO[strong.el]}은 굵고 ${ELEMENT_KO[weak.el]}은 얇음`,
        body: `${ELEMENT_KO[strong.el]} 기운이 생활에서 먼저 드러나고, ${ELEMENT_KO[weak.el]} 쪽은 과로·리듬이 깨일 때 빈칸처럼 느껴지기 쉽다. 강하다고 무조건 길·흉으로 단정하지 않는다.`,
        why: `원국 오행 카운트 강 ${ELEMENT_KO[strong.el]}(${strong.n}) / 약 ${ELEMENT_KO[weak.el]}(${weak.n})`,
      });
    }
  }

  // 4) 월주 환경 (여유 슬롯)
  const month = profile.pillars.month;
  if (traits.length < 3 && month?.ganjiKo) {
    const mEl = BRANCH_META[month.branchHanja]?.element;
    traits.push({
      id: "month_climate",
      title: `자란 환경 ${month.ganjiKo}`,
      body: mEl
        ? `성장·사회적 무대가 ${ELEMENT_KO[mEl]} 기운 쪽에 가깝다. 바깥에서 요구받는 리듬이 여기와 맞물린다.`
        : `월주 ${month.ganjiKo}가 바깥 환경·사회화의 배경색이 된다.`,
      why: `월주 ${month.ganjiKo}`,
    });
  }

  // 5) 오늘과 맞닿는 긴장 (보조 — 3개 채울 때)
  if (traits.length < 3 && natalDay?.byDomain?.overall?.tensionPlain) {
    traits.push({
      id: "today_touch",
      title: "오늘과 맞닿는 지점",
      body: natalDay.byDomain.overall.tensionPlain.slice(0, 120),
      why: `오늘 ${natalDay.ganjiKo}`,
    });
  }

  return traits.slice(0, 3);
}
