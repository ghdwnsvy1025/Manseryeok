"use client";

import { useEffect, useState } from "react";

const KEY = "band-hint-seen";

/**
 * 60칸 띠 아래 첫 방문 한 줄 (톤 v3.2 "첫 화면 제목·띠").
 * localStorage `band-hint-seen`이 없을 때만 보이고, 닫으면 다시 안 나온다. 저장소를 못 쓰면 그냥 보인다.
 */
export function BandHint({ ganjiKo, nth }: { ganjiKo: string; nth: number }) {
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
    <p className="-mt-2 flex items-start justify-between gap-3 text-[14px] leading-relaxed text-muted">
      <span>
        달력 대신 60갑자로 하루를 세요. 오늘은 {nth}번째 <span className="text-ganji">{ganjiKo}일</span>이에요
      </span>
      <button type="button" onClick={close} aria-label="설명 닫기" className="-mr-1 shrink-0 px-1 text-[18px] leading-none text-faint">
        ×
      </button>
    </p>
  );
}
