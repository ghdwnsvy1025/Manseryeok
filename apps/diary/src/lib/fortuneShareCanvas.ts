// "오늘의 운세 한 장" 공유 이미지 (v3.16, 2026-10-10 사용자 결정 A). 브라우저 캔버스로 그린다(서버 비용 없음).
// 담는 것: 오늘 간지 정사각 카드 · 단계와 점수 · 헤드라인 · 앱 주소. 행복도·메모 같은 일기 내용은 넣지 않는다(개인 기록).
import { canvasToPng, wrapText } from "./shareCanvas";

export const FS_W = 1080;
export const FS_H = 1350;

// 색은 globals.css 토큰과 맞춘다(paper/paper-2/frame/ink/muted/ganji). 점수 금빛만 큰 글자 대비 3:1을 넘기려 gold보다 진하게(#8a6420, 4.5:1).
const C = { paper: "#f1debb", paper2: "#f8ecd1", frame: "#767b3c", ink: "#2b2417", muted: "#6f6047", gold: "#8a6420", ganji: "#1f3f73" };

export interface FortuneShareInput {
  /** "10월 10일 토요일" */
  dateLabel: string;
  ganjiKo: string;
  band: string;
  score: number;
  headline: string;
  cardSrc: string;
  /** 이미지 아래에 적을 주소 (예: saju-diary-fm.vercel.app) */
  host: string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** next/font가 만든 실제 글꼴 이름(CSS 변수)을 읽는다. 없으면 시스템 명조 */
function fontFamily(varName: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || getComputedStyle(document.body).getPropertyValue(varName).trim();
    return v ? `${v}, ${fallback}` : fallback;
  } catch {
    return fallback;
  }
}

export async function drawFortuneShare(canvas: HTMLCanvasElement, input: FortuneShareInput): Promise<Blob> {
  canvas.width = FS_W;
  canvas.height = FS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 없음");
  const SERIF = fontFamily("--font-song", '"AppleMyungjo", "Batang", serif');
  const SANS = '"Pretendard Variable", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  try {
    await Promise.all([document.fonts.load(`400 80px ${SERIF}`), document.fonts.load(`700 34px ${SANS}`)]);
  } catch {
    /* 시스템 글꼴로 그린다 */
  }
  const img = await loadImage(input.cardSrc);

  // 바탕 + 녹갈 이중선 틀
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, FS_W, FS_H);
  ctx.fillStyle = C.paper2;
  ctx.fillRect(48, 48, FS_W - 96, FS_H - 96);
  ctx.strokeStyle = C.frame;
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, FS_W - 96, FS_H - 96);
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, FS_W - 128, FS_H - 128);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // 머리: 날짜 + 간지
  ctx.fillStyle = C.muted;
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText("오늘의 운세", FS_W / 2, 112);
  ctx.fillStyle = C.ink;
  ctx.font = `400 44px ${SERIF}`;
  ctx.fillText(`${input.dateLabel} ${input.ganjiKo}일`, FS_W / 2, 166);

  // 카드
  const size = 560;
  const cx = (FS_W - size) / 2;
  const cy = 248;
  if (img) ctx.drawImage(img, cx, cy, size, size);

  // 단계 + 점수
  ctx.font = `400 96px ${SERIF}`;
  const bandW = ctx.measureText(input.band).width;
  ctx.font = `400 76px ${SERIF}`;
  const scoreText = input.score.toFixed(1);
  const scoreW = ctx.measureText(scoreText).width;
  const gap = 28;
  const startX = FS_W / 2 - (bandW + gap + scoreW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  ctx.font = `400 96px ${SERIF}`;
  ctx.fillText(input.band, startX, cy + size + 40);
  ctx.fillStyle = C.gold;
  ctx.font = `400 76px ${SERIF}`;
  ctx.fillText(scoreText, startX + bandW + gap, cy + size + 58);

  // 헤드라인 (최대 2줄)
  ctx.textAlign = "center";
  ctx.fillStyle = C.ink;
  ctx.font = `400 50px ${SERIF}`;
  const lines = wrapText(ctx, input.headline, FS_W - 260).slice(0, 2);
  lines.forEach((l, i) => ctx.fillText(l, FS_W / 2, cy + size + 170 + i * 66));

  // 바닥: 앱 이름 + 주소
  ctx.fillStyle = C.muted;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText("사주읽는밤 일기에서 내 오늘 운세 보기", FS_W / 2, FS_H - 170);
  ctx.fillStyle = C.ganji;
  ctx.font = `700 32px ${SANS}`;
  ctx.fillText(input.host, FS_W / 2, FS_H - 124);

  return canvasToPng(canvas);
}
