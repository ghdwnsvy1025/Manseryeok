"use client";

import { useState } from "react";
import { happinessTier } from "@/lib/entry";
import { openDay } from "@/components/DaySheet";
import { VersusMark } from "@/components/VersusMark";
import type { VersusDay } from "@/lib/stats/insight";

const FIRST = 7;
/** "2026-11-23" → "11.23" */
const shortDate = (date: string): string => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;

/**
 * "예상은 맞았을까?" 낱장의 날 목록 (명세 50 6번, 톤 v3.54): 세 열로 줄을 맞춘다 — 날짜 · 예상(작은 옥색/주홍 점 + 좋을 날/조심할 날) · 내 행복도 도장.
 * "→", "~로 봄", "행복도" 글자와 같은 쪽 표시는 뺐다(도장 색이 말한다). 열 머리말 한 줄. 처음 7줄, "더 보기"로 나머지.
 * 명세 54(톤 v3.58): 맨 오른쪽에 결과 열 — 채점 붓 표시 ○ △ × 20px. 줄의 무게는 그대로, 기호만 색을 갖는다.
 * 줄을 누르면 이 낱장이 걷히고 그 날의 날짜 낱장이 뜬다. 운세 점수 숫자는 없다.
 */
export function VersusDays({ days }: { days: VersusDay[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? days : days.slice(0, FIRST);
  return (
    <div className="versus-table">
      <p className="versus-table__head" aria-hidden>
        <span>날짜</span>
        <span>예상</span>
        <span>내 행복도</span>
        <span>결과</span>
      </p>
      <ol className="versus-table__rows">
        {shown.map((d) => (
          <li key={d.date}>
            <button type="button" className="versus-table__row" data-band={d.band === "좋음" ? "good" : "care"} aria-haspopup="dialog" aria-label={`${shortDate(d.date)}, ${d.band === "좋음" ? "좋을 날" : "조심할 날"}로 봤어요. 내 행복도 ${d.happiness}. ${d.result === "same" ? "예상과 같았어요" : d.result === "opposite" ? "예상과 달랐어요" : "그 사이였어요"}`} onClick={() => openDay(d.date)}>
              <span className="versus-table__date">{shortDate(d.date)}</span>
              <span className="versus-table__band">{d.band === "좋음" ? "좋을 날" : "조심할 날"}</span>
              <span className="versus-table__stamp" data-tier={happinessTier(d.happiness)}>
                {d.happiness}
              </span>
              <span className="versus-table__result">
                <VersusMark result={d.result} size={20} label={false} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      {days.length > FIRST && !all && (
        <button type="button" className="versus-table__more tap" onClick={() => setAll(true)}>
          더 보기 <small>{days.length - FIRST}일</small>
        </button>
      )}
    </div>
  );
}
