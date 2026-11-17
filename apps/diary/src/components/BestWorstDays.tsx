import Link from "next/link";
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

/** 앞날 예상 한 날 (lib/stats/forecast.ts) — 칩 둘 · 달력 앞날 칸이 쓴다 */
export interface ForecastCard {
  date: string;
  label: string;
  ganjiKo: string;
  faceSrc: string;
  reason: string;
}

/**
 * 가장 행복했던 날 카드 + 그 아래 작게 힘든 날 한 줄 (2026-10-31 → 명세 47, 톤 v3.51).
 * 본문의 두 장 · 기간 전환 · 다음 달 예상 두 칸은 없앴다 — "나는 언제 행복했지?" 낱장 안으로 옮겨 전체 기록의 하루씩만.
 * 카드 = 그날의 간지 얼굴 + 날짜 + 행복도 도장 + 기분(최대 3개). 누르면 낱장이 걷히고 달력의 그날 상세로(/me?d=).
 * 모양은 디자이너(.day-pick*).
 */
export function BestWorstDays({ best, worst }: { best: DayCard | null; worst: DayCard | null }) {
  if (!best) return null;
  return (
    <div className="day-pick">
      <div className="metric day-pick__card" data-kind="best">
        <Link href={`/me?d=${best.date}#me-records`} scroll={false} className="day-pick__link day-pick__link--wide">
          <span className="day-pick__main">
            <span className="metric__label">가장 행복했던 날</span>
            <span className="day-pick__face">
              <img src={best.faceSrc} alt="" width={48} height={48} />
              <span className="day-pick__who">
                <span className="day-pick__ganji text-ganji">{best.ganjiKo}일</span>
                <span className="day-pick__date text-[13px] text-muted">{best.label}</span>
              </span>
            </span>
            {best.moods.length > 0 && (
              <span className="metric__chips">
                {best.moods.slice(0, 3).map((m) => (
                  <span key={m} className="metric__chip" data-tone={moodTone(m)}>
                    {m}
                  </span>
                ))}
              </span>
            )}
          </span>
          {/* 숫자는 그날 도장(달력·날짜 상세와 같은 네 단계 면) 안에 — 금색은 글자가 아니라 면으로만(v3.26) */}
          <span className="metric__value" data-tier={happinessTier(best.happiness)} aria-label={`행복도 ${best.happiness}`}>
            <span className="day-pick__num">{best.happiness}</span>
          </span>
        </Link>
      </div>
      {worst && (
        <Link href={`/me?d=${worst.date}#me-records`} scroll={false} className="day-pick__low tap">
          <span className="day-pick__low-label">가장 힘들었던 날</span>
          <span className="day-pick__low-date">
            {worst.label} <span className="text-ganji">{worst.ganjiKo}일</span>
          </span>
          <span className="day-pick__low-num">행복도 {worst.happiness}</span>
        </Link>
      )}
    </div>
  );
}
