import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";
import PwaRegister from "@/components/PwaRegister";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "사주 만세력 — 일진 기록 × 간지 통계",
  description:
    "오늘의 일주를 기록하고 간지별 행복도 패턴을 발견하세요. 사주 만세력 계산도 제공합니다.",
  applicationName: "오늘의 사주 일기",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/app-icon.svg",
    apple: "/icons/app-icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "사주일기",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      </head>
      <body
        className={`${notoSansKr.variable} min-h-dvh overflow-x-hidden app-body`}
      >
        <ClientShell>{children}</ClientShell>
        <PwaRegister />
      </body>
    </html>
  );
}
