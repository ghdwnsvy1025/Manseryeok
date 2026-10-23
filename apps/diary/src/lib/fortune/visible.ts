// 화면에 담을 영역 줄 고르기 (v4.5). 서버 전용 모듈(index.ts)과 분리해 테스트에서도 쓴다.
/**
 * v4.5 (2026-10-10 사용자 결정): 올해 영역 줄은 그 운이 바뀌거나 오늘과 어긋나 글 재료(facts)에 그 운 문장이 들어간 날에만 보여 준다.
 * 매일 같은 줄이 붙어 오늘 글이 흐려지던 것. brief·모델 출력은 그대로 두고 화면에 담을 때만 거른다.
 * v4.15 (2026-10-23): 이달 줄은 매일 보인다 — v4.13의 "이달 한 줄을 매일"(사용자 결정 2026-10-15)이 본문에서 영역 줄로 옮겨 왔다.
 */
export function visibleAreas<T extends { period?: string }>(areas: T[], facts: readonly string[], opts: { all?: boolean } = {}): T[] {
  // v4.16: 모델이 오늘 핵심에 맞는 0~3개만 골라 썼으면(all) 그대로 보인다 — 이달·올해는 모델이 골랐을 때만. 템플릿은 옛 규칙
  if (opts.all) return areas;
  const year = facts.some((f) => f.startsWith("올해 운"));
  return areas.filter((a) => (a.period ?? "오늘") === "오늘" || a.period === "이달" || (a.period === "올해" && year));
}
