/**
 * 최근 일주일 주 카테고리·핵심 포인트를 질문 생성용으로 요약
 */
import { getCategoryByCode } from "./categoryCatalog";
import {
  isHighJournalScore,
  isLowJournalScore,
  scoreBandLabel,
} from "./scoreScale";
import type { CategoryCode } from "./types";
import type { ContentScoreBundle } from "./contentD";

export type WeekThemeCategory = {
  code: CategoryCode;
  name: string;
  score: number;
  band: string;
};

export type WeekThemeSummary = {
  mainCategories: WeekThemeCategory[];
  keyPoints: string[];
  plainLine: string;
};

function rankByDistanceFromCenter(
  codes: CategoryCode[],
  scores: Partial<Record<CategoryCode, number | null>>
): WeekThemeCategory[] {
  const rows: WeekThemeCategory[] = [];
  for (const code of codes) {
    const score = scores[code];
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    rows.push({
      code,
      name: getCategoryByCode(code)?.name ?? code,
      score,
      band: scoreBandLabel(score),
    });
  }
  rows.sort(
    (a, b) => Math.abs(b.score - 5.5) - Math.abs(a.score - 5.5) || a.score - b.score
  );
  return rows;
}

export function buildWeekThemeSummary(opts: {
  enabledCodes: CategoryCode[];
  bundle: ContentScoreBundle;
  topKeywords?: string[];
}): WeekThemeSummary {
  const scored = opts.enabledCodes.reduce(
    (acc, code) => {
      acc[code] =
        opts.bundle.contentScoreByCategory[code]?.value ??
        opts.bundle.recentAByCategory[code] ??
        null;
      return acc;
    },
    {} as Partial<Record<CategoryCode, number | null>>
  );

  const ranked = rankByDistanceFromCenter(opts.enabledCodes, scored);
  const mainCategories = ranked.slice(0, 3);

  const keyPoints: string[] = [];
  for (const row of mainCategories) {
    if (isLowJournalScore(row.score)) {
      keyPoints.push(`「${row.name}」이 한동안 ${row.band} 쪽으로 기울었어요`);
    } else if (isHighJournalScore(row.score)) {
      keyPoints.push(`「${row.name}」에서 비교적 ${row.band} 기운이 보였어요`);
    } else {
      keyPoints.push(`「${row.name}」은 ${row.band}으로 오르락내리락했어요`);
    }
  }

  const kws = (opts.topKeywords ?? []).filter(Boolean).slice(0, 2);
  if (kws.length > 0) {
    keyPoints.push(`마음에 자주 닿은 말: ${kws.join("·")}`);
  }

  if (mainCategories.length === 0) {
    keyPoints.push("최근 기록이 아직 적어, 오늘 하루의 결을 천천히 들여다보면 좋아요");
  }

  const names = mainCategories.map((c) => c.name);
  const plainLine =
    names.length === 0
      ? "최근 한 주의 기록이 아직 쌓이는 중이에요"
      : names.length === 1
        ? `최근 한 주의 주된 결은 「${names[0]}」이에요`
        : `최근 한 주는 「${names.slice(0, 2).join("·")}」가 마음에 더 많이 남았어요`;

  return { mainCategories, keyPoints: keyPoints.slice(0, 4), plainLine };
}

/** 질문 생성에 넘길 오늘의 운세 스냅샷 (글자 포함) */
export type FortuneQuestionContext = {
  flow?: string | null;
  score?: number | null;
  headline?: string | null;
  body?: string | null;
  action?: string | null;
  caution?: string | null;
  signatureEcho?: string | null;
};

export function sanitizeFortuneQuestionContext(
  raw: unknown
): FortuneQuestionContext | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pick = (k: string) =>
    typeof o[k] === "string" && (o[k] as string).trim()
      ? (o[k] as string).trim().slice(0, 400)
      : null;
  const score =
    typeof o.score === "number" && Number.isFinite(o.score) ? o.score : null;
  const ctx: FortuneQuestionContext = {
    flow: pick("flow"),
    score,
    headline: pick("headline"),
    body: pick("body"),
    action: pick("action"),
    caution: pick("caution"),
    signatureEcho: pick("signatureEcho"),
  };
  if (!ctx.flow && !ctx.headline && !ctx.body && !ctx.signatureEcho) return null;
  return ctx;
}
