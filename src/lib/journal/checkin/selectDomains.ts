import {
  DOMAIN_POOL_CODES,
  MAX_DAILY_DOMAINS,
  TAG_DOMAIN_HINTS,
  type DomainCode,
} from "./catalog";

/**
 * 태그 힌트 → 조건부 생활영역 최대 2개.
 * 힌트가 부족하면 풀에서 앞쪽부터 채움 (결정적).
 */
export function selectDailyDomains(tagCodes: string[]): DomainCode[] {
  const ranked: DomainCode[] = [];
  const seen = new Set<DomainCode>();

  for (const tag of tagCodes) {
    const hints = TAG_DOMAIN_HINTS[tag] ?? [];
    for (const d of hints) {
      if (seen.has(d)) continue;
      seen.add(d);
      ranked.push(d);
      if (ranked.length >= MAX_DAILY_DOMAINS) return ranked;
    }
  }

  for (const d of DOMAIN_POOL_CODES) {
    if (seen.has(d)) continue;
    ranked.push(d);
    if (ranked.length >= MAX_DAILY_DOMAINS) break;
  }

  return ranked.slice(0, MAX_DAILY_DOMAINS);
}
