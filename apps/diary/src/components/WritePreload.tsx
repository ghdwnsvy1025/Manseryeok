import { BURST_ASSETS } from "@/components/BurstPreload";

/**
 * 쓰기 화면의 키트 그림을 미리 받아 둔다 (2026-10-08 진단). 도장 빈 자리·띠지·쪽지·괘선은 CSS 배경이라
 * 스타일시트 적용 뒤(첫 그리기 뒤)에야 요청이 나가 폰에서 도장이 '민짜'로 1~2초 떠 있었다.
 * 서버 컴포넌트 — React 19가 <link>를 <head>로 끌어올린다. 저장 뒤 팡 그림(BurstPreload)은 write/page.tsx가 따로 그린다.
 */
export const WRITE_ASSETS = [
  "/ui/stamp-empty-clean.webp",
  "/ui/stamp-inked-red-clean.png",
  "/ui/stamp-inked-ink-clean.png",
  "/ui/tag-strip-paper-clean.webp",
  "/ui/tag-strip-navy-clean.webp",
  "/ui/note-slip-clean.png",
  "/ui/ruled-paper-clean.webp",
] as const;

export function WritePreload() {
  return (
    <>
      {WRITE_ASSETS.filter((href) => !(BURST_ASSETS as readonly string[]).includes(href)).map((href) => (
        <link key={href} rel="preload" as="image" href={href} />
      ))}
    </>
  );
}
