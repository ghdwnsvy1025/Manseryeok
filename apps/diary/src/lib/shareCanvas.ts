// 공유 이미지 캔버스 도우미 (v3.17: 옛 "내 카드 공유" 그리기는 지웠다 — 지금은 fortuneShareCanvas.ts가 이 도우미를 쓴다).
// 서버 이미지 렌더러(satori)는 webp와 한글 글꼴을 못 다뤄서 클라이언트에서 그린다. 서버 비용도 없다.

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

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 변환 실패"))), "image/png");
  });
}
