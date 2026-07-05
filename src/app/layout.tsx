import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

export const metadata: Metadata = {
  title: "사주 만세력 — 사주팔자 계산기",
  description:
    "생년월일시를 입력하면 년주·월주·일주·시주를 절기 기준으로 정확히 계산합니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      </head>
      <body className="min-h-screen" style={{ background: "var(--px-bg)" }}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
