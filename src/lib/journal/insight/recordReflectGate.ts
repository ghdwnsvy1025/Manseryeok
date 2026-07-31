/**
 * 기록 반영 게이트 — 운세·질문·명언 공통
 *
 * XP 비중만 쓰면 일기 며칠 안 써도 "내 기록 70%"처럼 보일 수 있어,
 * 유일 기록 일수로 기록 비중 상한을 건다.
 *
 * 기준 (제품):
 * - 0~6일: 시동 (기록 상한 15%)
 * - 7~13일: 첫 체감 (35%)
 * - 14~27일: 안정 반영 (55%)
 * - 28+일: XP 곡선 그대로 (상한 없음)
 *
 * 천간/지지/간지 통계 문장 해금:
 * - <14: 끔
 * - 14~27: 천간·지지 힌트
 * - 28~59: 천간·지지 적용 + 간지 힌트
 * - 60+: 간지까지 적용 (개별 표본 5+/8+는 통계 모듈이 별도 판정)
 */
import {
  computeBlendWeights,
  type BlendWeights,
  type DataMaturityTier,
} from "./dynamicWeights";

export const RECORD_REFLECT_GATE_VERSION = "record-reflect-gate-v1.0.0";

export type RecordDayPhase =
  | "boot" // 0~6
  | "first_feel" // 7~13
  | "stable" // 14~27
  | "personal"; // 28+

export type PillarStatMode = "off" | "hint" | "apply";

export type PillarInfluence = {
  stem: PillarStatMode;
  branch: PillarStatMode;
  ganji: PillarStatMode;
  /** 통계 문장에 써도 되는 최소 전체 일수 안내 */
  guideKo: string;
};

export type GatedBlend = BlendWeights & {
  /** 일수 게이트 적용 전 XP 비중 */
  ungated: { recent: number; keyword: number; natal: number };
  dayPhase: RecordDayPhase;
  dayPhaseLabel: string;
  priorUniqueDays: number;
  /** 기록(recent+keyword) 상한 0~1 */
  journalShareCap: number;
  /** 게이트 적용 후 기록 비중 */
  journalShare: number;
  /** 게이트 적용 후 사주 비중 */
  sajuShare: number;
  pillarInfluence: PillarInfluence;
  guideKo: string;
  gateVersion: string;
};

const PHASE_LABEL: Record<RecordDayPhase, string> = {
  boot: "시동",
  first_feel: "첫 체감",
  stable: "안정 반영",
  personal: "개인화",
};

export function recordDayPhase(priorUniqueDays: number): RecordDayPhase {
  const d = Math.max(0, Math.floor(priorUniqueDays || 0));
  if (d < 7) return "boot";
  if (d < 14) return "first_feel";
  if (d < 28) return "stable";
  return "personal";
}

/** 기록(recent+keyword) 비중 상한 */
export function journalShareCapForDays(priorUniqueDays: number): number {
  const phase = recordDayPhase(priorUniqueDays);
  if (phase === "boot") return 0.15;
  if (phase === "first_feel") return 0.35;
  if (phase === "stable") return 0.55;
  return 1;
}

export function pillarInfluenceFromDays(priorUniqueDays: number): PillarInfluence {
  const d = Math.max(0, Math.floor(priorUniqueDays || 0));
  if (d < 14) {
    return {
      stem: "off",
      branch: "off",
      ganji: "off",
      guideKo:
        "기록이 14일 미만이라 천간·지지·간지 통계는 아직 쓰지 마세요. 원국×오늘 일진만.",
    };
  }
  if (d < 28) {
    return {
      stem: "hint",
      branch: "hint",
      ganji: "off",
      guideKo:
        "천간·지지는 약한 힌트만. 특정 간지 통계는 아직 주장하지 마세요.",
    };
  }
  if (d < 60) {
    return {
      stem: "apply",
      branch: "apply",
      ganji: "hint",
      guideKo:
        "천간·지지는 반영 가능. 간지는 힌트만(같은 간지 반복이 분명할 때).",
    };
  }
  return {
    stem: "apply",
    branch: "apply",
    ganji: "apply",
    guideKo:
      "천간·지지·간지 패턴을 반영할 수 있습니다. 표본이 적은 글자는 단정하지 마세요.",
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * XP 비중에 일수 상한을 씌운다.
 * recent:keyword 비율은 유지한 채 journal 합을 cap으로 줄이고 natal을 채운다.
 */
export function applyRecordDayGate(
  w: BlendWeights,
  priorUniqueDays: number
): GatedBlend {
  const days = Math.max(0, Math.floor(priorUniqueDays || 0));
  const phase = recordDayPhase(days);
  const cap = journalShareCapForDays(days);
  const pillarInfluence = pillarInfluenceFromDays(days);

  const ungated = {
    recent: w.recent,
    keyword: w.keyword,
    natal: w.natal,
  };

  let recent = w.recent;
  let keyword = w.keyword;
  let natal = w.natal;
  const journal = recent + keyword;

  if (journal > cap && journal > 0) {
    const scale = cap / journal;
    recent = round3(recent * scale);
    keyword = round3(keyword * scale);
    natal = round3(1 - recent - keyword);
  }

  const journalShare = round3(recent + keyword);
  const sajuShare = round3(natal);
  const journalPct = Math.round(journalShare * 100);
  const sajuPct = Math.round(sajuShare * 100);

  const guideKo = `기록 ${days}일 · ${PHASE_LABEL[phase]} · 반영 목표 기록 약 ${journalPct}% / 사주 약 ${sajuPct}% (상한 ${Math.round(cap * 100)}%). ${pillarInfluence.guideKo}`;

  return {
    ...w,
    recent,
    keyword,
    natal,
    ungated,
    dayPhase: phase,
    dayPhaseLabel: PHASE_LABEL[phase],
    priorUniqueDays: days,
    journalShareCap: cap,
    journalShare,
    sajuShare,
    pillarInfluence,
    guideKo,
    gateVersion: RECORD_REFLECT_GATE_VERSION,
    version: `${w.version}+${RECORD_REFLECT_GATE_VERSION}`,
  };
}

export function resolveGatedBlend(opts: {
  totalXp: number;
  onboardingCompleted?: boolean;
  priorUniqueDays: number;
  weights?: BlendWeights;
}): GatedBlend {
  const base =
    opts.weights ??
    computeBlendWeights({
      totalXp: opts.totalXp,
      onboardingCompleted: opts.onboardingCompleted,
    });
  return applyRecordDayGate(base, opts.priorUniqueDays);
}

/**
 * 질문 키워드용 사주 가설 가중치 (1=사주 강함 → 0.2=약함)
 * 일수 게이트와 같은 구간을 씀.
 */
export function sajuHypothesisWeightFromDays(priorUniqueDays: number): number {
  const phase = recordDayPhase(priorUniqueDays);
  if (phase === "boot") return 0.92;
  if (phase === "first_feel") return 0.7;
  if (phase === "stable") return 0.45;
  const d = Math.max(0, Math.floor(priorUniqueDays || 0));
  if (d >= 60) return 0.2;
  // 28~59: 0.45 → 0.2
  return round3(0.45 - ((d - 28) / 32) * 0.25);
}

export function mixRatioPayload(gated: GatedBlend) {
  return {
    todayGanjiAndNatal: gated.sajuShare,
    journalRecords: gated.journalShare,
    recent: gated.recent,
    keyword: gated.keyword,
    natal: gated.natal,
    maturity: gated.maturity,
    tier: gated.tier as DataMaturityTier,
    dayPhase: gated.dayPhase,
    dayPhaseLabel: gated.dayPhaseLabel,
    priorUniqueDays: gated.priorUniqueDays,
    journalShareCap: gated.journalShareCap,
    pillarInfluence: gated.pillarInfluence,
    guideKo: gated.guideKo,
    ungatedJournalShare: round3(
      gated.ungated.recent + gated.ungated.keyword
    ),
  };
}
