"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 과거 날짜 기록을 저장하고 /?saved=날짜 로 돌아왔을 때 (전수조사 B8). 팡은 오늘만 뜨므로 과거는 이 작은 한지 띠 한 줄로 알린다.
 * "10월 1일 기록을 남겼어요 · 나에서 보기" → /me. sessionStorage로 한 번만. 처음 서버 렌더에서는 비어 있다가 effect에서 켜진다(수화 불일치 방지).
 */
export function SavedPastNotice({ date, label }: { date: string; label: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `saju-saved-notice:${date}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 저장소를 못 써도 한 번은 보여 준다 */
    }
    setShow(true);
    try {
      if (window.location.search) window.history.replaceState(null, "", "/");
    } catch {
      /* 주소를 못 고쳐도 알림은 보인다 */
    }
  }, [date]);

  if (!show) return null;
  return (
    <p className="mt-2" role="status">
      <Link href="/me" className="tag h-8 px-1 text-[13px] text-ink">
        {label} 기록을 남겼어요 · 나에서 보기
      </Link>
    </p>
  );
}
