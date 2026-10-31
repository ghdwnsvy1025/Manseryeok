"use client";

/** 펼친 details 맨 아래의 "접기" — 가장 가까운 details를 닫고 그 머리(요약 카드)로 돌아간다 (나 탭 만세력, 2026-10-31) */
export function FoldButton({ label = "접기" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const d = e.currentTarget.closest("details");
        if (!d) return;
        d.open = false;
        d.scrollIntoView({ block: "start", behavior: "smooth" });
      }}
      className="fold-button tap mx-auto flex h-11 items-center gap-1 px-4 text-[15px] text-ink"
    >
      {label} ▴
    </button>
  );
}
