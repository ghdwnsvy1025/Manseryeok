"use client";

import Link from "next/link";

type Props = {
  onDismiss?: () => void;
};

export default function BirthDateNudge({ onDismiss }: Props) {
  return (
    <div
      className="p-2 border-2 text-center space-y-1"
      style={{ background: "var(--px-bg3)", borderColor: "var(--px-accent)" }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--px-text-on-panel)" }}>
        생년을 넣으면 「내 일간 vs 오늘」 비교가 열려요
      </p>
      <p className="ui-hint">상세 보기에서 생년월일을 입력할 수 있어요</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ui-hint text-xs font-bold">
          닫기
        </button>
      )}
    </div>
  );
}
