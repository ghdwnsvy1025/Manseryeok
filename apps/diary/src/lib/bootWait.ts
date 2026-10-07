/**
 * 첫 방문 대기(B2): 세션이 없는 동안은 화면 뼈대만 보이고, BOOT_WAIT_MS가 지나도 세션이 안 생기면
 * "준비하고 있어요 · 다시 시도" 카드로 바뀐다. AnonBoot가 세션을 만들고 refresh하면 어차피 사라진다.
 * useSyncExternalStore에 꽂는 작은 저장소 — 타이머 하나, 만료되면 true.
 */
export const BOOT_WAIT_MS = 5000;

export interface BootWait {
  subscribe: (onChange: () => void) => () => void;
  /** 기다림이 끝났는지 (true면 안내 카드) */
  getSnapshot: () => boolean;
  /** 서버·하이드레이션 첫 그림은 늘 뼈대 */
  getServerSnapshot: () => false;
}

export function createBootWait(ms: number = BOOT_WAIT_MS): BootWait {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(onChange) {
      listeners.add(onChange);
      // 구독자가 하나라도 붙은 순간부터 잰다 — 마운트 시점 기준
      if (!timer && !expired) {
        timer = setTimeout(() => {
          expired = true;
          timer = null;
          for (const l of listeners) l();
        }, ms);
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && timer) {
          clearTimeout(timer);
          timer = null;
        }
      };
    },
    getSnapshot: () => expired,
    getServerSnapshot: () => false,
  };
}
