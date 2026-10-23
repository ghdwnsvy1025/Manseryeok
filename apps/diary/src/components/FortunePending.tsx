"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fortuneReadyAction } from "@/app/actions";
import { FortuneLoading } from "./FortuneLoading";
import { RetryButton } from "./RetryButton";

/** 첫 확인까지 2.5초, 그 뒤 3초마다. 모델 호출은 보통 5~20초, 재시도·검수까지 길면 40초 남짓 */
const FIRST_MS = 2500;
const EVERY_MS = 3000;
/** 이만큼 물어도 안 오면 "불러오지 못했어요 · 다시 시도". 25번 × 3초 ≈ 75초 — 서버 함수 상한(60초)보다 조금 길게 */
const MAX_CHECKS = 25;

/**
 * 운세 카드 자리 — 오늘 운세가 아직 만들어지는 중일 때 (오늘 화면 startFortune 참고).
 * 보이는 건 FortuneLoading 그대로("오늘 글자를 읽고 있어요"). 뒤에서 몇 초마다 서버에 캐시가 생겼는지 묻고,
 * 생기면 router.refresh()로 서버가 다시 그려 FortuneCard로 바뀐다 (이 컴포넌트는 그때 사라진다).
 * 앱을 내려 둔 동안(document.hidden)은 묻지 않고 세지도 않는다 — 돌아오면 바로 한 번 묻는다.
 */
export function FortunePending({ character, date, fingerprint }: { character?: string; date: string; fingerprint: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let stopped = false;
    let checks = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };
    const tick = async () => {
      if (stopped) return;
      if (document.hidden) return; // visibilitychange가 다시 깨운다
      checks += 1;
      try {
        const state = await fortuneReadyAction(date, fingerprint);
        if (stopped) return;
        if (state === "ready") router.refresh();
      } catch (e) {
        console.warn("운세 준비 확인 실패", e);
      }
      if (checks >= MAX_CHECKS) {
        setGaveUp(true);
        return;
      }
      schedule(EVERY_MS);
    };
    const onVisible = () => {
      if (!document.hidden && !stopped) schedule(300);
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule(FIRST_MS);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [date, fingerprint, router]);

  if (gaveUp) {
    return (
      <section className="card-frame card-light card-paper p-5 text-muted">
        <h2 className="text-lg font-bold text-ink">오늘의 운세</h2>
        <p className="mt-2 text-[15px]">운세를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
        <RetryButton className="mt-1" />
      </section>
    );
  }
  return <FortuneLoading character={character} />;
}
