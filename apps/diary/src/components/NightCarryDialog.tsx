"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

interface Props {
  /** 어제 날짜 (YYYY-MM-DD). 같은 날 두 번 묻지 않는 열쇠 */
  date: string;
  /** "10월 23일" */
  label: string;
  /** 오늘 날짜로 여는 주소 (`/write?date=오늘`) */
  todayHref: string;
}

/**
 * 새벽 0~4시, 날짜 없이 쓰기를 열었고 어제 기록이 없을 때(= writeNav.nightCarryDate) 한 번 묻는다 (2026-10-24 사용자 결정).
 * 폼은 이미 어제 날짜로 열려 있다 — "어제 일기 쓰기"면 그대로 닫히고, "오늘 일기 쓰기"면 오늘 날짜로 다시 연다.
 * 같은 날 다시 열면 묻지 않는다(sessionStorage). Esc·뒤로가기도 "어제 그대로"로 본다.
 * 첫 서버 렌더에서는 닫혀 있다가 effect에서 연다(수화 불일치 방지). 모양은 globals.css .night-ask*
 */
export function NightCarryDialog({ date, label, todayHref }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const key = `saju-night-ask:${date}`;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* 저장소를 못 쓰면 매번 묻는다 */
    }
    setOpen(true);
    track("night_ask_show", {});
  }, [key]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      try {
        el.showModal();
      } catch {
        el.setAttribute("open", "");
      }
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const remember = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* 못 남기면 다음에 또 묻는다 */
    }
  };
  const keepYesterday = () => {
    remember();
    track("night_ask", { choice: "yesterday" });
    setOpen(false);
  };

  return (
    <dialog
      ref={ref}
      className="night-ask"
      aria-labelledby="night-ask-title"
      onCancel={(e) => {
        e.preventDefault();
        keepYesterday();
      }}
    >
      <div className="night-ask__card card-frame card-light card-paper">
        <p className="text-sm text-muted">자정이 지났어요</p>
        <h2 id="night-ask-title" className="mt-1 font-serif text-[22px] leading-snug break-keep">
          어제({label}) 일기를 쓸까요?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted break-keep">밤에 쓰는 일기는 아침 4시까지 어제 날짜로 남겨요.</p>
        {/* 금색 면 버튼은 화면에 하나 — 이것 */}
        <button
          type="button"
          onClick={keepYesterday}
          autoFocus
          className="gold-plate mt-5 flex h-14 w-full items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink"
        >
          어제 일기 쓰기
        </button>
        <Link
          href={todayHref}
          onClick={() => {
            remember();
            track("night_ask", { choice: "today" });
          }}
          className="tap mt-2 flex h-11 items-center justify-center text-[15px] text-muted underline underline-offset-4"
        >
          오늘 일기 쓰기
        </Link>
      </div>
    </dialog>
  );
}
