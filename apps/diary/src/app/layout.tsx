import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Song_Myung } from "next/font/google";
import { AnonBoot } from "@/components/AnonBoot";
import { BottomNav } from "@/components/BottomNav";
import { TouchFx } from "@/components/TouchFx";
import { PwaRegister } from "@/components/PwaRegister";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

// 한글 글꼴은 서브셋 지정이 안 돼 미리 불러오지 않는다.
// 톤 v3: 제목·숫자 송명, 사용자 메모 나눔펜, 한자 폴백 고운바탕. 본문 Pretendard는 바이럴과 같은 CDN을 <link>로.
// variable dynamic-subset: 글자 범위별로 잘라 쓰는 글자만 받는다. CSS 53KB (static 전체본은 폰에서 1.5MB, static subset은 CSS만 550KB — 2026-10-07 성능 조사)
// 송명은 타입 정의에 preload가 빠져 있지만 런타임은 서브셋 없이 미리 불러오기를 거부한다 (next/font는 리터럴만 받아 spread 불가)
// @ts-expect-error -- preload는 런타임에서 유효
const song = Song_Myung({ weight: "400", preload: false, variable: "--font-song", display: "swap" });
const gowun = Gowun_Batang({ weight: ["400", "700"], preload: false, variable: "--font-gowun", display: "swap" });
const PRETENDARD_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: "사주읽는밤 일기",
  description: "밤에 한 줄 쓰면, 내 기록으로 운세가 점점 내 것이 됩니다.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "사주읽는밤" },
  icons: { icon: "/icons/favicon-48.png", apple: "/icons/apple-touch-icon.png" },
  // 링크 미리보기(카톡·스레드·인스타): scripts/build-og.mjs가 만든 public/og.jpg — 앱 아이콘과 같은 붓 초승달.
  // 절대 주소는 metadataBase: NEXT_PUBLIC_SITE_URL이 있으면 그것, 없으면 Vercel이 넣는 VERCEL_PROJECT_PRODUCTION_URL(Next 15 기본)
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "사주읽는밤 일기",
    title: "사주읽는밤 일기",
    description: "밤에 한 줄 쓰면, 내 기록으로 운세가 점점 내 것이 됩니다.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "사주읽는밤 일기 — 한지 위 붓 한 획 초승달" }],
  },
  twitter: { card: "summary_large_image", title: "사주읽는밤 일기", description: "밤에 한 줄 쓰면, 내 기록으로 운세가 점점 내 것이 됩니다.", images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  themeColor: "#f1debb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${song.variable} ${gowun.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} />
      </head>
      <body className="antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 pb-28">{children}</div>
        <BottomNav />
        <PwaRegister />
        {/* 첫 방문에 익명 세션 하나 (docs/ANON_START.md) */}
        <AnonBoot />
        {/* v3.20: 기본 터치감 — 누른 자리 먹물 번짐 + 짧은 진동 */}
        <TouchFx />
        {/* 이용 통계 (PostHog): 경로마다 pageview, 로그인 사용자 식별. 이벤트 목록은 docs/측정.md */}
        <Analytics />
      </body>
    </html>
  );
}
