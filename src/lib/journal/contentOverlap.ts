/**
 * 질문·운세·문장 의미 중복 방지 (간단 토큰 겹침)
 */
export function tokenizeKo(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = tokenizeKo(a);
  const B = tokenizeKo(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function isTooSimilar(
  candidate: string,
  others: string[],
  threshold = 0.55
): boolean {
  return others.some((o) => jaccardSimilarity(candidate, o) >= threshold);
}

export function pickLeastOverlapping(
  candidates: string[],
  others: string[]
): string | null {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = Math.max(
      0,
      ...others.map((o) => jaccardSimilarity(c, o))
    );
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
