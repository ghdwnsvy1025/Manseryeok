"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth error]", error);
  }, [error]);

  return (
    <div className="p-6 space-y-3 text-center">
      <p className="text-sm font-black" style={{ color: "var(--px-text)" }}>
        로그인 처리 중 문제가 생겼어요
      </p>
      <p className="ui-hint">홈으로 돌아가 다시 로그인해 주세요.</p>
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          className="px-3 py-2 border-2 text-sm font-black"
          style={{
            borderColor: "var(--px-border)",
            color: "var(--px-text2)",
            background: "var(--px-bg3)",
          }}
          onClick={() => reset()}
        >
          다시 시도
        </button>
        <a
          href="/"
          className="px-3 py-2 border-2 text-sm font-black"
          style={{
            borderColor: "var(--px-accent)",
            color: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          홈으로
        </a>
      </div>
    </div>
  );
}
