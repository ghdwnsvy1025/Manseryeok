/**
 * 하루의 사주 사실 — "오늘이 이 가설의 대상인가"를 판정할 재료.
 *
 * 관계는 원국의 일주(나 자신)와 그날 일진 사이만 본다.
 * 년·월주까지 넣으면 대부분의 날이 무언가에 걸려 조건의 변별력이 사라진다.
 */
import { STEM_META, BRANCH_META, type Element } from "@/lib/saju/constants";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { SajuProfilePillars } from "@/lib/diary/types";
import {
  GOD_FAMILY_OF,
  type DayCondition,
  type DayFacts,
  type GodFamily,
  type NatalSummary,
  type RelationKind,
} from "./types";

function isStemHanja(value: string): value is StemHanja {
  return Boolean(STEM_META[value]);
}

/** 엔진의 관계 종류를 사용자용 5종으로 접는다 */
function foldRelationKind(kind: string): RelationKind | null {
  switch (kind) {
    case "yukhap":
    case "cheon_gan_hap":
      return "hap";
    case "chung":
      return "chung";
    case "hyeong":
      return "hyeong";
    case "pa":
      return "pa";
    case "hae":
      return "hae";
    default:
      return null;
  }
}

/** 지지의 정기(주인) 십신 */
function mainBranchGod(dayMaster: StemHanja, branch: string): TenGod | null {
  let hidden: ReturnType<typeof getHiddenStemsByBranch>;
  try {
    hidden = getHiddenStemsByBranch(branch);
  } catch {
    return null;
  }
  const main = hidden.find((h) => h.role === "main") ?? hidden[hidden.length - 1];
  if (!main || !isStemHanja(main.stem)) return null;
  return getTenGod(dayMaster, main.stem);
}

export function buildDayFacts(
  dateStr: string,
  natalPillars: SajuProfilePillars,
  natal: NatalSummary
): DayFacts {
  const { dayPillar } = getPillarsForDate(dateStr);
  const dayMaster = natal.dayMaster as StemHanja;

  const todayStem = dayPillar.stem.hanja;
  const todayBranch = dayPillar.branch.hanja;

  const stemGod = isStemHanja(todayStem)
    ? getTenGod(dayMaster, todayStem)
    : null;
  const branchGod = mainBranchGod(dayMaster, todayBranch);

  const relations = detectDayRelations({
    natalStemHanja: natalPillars.day.stemHanja,
    natalBranchHanja: natalPillars.day.branchHanja,
    todayStemHanja: todayStem,
    todayBranchHanja: todayBranch,
  })
    .map((r) => foldRelationKind(r.kind))
    .filter((k): k is RelationKind => k !== null);

  // 용신일 — 그날 일주의 천간이나 지지가 용신 간지 목록에 있으면 참.
  // 용신이 T존에서 나왔으면 그 간지 하나뿐이라 드물게 오고,
  // T존에 없어서 오행 전체가 용신이면 자주 온다. 빈도 차이는 카드에 그대로 보여준다.
  const yongsinSet = natal.yongsin?.ganjiHanja ?? [];
  const isYongsin =
    yongsinSet.length > 0 &&
    (yongsinSet.includes(todayStem) || yongsinSet.includes(todayBranch));

  return {
    date: dateStr,
    stemGod,
    branchGod,
    relations: Array.from(new Set(relations)),
    stemElement: STEM_META[todayStem]?.element ?? null,
    branchElement: BRANCH_META[todayBranch]?.element ?? null,
    isYongsin,
  };
}

/** 그날이 이 조건에 해당하는가 */
export function matchesCondition(facts: DayFacts, condition: DayCondition): boolean {
  const familyOf = (god: TenGod | null): GodFamily | null =>
    god ? GOD_FAMILY_OF[god] : null;

  switch (condition.kind) {
    case "stem_family":
      return familyOf(facts.stemGod) === condition.family;

    case "branch_family":
      return familyOf(facts.branchGod) === condition.family;

    case "any_family":
      return (
        familyOf(facts.stemGod) === condition.family ||
        familyOf(facts.branchGod) === condition.family
      );

    case "relation":
      return facts.relations.includes(condition.relation);

    case "element":
      return (
        facts.stemElement === condition.element ||
        facts.branchElement === condition.element
      );

    case "yongsin":
      return facts.isYongsin;

    default:
      return false;
  }
}

/** 조건을 사용자에게 보여줄 이름으로 (오행 조건은 호출부에서 문구를 덮어쓴다) */
export function describeElement(element: Element): string {
  const labels: Record<Element, string> = {
    wood: "나무(木)",
    fire: "불(火)",
    earth: "흙(土)",
    metal: "쇠(金)",
    water: "물(水)",
  };
  return labels[element];
}
