"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** 그날 간지 한글 ("임자"). 카드 파일은 /cards/{간지}.webp (바이럴 60갑자 세트 복사본) */
  ganjiKo: string;
  happiness: number;
  /** 같은 저장을 두 번 터뜨리지 않기 위한 열쇠 (날짜·내용). 바뀌면 다시 터진다 */
  signature: string;
}

/** 키트 sprite sheet(1024×1024) 안의 조각 위치 [x, y, w, h] — ui-kit/pop-pieces.json에서 측정 */
const PAPER_BITS: [number, number, number, number][] = [
  [80, 68, 312, 232],
  [652, 68, 308, 268],
  [416, 268, 224, 280],
  [80, 416, 260, 224],
  [724, 420, 236, 252],
  [440, 624, 212, 332],
  [76, 728, 320, 204],
  [748, 748, 212, 216],
];
const GOLD_BITS: [number, number, number, number][] = [
  [164, 104, 192, 188],
  [764, 192, 208, 144],
  [436, 340, 212, 224],
  [788, 492, 152, 120],
  [72, 592, 248, 128],
  [648, 728, 152, 148],
  [252, 820, 160, 112],
  [564, 108, 84, 84],
];
const SHEET = 1024;

/** 조각 하나 — 1024 시트의 [x,y,w,h] 영역을 size px 폭으로 잘라 보이고, (dx,dy)로 날아간다 */
function Bit({ kind, box, size, dx, dy, rot }: { kind: "paper" | "gold"; box: [number, number, number, number]; size: number; dx: number; dy: number; rot: number }) {
  const [x, y, w, h] = box;
  const style: CSSProperties & Record<"--dx" | "--dy" | "--rot", string> = {
    width: size,
    height: (size * h) / w,
    backgroundSize: `${(SHEET / w) * 100}% ${(SHEET / h) * 100}%`,
    backgroundPosition: `${(x / (SHEET - w)) * 100}% ${(y / (SHEET - h)) * 100}%`,
    "--dx": `${dx}px`,
    "--dy": `${dy}px`,
    "--rot": `${rot}deg`,
  };
  return <span aria-hidden className={`burst-bit burst-bit--${kind}`} style={style} />;
}

/**
 * 저장 완료 보상 "팡" (톤 v3.1 — 색종이 금지의 유일한 예외).
 * 한지 반투명 오버레이 → 그날 간지의 바이럴 카드가 팡 → 뒤에서 한지 조각 8·금빛 가루 8이 흩어진다 → 1.5초 뒤 걷힌다.
 * 탭하면 바로 닫힌다. reduced-motion이면 팡·흩날림 없이 카드만 보이고 1초 뒤 걷힌다.
 * 오늘 화면(/?saved=날짜)에서 한 번만 뜬다. 저장 자체는 서버 액션이 끝낸 뒤라 성공이 보장된다.
 */
export function SaveBurst({ ganjiKo, happiness, signature }: Props) {
  const [phase, setPhase] = useState<"hidden" | "open" | "closing">("hidden");

  useEffect(() => {
    const key = `saju-burst:${signature}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 저장소를 못 써도 한 번은 보여 준다 */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("open");
    try {
      navigator.vibrate?.(30);
    } catch {
      /* 진동 미지원 */
    }
    const t = window.setTimeout(() => setPhase("closing"), reduced ? 1000 : 1500);
    return () => window.clearTimeout(t);
  }, [signature]);

  useEffect(() => {
    if (phase !== "closing") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setPhase("hidden"), reduced ? 0 : 200);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

  // 16조각이 둥글게 퍼진다. 방향·거리·회전은 고정값 — 매번 같아야 "장치"가 아니라 "물건"으로 읽힌다
  const bits = [...PAPER_BITS.map((b) => ({ kind: "paper" as const, box: b })), ...GOLD_BITS.map((b) => ({ kind: "gold" as const, box: b }))].map(
    (bit, i) => {
      const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.25 : -0.15);
      // 카드 반폭 ~116px·반높이 ~160px(375px 화면) 바깥까지 날아가야 보인다
      const dist = 200 + (i % 3) * 40 + (bit.kind === "gold" ? 30 : 0);
      return { ...bit, dx: Math.round(Math.cos(angle) * dist), dy: Math.round(Math.sin(angle) * dist), rot: (i % 2 ? 1 : -1) * (40 + (i % 4) * 25), size: bit.kind === "paper" ? 44 + (i % 3) * 8 : 18 + (i % 3) * 6 };
    },
  );

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-closing={phase === "closing" ? "" : undefined}
      onClick={() => setPhase("closing")}
      className="burst-overlay fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-paper/85"
    >
      <div className="relative flex w-[62vw] max-w-[320px] flex-col items-center">
        {bits.map((b, i) => (
          <Bit key={i} {...b} />
        ))}
        <img
          src={`/cards/${ganjiKo}.webp`}
          alt={`${ganjiKo}일 카드`}
          width={768}
          height={1030}
          className="burst-card relative h-auto w-full"
        />
      </div>
      <p className="burst-text mt-6 text-center">
        <span className="block font-serif text-[22px] leading-snug text-ink">{ganjiKo}일 카드를 모았어요</span>
        <span className="mt-1 block text-[16px] text-muted">행복도 {happiness}</span>
      </p>
    </div>,
    document.body,
  );
}
