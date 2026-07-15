import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

export const metadata: Metadata = {
  title: "사주 만세력 — 일진 기록 × 간지 통계",
  description:
    "오늘의 일주를 기록하고 간지별 행복도 패턴을 발견하세요. 사주 만세력 계산도 제공합니다.",
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
      <body className="min-h-dvh overflow-x-hidden app-body">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
