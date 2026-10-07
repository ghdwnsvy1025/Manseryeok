/**
 * 저장 완료 "팡"(SaveBurst)에 쓰이는 그림을 미리 받아 둔다 (전수조사 B8).
 * 쓰기 화면이 열릴 때와 /?saved=오늘 분기에서 그린다. 서버 컴포넌트 — React 19가 <link>를 <head>로 끌어올린다.
 * 그날 일진 캐릭터 · char-frame 틀 · 인주 도장 · 팡 조각(한지·금빛 가루).
 */
export const BURST_ASSETS = ["/ui/char-frame-clean.webp", "/ui/stamp-inked-red-clean.png", "/ui/pop-paper-bits-clean.png", "/ui/pop-gold-dust-clean.png"] as const;

export function BurstPreload({ characterSrc }: { characterSrc: string }) {
  return (
    <>
      {[characterSrc, ...BURST_ASSETS].map((href) => (
        <link key={href} rel="preload" as="image" href={href} />
      ))}
    </>
  );
}
