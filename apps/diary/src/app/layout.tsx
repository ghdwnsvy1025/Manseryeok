import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

// 한글 글꼴은 서브셋 지정이 안 돼 미리 불러오지 않는다
const noto = Noto_Sans_KR({ weight: ["400", "500", "700"], preload: false, variable: "--font-noto", display: "swap" });
const gowun = Gowun_Batang({ weight: ["400", "700"], preload: false, variable: "--font-gowun", display: "swap" });

export const metadata: Metadata = {
  title: "사주읽는밤 일기",
  description: "밤에 한 줄 쓰면, 내 기록으로 운세가 점점 내 것이 됩니다.",
};

export const viewport: Viewport = {
  themeColor: "#0e0c1b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${noto.variable} ${gowun.variable}`}>
      <body className="antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 pb-28">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
