/**
 * 명언 후보 안전 필터
 */
import {
  isQuoteExposable,
  type QuoteLibraryItem,
} from "./types";

const UNSAFE_THEME = [/자해/, /자살/, /죽음\s*미화/, /공포/, /저주/];

export function filterSafeQuotes(
  candidates: QuoteLibraryItem[],
  opts?: {
    hardDay?: boolean;
    moods?: string[];
    tags?: string[];
  }
): QuoteLibraryItem[] {
  const moods = opts?.moods ?? [];
  const tags = opts?.tags ?? [];
  const hard =
    opts?.hardDay ||
    moods.some((m) => ["슬픔", "지침", "불안"].includes(m)) ||
    tags.some((t) =>
      ["illness", "conflict", "mistake", "pain"].some((k) =>
        t.toLowerCase().includes(k)
      )
    );

  return candidates.filter((q) => {
    if (!isQuoteExposable(q)) return false;
    const blob = [
      q.quoteTextKo,
      ...q.themes,
      ...q.emotionalTone,
    ].join(" ");
    if (UNSAFE_THEME.some((re) => re.test(blob))) return false;
    if (
      q.unsuitableStates.some((s) =>
        [...moods, ...tags].some((m) => m.includes(s) || s.includes(m))
      )
    ) {
      return false;
    }
    if (hard) {
      // 힘든 날: 과도한 긍정·훈계 톤 제외
      if (
        /마음먹기에|잘될\s*거|시련은|긍정적으로/.test(q.quoteTextKo)
      ) {
        return false;
      }
    }
    return true;
  });
}
