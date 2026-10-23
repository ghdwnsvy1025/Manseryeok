"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createBootWait } from "@/lib/bootWait";
import { createClient } from "@/lib/supabase/client";
import { PageSkeleton } from "./PageSkeleton";
import { RetryButton } from "./RetryButton";

/**
 * 세션이 아직 없는 첫 요청의 화면 (B2, docs/ANON_START.md 1절). 다섯 화면(오늘·쓰기·나·설정·온보딩)이 같이 쓴다.
 * 처음엔 PageSkeleton과 똑같은 뼈대만. 5초가 지나도 세션이 안 생기면 "준비하고 있어요 · 다시 시도" 카드로 바뀐다.
 * AnonBoot가 세션을 만들고 router.refresh()하면 서버가 진짜 화면을 그려 이 컴포넌트는 사라진다.
 *
 * 2026-10-23: 이 기기엔 세션이 있는데 서버가 못 본 경우도 있다 — 토큰이 만료돼 브라우저 쪽에서 방금 갱신됐거나,
 * 서버의 서명 키 확인이 잠깐 실패했을 때. AnonBoot는 "세션 있음"이면 아무것도 안 해 뼈대 → 5초 뒤 "준비하고 있어요"에
 * 갇혔다(앱을 열 때마다 오류처럼 보임). 그래서 여기서 세션이 있으면 한 번 다시 그려 달라고 한다.
 * 이 컴포넌트는 refresh 뒤에도 같은 자리라 효과가 다시 돌지 않는다 — 무한 반복 없음.
 */
export function Booting({ title, cards = 2 }: { title: string; cards?: number }) {
  const router = useRouter();
  const [wait] = useState(createBootWait);
  const expired = useSyncExternalStore(wait.subscribe, wait.getSnapshot, wait.getServerSnapshot);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session) router.refresh();
      })
      .catch((e) => console.warn("세션 확인 실패", e));
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!expired) return <PageSkeleton title={title} cards={cards} />;

  return (
    <main className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-[26px] leading-snug">{title}</h1>
      </header>
      <section className="card-frame card-paper p-5" aria-busy="true" aria-live="polite">
        <span aria-hidden className="brush-loading" />
        <p className="mt-3 text-[15px] text-muted">준비하고 있어요</p>
        <RetryButton className="mt-3" />
      </section>
    </main>
  );
}
