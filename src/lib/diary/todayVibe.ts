import { getTenGod, type TenGod } from "@/lib/saju/hiddenStems";
import { BRANCH_META, ELEMENT_LABELS, STEM_META, STEMS, type Element } from "@/lib/saju/constants";
import type { DiaryDayPillar } from "./types";
import type { UserBirthPillars } from "./types";

export type TodayVibe = {
  headline: string;
  detail?: string;
  tenGod?: TenGod;
};

const TEN_GOD_HINTS: Record<TenGod, { short: string; action: string }> = {
  비견: { short: "나와 같은 기운", action: "자기 페이스를 지키기 좋은 날" },
  겁재: { short: "경쟁·협력의 기운", action: "비교보다 내 기준에 집중해 보세요" },
  식신: { short: "표현·창작의 기운", action: "만들고 나누기 좋은 날" },
  상관: { short: "도전·변화의 기운", action: "익숙한 방식을 살짝 바꿔 보세요" },
  편재: { short: "기회·유동의 기운", action: "가벼운 결정과 실행에 유리해요" },
  정재: { short: "안정·관리의 기운", action: "계획과 정리에 에너지 쓰기 좋아요" },
  편관: { short: "압박·돌파의 기운", action: "목표를 하나만 정해 밀어붙이기 좋아요" },
  정관: { short: "책임·구조의 기운", action: "약속·루틴 지키기에 좋은 날" },
  편인: { short: "학습·직관의 기운", action: "배우고 정리하기 좋은 날" },
  정인: { short: "보호·지원의 기운", action: "돌봄과 휴식에 에너지 쓰기 좋아요" },
};

const ELEMENT_VIBE: Record<Element, string> = {
  wood: "성장·시작",
  fire: "열정·표현",
  earth: "안정·중심",
  metal: "정리·결단",
  water: "유연·내면",
};

function koToStemHanja(ko: string): (typeof STEMS)[number] | null {
  for (const stem of STEMS) {
    if (STEM_META[stem].ko === ko) return stem;
  }
  return null;
}

function getElementComboLine(dayPillar: DiaryDayPillar): TodayVibe {
  const stemEl = STEM_META[dayPillar.stem.hanja]?.element;
  const branchEl = BRANCH_META[dayPillar.branch.hanja]?.element;
  const stemKo = dayPillar.stem.ko;
  const branchKo = dayPillar.branch.ko;

  if (stemEl && branchEl) {
    const s = ELEMENT_VIBE[stemEl];
    const b = ELEMENT_VIBE[branchEl];
    return {
      headline: `${stemKo}${branchKo}(${ELEMENT_LABELS[stemEl]}${ELEMENT_LABELS[branchEl]}) — ${s}과 ${b}이 함께하는 날`,
      detail: `오늘 일운 ${dayPillar.ganjiKo}일. 기록해 두면 60일 뒤 같은 날과 비교할 수 있어요.`,
    };
  }

  return {
    headline: `오늘 일운 ${dayPillar.ganjiKo}일 — 기록해 두면 패턴이 쌓여요`,
  };
}

export function getTodayVibe(
  dayPillar: DiaryDayPillar,
  userBirthPillars?: UserBirthPillars | null
): TodayVibe {
  if (userBirthPillars?.day) {
    const dayStem = koToStemHanja(userBirthPillars.day.stemKo);
    const todayStem = koToStemHanja(dayPillar.stem.ko);

    if (dayStem && todayStem) {
      const tenGod = getTenGod(dayStem, todayStem);
      const hint = TEN_GOD_HINTS[tenGod];
      return {
        headline: `오늘은 ${tenGod} 기운 — ${hint.short}`,
        detail: `내 일간 ${userBirthPillars.day.stemKo} · 오늘 일간 ${dayPillar.stem.ko} — ${hint.action}`,
        tenGod,
      };
    }
  }

  return getElementComboLine(dayPillar);
}
