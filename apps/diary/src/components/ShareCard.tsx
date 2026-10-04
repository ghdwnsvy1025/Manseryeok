"use client";

import { useRef, useState } from "react";
import type { ShareCardText } from "@/lib/share";
import { canvasToPng, drawShareCard } from "@/lib/shareCanvas";

interface Props {
  /** 같은 간지 2번 이상이면 값이 있고, 아니면 null */
  card: ShareCardText | null;
  title: string;
  text: string;
}

/** 브라우저에서 카드를 그려 공유 시트로 넘긴다. 공유가 안 되는 환경이면 내려받는다 */
export function ShareCard({ card, title, text }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    if (!card || !canvasRef.current) return;
    setBusy(true);
    setNote(null);
    try {
      await drawShareCard(canvasRef.current, card, `/characters/${card.ganjiKo}.webp`);
      const blob = await canvasToPng(canvasRef.current);
      const fileName = `saju-night-${card.ganjiKo}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ title, text, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        setNote("이미지를 내려받았어요. 갤러리에서 공유할 수 있어요.");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      console.error(e);
      setNote("카드를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-[15px] font-bold">내 카드 공유</p>
      <p className="mt-0.5 text-sm text-muted">
        {card ? `가장 행복한 날 ${card.title}을 60갑자 카드로 만들어요.` : "같은 간지 날을 두 번 이상 기록하면 카드가 열려요."}
      </p>
      <button
        type="button"
        onClick={share}
        disabled={!card || busy}
        className="mt-3 h-10 rounded-full bg-lamp px-4 text-sm font-bold text-lamp-ink disabled:opacity-40"
      >
        {busy ? "만드는 중…" : "카드 공유"}
      </button>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </div>
  );
}
