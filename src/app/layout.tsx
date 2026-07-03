import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사주 만세력 — 사주팔자 계산기",
  description:
    "생년월일시를 입력하면 년주·월주·일주·시주를 절기 기준으로 정확히 계산합니다.",
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
        {/* ── HEADER ── */}
        <header
          className="sticky top-0 z-50 border-b-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border2)",
            boxShadow: "0 4px 0 #000",
          }}
        >
          <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
            {/* Pixel logo box */}
            <div
              className="w-10 h-10 flex items-center justify-center border-2 text-xl font-black select-none"
              style={{
                background: "var(--px-bg3)",
                borderColor: "var(--px-accent)",
                color: "var(--px-accent)",
                boxShadow: "3px 3px 0 #4a3a00",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "14px",
              }}
            >
              命
            </div>
            <div>
              <h1
                className="font-black leading-tight tracking-wide"
                style={{ color: "var(--px-accent)", fontSize: "16px" }}
              >
                사주 만세력
              </h1>
              <p className="text-xs leading-tight" style={{ color: "var(--px-text2)" }}>
                절기 기준 사주팔자 계산기 v1.0
              </p>
            </div>

            <a
              href="/admin"
              className="ml-auto mr-2 text-xs font-bold px-2 py-1 border"
              style={{
                color: "var(--px-text2)",
                borderColor: "var(--px-border)",
                background: "var(--px-bg3)",
              }}
            >
              ⚙ 관리자
            </a>
            <div className="flex gap-1">
              {["木", "火", "土", "金", "水"].map((ch, i) => {
                const colors = ["#4ade80", "#f87171", "#fbbf24", "#cbd5e1", "#60a5fa"];
                return (
                  <span
                    key={ch}
                    className="text-xs font-bold w-6 h-6 flex items-center justify-center border"
                    style={{
                      color: colors[i],
                      borderColor: colors[i] + "55",
                      background: colors[i] + "11",
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>
        </header>


        <main className="max-w-[1400px] mx-auto px-4 py-8">{children}</main>

        <footer
          className="mt-12 border-t-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
        >
          <div
            className="max-w-[1400px] mx-auto px-4 py-5 text-center text-xs space-y-1"
            style={{ color: "var(--px-text2)" }}
          >
            <p>절기 시각: Jean Meeus 「Astronomical Algorithms」 기반 천문 계산 (±15~45분)</p>
            <p>경계 근처 출생 시 한국천문연구원(KASI) 공식 데이터와 교차 검증을 권장합니다.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
