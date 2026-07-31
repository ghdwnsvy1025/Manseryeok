/**
 * 오늘의 상태 — 구조화된 요약 (긴 문장 대신 역할별 조각)
 */
import type { HomeEStats } from "@/lib/journal/homeStats";

export type StatusFocus = {
  label: string;
  value: string;
  score: number | null;
};

export type RecentStatusPayload = {
  /** 한 줄 요약 (크게 표시) */
  headline: string;
  /** 핵심 Best */
  coreGood: StatusFocus | null;
  /** 핵심 Worst */
  coreWatch: StatusFocus | null;
  /** 선택 Best */
  domainGood: StatusFocus | null;
  /** 선택 Worst */
  domainWatch: StatusFocus | null;
  /** @deprecated coreGood — LLM/구 UI 호환 */
  good: StatusFocus | null;
  /** @deprecated coreWatch — LLM/구 UI 호환 */
  watch: StatusFocus | null;
  /** 짧은 조언 한 문장 */
  advice: string;
  /** 하위 호환: 문장형 합본 */
  message: string;
};

export type HappinessBand = {
  label: "아주 좋음" | "좋음" | "보통" | "살짝 지침" | "많이 지침";
  emoji: string;
  description: string;
  color: string;
};

/** 최근 행복도 숫자를 사용자가 바로 이해할 수 있는 단계로 바꾼다. */
export function describeRecentHappiness(score: number): HappinessBand {
  if (score >= 8) {
    return {
      label: "아주 좋음",
      emoji: "😄",
      description: "최근 만족도가 높은 편이에요.",
      color: "#4ade80",
    };
  }
  if (score >= 6.5) {
    return {
      label: "좋음",
      emoji: "🙂",
      description: "최근 만족도가 중간보다 높아요.",
      color: "#60a5fa",
    };
  }
  if (score >= 5) {
    return {
      label: "보통",
      emoji: "😐",
      description: "최근 만족도가 중간 정도예요.",
      color: "var(--px-accent)",
    };
  }
  if (score >= 3.5) {
    return {
      label: "살짝 지침",
      emoji: "😕",
      description: "최근 만족도가 중간보다 낮아요.",
      color: "#fbbf24",
    };
  }
  return {
    label: "많이 지침",
    emoji: "😣",
    description: "최근 만족도가 낮은 편이에요.",
    color: "#f87171",
  };
}

export const STATUS_FOCUS_EMOJI = {
  good: "👍",
  watch: "⚠️",
} as const;

function clampText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function focusFrom(
  label: string,
  row: { name: string; average: number } | null | undefined
): StatusFocus | null {
  if (!row) return null;
  return {
    label,
    value: row.name,
    score: row.average,
  };
}

export function composeStatusMessage(
  p: Omit<RecentStatusPayload, "message" | "good" | "watch">
): string {
  const bits = [p.headline];
  if (p.coreGood) bits.push(`${p.coreGood.label} ${p.coreGood.value}`);
  if (p.coreWatch) bits.push(`${p.coreWatch.label} ${p.coreWatch.value}`);
  if (p.domainGood) bits.push(`${p.domainGood.label} ${p.domainGood.value}`);
  if (p.domainWatch) bits.push(`${p.domainWatch.label} ${p.domainWatch.value}`);
  if (p.advice) bits.push(p.advice);
  return bits.join(". ");
}

function withCompat(
  base: Omit<RecentStatusPayload, "message" | "good" | "watch">
): RecentStatusPayload {
  return {
    ...base,
    good: base.coreGood,
    watch: base.coreWatch,
    message: composeStatusMessage(base),
  };
}

/** OpenAI/템플릿 공통 폴백 — stats만으로 구조 생성 */
export function buildTemplateRecentStatus(stats: HomeEStats): RecentStatusPayload {
  const coreGood = focusFrom("기본", stats.coreBest ?? stats.best);
  const coreWatch = focusFrom("기본", stats.coreWorst ?? stats.worst);
  const domainGood = focusFrom("생활", stats.domainBest);
  const domainWatch = focusFrom("생활", stats.domainWorst);

  let headline: string;
  let advice: string;

  if (
    stats.avg7 == null &&
    !coreGood &&
    !coreWatch &&
    !domainGood &&
    !domainWatch
  ) {
    headline = "아직 기록이 적어요";
    advice = "오늘 한 줄만 남겨도 흐름이 선명해져요.";
  } else if (stats.avg7 != null) {
    const band = describeRecentHappiness(stats.avg7);
    headline = `최근 행복도는 '${band.label}' 수준이에요 · ${stats.avg7}/10`;
    advice = pickTemplateAdvice({
      avg7: stats.avg7,
      coreWatch: coreWatch?.value ?? null,
      domainWatch: domainWatch?.value ?? null,
      coreGood: coreGood?.value ?? null,
      uniqueDays: stats.uniqueDays,
    });
  } else {
    headline = "기록이 쌓이는 중이에요";
    advice = "며칠만 더 남기면 패턴이 또렷해집니다.";
  }

  return withCompat({
    headline,
    coreGood,
    coreWatch,
    domainGood,
    domainWatch,
    advice,
  });
}

/** 행복도 구간 + 약한 영역에 맞춰 조언이 달라지게 */
export function pickTemplateAdvice(input: {
  avg7: number;
  coreWatch: string | null;
  domainWatch: string | null;
  coreGood: string | null;
  uniqueDays: number;
}): string {
  const watch = input.domainWatch ?? input.coreWatch;
  const good = input.coreGood;

  if (watch) {
    if (input.avg7 < 5) {
      return `${watch} 쪽을 조금 덜어내고, 오늘은 할 일을 하나만 골라 보세요.`;
    }
    if (input.avg7 >= 6.5) {
      return `좋은 흐름을 지키되, ${watch}만 살짝 점검해 두면 균형이 더 좋아요어요.`;
    }
    return `${watch}에 5분만 더 관심을 주면 오늘이 한결 편해질 거예요.`;
  }

  if (good && input.avg7 >= 6.5) {
    return `${good}의 좋은 리듬을 무리 없이 이어가 보세요.`;
  }

  if (input.uniqueDays < 5) {
    return "기록이 조금만 더 쌓이면 조언도 더 구체적으로 바뀌어요.";
  }

  if (input.avg7 >= 6.5) {
    return "무리하지 않는 선에서 지금의 좋은 습관을 이어가 보세요.";
  }
  if (input.avg7 < 5) {
    return "오늘은 해야 할 일을 하나만 고르고 나머지는 미뤄도 됩니다.";
  }
  return "작은 루틴 하나만 지키면 균형이 잡히기 쉬워요.";
}

type LooseFocus = {
  label?: unknown;
  value?: unknown;
  score?: unknown;
};

function parseFocus(
  raw: unknown,
  fallback: StatusFocus | null
): StatusFocus | null {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as LooseFocus;
  const value = typeof o.value === "string" ? o.value.trim() : "";
  if (!value) return fallback;
  const label =
    typeof o.label === "string" && o.label.trim()
      ? o.label.trim()
      : fallback?.label ?? "항목";
  const score =
    typeof o.score === "number" && Number.isFinite(o.score)
      ? Math.round(o.score * 10) / 10
      : fallback?.score ?? null;
  return { label: clampText(label, 14), value: clampText(value, 16), score };
}

/** LLM JSON + 템플릿을 안전하게 합친다 */
export function normalizeRecentStatus(
  raw: unknown,
  fallback: RecentStatusPayload
): RecentStatusPayload {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;

  const headline =
    typeof o.headline === "string" && o.headline.trim()
      ? clampText(o.headline, 48)
      : fallback.headline;
  const advice =
    typeof o.advice === "string" && o.advice.trim()
      ? clampText(o.advice, 80)
      : fallback.advice;

  const coreGood = parseFocus(
    o.coreGood ?? o.good,
    fallback.coreGood ?? fallback.good
  );
  const coreWatch = parseFocus(
    o.coreWatch ?? o.watch,
    fallback.coreWatch ?? fallback.watch
  );
  const domainGood = parseFocus(o.domainGood, fallback.domainGood);
  const domainWatch = parseFocus(o.domainWatch, fallback.domainWatch);

  // 구형 message만 온 경우
  if (
    !o.headline &&
    typeof o.message === "string" &&
    o.message.trim() &&
    !o.advice
  ) {
    const msg = clampText(o.message, 280);
    const firstSentence = msg.split(/[.!?。]/)[0]?.trim() || msg;
    return withCompat({
      headline: clampText(firstSentence, 48),
      coreGood: fallback.coreGood,
      coreWatch: fallback.coreWatch,
      domainGood: fallback.domainGood,
      domainWatch: fallback.domainWatch,
      advice: fallback.advice,
    });
  }

  return withCompat({
    headline,
    coreGood,
    coreWatch,
    domainGood,
    domainWatch,
    advice,
  });
}
