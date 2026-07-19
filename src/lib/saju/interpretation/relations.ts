import { BRANCHES, STEMS } from "@/lib/saju/constants";

export type BranchRelationKind =
  | "yukhap"
  | "chung"
  | "hyeong"
  | "pa"
  | "hae";

export type StemRelationKind = "cheon_gan_hap";

export type DetectedRelation = {
  kind: BranchRelationKind | StemRelationKind;
  label: string;
  left: string;
  right: string;
  description: string;
};

const YUKHAP: Array<[string, string]> = [
  ["子", "丑"],
  ["寅", "亥"],
  ["卯", "戌"],
  ["辰", "酉"],
  ["巳", "申"],
  ["午", "未"],
];

const CHUNG: Array<[string, string]> = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

const PA: Array<[string, string]> = [
  ["子", "酉"],
  ["午", "卯"],
  ["寅", "亥"],
  ["巳", "申"],
  ["辰", "丑"],
  ["戌", "未"],
];

const HAE: Array<[string, string]> = [
  ["子", "未"],
  ["丑", "午"],
  ["寅", "巳"],
  ["卯", "辰"],
  ["申", "亥"],
  ["酉", "戌"],
];

/** 형: 寅巳申 / 丑戌未 / 子卯 / 辰午酉亥(자형) */
const HYEONG_GROUPS: string[][] = [
  ["寅", "巳", "申"],
  ["丑", "戌", "未"],
  ["子", "卯"],
];

const CHEON_GAN_HAP: Array<[string, string, string]> = [
  ["甲", "己", "토"],
  ["乙", "庚", "금"],
  ["丙", "辛", "수"],
  ["丁", "壬", "목"],
  ["戊", "癸", "화"],
];

function pairMatch(
  a: string,
  b: string,
  pairs: Array<[string, string]>
): boolean {
  return pairs.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

function isValidBranch(value: string): boolean {
  return (BRANCHES as readonly string[]).includes(value);
}

function isValidStem(value: string): boolean {
  return (STEMS as readonly string[]).includes(value);
}

/**
 * 원국 일지와 오늘 일지의 전통 관계 판정.
 * 기존 오행 점수/계산 코어와 독립된 순수 함수.
 */
export function detectBranchRelations(
  natalBranchHanja: string,
  todayBranchHanja: string
): DetectedRelation[] {
  if (!isValidBranch(natalBranchHanja) || !isValidBranch(todayBranchHanja)) {
    return [];
  }
  if (natalBranchHanja === todayBranchHanja) return [];

  const results: DetectedRelation[] = [];
  const left = natalBranchHanja;
  const right = todayBranchHanja;

  if (pairMatch(left, right, YUKHAP)) {
    results.push({
      kind: "yukhap",
      label: "육합",
      left,
      right,
      description: `${left}와 ${right}는 육합 관계로 협조·연결의 흐름이 강해질 수 있습니다.`,
    });
  }
  if (pairMatch(left, right, CHUNG)) {
    results.push({
      kind: "chung",
      label: "충",
      left,
      right,
      description: `${left}와 ${right}는 충 관계로 일정이나 감정의 변화가 평소보다 크게 느껴질 수 있습니다.`,
    });
  }
  if (pairMatch(left, right, PA)) {
    results.push({
      kind: "pa",
      label: "파",
      left,
      right,
      description: `${left}와 ${right}는 파 관계로 계획의 수정이나 리듬 조율이 필요할 수 있습니다.`,
    });
  }
  if (pairMatch(left, right, HAE)) {
    results.push({
      kind: "hae",
      label: "해",
      left,
      right,
      description: `${left}와 ${right}는 해 관계로 오해나 긴장에 민감해질 수 있습니다.`,
    });
  }
  for (const group of HYEONG_GROUPS) {
    if (group.includes(left) && group.includes(right) && left !== right) {
      results.push({
        kind: "hyeong",
        label: "형",
        left,
        right,
        description: `${left}와 ${right}는 형 관계로 반복되는 자극이나 내부 긴장에 주의가 필요합니다.`,
      });
      break;
    }
  }

  return results;
}

export function detectStemRelations(
  natalStemHanja: string,
  todayStemHanja: string
): DetectedRelation[] {
  if (!isValidStem(natalStemHanja) || !isValidStem(todayStemHanja)) {
    return [];
  }
  if (natalStemHanja === todayStemHanja) return [];

  for (const [a, b, element] of CHEON_GAN_HAP) {
    if (
      (natalStemHanja === a && todayStemHanja === b) ||
      (natalStemHanja === b && todayStemHanja === a)
    ) {
      return [
        {
          kind: "cheon_gan_hap",
          label: "천간합",
          left: natalStemHanja,
          right: todayStemHanja,
          description: `${natalStemHanja}와 ${todayStemHanja}는 천간합(${element}) 관계로 협력·조율의 흐름이 나타날 수 있습니다.`,
        },
      ];
    }
  }
  return [];
}

export function detectDayRelations(input: {
  natalStemHanja?: string | null;
  natalBranchHanja?: string | null;
  todayStemHanja?: string | null;
  todayBranchHanja?: string | null;
}): DetectedRelation[] {
  const stem =
    input.natalStemHanja && input.todayStemHanja
      ? detectStemRelations(input.natalStemHanja, input.todayStemHanja)
      : [];
  const branch =
    input.natalBranchHanja && input.todayBranchHanja
      ? detectBranchRelations(input.natalBranchHanja, input.todayBranchHanja)
      : [];
  return [...stem, ...branch];
}
