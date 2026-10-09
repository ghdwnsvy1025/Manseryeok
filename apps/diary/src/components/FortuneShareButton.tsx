"use client";

import { useRef, useState } from "react";
import { recordShareAction } from "@/app/actions";
import { characterOfGanji } from "@/lib/character";
import { drawFortuneShare } from "@/lib/fortuneShareCanvas";
import { formatKoreanDate } from "@/lib/time";

interface Props {
  date: string;
  ganjiKo: string;
  band: string;
  score: number;
  headline: string;
}

/**
 * 운세 카드 안 "공유" (v3.16, 2026-10-10 사용자 결정 A). "오늘의 운세 한 장" 이미지 + 앱 주소.
 * 1) 이미지 파일 공유가 되면 이미지로, 2) 안 되면 글·주소만 공유, 3) 그것도 안 되면 이미지를 내려받고 주소를 복사한다.
 * 공유가 끝나면 서버에 횟수만 남긴다(누가 눌렀는지는 없음, recordShareAction). 모양은 디자이너(.share-btn).
 */
export function FortuneShareButton({ date, ganjiKo, band, score, headline }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const url = window.location.origin;
    const text = `오늘 나는 ${band} ${score.toFixed(1)}점, "${headline}". 내 오늘 운세도 보러 가기`;
    let method: "image" | "link" | "download" | null = null;
    try {
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      const blob = await drawFortuneShare(canvas, {
        dateLabel: formatKoreanDate(date),
        ganjiKo,
        band,
        score,
        headline,
        cardSrc: characterOfGanji(ganjiKo).cardSrc,
        host: window.location.host,
      });
      const file = new File([blob], `오늘의-운세-${date}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: `${text} ${url}` });
        method = "image";
      } else if (nav.share) {
        await nav.share({ text, url });
        method = "link";
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        try {
          await navigator.clipboard.writeText(url);
          setNote("이미지를 저장하고 주소를 복사했어요");
        } catch {
          setNote("이미지를 저장했어요");
        }
        method = "download";
      }
    } catch (e) {
      // 공유 창을 닫은 경우(AbortError)는 조용히
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("공유하지 못했어요. 다시 눌러 주세요");
    } finally {
      setBusy(false);
    }
    if (method) recordShareAction("fortune", method).catch(() => {});
  };

  return (
    <span className="share-btn-wrap">
      <button type="button" onClick={onClick} disabled={busy} className="share-btn tap" aria-label="오늘 운세 공유하기">
        공유
      </button>
      {note && (
        <span role="status" className="share-btn__note">
          {note}
        </span>
      )}
    </span>
  );
}
