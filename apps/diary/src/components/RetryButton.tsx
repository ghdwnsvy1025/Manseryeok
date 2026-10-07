"use client";

/**
 * "준비하고 있어요" 카드의 다시 시도 — 페이지를 새로 불러 AnonBoot가 처음부터 다시 돌게 한다.
 * (익명 시작이 실패했거나 어떤 이유로 세션이 만들어지지 않았을 때의 탈출구)
 */
export function RetryButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className={`text-sm text-muted underline underline-offset-4 ${className}`}>
      다시 시도
    </button>
  );
}
