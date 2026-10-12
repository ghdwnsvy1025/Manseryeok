// 손맛 효과 (v3.20, 2026-10-12 사용자 결정 Q1 = A · Q2 = A). 화면 배치를 건드리지 않게 화면 위(fixed) 레이어에 잠깐 그렸다 지운다.
// - inkAt: 누른 자리에 옅은 먹물 번짐 한 번 (.ink-bloom) — TouchFx가 모든 누를 수 있는 요소에 붙인다
// - celebrate: 보상 순간에만 금빛 가루가 톡 튄다 (.gold-dust) — 투표 "맞아요", "해봤어요", 카드 첫 만남, 연속 7·30일, 오늘 칸 도장
// 움직임 줄이기 설정이면 아무것도 그리지 않는다. 모양·움직임은 디자이너(globals.css .fx-layer .ink-bloom .gold-dust).

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function layer(): HTMLElement {
  let el = document.getElementById("fx-layer");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-layer";
    el.className = "fx-layer";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

function spawn(className: string, x: number, y: number, vars: Record<string, string> = {}, life = 700): void {
  const s = document.createElement("span");
  s.className = className;
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  for (const [k, v] of Object.entries(vars)) s.style.setProperty(k, v);
  layer().appendChild(s);
  window.setTimeout(() => s.remove(), life);
}

/** 짧은 진동 (안드로이드). iOS 사파리는 지원하지 않아 조용히 넘어간다 */
export function buzz(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 미지원 */
  }
}

export function inkAt(x: number, y: number): void {
  if (reducedMotion()) return;
  spawn("ink-bloom", x, y, {}, 500);
}

/** 요소 가운데(또는 좌표)에서 금빛 가루 10알이 둥글게 튄다 */
export function celebrate(target: Element | { x: number; y: number } | null): void {
  if (!target || reducedMotion()) return;
  let x: number, y: number;
  if ("getBoundingClientRect" in target) {
    const r = target.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else {
    ({ x, y } = target);
  }
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
    const d = 34 + (i % 3) * 12;
    spawn("gold-dust", x, y, { "--dx": `${Math.round(Math.cos(a) * d)}px`, "--dy": `${Math.round(Math.sin(a) * d)}px`, "--s": `${5 + (i % 3) * 2}px` }, 800);
  }
  buzz(14);
}
