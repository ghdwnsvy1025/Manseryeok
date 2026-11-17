"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

/** "다음에"를 누른 때(ms)를 이 기기에만 적어 둔다. DB에는 남기지 않는다 (명세 47 Q7) */
const LATER_KEY = "saju-paid-invite-later";
const LATER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 유료 풀이 권유 — 만세력 낱장 맨 끝 한 곳뿐 (명세 47 Q6·Q21, 톤 v3.51). 나 탭 본문에는 권유가 없다.
 * 한 줄 + 작은 글씨 + 금색 면 버튼 하나(낱장 안의 유일한 금 면) + 옆에 "다음에" 글자 버튼.
 * 결제가 열렸으면 풀이로(가격), 닫혔으면 "열리면 알림 받기"(카카오 채널) + "초대 코드가 있어요" — SajuChartPanel이 갖고 있던 분기와 링크 그대로.
 * "다음에"를 누르면 권유 칸이 접히고 30일 동안 안 보인다. 저장소를 못 쓰면 그냥 보인다.
 * 주소는 서버(SajuChartPanel)가 만들어 넘긴다.
 */
export function PaidInvite({ open, readingHref, notifyHref, price }: { open: boolean; readingHref: string; notifyHref: string; price: number }) {
  const [later, setLater] = useState(false);

  useEffect(() => {
    try {
      const at = Number(window.localStorage.getItem(LATER_KEY));
      if (at > 0 && Date.now() - at < LATER_MS) setLater(true);
    } catch {
      /* 저장소를 못 읽으면 그냥 보인다 */
    }
  }, []);

  if (later) return null;

  const click = () => {
    // 옛 이름(paid_reading_click)은 그대로 두고, 권유 자리 이름을 하나 더 센다
    track("paid_reading_click", { at: "saju", open });
    track("paid_cta_click", { at: "me_saju" });
  };

  return (
    <section className="paid-invite" aria-label="전체 풀이">
      <p className="paid-invite__line">여덟 글자의 나머지 이야기를 편지로 받아 보세요</p>
      <p className="paid-invite__sub">10년 흐름, 연애, 돈, 올해 좋은 달까지</p>
      <div className="paid-invite__actions">
        <Link href={open ? readingHref : notifyHref} target="_blank" rel="noopener" onClick={click} className="paid-invite__go gold-plate">
          {open ? `전체 풀이 받기 ${price.toLocaleString("ko-KR")}원` : "열리면 알림 받기"}
        </Link>
        <button
          type="button"
          className="paid-invite__later tap"
          onClick={() => {
            try {
              window.localStorage.setItem(LATER_KEY, String(Date.now()));
            } catch {
              /* 저장소를 못 쓰면 이번만 접힌다 */
            }
            track("paid_cta_dismiss", { at: "me_saju" });
            setLater(true);
          }}
        >
          다음에
        </button>
      </div>
      {!open && (
        <Link
          href={readingHref}
          target="_blank"
          rel="noopener"
          onClick={() => track("paid_reading_click", { at: "saju", open: false, code: true })}
          className="paid-invite__code tap"
        >
          초대 코드가 있어요
        </Link>
      )}
    </section>
  );
}
