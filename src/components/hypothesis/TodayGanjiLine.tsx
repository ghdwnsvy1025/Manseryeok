"use client";

/**
 * 오늘 간지 — 한 줄로 접어 둔다.
 *
 * 왜 접는가. 지금은 큰 한자(丁亥)와 십신 배지가 홈 **맨 위**에 있다.
 * 사주를 아는 사람만 읽는 정보가 첫인상을 차지하고 있었다.
 * 지우지는 않는다 — 아는 사람에겐 중요한 정보이고, 이 앱의 정체성이다.
 * 한 줄로 줄이고, 누르면 원래대로 펼친다.
 */
import { useState } from "react";

type Props = {
  /** "정해" */
  ganjiKo: string;
  /** "丁" */
  stemHanja?: string;
  /** "亥" */
  branchHanja?: string;
  /** ["정관", "식신"] */
  tenGods?: string[];
};

export default function TodayGanjiLine({
  ganjiKo,
  stemHanja,
  branchHanja,
  tenGods = [],
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className="w-full text-left px-2 py-1.5 flex items-center gap-2"
      style={{ color: "var(--px-text2)" }}
    >
      <span className="text-xs">오늘 {ganjiKo}일</span>

      {open && (
        <>
          {stemHanja && branchHanja && (
            <span
              className="text-sm font-bold"
              style={{ color: "var(--px-text)" }}
            >
              {stemHanja}
              {branchHanja}
            </span>
          )}
          {tenGods.map((god) => (
            <span
              key={god}
              className="text-[10px] px-1.5 py-0.5"
              style={{
                border: "1px solid var(--px-border2)",
                color: "var(--px-text2)",
              }}
            >
              {god}
            </span>
          ))}
        </>
      )}

      <span className="text-[10px] ml-auto" aria-hidden>
        {open ? "접기" : "자세히"}
      </span>
    </button>
  );
}
