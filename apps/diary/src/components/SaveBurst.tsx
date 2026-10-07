"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

interface Props {
  /**
   * save 모드(v3.5): 오늘 일진 한글 ("갑인"). 틀 안 간지 글자와 "{ganjiKo}일 카드에 오늘 도장을 찍었어요"에 쓴다.
   * reveal 모드: 내 일주 한글 ("기축").
   */
  ganjiKo: string;
  /** 오늘 일진 한자 ("甲寅", save 모드). 틀 안 간지 글자 옆에 ink색으로 */
  ganjiHanja?: string;
  /** reveal 모드 전용 — 내 일주 카드 전체 (characterOf().cardSrc = /cards/{일주}.webp) */
  cardSrc?: string;
  /** save 모드(v3.5) — 오늘 일진의 캐릭터 그림 (characterOfGanji(today).characterSrc = /characters/{간지}.webp). char-frame 틀 안에 들어간다 */
  characterSrc?: string;
  /** 오늘 행복도. reveal 모드에서는 쓰지 않는다 */
  happiness?: number;
  /** 같은 저장을 두 번 터뜨리지 않기 위한 열쇠 (날짜·내용). 바뀌면 다시 터진다. reveal 모드에서는 쓰지 않는다 */
  signature?: string;
  /** 오늘의 작은 약속을 지킨 날 (톤 v3.2) → 카드가 금테. 시각은 디자이너가 data-kept로 입힌다 */
  kept?: boolean;
  /** 지난 도장들: 최근 7개 기록의 행복도 (오늘 제외, 최신순). 카드 아래 가장자리에 작은 인주 점으로 — 시각은 디자이너 */
  recentHappiness?: number[];
  /**
   * "save"(기본) = 저장 완료 팡: 오버레이 + 도장 + 글자 + 1.5초 뒤 자동으로 걷힘.
   * "reveal" = /welcome 카드 등장: 오버레이·도장·글자·자동 닫힘 없이 카드 팡만 제자리에서 (글·버튼은 부모가 둔다).
   */
  mode?: "save" | "reveal";
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
 * 한지 반투명 오버레이 → 오늘 일진 캐릭터를 char-frame 틀에 넣은 카드(v3.5)가 팡 → 뒤에서 한지 조각 8·금빛 가루 8이 흩어진다 → 1.5초 뒤 걷힌다.
 * 탭하면 바로 닫힌다. reduced-motion이면 팡·흩날림 없이 카드만 보이고 1초 뒤 걷힌다.
 * 오늘 화면(/?saved=날짜)에서 한 번만 뜬다. 저장 자체는 서버 액션이 끝낸 뒤라 성공이 보장된다.
 */
export function SaveBurst({ ganjiKo, ganjiHanja, cardSrc, characterSrc, happiness, signature = "", kept = false, recentHappiness = [], mode = "save" }: Props) {
  const [phase, setPhase] = useState<"hidden" | "open" | "closing">("hidden");
  const reveal = mode === "reveal";
  // 이 인스턴스가 이미 한 번 열었는지. 개발 모드 StrictMode가 effect를 두 번 돌릴 때
  // 두 번째 실행이 sessionStorage 열쇠를 보고 빠져나가 닫힘 타이머가 사라지는 것을 막는다
  const opened = useRef(false);

  useEffect(() => {
    if (reveal) {
      setPhase("open");
      return;
    }
    const key = `saju-burst:${signature}`;
    try {
      if (sessionStorage.getItem(key) && !opened.current) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 저장소를 못 써도 한 번은 보여 준다 */
    }
    opened.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("open");
    try {
      navigator.vibrate?.(30);
    } catch {
      /* 진동 미지원 */
    }
    const t = window.setTimeout(() => setPhase("closing"), reduced ? 1000 : 1500);
    return () => window.clearTimeout(t);
  }, [signature, reveal]);

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

  const cardBlock = (
    <div className="relative flex w-[62vw] max-w-[320px] flex-col items-center">
      {bits.map((b, i) => (
        <Bit key={i} {...b} />
      ))}
      {reveal || !characterSrc ? (
        // reveal (/welcome): 내 일주 카드 전체 — 여기만 바이럴 카드
        <img src={cardSrc} alt={`${ganjiKo} 카드`} width={768} height={1030} data-kept={kept ? "" : undefined} className="burst-card relative h-auto w-full" />
      ) : (
        // save (v3.5): char-frame 틀(3:4) 안에 위 간지 글자 · 가운데 오늘 일진 캐릭터 · 아래 행복도 인주 도장. 설명·별점 없음
        <div data-kept={kept ? "" : undefined} className="burst-card char-card relative w-full">
          <p className="char-card__ganji font-serif text-[22px] leading-none">
            <span className="text-ganji">{ganjiKo}</span>
            {ganjiHanja && <span className="ml-2 text-ink">{ganjiHanja}</span>}
          </p>
          <img src={characterSrc} alt={`${ganjiKo} 캐릭터`} width={777} height={900} className="char-card__figure" />
          {/* 행복도 인주 도장 — 카드 팡 150ms 뒤 꽝 (v3.2). 숫자 한지색 */}
          {happiness !== undefined && (
            <span className="burst-stamp" aria-label={`행복도 ${happiness}`}>
              {happiness}
            </span>
          )}
        </div>
      )}
      {/* 지난 도장들 (v3.3 → v3.5에서 틀 아래 바깥으로): 최근 7개, 최신순. 번호 없음. 12px 인주 점, 간격 6px.
          점의 농도 = 그날 행복도 (--h). 글자와 같은 150ms 뒤에 나타난다 */}
      {!reveal && recentHappiness.length > 0 && (
        <ul className="burst-past" aria-label="지난 도장들">
          {recentHappiness.map((h, i) => (
            <li key={i} data-happiness={h} className="burst-past__dot" style={{ "--h": h } as CSSProperties} />
          ))}
        </ul>
      )}
    </div>
  );

  // reveal (/welcome): 오버레이 없이 제자리에서 카드만 팡. 닫히지 않는다
  if (reveal) return cardBlock;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-closing={phase === "closing" ? "" : undefined}
      onClick={() => setPhase("closing")}
      className="burst-overlay fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-paper/85"
    >
      {cardBlock}
      <p className="burst-text mt-6 text-center">
        <span className="block font-serif text-[22px] leading-snug text-ink">{ganjiKo}일 카드에 오늘 도장을 찍었어요</span>
      </p>
    </div>,
    document.body,
  );
}
