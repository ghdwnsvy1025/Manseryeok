// 공유 카드를 브라우저 캔버스로 그린다 (1080×1350).
// 서버 이미지 렌더러(satori)는 webp와 한글 글꼴을 못 다뤄서 클라이언트에서 그린다. 서버 비용도 없다.
import type { ShareCardText } from "./share";

export const CARD_W = 1080;
export const CARD_H = 1350;

const COLORS = {
  paper: "#f3e7c9",
  paper2: "#faf3e0",
  frame: "#7f8c4b",
  line: "#d8c89f",
  ink: "#2b2417",
  muted: "#6f6047",
  gold: "#c99a2e",
  ganji: "#1f3f73",
};

const SERIF = '"Gowun Batang", "AppleMyungjo", "Batang", serif';
const SANS = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 글이 폭을 넘으면 줄을 나눈다 (한글은 글자 단위) */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    const next = cur + ch;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch === " " ? "" : ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function drawShareCard(canvas: HTMLCanvasElement, text: ShareCardText, characterSrc: string): Promise<void> {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 없음");

  // 웹폰트가 아직 안 내려왔으면 기다린다. 실패해도 시스템 글꼴로 그린다
  try {
    await Promise.all([document.fonts.load(`700 150px ${SERIF}`), document.fonts.load(`700 40px ${SANS}`)]);
  } catch {
    // 무시
  }
  const img = await loadImage(characterSrc);

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const pad = 72;
  roundRect(ctx, pad, pad, CARD_W - pad * 2, CARD_H - pad * 2, 36);
  ctx.fillStyle = COLORS.paper2;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLORS.frame;
  ctx.stroke();

  const x = pad + 56;
  let y = pad + 56;
  const innerW = CARD_W - (pad + 56) * 2;

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText(text.eyebrow, x, y);
  y += 60;

  ctx.fillStyle = COLORS.ganji;
  ctx.font = `700 150px ${SERIF}`;
  ctx.fillText(text.hanja, x, y);
  const hanjaW = ctx.measureText(text.hanja).width;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 64px ${SERIF}`;
  ctx.fillText(text.title, x + hanjaW + 28, y + 150 - 64 - 14);
  y += 190;

  const imgSize = 560;
  const imgY = y + 10;
  if (img) {
    ctx.drawImage(img, (CARD_W - imgSize) / 2, imgY, imgSize, imgSize);
  } else {
    ctx.fillStyle = COLORS.ganji;
    ctx.font = `700 320px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText(text.hanja, CARD_W / 2, imgY + 100);
    ctx.textAlign = "left";
  }
  y = imgY + imgSize + 40;

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 40px ${SANS}`;
  for (const line of wrapText(ctx, text.detail, innerW)) {
    ctx.fillText(line, x, y);
    y += 56;
  }

  const footY = CARD_H - pad - 56 - 40;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, footY - 24);
  ctx.lineTo(x + innerW, footY - 24);
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText(text.footer, x, footY);
  ctx.fillStyle = COLORS.gold;
  ctx.textAlign = "right";
  ctx.fillText("사주읽는밤 일기", x + innerW, footY);
  ctx.textAlign = "left";
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 변환 실패"))), "image/png");
  });
}
