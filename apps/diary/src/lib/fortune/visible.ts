// 화면에 담을 영역 줄 고르기 (v4.5). 서버 전용 모듈(index.ts)과 분리해 테스트에서도 쓴다.
/**
 * v4.5 (2026-10-10 사용자 결정): 이달·올해 영역 줄은 그 운이 바뀌거나 오늘과 어긋나 글 재료(facts)에 그 운 문장이 들어간 날에만 보여 준다.
 * 매일 같은 줄이 붙어 오늘 글이 흐려지던 것. brief·모델 출력은 그대로 두고 화면에 담을 때만 거른다.
 */
export function visibleAreas<T extends { period?: string }>(areas: T[], facts: readonly string[]): T[] {
  const month = facts.some((f) => f.startsWith("이달 운"));
  const year = facts.some((f) => f.startsWith("올해 운"));
  return areas.filter((a) => (a.period ?? "오늘") === "오늘" || (a.period === "이달" && month) || (a.period === "올해" && year));
}
