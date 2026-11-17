"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { RetryButton } from "./RetryButton";

/**
 * 운세 카드 자리 — 운세가 캐시에 없는 날, 뒤에서 만드는 5~25초 동안 보인다 (FortunePending이 그린다).
 * 디자인 명세 30 (톤 v3.31): 운세 카드와 같은 틀 안에
 *   1. 먹 달 72px, 가로 가운데 — 키트의 붓 먹 보름달 원판(moon-ink-disc) 한 장을 두 겹으로.
 *      아래 겹은 마스크 없이 옅게(18%) 깔린 보름달 = "다 찬 달의 자리", 위 겹은 같은 자리·같은 크기의 진한 달을
 *      가림 원(마스크)으로 깎은 것. 진척이 오르면 가림 원이 오른쪽으로 빠져나가 옅은 달 위로 진한 달이 차오른다
 *      (초승달 → 반달 → 보름달). 모양이 곧 진행이라 막대·퍼센트가 없다.
 *   2. 진행 말 한 줄 — 달 아래 10px, 가운데. 단계가 바뀔 때 글자만 바뀐다(페이드 120ms).
 * 서버는 진행률을 모르므로 마운트 뒤 경과 시간으로 추정한다(아래 표). 퍼센트 숫자는 보조 기술에만 있다.
 * 막대·캐릭터·스피너·점 세 개·돌아가는 문구 없음. 높이는 닫힌 운세 카드와 같다 — 카드가 와도 화면이 튀지 않는다.
 * 명세 40 (톤 v3.44): 틀은 인장 카드(variant="seal")와 같은 1px 선·24px 여백·라벨 줄, 높이는 닫힌 인장 카드 머리 214.6px(375px, 제목 두 줄).
 * 명세 44 (톤 v3.48): 오늘 화면의 운세 카드가 섞은 톤(theme="blend")이 되어, 로딩 카드도 같은 틀을 입는다 —
 *   금빛 겹선 테 · 맨 위 남색 뇌문 띠 40px · 띠 가운데에서 내려오는 줄 → 금빛 매듭 → 주홍 술(전부 aria-hidden, 모양은 globals.css의 .fc--blend).
 *   먹 달과 진행 말은 그대로. 높이는 띠만큼(+36px) 다시 맞춘 290.6px(375px).
 * 명세 45 (톤 v3.49): 남색이 섞은 톤에서 "조심할 것"의 색이라, 남색이 차오르는 달이 그 뜻으로 읽혔다 — 좋음·조심의 뜻이 없는 색의 시안을 `look`으로 고른다.
 *   기본 `now`는 지금 모습 그대로(마크업도 같다). 시안은 하네스에서만 넘기고, 앱 주인이 고르면 기능 쪽이 FortunePending에서 넘긴다.
 *   gold = 같은 달 두 겹, 차오르는 달만 금빛 / ink = 먹(검갈색)으로 차오름 / knot = 큰 동심결 매듭이 진척만큼 그려지고 ready에 주홍 술이 한 번 떨어짐 /
 *   window = 달창(moon-window-gold) 뒤로 따뜻한 빛이 아래에서 차오름 / band = 가운데 그림 없이 머리 띠의 금빛 뇌문이 왼→오로 이어져 그려짐.
 *   진척(--moon-p 0~1)은 시안이면 카드(section)에 달려 띠·매듭·창이 같은 값을 읽는다. 진척 추정 · 진행 말 · ready는 그대로.
 *
 * `character`는 page.tsx가 아직 넘기지만 v3.29부터 쓰지 않는다(prop 서명만 유지).
 * `ready`: 캐시가 생겨 refresh 직전(수백 ms) — 보름달로 채우고 "다 됐어요".
 */

/** 경과 구간 → 차오름 범위(%)와 진행 말. 파이프라인: 사주 계산(<1초) → 모델이 글 씀(5~20초) → 검사·다시 씀 → 검수 */
const STAGES = [
  { until: 1.5, from: 0, to: 12, text: "사주를 펼치고 있어요" },
  { until: 5, from: 12, to: 30, text: "오늘 간지와 맞춰 보고 있어요" },
  { until: 18, from: 30, to: 75, text: "운세 글을 쓰고 있어요" },
] as const;
/** 18초 뒤: 75%에서 92%로 ease-out, 92를 넘지 않는다 */
const TAIL = { from: 75, to: 92, text: "글을 다듬고 있어요", tau: 8 };
const READY_TEXT = "다 됐어요";
/** 상태 갱신 간격 — 가림 원 이동 전환도 같은 길이라 눈에는 이어져 차오른다 */
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

/**
 * 섞은 톤 카드 틀의 장식(명세 43·44): 맨 위 남색 뇌문 띠(자리를 차지한다 — 40px + 아래 20px), 금빛 겹선 테, 줄 → 금빛 매듭 → 주홍 술(절대 위치).
 * FortuneCard의 섞은 톤과 같은 클래스라 같은 규칙으로 그려진다. 일진 한자 워터마크와 창살은 제목에 딸린 것이라 여기에는 없다
 */
function BlendFrame() {
  return (
    <>
      <span aria-hidden className="fc-blend__band" />
      <span aria-hidden className="fc-frame" />
      <span aria-hidden className="fc-knot" />
    </>
  );
}

/** 로딩 시안 (명세 45). "now" = 지금 모습(남색 먹 달) */
export type FortuneLoadingLook = "now" | "gold" | "ink" | "knot" | "window" | "band";

/**
 * knot 시안의 동심결 매듭(카드 머리 매듭 20px 기호를 그대로 키운 선). 획마다 진척 구간 [a, b]를 맡아 그 구간 동안 그려진다 —
 * 위 고리 → 마름모 → 엮음 넷 → 오른쪽 · 아래 · 왼쪽 고리. 구간은 획 길이에 비례(합 ≈ 110.7). 모양·색은 globals.css(.fortune-loading__knot)
 */
const loop = (cx: number, cy: number, r = 1.7) => `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}`;
const KNOT_STROKES: { d: string; a: number; b: number }[] = [
  { d: loop(10, 2.4), a: 0, b: 0.097 },
  { d: "M10 4L16 10L10 16L4 10Z", a: 0.097, b: 0.403 },
  { d: "M6 8L12 14", a: 0.403, b: 0.48 },
  { d: "M8 6L14 12", a: 0.48, b: 0.557 },
  { d: "M6 12L12 6", a: 0.557, b: 0.634 },
  { d: "M8 14L14 8", a: 0.634, b: 0.71 },
  { d: loop(17.6, 10), a: 0.71, b: 0.807 },
  { d: loop(10, 17.6), a: 0.807, b: 0.903 },
  { d: loop(2.4, 10), a: 0.903, b: 1 },
];

function KnotDrawing() {
  return (
    <svg aria-hidden className="fortune-loading__knot-svg" viewBox="0 0 20 20" fill="none">
      {/* 옅은 자리(다 그려진 매듭) — 움직이지 않는다 */}
      <g className="fortune-loading__knot-ghost">
        {KNOT_STROKES.map((k) => (
          <path key={k.d} d={k.d} />
        ))}
      </g>
      <g className="fortune-loading__knot-ink">
        {KNOT_STROKES.map((k) => (
          <path key={k.d} d={k.d} pathLength={1} style={{ "--a": k.a, "--b": k.b } as CSSProperties} />
        ))}
      </g>
    </svg>
  );
}

export function FortuneLoading({ character, ready = false, look = "now" }: { character?: string; ready?: boolean; look?: FortuneLoadingLook }) {
  void character; // v3.29: 캐릭터는 그리지 않는다 (page.tsx가 넘기는 값은 무시)
  // 서버 렌더(첫 그림)는 0% · 첫 문구 · 옅은 보름달. 클라이언트에서 마운트 시점부터 센다
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

  const pStyle = { "--moon-p": (pct / 100).toFixed(3) } as CSSProperties;
  const bar = {
    role: "progressbar",
    "aria-label": "운세 준비",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.round(pct),
    "aria-valuetext": text,
    "data-ready": ready ? "" : undefined,
  } as const;
  /* 진행 말: 단계가 바뀔 때만 글자가 바뀐다 — key로 다시 그려 120ms 페이드 한 번 */
  const words = (
    <p key={stage} className="fortune-loading__text text-[15px] text-muted">
      {text}
    </p>
  );

  if (look !== "now") {
    /* 명세 45 시안: 진척은 카드에 달아 띠(band) · 매듭(knot) · 창(window) · 달(gold · ink)이 같은 --moon-p를 읽는다 */
    return (
      <section
        className="fortune-loading fortune-card--seal fc--blend card-paper flex flex-col text-ink"
        data-look={look}
        data-ready={ready ? "" : undefined}
        aria-busy={!ready}
        aria-live="polite"
        style={pStyle}
      >
        <BlendFrame />
        <h2 className="fc-top">
          <span className="fc-label">오늘의 운세</span>
        </h2>
        <div className="fortune-loading__body">
          {look === "gold" || look === "ink" ? (
            <span className="fortune-loading__moon" {...bar} />
          ) : look === "knot" ? (
            <span className="fortune-loading__knot" {...bar}>
              <KnotDrawing />
              {/* 주홍 술: ready 때만 한 번 떨어진다(ready의 300ms 자리 안, 반복 없음) */}
              <span aria-hidden className="fortune-loading__tassel" />
            </span>
          ) : look === "window" ? (
            <span className="fortune-loading__window" {...bar} />
          ) : (
            /* band: 가운데 그림 없음 — 진척은 머리 띠의 금빛 뇌문이 보인다. 보조 기술용 진행 막대만 */
            <span className="sr-only" {...bar} />
          )}
          {words}
        </div>
      </section>
    );
  }

  return (
    /* 명세 40: 인장 카드와 같은 틀 — 금색 이중 테 대신 같은 1px 선·모서리 2px·안쪽 여백 24px·같은 라벨 줄, 높이는 닫힌 인장 카드 머리와 같다(globals.css v3.44)
       명세 44: 오늘 화면의 섞은 톤 카드와 같은 테 · 띠 · 매듭과 술(fc--blend) */
    <section className="fortune-loading fortune-card--seal fc--blend card-paper flex flex-col text-ink" aria-busy={!ready} aria-live="polite">
      <BlendFrame />
      <h2 className="fc-top">
        <span className="fc-label">오늘의 운세</span>
      </h2>
      {/* 달 + 말 세로 묶음: 제목 아래 남은 높이의 세로 가운데 */}
      <div className="fortune-loading__body">
        {/* 먹 달 두 겹(같은 상자의 ::before = 옅은 보름달, ::after = 가림 원으로 깎은 진한 달).
            진척(--moon-p 0~1)에 따라 가림 원이 오른쪽으로 빠져나간다 — 모양은 globals.css. 숫자는 보조 기술에만 (role=progressbar) */}
        <span className="fortune-loading__moon" {...bar} style={pStyle} />
        {words}
      </div>
    </section>
  );
}

/**
 * 운세를 끝내 못 받았을 때(FortunePending의 gaveUp) — 로딩 카드와 같은 섞은 톤 틀 · 같은 높이라 로딩 → 실패로 바뀌어도 화면이 튀지 않는다(명세 44 할 일 3).
 * 글과 "다시 시도"는 FortunePending의 지금 실패 카드와 같다. 달 자리(세로 가운데)에 안내 한 줄 + 다시 시도.
 * FortunePending이 아직 옛 틀(card-frame)을 그리므로, 쓰려면 기능 쪽이 gaveUp 분기를 `<FortuneFailed />`로 바꾼다
 */
export function FortuneFailed() {
  return (
    <section className="fortune-loading fortune-loading--failed fortune-card--seal fc--blend card-paper flex flex-col text-ink">
      <BlendFrame />
      <h2 className="fc-top">
        <span className="fc-label">오늘의 운세</span>
      </h2>
      <div className="fortune-loading__body">
        <p className="fortune-loading__failed">운세를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
        <RetryButton />
      </div>
    </section>
  );
}
