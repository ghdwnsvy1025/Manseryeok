import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

export const metadata: Metadata = {
  title: "사주 만세력 — 감정 일기 × 간지",
  description:
    "매일 기분을 기록하고 일주(日柱) 패턴을 발견하세요. 사주팔자 계산과 AI 분석도 제공합니다.",
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
