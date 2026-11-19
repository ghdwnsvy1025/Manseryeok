import { moodTone } from "@/lib/entry";
import { DayButton } from "@/components/DaySheet";

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
 * 가장 행복했던 날 · 가장 힘들었던 날 — 나란히 두 칸, 같은 크기 (2026-10-31 → 명세 47 → 명세 49, 톤 v3.53).
 * "나는 언제 행복했지?" 낱장 맨 위, 그래프 바로 위에 놓인다. 앱 주인: "가장 행복했던 날, 힘들었던 날을 그래프와 맨 위에".
 * 칸 = 작은 머리말 · 얼굴 동그라미 · 일진 이름 · 날짜 · 행복도 도장(행복 = 옥색, 힘듦 = 주홍 — 아래 그래프의 도장과 같은 색) · 기분 띠 최대 둘.
 * 명세 50: 누르면 이 낱장이 걷히고 그 날의 **날짜 낱장**이 뜬다(DayButton — 전에는 /me?d= 링크). 힘든 날이 없으면 한 칸만 넓게.
 * 모양은 디자이너(.two-days · .day-cell*).
 */
export function BestWorstDays({ best, worst }: { best: DayCard | null; worst: DayCard | null }) {
  if (!best) return null;
  const cells = [{ kind: "best" as const, title: "가장 행복했던 날", day: best }, ...(worst ? [{ kind: "worst" as const, title: "가장 힘들었던 날", day: worst }] : [])];
  return (
    <ul className="two-days" data-one={cells.length === 1 ? "" : undefined}>
      {cells.map(({ kind, title, day }) => (
        <li key={kind} className="day-cell" data-kind={kind}>
          <DayButton date={day.date} className="day-cell__link" aria-label={`${title} ${day.label} ${day.ganjiKo}일, 행복도 ${day.happiness}. 그날 기록 보기`}>
            <span className="day-cell__title">{title}</span>
            <span className="day-cell__who">
              <img src={day.faceSrc} alt="" width={40} height={40} className="day-cell__face" />
              <span className="day-cell__name">
                <span className="day-cell__ganji text-ganji">{day.ganjiKo}일</span>
                <span className="day-cell__date">{day.label}</span>
              </span>
            </span>
            <span className="day-cell__foot">
              <span className="day-cell__stamp">{day.happiness}</span>
              {day.moods.length > 0 && (
                <span className="day-cell__moods">
                  {day.moods.slice(0, 2).map((m) => (
                    <span key={m} className="metric__chip" data-tone={moodTone(m)}>
                      {m}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </DayButton>
        </li>
      ))}
    </ul>
  );
}
