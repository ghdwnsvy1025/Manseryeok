"use client";

import { useEffect, useState } from "react";

const KEY = "signal-legend-seen";

/**
 * 오늘의 신호 상자 위 화살표 범례 — 첫 한 번만 (전수조사 C "화살표 범례 없음").
 * localStorage `signal-legend-seen`이 없을 때만 보이고, ×로 닫으면 다시 안 나온다. 저장소를 못 쓰면 그냥 보인다.
 * 색은 신호 상자와 같다 (↑ 금색 · → 보조 · ↓ 먹색 — 길흉을 색으로 말하지 않는다).
 */
export function SignalLegend() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

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
    <p className="-mt-1 mb-1 flex items-center justify-between gap-3 text-[14px] text-muted">
      <span>
        <span className="inline-flex gap-4">
          <span><span className="text-gold">↑</span> 좋아요</span>
          <span><span>→</span> 보통</span>
          <span><span className="text-ink">↓</span> 조심</span>
        </span>
      </span>
      <button type="button" onClick={close} aria-label="범례 닫기" className="tap tap--box -mr-2 text-[18px] leading-none text-muted">
        ×
      </button>
    </p>
  );
}
