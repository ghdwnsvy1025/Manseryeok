"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  hasSeenFirstVisitWelcome,
  isFirstVisitWelcomePath,
  markFirstVisitWelcomeSeen,
  setWelcomeOverlayPhase,
} from "@/lib/app/firstVisitWelcome";

/**
 * 로그인 후 홈에 처음 들어올 때 한 번 —
 * 아이콘과 짧은 시가 차례로 피어나는 장면.
 */
export default function FirstVisitWelcome() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (hasSeenFirstVisitWelcome()) {
      setWelcomeOverlayPhase("idle");
      return;
    }
    if (!isFirstVisitWelcomePath(pathname)) {
      setWelcomeOverlayPhase("idle");
      return;
    }

    // 홈 연출이 창 뒤에서 돌지 않도록 바로 대기
    setWelcomeOverlayPhase("pending");
    const t = window.setTimeout(() => {
      setOpen(true);
      setWelcomeOverlayPhase("open");
    }, 280);
    return () => {
      window.clearTimeout(t);
    };
  }, [pathname]);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    markFirstVisitWelcomeSeen();
    window.setTimeout(() => {
      setOpen(false);
      setWelcomeOverlayPhase("closed");
    }, 480);
  };

  if (!open) return null;

  return (
    <div
      className={`welcome-splash ${leaving ? "welcome-splash--out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
    >
      <div className="welcome-splash__glow" aria-hidden />
      <div className="welcome-splash__dust" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className={`welcome-splash__mote welcome-splash__mote--${i + 1}`} />
        ))}
      </div>

      <div className="welcome-splash__stage">
        <div className="welcome-splash__icon-wrap">
          <div className="welcome-splash__icon-ring" aria-hidden />
          <div className="welcome-splash__icon">
            <Image
              src="/icons/app-icon-512.png"
              alt=""
              width={512}
              height={512}
              priority
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="welcome-splash__copy">
          <h2 id="first-visit-title" className="welcome-splash__line welcome-splash__line--1">
            밤의 한 줄이
          </h2>
          <p className="welcome-splash__line welcome-splash__line--2">
            내일의 결을 닮아갑니다
          </p>
          <p className="welcome-splash__line welcome-splash__line--3">
            짧게 적어도 괜찮아요.
            <br />
            기록이 쌓일수록, 사주도 당신 곁으로.
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="welcome-splash__cta"
        >
          오늘의 홈으로
        </button>
      </div>
    </div>
  );
}
