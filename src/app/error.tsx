"use client";

import { useEffect } from "react";

/**
 * 세그먼트 런타임 에러 경계.
 * 없으면 Next가 "missing required error components, refreshing…" 를 띄운다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="p-6 space-y-3 text-center">
      <p className="text-sm font-black" style={{ color: "var(--px-text)" }}>
        화면을 불러오지 못했어요
      </p>
      <p className="ui-hint">
        {error.message?.slice(0, 160) || "잠시 후 다시 시도해 주세요."}
      </p>
      <button
        type="button"
        className="px-3 py-2 border-2 text-sm font-black"
        style={{
          borderColor: "var(--px-accent)",
          color: "var(--px-accent)",
          background: "var(--px-bg3)",
          boxShadow: "2px 2px 0 #000",
        }}
        onClick={() => reset()}
      >
        다시 시도
      </button>
    </div>
  );
}
