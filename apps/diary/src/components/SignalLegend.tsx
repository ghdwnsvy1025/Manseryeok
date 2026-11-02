"use client";

import { useEffect, useState } from "react";

const KEYS = { arrows: "signal-legend-seen", stamps: "area-grid-legend-seen" } as const;

/**
 * 오늘의 신호 상자 위 화살표 범례 — 첫 한 번만 (전수조사 C "화살표 범례 없음").
 * localStorage `signal-legend-seen`이 없을 때만 보이고, ×로 닫으면 다시 안 나온다. 저장소를 못 쓰면 그냥 보인다.
 * 색은 신호 상자와 같다 (↑ 금색 · ↓ 먹색 — 길흉을 색으로 말하지 않는다).
 * v3.37 (명세 33, 운세 v4.20): → 줄은 더 오지 않으므로 범례에서도 뺐다.
 */
/** kind="stamps" (명세 35, 운세 개편 Phase 2): 6영역 막대 범례 — 조심할 쪽 · 좋은 쪽 · 가운데 = 특별한 신호 없음. 따로 한 번 */
export function SignalLegend({ kind = "arrows" }: { kind?: keyof typeof KEYS }) {
  const KEY = KEYS[kind];
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, [KEY]);

  function close() {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // 저장소를 못 쓰면 이번만 닫힌다
    }
  }

  if (!show) return null;
  return (
    <p className={`-mt-1 mb-1 flex items-center justify-between gap-3 text-[14px] text-muted${kind === "stamps" ? " area-legend-row" : ""}`}>
      <span>
        {kind === "stamps" ? (
          /* 명세 35 v2 (붓 막대): 글 앞 견본 — 왼쪽 남색 막대 = 조심할 쪽, 오른쪽 금빛 막대 = 좋은 쪽, 가운데 눈금만 = 특별한 신호 없음. 모양은 디자이너(.area-legend*) */
          <span className="area-legend">
            <span className="area-legend__item" data-kind="down">
              <span aria-hidden className="area-legend__sample" data-tone="down" />
              조심할 쪽
            </span>
            <span className="area-legend__item" data-kind="up">
              <span aria-hidden className="area-legend__sample" data-tone="up" />
              좋은 쪽
            </span>
            <span className="area-legend__item" data-kind="quiet">
              <span aria-hidden className="area-legend__sample" data-tone="quiet" />
              가운데 = 특별한 신호 없음
            </span>
          </span>
        ) : (
          <span className="inline-flex gap-4">
            <span><span className="text-gold font-bold">↑</span> 좋아요</span>
            <span><span className="text-ink">↓</span> 조심</span>
          </span>
        )}
      </span>
      <button type="button" onClick={close} aria-label="범례 닫기" className="tap tap--box -mr-2 text-[18px] leading-none text-muted">
        ×
      </button>
    </p>
  );
}
