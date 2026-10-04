// 공유 카드 문구. 기록이 모자라면 null (카드를 만들지 않는다).
import type { Highlights } from "./stats/ganji";

export interface ShareCardText {
  ganjiKo: string;
  hanja: string;
  eyebrow: string;
  title: string;
  detail: string;
  footer: string;
}

export function shareCardText(h: Highlights, name: string | null): ShareCardText | null {
  const best = h.bestGanji;
  if (!best || best.mean === null) return null;
  const who = name ? `${name}의` : "내";
  return {
    ganjiKo: best.ko,
    hanja: best.hanja,
    eyebrow: `${who} 가장 행복한 날`,
    title: `${best.ko}일`,
    detail: `이 날 ${best.n}번 기록했고 평균 행복도는 ${best.mean.toFixed(1)}이었어요.`,
    footer: `기록 ${h.total}일 · 60가지 날 중 ${60 - h.unseen}가지를 겪었어요`,
  };
}

/** Web Share API에 넣는 글 */
export function shareMessage(t: ShareCardText): { title: string; text: string } {
  return {
    title: "사주읽는밤 일기",
    text: `${t.eyebrow}은 ${t.title}(${t.hanja}). ${t.detail}`,
  };
}
