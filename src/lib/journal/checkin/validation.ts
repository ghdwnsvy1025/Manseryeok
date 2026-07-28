import { MOOD_OPTIONS } from "@/lib/journal/types";
import { isHappinessScore } from "@/lib/journal/happinessScale";
import { isKnownTagCode } from "@/lib/journal/eventTagCatalog";
import {
  CORE_STATE_CODES,
  DOMAIN_POOL_CODES,
  MAX_CHECKIN_TAGS,
  MAX_MOODS,
  NONE_SPECIAL_TAG,
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
  if (
    input.tagCodes.includes(NONE_SPECIAL_TAG) &&
    input.tagCodes.length > 1
  ) {
    return {
      ok: false,
      error: "「특별한 일 없음」은 다른 사건과 함께 고를 수 없어요.",
    };
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
    // 핵심 상태는 매일 기본 컨디션이라 「해당 없음」을 허용하지 않는다.
    if (row.isNotApplicable) {
      return { ok: false, error: "핵심 상태는 1~5 중 하나로 골라주세요." };
    }
    if (!isOrdinalScore(row.ordinal)) {
      return { ok: false, error: "핵심 상태를 모두 입력해주세요." };
    }
  }

  // 추천 2개 외에 「다른 영역도 펼치기」로 전체 풀까지 노출·응답할 수 있으므로
  // 저장 상한은 풀 크기(중복 없는 전체 영역 수)로 둔다.
  if (input.domains.length > DOMAIN_POOL_CODES.length) {
    return {
      ok: false,
      error: `생활영역이 너무 많아요(최대 ${DOMAIN_POOL_CODES.length}개).`,
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
    // 생활영역도 「해당 없음」 없음 — 안 쓰면 비워 두면 됨(선택 입력)
    if (d.isNotApplicable) {
      return {
        ok: false,
        error: "생활영역은 1~5 중 고르거나 비워 두세요.",
      };
    }
    // 노출만 하고 미입력은 NULL 허용
    if (d.ordinal == null) {
      continue;
    }
    if (!isOrdinalScore(d.ordinal)) {
      return { ok: false, error: "열린 생활영역 점수를 입력해주세요." };
    }
  }

  return { ok: true };
}

