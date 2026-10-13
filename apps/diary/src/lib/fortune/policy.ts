// 운세 생성 비용·캐시 정책. 순수 함수라 server-only 없이 테스트에서 바로 부른다 (index.ts가 쓴다).
import type { FortuneContent } from "./types";

// ---- 비용 상한 (전체검토 2026-10-14 B-H1) ----
/** 같은 날 프로필을 고쳐 다시 만들 수 있는 횟수. 넘으면 모델 없이 템플릿만 쓴다 (생년월일을 몇 번 고치는 정상 사용은 충분히 들어간다) */
export const REGEN_LIMIT = 5;
/** 하루 전체 모델 호출 행 수 상한. 환경변수 FORTUNE_DAILY_CAP로 바꾼다. 넘으면 그날 남은 요청은 템플릿 */
export const dailyCap = (): number => {
  const n = Number(process.env.FORTUNE_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 2000;
};

/** 캐시 행의 content에서 재생성 횟수를 읽는다. 옛 캐시엔 없으니 0 */
export function regenCountOf(cached: { content: unknown } | null): number {
  const c = cached?.content as { regen?: unknown } | null | undefined;
  return typeof c?.regen === "number" && c.regen >= 0 ? c.regen : 0;
}

/** 지문이 바뀐 재계산이면 다음 regen 값과 모델 사용 여부. 첫 계산(cached 없음)은 regen 0 */
export function regenPolicy(cached: { content: unknown } | null): { regen: number; useModel: boolean } {
  if (!cached) return { regen: 0, useModel: true };
  const regen = regenCountOf(cached) + 1;
  return { regen, useModel: regen <= REGEN_LIMIT };
}

/**
 * API 일시 장애(429·5xx·타임아웃)로 떨어진 템플릿을 다시 시도하기까지의 시간. (A-3)
 * 아예 캐시하지 않으면 장애 중 화면을 열 때마다 모델을 다시 불러 비용이 샌다(2026-10-14 실측) — 그래서 짧게 캐시하고 이 시간 뒤에 다시 만든다
 */
export const TRANSIENT_RETRY_MS = 10 * 60 * 1000;

/** 장애 템플릿에 붙일 재시도 시각 */
export const retryAfterFor = (now = Date.now()): string => new Date(now + TRANSIENT_RETRY_MS).toISOString();

/**
 * 캐시 행의 내용을 그대로 써도 되는가. 정상 결과·검사 탈락 템플릿 = 그날 내내 쓴다.
 * API 장애 템플릿(transient) = retryAfter가 지나기 전에만 쓴다. 지났으면 null → 다시 만든다
 */
export function usableCachedContent(content: unknown, now = Date.now()): FortuneContent | null {
  if (!content || typeof content !== "object") return null;
  const c = content as FortuneContent & { retryAfter?: unknown };
  if (c.transient === "api") {
    const t = typeof c.retryAfter === "string" ? Date.parse(c.retryAfter) : NaN;
    if (!Number.isFinite(t) || t <= now) return null;
  }
  return c;
}
