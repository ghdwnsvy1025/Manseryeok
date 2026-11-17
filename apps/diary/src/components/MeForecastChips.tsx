"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import type { ForecastCard } from "@/components/BestWorstDays";

/** "2026-11-23" → "11.23" */
const shortDate = (date: string): string => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;

/**
 * 나 탭 칩 둘 (명세 47, 톤 v3.51): 앞으로 30일 가운데 가장 좋을 날 · 가장 조심할 날. 누르지 않아도 답이 보인다.
 * 칩 = 그날 일주 얼굴 동그라미 + 이름 + 날짜. 테와 이름 글자가 옥색(좋을 쪽) · 주홍(조심할 쪽) — 운세 카드 인장과 같은 "1px 선 + 같은 색 글자".
 * 누르면 달력이 그 날이 든 달로 넘어가고(/me?m=YYYY-MM) 그 칸이 골라진다(fd= — MonthCalendar가 읽는다).
 * 조심할 날이 없으면(점수 차가 없을 때) 칩 하나만. 점수는 내지 않는다.
 */
export function MeForecastChips({ best, worst }: { best: ForecastCard | null; worst: ForecastCard | null }) {
  const chips = [
    best ? { kind: "best" as const, title: "가장 좋을 날", day: best } : null,
    worst ? { kind: "worst" as const, title: "조심할 날", day: worst } : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);
  if (chips.length === 0) return null;
  return (
    <section className="me-chips" aria-label="앞으로 30일, 사주로 본 예상">
      <p className="me-chips__head" aria-hidden>
        <span>앞으로 30일</span>
        <span>사주로 본 예상</span>
      </p>
      <ul className="me-chips__list">
        {chips.map(({ kind, title, day }) => (
          <li key={kind}>
            <Link
              href={`/me?m=${day.date.slice(0, 7)}&fd=${day.date}#me-records`}
              scroll={false}
              className="me-chip"
              data-kind={kind}
              aria-label={`${title} ${day.label}, ${day.ganjiKo}일. 달력에서 보기`}
              onClick={() => track("me_chip_tap", { kind })}
            >
              <img src={day.faceSrc} alt="" width={40} height={40} className="me-chip__face" />
              <span className="me-chip__text">
                <span className="me-chip__title">{title}</span>
                <span className="me-chip__date">{shortDate(day.date)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
