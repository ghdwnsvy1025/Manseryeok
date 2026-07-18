/** P1 추천 감정 태그 */
export const RECOMMENDED_EMOTION_TAGS = [
  "행복",
  "편안",
  "설렘",
  "만족",
  "평범",
  "피곤",
  "불안",
  "우울",
  "화남",
  "외로움",
] as const;

/** P1 추천 사건 태그 */
export const RECOMMENDED_EVENT_TAGS = [
  "연애",
  "친구",
  "가족",
  "직장",
  "공부",
  "돈",
  "건강",
  "운동",
  "여행",
  "휴식",
  "술자리",
  "수면 부족",
] as const;

export type RecommendedEmotionTag = (typeof RECOMMENDED_EMOTION_TAGS)[number];
export type RecommendedEventTag = (typeof RECOMMENDED_EVENT_TAGS)[number];

export function normalizeTagList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 40);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= max) break;
  }
  return result;
}
