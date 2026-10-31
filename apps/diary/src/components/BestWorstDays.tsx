"use client";

import Link from "next/link";
import { useState } from "react";
import { happinessTier, moodTone } from "@/lib/entry";

export interface DayCard {
  date: string;
  /** "10월 5일" */
  label: string;
  happiness: number;
  moods: string[];
  ganjiKo: string;
  faceSrc: string;
}

interface Props {
  /** 지금 보는 달("10월")의 가장 행복한 날·힘든 날 */
  month: { label: string; best: DayCard | null; worst: DayCard | null };
  all: { best: DayCard | null; worst: DayCard | null };
}

/**
 * 가장 행복한 날·가장 힘든 날 (2026-10-31 사용자 결정): 실제 하루 하나씩. 기본은 지금 보는 달, "전체"로 바꿀 수 있다.
 * 카드 = 그날의 간지 얼굴 + 날짜 + 행복도 + 기분(최대 3개 보임). 누르면 달력의 그날 상세(/me?d=).
 * "하면 좋아요" 지표가 있던 칸(.metrics--two)에 둔다. 모양은 디자이너(.day-pick*).
 */
export function BestWorstDays({ month, all }: Props) {
  const [scope, setScope] = useState<"month" | "all">("month");
  const cur = scope === "month" ? month : all;
  return (
    <div className="day-pick">
      <div className="day-pick__head flex items-center justify-between">
        <p className="text-[15px] font-bold">가장 행복한 날과 힘든 날</p>
        <div className="day-pick__scope flex gap-1" role="radiogroup" aria-label="기간">
          {(
            [
              ["month", month.label],
              ["all", "전체"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={scope === k} data-on={scope === k ? "" : undefined} onClick={() => setScope(k)} className="day-pick__scope-btn">
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="metrics metrics--two mt-2" aria-label="가장 행복한 날과 힘든 날">
        <Card kind="best" title="가장 행복한 날" day={cur.best} />
        <Card kind="worst" title="가장 힘든 날" day={cur.worst} />
      </ul>
    </div>
  );
}

function Card({ kind, title, day }: { kind: "best" | "worst"; title: string; day: DayCard | null }) {
  if (!day) {
    return (
      <li className="metric day-pick__card" data-kind={kind} data-empty="">
        <span className="metric__label">{title}</span>
        <span className="metric__sub">{kind === "worst" ? "아직 고를 날이 없어요" : "기록이 없어요"}</span>
      </li>
    );
  }
  return (
    <li className="metric day-pick__card" data-kind={kind}>
      <Link href={`/me?d=${day.date}#me-records`} scroll={false} className="day-pick__link flex flex-col gap-1">
        <span className="metric__label">{title}</span>
        <span className="day-pick__face">
          <img src={day.faceSrc} alt="" width={48} height={48} />
          <span className="day-pick__ganji text-ganji">{day.ganjiKo}일</span>
        </span>
        <span className="day-pick__date text-[13px] text-muted">{day.label}</span>
        {/* 숫자는 그날 도장(달력·날짜 상세와 같은 네 단계 면) 안에 — 금색은 글자가 아니라 면으로만(v3.26) */}
        <span className="metric__value" data-tier={happinessTier(day.happiness)}>
          <span className="day-pick__num">{day.happiness}</span>
          <small>/10</small>
        </span>
        {day.moods.length > 0 && (
          <span className="metric__chips">
            {day.moods.slice(0, 3).map((m) => (
              <span key={m} className="metric__chip" data-tone={moodTone(m)}>
                {m}
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}
