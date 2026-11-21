import type { VersusDay } from "@/lib/stats/insight";

/**
 * "예상은 맞았을까?"의 채점 붓 표시 (명세 54, 톤 v3.58): ○ 예상과 같았어요(인주) · △ 그 사이였어요(muted) · × 달랐어요(먹).
 * 옥색 · 주홍은 "좋을 날 · 조심할 날"(무엇을 예상했나)에 쓰이므로 결과 표시에는 쓰지 않는다 — 한 줄에서 예상과 결과가 색으로 섞이지 않게.
 * 손으로 그은 꼴: ○는 끝이 살짝 겹치고, ×는 두 획이 조금 휘고, △는 꼭대기에서 끝이 어긋난다. 그림 파일이 아니라 선.
 */
export type VersusResult = VersusDay["result"];

export const RESULT_WORD: Record<VersusResult, string> = { same: "같았어요", between: "그 사이였어요", opposite: "달랐어요" };
/** 모아 놓는 차례: ○ → △ → × */
export const RESULT_ORDER: VersusResult[] = ["same", "between", "opposite"];

const PATHS: Record<VersusResult, string[]> = {
  same: ["M13.2 3.3 C7.2 2.4 2.9 6.9 3.1 12.3 C3.3 17.7 7.5 21.1 12.5 20.9 C17.7 20.7 21.2 16.7 20.9 11.7 C20.6 7.2 17.2 3.6 11.2 3.9"],
  between: ["M12.3 3.4 L20.9 19.7 L3.2 19.3 L12.9 3.9"],
  opposite: ["M4.8 4.4 C9.4 9.4 14.2 14.6 19.5 19.8", "M19.4 4.2 C14.8 9.2 9.9 14.4 4.6 20"],
};

export function VersusMark({ result, size = 20, label = true }: { result: VersusResult; size?: number; /** 읽어 주는 글을 붙일지 — 띠 안에서는 띠가 한 번에 읽는다 */ label?: boolean }) {
  return (
    <svg className="vmark" data-result={result} viewBox="0 0 24 24" width={size} height={size} {...(label ? { role: "img", "aria-label": RESULT_WORD[result] } : { "aria-hidden": true })} focusable="false">
      {PATHS[result].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
