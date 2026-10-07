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
  /** 선택 칸의 그 날들 (최신순). 상세 아래 기록 목록. 없으면 생략 */
  pickedEntries?: { entry_date: string; happiness: number; promise?: "kept" | "missed" | "na" | null }[];
}

/**
 * 60갑자 도장판 10×6 (톤 v3.3). 자바스크립트 없이 링크로 칸을 고른다 (?cell=N).
 * 모은 칸 = 그 간지의 캐릭터만(contain) + 금 테두리. 농도 = 평균 행복도(옅음 1px → 진함 2px, --ink).
 * 약속 지킨 날이 있는 칸은 두 겹(금 2px + 안쪽 한지 1px + 금 1px). 카드 틀·썸네일·인장 없음.
 * 안 모은 칸 = 빈 도장 자리 + 지지 한 글자. 숫자·이모지는 넣지 않는다. 전환 효과 없음.
 */
export function GanjiGrid({ cells, selected, todayIndex, basePath, pickedEntries = [] }: Props) {
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
          // 1~10 → 0.35~1.0. 기록이 없으면 금 테두리 없음
          const ink = c.mean === null ? 0 : 0.35 + ((c.mean - 1) / 9) * 0.65;
          const ring = isSel ? "outline-2 outline-offset-1 outline-ink" : isToday ? "outline-2 outline-offset-1 outline-ganji" : "";
          return (
            <li key={c.index}>
              <Link
                href={isSel ? basePath : `${basePath}?cell=${c.index}`}
                scroll={false}
                aria-label={`${c.ko}일 ${c.n ? `${c.n}번, 평균 ${c.mean}${c.keptCount ? `, 지킨 약속 ${c.keptCount}` : ""}` : "기록 없음"}`}
                aria-current={isSel ? "true" : undefined}
                data-kept={c.keptCount > 0 ? "" : undefined}
                className={`flex aspect-square items-center justify-center rounded-[18%] ${c.n ? "album-cell" : "board-cell"} ${ring}`}
                style={{ "--ink": ink } as React.CSSProperties}
              >
                {c.n ? (
                  // 모은 칸 = 캐릭터만 (v3.3). 지연 로딩
                  <img src={`/characters/${c.ko}.webp`} alt="" width={64} height={64} loading="lazy" decoding="async" className="album-cell__img" />
                ) : (
                  <span className="font-serif text-[12px] leading-none text-faint">{c.hanja[1]}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* 선택 칸 상세: 카드 크게(폭 60%) + 숫자 줄. 기록 목록은 아래 "내 기록"이 맡는다 */}
      <div className="mx-2 mt-3 min-h-6 text-[15px]" aria-live="polite">
        {picked ? (
          picked.n ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={`/cards/${picked.ko}.webp`}
                alt={`${picked.ko}일 카드`}
                width={768}
                height={1030}
                data-kept={picked.keptCount > 0 ? "" : undefined}
                className={`album-pick ${picked.keptCount > 0 ? "outline-2 outline-gold" : ""}`}
              />
              <p className="text-center">
                <b className="text-ganji">{picked.ko}일</b> {picked.n}번 · 평균 <b className="font-serif">{picked.mean}</b>
                {picked.keptCount > 0 && <> · 지킨 약속 {picked.keptCount}</>}
                <span className="text-faint"> · 신호 {picked.signal}</span>
              </p>
              {pickedEntries.length > 0 && (
                <ul className="flex w-full flex-col gap-1.5 text-[15px]">
                  {pickedEntries.map((e) => (
                    <li key={e.entry_date}>
                      <Link href={`/write?date=${e.entry_date}`} className="flex items-baseline justify-between gap-3 px-1 underline-offset-4 hover:underline">
                        <span>{e.entry_date.replace(/-/g, ".")}</span>
                        <span className="font-serif tabular-nums">
                          행복도 {e.happiness}
                          {e.promise === "kept" && <span className="ml-2 text-[13px] font-sans text-gold-ink">약속 지킴</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p>
              <b className="text-ganji">{picked.ko}일</b>은 아직 기록이 없어요.
            </p>
          )
        ) : (
          <p className="text-faint">칸을 누르면 그날의 카드가 크게 보여요. 남색 테두리가 오늘이에요.</p>
        )}
      </div>
    </div>
  );
}
