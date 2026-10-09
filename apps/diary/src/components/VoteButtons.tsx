"use client";

import { useEffect, useState, useTransition } from "react";
import { fortuneVoteAction } from "@/app/actions";

/**
 * "오늘과 맞았어요?" (v3.14). 누르는 즉시 모양이 바뀐다(낙관적 갱신) — 저장은 뒤에서.
 * 예전엔 form 제출 → 서버 저장 → 화면 전체 다시 그림이라 0.3~1초 멈칫하고, 그때 운세 카드가 처음 상태(밤엔 접힘)로 돌아갔다.
 * 액션은 revalidate하지 않는다(이 화면이 다시 그려지지 않는다). 모양은 globals.css .vote / .vote__btn 그대로.
 */
export function VoteButtons({ date, initial }: { date: string; initial: 1 | -1 | null }) {
  const [vote, setVote] = useState<1 | -1 | null>(initial);
  const [, start] = useTransition();
  const key = `saju-vote:${date}`;

  // 탭을 오가면 30초 캐시(staleTimes)의 옛 값이 그려질 수 있어, 이 세션에서 마지막으로 누른 값을 덮어 쓴다
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(key);
      if (v !== null) setVote(v === "1" ? 1 : v === "-1" ? -1 : null);
    } catch {
      /* 저장소를 못 쓰면 서버 값 그대로 */
    }
  }, [key]);

  const press = (v: 1 | -1) => {
    const next = vote === v ? null : v;
    setVote(next);
    try {
      sessionStorage.setItem(key, String(next ?? 0));
    } catch {
      /* 무시 */
    }
    const fd = new FormData();
    fd.set("date", date);
    fd.set("vote", String(next ?? 0));
    start(() => fortuneVoteAction(fd));
  };

  return (
    <div id="fortune-vote" className="vote mt-4 flex flex-wrap items-center gap-2 text-sm text-muted" data-voted={vote !== null ? "" : undefined}>
      <span className="mr-1">오늘과 맞았어요?</span>
      <button type="button" aria-pressed={vote === 1} onClick={() => press(1)} className="vote__btn">
        맞아요
      </button>
      <button type="button" aria-pressed={vote === -1} onClick={() => press(-1)} className="vote__btn">
        아니에요
      </button>
      {vote !== null && <span className="basis-full break-keep text-[14px] text-muted">고마워요, 내일 운세에 반영해요. 다시 누르면 취소돼요.</span>}
    </div>
  );
}
