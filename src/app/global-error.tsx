"use client";

/**
 * 루트 레이아웃까지 깨졌을 때 쓰는 최후 에러 UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#111",
          color: "#eee",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <p style={{ fontWeight: 800, marginBottom: 8 }}>앱을 다시 열어 주세요</p>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }}>
            {error.message?.slice(0, 160) || "알 수 없는 오류"}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "8px 14px",
              border: "2px solid #fbbf24",
              background: "#222",
              color: "#fbbf24",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
