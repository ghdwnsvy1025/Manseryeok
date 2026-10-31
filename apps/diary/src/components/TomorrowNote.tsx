"use client";

import { useEffect, useState } from "react";

/** 오늘(그 날짜) 쪽지를 이미 펼쳐 봤는지 — 값은 날짜 */
const SEEN_KEY = "night_tomorrow_seen";

/**
 * 어젯밤의 내가 남긴 쪽지 (2026-10-31, 쓰기 화면 "내일의 나에게"). 오늘 화면 맨 위, 운세 카드 위.
 * 오늘 처음 열면 펼쳐진 쪽지, 그 뒤엔(같은 날 다시 열면) 접힌 띠 한 줄 — 누르면 펼친다. 첫 그림(서버)은 접힌 띠.
 * 재료는 쓰기 화면과 같은 쪽지(note-slip). 모양은 디자이너 몫(.tomorrow-note*).
 */
export function TomorrowNote({ date, text }: { date: string; text: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== date) {
        setOpen(true);
        localStorage.setItem(SEEN_KEY, date);
      }
    } catch {
      /* 저장소를 못 쓰면 접힌 띠만 */
    }
  }, [date]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="tomorrow-note tomorrow-note--folded tap text-left text-[15px] text-muted" aria-expanded={false}>
        어젯밤의 내가 남긴 쪽지 ›
      </button>
    );
  }
  return (
    <section className="tomorrow-note note-slip" aria-label="어젯밤의 내가 남긴 쪽지">
      <p className="note-slip__label">어젯밤의 내가 남긴 말</p>
      <p className="note-slip__text font-hand text-[18px] break-keep">{text}</p>
      <button type="button" onClick={() => setOpen(false)} className="tomorrow-note__fold tap text-[13px] text-muted underline underline-offset-4" aria-expanded>
        접기
      </button>
    </section>
  );
}
