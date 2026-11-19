"use client";

import { useState } from "react";
import { happinessTier } from "@/lib/entry";
import type { StateHappyRow } from "@/lib/stats/states";

/** 처음 보이는 줄 수 */
const FIRST = 8;

/**
 * 나 화면 "있었던 일별 행복도" (2026-11-14 명세 37 → 명세 50 8번, 톤 v3.54).
 * 앱 주인: "영역별 행복도는 빼 주고, 있었던 일에 있는 거를 영역별 행복도처럼 계산해 줘."
 * 그 일이 있었던 날의 내 행복도 평균을 한 줄씩 — 왼쪽 말("여유", "돈 많이 나감"), 가운데 막대(평균, 10이 끝. 색은 행복도 네 단계 색),
 * 오른쪽 "평균 8.5"와 날 수. 한 번뿐인 줄(avg null)은 옅게 "1일뿐이라 아직 몰라요". 처음 8줄, "더 보기".
 * 예전에 그리던 축별 세 단계 횟수 · 자주 고른 낱말 · 갈래별 경향은 이 칸 하나로 바꿨다. 계산은 lib/stats/states.ts stateHappiness.
 * 모양은 globals.css .state-happy* (막대는 영역별 행복도 막대 .area-bars와 같은 재료)
 */
export function StateStats({ rows }: { rows: StateHappyRow[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST);
  return (
    <section className="state-happy card-frame card-light card-paper px-5 py-4" aria-label="있었던 일별 행복도">
      <p className="text-[15px] font-bold">
        있었던 일별 행복도 <span className="text-[13px] font-normal text-muted">그 일이 있었던 날의 내 행복도 평균</span>
      </p>
      {rows.length === 0 ? (
        <p className="state-happy__empty">있었던 일을 고른 기록이 쌓이면 보여요</p>
      ) : (
        <ol className="state-happy__list">
          {shown.map((r) => (
            <li key={r.key} className="state-happy__row" data-thin={r.avg === null ? "" : undefined} aria-label={r.avg === null ? `${r.label}, ${r.n}일뿐이라 아직 몰라요` : `${r.label} 평균 ${r.avg}, ${r.n}일`}>
              <span className="state-happy__label">{r.label}</span>
              {r.avg === null ? (
                <span className="state-happy__few">{r.n}일뿐이라 아직 몰라요</span>
              ) : (
                <>
                  <span className="area-bars__track" aria-hidden>
                    <span className="area-bars__fill" style={{ width: `${(r.avg / 10) * 100}%` }} data-tier={happinessTier(r.avg)} />
                  </span>
                  <span className="state-happy__avg">
                    <small>평균</small>
                    {r.avg}
                  </span>
                  <span className="state-happy__n">{r.n}일</span>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {rows.length > FIRST && !all && (
        <button type="button" className="state-happy__more tap" onClick={() => setAll(true)}>
          더 보기 <small>{rows.length - FIRST}줄</small>
        </button>
      )}
    </section>
  );
}
