"use client";

import Link from "next/link";

type Props = {
  onClose: () => void;
};

export default function CreateSajuPromptModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-saju-prompt-title"
    >
      <div
        className="w-full max-w-sm p-4 border-2 space-y-3"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p
          id="create-saju-prompt-title"
          className="text-lg font-black"
          style={{ color: "var(--px-accent)" }}
        >
          내 사주가 필요해요
        </p>
        <p className="ui-guide leading-relaxed">
          만세력에 <strong style={{ color: "var(--px-accent)" }}>대운</strong>과{" "}
          <strong style={{ color: "var(--px-accent)" }}>십신</strong>을 보려면
          프로필 사주(생년월일·성별)가 있어야 해요.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/saju"
            className="text-center py-2.5 text-sm font-black border-2 ui-primary-btn"
            onClick={onClose}
          >
            사주 만들러 가기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold ui-hint py-1"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
