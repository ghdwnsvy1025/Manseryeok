"use client";

import { useState, useSyncExternalStore } from "react";
import { createBootWait } from "@/lib/bootWait";
import { PageSkeleton } from "./PageSkeleton";
import { RetryButton } from "./RetryButton";

/**
 * 세션이 아직 없는 첫 요청의 화면 (B2, docs/ANON_START.md 1절). 다섯 화면(오늘·쓰기·나·설정·온보딩)이 같이 쓴다.
 * 처음엔 PageSkeleton과 똑같은 뼈대만. 5초가 지나도 세션이 안 생기면 "준비하고 있어요 · 다시 시도" 카드로 바뀐다.
 * AnonBoot가 세션을 만들고 router.refresh()하면 서버가 진짜 화면을 그려 이 컴포넌트는 사라진다.
 */
export function Booting({ title, cards = 2 }: { title: string; cards?: number }) {
  const [wait] = useState(createBootWait);
  const expired = useSyncExternalStore(wait.subscribe, wait.getSnapshot, wait.getServerSnapshot);

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
