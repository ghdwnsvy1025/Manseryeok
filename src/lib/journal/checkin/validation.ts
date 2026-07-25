import { MOOD_OPTIONS } from "@/lib/journal/types";
import { isHappinessScore } from "@/lib/journal/happinessScale";
import { isKnownTagCode } from "@/lib/journal/eventTagCatalog";
import {
  CORE_STATE_CODES,
  MAX_CHECKIN_TAGS,
  MAX_DAILY_DOMAINS,
  MAX_MOODS,
  isDomainCode,
  isOrdinalScore,
  type CoreStateCode,
  type DomainCode,
  type OrdinalScore,
} from "./catalog";

export type CoreStateUi = {
  ordinal: OrdinalScore | null;
  isNotApplicable: boolean;
};

export type DomainStateUi = {
  code: DomainCode;
  ordinal: OrdinalScore | null;
  isNotApplicable: boolean;
};

export function validateCheckInSave(input: {
  happiness: unknown;
  moods: string[];
  tagCodes: string[];
  core: Record<CoreStateCode, CoreStateUi>;
  domains: DomainStateUi[];
}): { ok: true } | { ok: false; error: string } {
  if (!isHappinessScore(input.happiness)) {
    return { ok: false, error: "행복도를 0~10 중에서 골라주세요." };
  }

  if (input.moods.length > MAX_MOODS) {
    return { ok: false, error: `기분은 최대 ${MAX_MOODS}개까지 고를 수 있어요.` };
  }
  if (new Set(input.moods).size !== input.moods.length) {
    return { ok: false, error: "기분이 중복됐어요." };
  }
  const moodSet = new Set<string>(MOOD_OPTIONS);
  for (const m of input.moods) {
    if (!moodSet.has(m)) {
      return { ok: false, error: `알 수 없는 기분: ${m}` };
    }
  }

  if (input.tagCodes.length > MAX_CHECKIN_TAGS) {
    return {
      ok: false,
      error: `사건 태그는 최대 ${MAX_CHECKIN_TAGS}개까지예요.`,
    };
  }
  if (new Set(input.tagCodes).size !== input.tagCodes.length) {
    return { ok: false, error: "태그가 중복됐어요." };
  }
  for (const t of input.tagCodes) {
    if (!isKnownTagCode(t)) {
      return { ok: false, error: `알 수 없는 태그: ${t}` };
    }
  }

  for (const code of CORE_STATE_CODES) {
    const row = input.core[code];
    if (!row) {
      return { ok: false, error: "핵심 상태를 모두 입력해주세요." };
    }
    if (row.isNotApplicable) {
      if (row.ordinal != null) {
        return { ok: false, error: "해당 없음은 점수와 함께 저장할 수 없습니다." };
      }
      continue;
    }
    if (!isOrdinalScore(row.ordinal)) {
      return { ok: false, error: "핵심 상태를 모두 입력해주세요." };
    }
  }

  if (input.domains.length > MAX_DAILY_DOMAINS) {
    return {
      ok: false,
      error: `생활영역은 하루 최대 ${MAX_DAILY_DOMAINS}개예요.`,
    };
  }
  const domainCodes = input.domains.map((d) => d.code);
  if (new Set(domainCodes).size !== domainCodes.length) {
    return { ok: false, error: "생활영역이 중복됐어요." };
  }
  for (const d of input.domains) {
    if (!isDomainCode(d.code)) {
      return { ok: false, error: `알 수 없는 생활영역: ${d.code}` };
    }
    if (d.isNotApplicable) {
      if (d.ordinal != null) {
        return { ok: false, error: "해당 없음은 점수와 함께 저장할 수 없습니다." };
      }
      continue;
    }
    if (!isOrdinalScore(d.ordinal)) {
      return { ok: false, error: "열린 생활영역 점수를 입력해주세요." };
    }
  }

  return { ok: true };
}
