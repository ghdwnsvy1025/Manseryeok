import Link from "next/link";
import { STEMS } from "@saju/engine";
import type { GanjiCell } from "@/lib/stats/ganji";

interface Props {
  cells: GanjiCell[];
  /** 선택된 칸 (쿼리 ?cell=index). 없으면 null */
  selected: number | null;
  /** 오늘 간지 순번. 테두리로 표시 */
  todayIndex: number;
  /** 선택 링크의 기준 경로 */
  basePath: string;
}

/**
 * 60갑자 격자 10×6. 자바스크립트 없이 링크로 칸을 고른다 (?cell=N).
 * 기록이 있는 칸은 행복도에 따라 등불색 농도가 달라지고, 없는 칸은 윤곽선만.
 * 디자인 명세 03에서 시각을 다듬는다 (구조·링크 형식은 유지).
 */
export function GanjiGrid({ cells, selected, todayIndex, basePath }: Props) {
  const picked = selected !== null ? cells[selected] : null;
  return (
    <div>
      {/* 열마다 천간이 같다: 甲 열, 乙 열 … 癸 열 */}
      <div className="mb-1 grid grid-cols-10 gap-1 text-center text-[11px] text-faint" aria-hidden>
        {STEMS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <ol className="grid grid-cols-10 gap-1" aria-label="60갑자별 내 행복도">
        {cells.map((c) => {
          const isSel = c.index === selected;
          const isToday = c.index === todayIndex;
          // 1~10 → 0.25~1.0. 기록이 없으면 투명
          const alpha = c.mean === null ? 0 : 0.25 + ((c.mean - 1) / 9) * 0.75;
          return (
            <li key={c.index}>
              <Link
                href={isSel ? basePath : `${basePath}?cell=${c.index}`}
                scroll={false}
                aria-label={`${c.ko}일 ${c.n ? `${c.n}번, 평균 ${c.mean}` : "기록 없음"}`}
                aria-current={isSel ? "true" : undefined}
                className={`flex aspect-square items-center justify-center rounded-md border text-[11px] leading-none ${
                  isSel ? "border-ink" : isToday ? "border-moon" : "border-line"
                } ${c.n ? "text-lamp-ink" : "text-faint"}`}
                style={c.n ? { backgroundColor: `color-mix(in srgb, var(--color-lamp) ${Math.round(alpha * 100)}%, transparent)` } : undefined}
              >
                {c.hanja[1]}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 min-h-6 text-[15px]" aria-live="polite">
        {picked ? (
          picked.n ? (
            <>
              <b className="text-moon">{picked.ko}일</b> {picked.n}번 · 평균 행복도 <b>{picked.mean}</b>
              <span className="text-faint"> · 신호 {picked.signal}</span>
            </>
          ) : (
            <>
              <b className="text-moon">{picked.ko}일</b>은 아직 기록이 없어요.
            </>
          )
        ) : (
          <span className="text-faint">칸을 누르면 그날의 평균이 보여요. 테두리가 밝은 칸이 오늘이에요.</span>
        )}
      </p>
    </div>
  );
}
