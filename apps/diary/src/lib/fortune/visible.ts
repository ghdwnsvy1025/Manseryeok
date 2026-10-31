// 화면에 담을 영역 줄 고르기 (v4.5). 서버 전용 모듈(index.ts)과 분리해 테스트에서도 쓴다.
import { areaLineOf } from "./text";
import type { AreaName, AreaPeriod, AreaSignal, FortuneContent } from "./types";

/**
 * v4.5 (2026-10-10 사용자 결정): 올해 영역 줄은 그 운이 바뀌거나 오늘과 어긋나 글 재료(facts)에 그 운 문장이 들어간 날에만 보여 준다.
 * 매일 같은 줄이 붙어 오늘 글이 흐려지던 것.
 * v4.15 (2026-10-23): 이달 줄은 매일 보인다.
 * v4.16~4.18: 모델이 고른 0~3개만 보였다(all). v4.19부터는 모델이 줄을 고르지 않는다 — 신호는 코어 것 전부(composeAreas), 이 규칙만 적용한다.
 */
export function visibleAreas<T extends { period?: string }>(areas: T[], facts: readonly string[], opts: { all?: boolean } = {}): T[] {
  if (opts.all) return areas;
  const year = facts.some((f) => f.startsWith("올해 운"));
  return areas.filter((a) => (a.period ?? "오늘") === "오늘" || a.period === "이달" || (a.period === "올해" && year));
}

type AreaRow = { period: AreaPeriod; area: AreaName; signal: AreaSignal; line: string };

/**
 * v4.19: 화면 영역 줄 = 코어 신호(전부, 모델이 지울 수 없음) × 문장. 문장은 계획이 고른 영역(최대 2)이면 모델 것, 아니면 템플릿 줄.
 * 올해 줄은 v4.5 규칙(그 운 문장이 facts에 있는 날만). 같은 영역·신호가 두 번이면 둘째 템플릿 변형.
 */
export function composeAreas(
  signals: readonly { period: AreaPeriod; area: AreaName; signal: AreaSignal }[],
  narratives: readonly { period: AreaPeriod; area: AreaName; text: string }[],
  facts: readonly string[],
): AreaRow[] {
  const seen = new Map<string, number>();
  return visibleAreas([...signals], facts).map((s) => {
    const key = `${s.area}${s.signal}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const own = narratives.find((x) => x.area === s.area && x.period === s.period);
    return { period: s.period, area: s.area, signal: s.signal, line: own?.text ?? areaLineOf(s.area, s.signal, n) };
  });
}

/** v4.19 읽기: 새 캐시는 areaSignals + areaNarratives로, 옛 캐시는 저장된 areas 그대로 */
export function areasOf(c: Pick<FortuneContent, "areas" | "areaSignals" | "areaNarratives" | "core">): AreaRow[] {
  if (c.areaSignals) return composeAreas(c.areaSignals, c.areaNarratives ?? [], c.core?.facts ?? []);
  return (c.areas ?? []).map((a) => ({ ...a, period: a.period ?? "오늘" }));
}
