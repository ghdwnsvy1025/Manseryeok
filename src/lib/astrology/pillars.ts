import { BRANCHES_KO, BRANCH_META, STEMS_KO, STEM_META } from "@/lib/saju/constants";
import type { SajuProfilePillars } from "@/lib/diary/types";

export function koToStemHanja(ko: string): string | null {
  for (const [hanja, meta] of Object.entries(STEM_META)) {
    if (meta.ko === ko) return hanja;
  }
  return null;
}

export function koToBranchHanja(ko: string): string | null {
  for (const [hanja, meta] of Object.entries(BRANCH_META)) {
    if (meta.ko === ko) return hanja;
  }
  return null;
}

export function stemHanjaToKo(hanja: string): string | null {
  return STEM_META[hanja]?.ko ?? null;
}

export function branchHanjaToKo(hanja: string): string | null {
  return BRANCH_META[hanja]?.ko ?? null;
}

/**
 * 자료 B 입력 순서: 시→일→월→년
 * hour 없으면 일·월·년만 (길이 3).
 */
export function pillarsToStemBranchStrings(pillars: SajuProfilePillars): {
  stems: string;
  branches: string;
} {
  const order = [pillars.hour ?? null, pillars.day, pillars.month, pillars.year];

  let stems = "";
  let branches = "";
  for (const p of order) {
    if (!p) continue;
    const stemKo = p.stemKo || stemHanjaToKo(p.stemHanja);
    const branchKo = p.branchKo || branchHanjaToKo(p.branchHanja);
    if (!stemKo || !branchKo) {
      throw new Error("원국 기둥에 천간/지지가 없습니다.");
    }
    stems += stemKo;
    branches += branchKo;
  }
  if (stems.length < 3) {
    throw new Error("원국은 최소 일·월·년 기둥이 필요합니다.");
  }
  return { stems, branches };
}

export function assertValidPillarChars(stems: string, branches: string): void {
  if (stems.length !== branches.length) {
    throw new Error("천간과 지지 길이가 일치해야 합니다.");
  }
  if (stems.length < 3 || stems.length > 4) {
    throw new Error("원국 기둥 수는 3 또는 4여야 합니다.");
  }
  for (const ch of stems) {
    if (!(STEMS_KO as readonly string[]).includes(ch)) {
      throw new Error(`잘못된 천간: ${ch}`);
    }
  }
  for (const ch of branches) {
    if (!(BRANCHES_KO as readonly string[]).includes(ch)) {
      throw new Error(`잘못된 지지: ${ch}`);
    }
  }
}

export function dayMasterFromStems(stems: string): string {
  return stems.length === 4 ? stems[1]! : stems[0]!;
}

export function dayBranchFromBranches(branches: string): string {
  return branches.length === 4 ? branches[1]! : branches[0]!;
}

export function monthBranchFromBranches(branches: string): string {
  return branches.length === 4 ? branches[2]! : branches[1]!;
}
