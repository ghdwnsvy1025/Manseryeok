// 공유 카드 문구. 기록이 1건이라도 있으면 카드가 생긴다 (0건이면 null).
// ① 같은 간지를 2번 이상 기록한 날 중 가장 행복한 날 ② 없으면 가장 최근 기록 한 줄
import { GANJI_60, STEMS_KO, BRANCHES_KO } from "@saju/engine";
import type { Highlights } from "./stats/ganji";

export interface ShareCardText {
  ganjiKo: string;
  hanja: string;
  eyebrow: string;
  title: string;
  detail: string;
  footer: string;
}

function footerOf(h: Highlights): string {
  return `기록 ${h.total}일 · 60가지 날 중 ${60 - h.unseen}가지를 겪었어요`;
}

export function shareCardText(h: Highlights, name: string | null): ShareCardText | null {
  const who = name ? `${name}의` : "내";
  const best = h.bestGanji;
  if (best && best.mean !== null) {
    return {
      ganjiKo: best.ko,
      hanja: best.hanja,
      eyebrow: `${who} 가장 행복한 날`,
      title: `${best.ko}일`,
      detail: `이 날 ${best.n}번 기록했고 평균 행복도는 ${best.mean.toFixed(1)}이었어요.`,
      footer: footerOf(h),
    };
  }
  const latest = h.latest;
  if (!latest || h.total <= 0) return null;
  const i = latest.day_ganji_index;
  const ko = GANJI_60[i] ? STEMS_KO[i % 10]! + BRANCHES_KO[i % 12]! : `${latest.day_stem}${latest.day_branch}`;
  const hanja = GANJI_60[i] ?? "";
  const first = h.total === 1;
  return {
    ganjiKo: ko,
    hanja,
    eyebrow: first ? `${who} 첫 기록` : `${who} 가장 최근 하루`,
    title: `${ko}일`,
    detail: `${ko}일 · 행복도 ${latest.happiness} · ${first ? "첫 기록" : "가장 최근 기록"}`,
    footer: footerOf(h),
  };
}

/** Web Share API에 넣는 글 */
export function shareMessage(t: ShareCardText): { title: string; text: string } {
  return {
    title: "사주읽는밤 일기",
    text: `${t.eyebrow}은 ${t.title}(${t.hanja}). ${t.detail}`,
  };
}
