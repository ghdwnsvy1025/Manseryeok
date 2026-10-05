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
 * 60갑자 도장판 10×6 (톤 v3). 자바스크립트 없이 링크로 칸을 고른다 (?cell=N).
 * 기록 없는 칸 = 빈 도장 자리 + 지지 한 글자. 기록 있는 칸 = 그 간지 동물 + 평균 행복도 농도의 금빛 테두리.
 * 숫자·이모지는 넣지 않는다. 전환 효과 없음.
 */
export function GanjiGrid({ cells, selected, todayIndex, basePath }: Props) {
  const picked = selected !== null ? cells[selected] : null;
  return (
    <div className="-mx-2">
      {/* 열마다 천간이 같다: 甲 열, 乙 열 … 癸 열 */}
      <div className="mb-1 grid grid-cols-10 gap-1 text-center font-serif text-[12px] text-faint" aria-hidden>
        {STEMS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <ol className="grid grid-cols-10 gap-1" aria-label="60갑자별 내 행복도">
        {cells.map((c) => {
          const isSel = c.index === selected;
          const isToday = c.index === todayIndex;
          // 1~10 → 0.35~1.0. 기록이 없으면 금빛 테두리 없음
          const ink = c.mean === null ? 0 : 0.35 + ((c.mean - 1) / 9) * 0.65;
          return (
            <li key={c.index}>
              <Link
                href={isSel ? basePath : `${basePath}?cell=${c.index}`}
                scroll={false}
                aria-label={`${c.ko}일 ${c.n ? `${c.n}번, 평균 ${c.mean}` : "기록 없음"}`}
                aria-current={isSel ? "true" : undefined}
                className={`board-cell flex aspect-square items-center justify-center rounded-[22%] ${
                  isSel ? "outline-2 outline-offset-1 outline-ink" : isToday ? "outline-2 outline-offset-1 outline-ganji" : ""
                }`}
                style={{ "--ink": ink } as React.CSSProperties}
              >
                {c.n ? (
                  // 기록한 간지의 동물 (바이럴 60갑자 세트). 크기 고정, 지연 로딩
                  <img
                    src={`/characters/${c.ko}.webp`}
                    alt=""
                    width={24}
                    height={24}
                    loading="lazy"
                    className="h-[70%] w-[70%] object-contain"
                  />
                ) : (
                  <span className="font-serif text-[12px] leading-none text-faint">{c.hanja[1]}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mx-2 mt-3 min-h-6 text-[15px]" aria-live="polite">
        {picked ? (
          picked.n ? (
            <>
              <b className="text-ganji">{picked.ko}일</b> {picked.n}번 · 평균 행복도 <b className="font-serif">{picked.mean}</b>
              <span className="text-faint"> · 신호 {picked.signal}</span>
            </>
          ) : (
            <>
              <b className="text-ganji">{picked.ko}일</b>은 아직 기록이 없어요.
            </>
          )
        ) : (
          <span className="text-faint">칸을 누르면 그날의 평균이 보여요. 남색 테두리가 오늘이에요.</span>
        )}
      </p>
    </div>
  );
}
