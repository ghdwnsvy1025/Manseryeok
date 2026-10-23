"use client";

import { useEffect, useState } from "react";

/**
 * 운세 카드 자리 — 운세가 캐시에 없는 날, 뒤에서 만드는 5~25초 동안 보인다 (FortunePending이 그린다).
 * 디자인 명세 28 (톤 v3.29): 열린 운세 카드와 같은 틀(card-gold card-paper) 안에
 *   1. 진척 붓 막대 — 금색 면(gold-wash)을 붓 가로획(brush-stroke)으로 마스크. 왼→오로 한 번 차오른다(반복 쓸기 아님).
 *   2. 진행 말 한 줄 — 단계가 바뀔 때 글자만 바뀐다(페이드 120ms).
 * 서버는 진행률을 모르므로 마운트 뒤 경과 시간으로 추정한다(아래 표). 퍼센트 숫자는 보이지 않는다.
 * 캐릭터 그림·스피너·점 세 개·돌아가는 문구 없음. 높이는 닫힌 운세 카드와 같다(.fortune-loading min-height) — 카드가 와도 화면이 튀지 않는다.
 *
 * `character`는 page.tsx가 아직 넘기지만 v3.29부터 쓰지 않는다(prop 서명만 유지).
 * `ready`: 캐시가 생겨 refresh 직전(수백 ms) — 막대를 100%로 채우고 "다 됐어요".
 */

/** 경과 구간 → 막대 범위(%)와 진행 말. 파이프라인: 사주 계산(<1초) → 모델이 글 씀(5~20초) → 검사·다시 씀 → 검수 */
const STAGES = [
  { until: 1.5, from: 0, to: 12, text: "사주를 펼치고 있어요" },
  { until: 5, from: 12, to: 30, text: "오늘 간지와 맞춰 보고 있어요" },
  { until: 18, from: 30, to: 75, text: "운세 글을 쓰고 있어요" },
] as const;
/** 18초 뒤: 75%에서 92%로 ease-out, 92를 넘지 않는다 */
const TAIL = { from: 75, to: 92, text: "글을 다듬고 있어요", tau: 8 };
const READY_TEXT = "다 됐어요";
/** 상태 갱신 간격 — 막대 width 전환도 같은 길이라 눈에는 이어져 보인다 */
const TICK_MS = 300;

/** 경과 초 → 추정 진척(%)과 단계 번호 */
export function estimateProgress(elapsedSec: number): { pct: number; stage: number; text: string } {
  let start = 0;
  for (let i = 0; i < STAGES.length; i += 1) {
    const s = STAGES[i];
    if (elapsedSec < s.until) {
      const r = Math.max(0, (elapsedSec - start) / (s.until - start));
      return { pct: s.from + (s.to - s.from) * r, stage: i, text: s.text };
    }
    start = s.until;
  }
  const k = 1 - Math.exp(-(elapsedSec - start) / TAIL.tau);
  return { pct: Math.min(TAIL.to, TAIL.from + (TAIL.to - TAIL.from) * k), stage: STAGES.length, text: TAIL.text };
}

export function FortuneLoading({ character, ready = false }: { character?: string; ready?: boolean }) {
  void character; // v3.29: 캐릭터는 그리지 않는다 (page.tsx가 넘기는 값은 무시)
  // 서버 렌더(첫 그림)는 0% · 첫 문구. 클라이언트에서 마운트 시점부터 센다
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const est = estimateProgress(elapsed);
  const pct = ready ? 100 : est.pct;
  const stage = ready ? STAGES.length + 1 : est.stage;
  const text = ready ? READY_TEXT : est.text;

  return (
    <section className="fortune-loading card-gold card-paper flex flex-col justify-center p-5" aria-busy={!ready} aria-live="polite">
      <h2 className="text-[15px] text-muted">오늘의 운세</h2>
      {/* 진척 붓 막대: 트랙 없음(한지 그대로), fill = 금색 면 + 붓 가로획 마스크. 숫자는 보조 기술에만 */}
      <div
        className="fortune-loading__bar mt-3"
        role="progressbar"
        aria-label="운세 준비"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={text}
        data-ready={ready ? "" : undefined}
      >
        <span className="fortune-loading__fill" style={{ width: `${pct}%` }} />
      </div>
      {/* 진행 말: 단계가 바뀔 때만 글자가 바뀐다 — key로 다시 그려 120ms 페이드 한 번 */}
      <p key={stage} className="fortune-loading__text mt-2 text-[15px] text-muted">
        {text}
      </p>
    </section>
  );
}
