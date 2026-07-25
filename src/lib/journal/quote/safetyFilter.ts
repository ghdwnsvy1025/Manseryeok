/**
 * 명언 후보 안전 필터
 */
import {
  isQuoteExposable,
  type QuoteLibraryItem,
} from "./types";

const UNSAFE_THEME = [/자해/, /자살/, /죽음\s*미화/, /공포/, /저주/];

export type QuoteSafetyInput = {
  hardDay: boolean;
  dominantStates?: string[];
  moods: string[];
  eventTags: string[];
};

export function deriveHardDay(opts: {
  moods?: string[];
  eventTags?: string[];
  happiness?: number | null;
  lowEnergyScore?: number | null;
}): boolean {
  const moods = opts.moods ?? [];
  const tags = opts.eventTags ?? [];
  if (moods.some((m) => ["슬픔", "지침", "불안", "분노", "답답함"].includes(m))) {
    return true;
  }
  if (
    tags.some((t) =>
      ["illness", "conflict", "mistake", "pain"].includes(t.toLowerCase())
    )
  ) {
    return true;
  }
  if (typeof opts.happiness === "number" && opts.happiness <= 2) return true;
  if (typeof opts.lowEnergyScore === "number" && opts.lowEnergyScore <= 3) {
    return true;
  }
  return false;
}

export function filterSafeQuotes(
  candidates: QuoteLibraryItem[],
  opts?: QuoteSafetyInput | {
    hardDay?: boolean;
    moods?: string[];
    tags?: string[];
  }
): QuoteLibraryItem[] {
  const moods = ("moods" in (opts ?? {}) ? opts?.moods : []) ?? [];
  const tags =
    ("eventTags" in (opts ?? {})
      ? (opts as QuoteSafetyInput).eventTags
      : (opts as { tags?: string[] } | undefined)?.tags) ?? [];
  const dominant =
    ("dominantStates" in (opts ?? {})
      ? (opts as QuoteSafetyInput).dominantStates
      : undefined) ?? [];
  const hardDay =
    typeof opts?.hardDay === "boolean"
      ? opts.hardDay
      : deriveHardDay({ moods, eventTags: tags });

  return candidates.filter((q) => {
    if (!isQuoteExposable(q)) return false;
    const blob = [
      q.quoteTextKo,
      ...q.themes,
      ...q.emotionalTone,
    ].join(" ");
    if (UNSAFE_THEME.some((re) => re.test(blob))) return false;

    // hard_day 부적합 상태 — 명시적 플래그와 연결
    if (
      hardDay &&
      q.unsuitableStates.some(
        (s) => s === "hard_day" || s.toLowerCase() === "hard_day"
      )
    ) {
      return false;
    }

    if (
      q.unsuitableStates.some((s) => {
        if (s === "hard_day") return false; // 위에서 처리
        return [...moods, ...tags, ...dominant].some(
          (m) => m.includes(s) || s.includes(m)
        );
      })
    ) {
      return false;
    }
    if (hardDay) {
      if (
        /마음먹기에|잘될\s*거|시련은|긍정적으로/.test(q.quoteTextKo)
      ) {
        return false;
      }
    }
    return true;
  });
}
