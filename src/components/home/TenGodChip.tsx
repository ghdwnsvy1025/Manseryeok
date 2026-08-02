"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tenGodPlain } from "@/lib/saju/tenGodPlain";

type Color = { text: string; bg: string; border: string } | null;

type Props = {
  label: string;
  color: Color;
};

/**
 * 십신 칩 — 설명은 화면 중앙 모달(포털)로 열어 overflow 짤림을 막는다.
 */
export default function TenGodChip({ label, color }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="font-bold border leading-none"
        style={{
          color: color?.text ?? "var(--px-accent)",
          borderColor: color?.border ?? "var(--px-border)",
          background: color?.bg ?? "transparent",
          fontSize: "11px",
          padding: "2px 5px",
        }}
        aria-expanded={open}
        aria-label={`${label} 설명`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 motion-modal-backdrop"
            style={{ background: "rgba(0,0,0,0.55)" }}
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tengod-explain-title"
              className="w-full max-w-sm border-2 p-4 space-y-3 motion-modal-card"
              style={{
                background: "var(--px-bg2)",
                borderColor: "var(--px-border2)",
                boxShadow: "4px 4px 0 #000",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="tengod-explain-title"
                className="text-sm font-black text-center"
                style={{ color: "var(--px-accent)" }}
              >
                {label}
              </p>
              <p
                className="text-[13px] font-bold leading-relaxed text-center"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {tenGodPlain(label)}
              </p>
              <button
                type="button"
                className="w-full py-2.5 text-xs font-black border-2"
                style={{
                  borderColor: "#000",
                  background: "var(--px-accent)",
                  color: "#111",
                  boxShadow: "2px 2px 0 #000",
                }}
                onClick={() => setOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
