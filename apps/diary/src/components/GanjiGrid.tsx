import Link from "next/link";
import { STEMS } from "@saju/engine";
import type { GanjiCell } from "@/lib/stats/ganji";
import { characterOfGanji } from "@/lib/character";

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
  /** 선택 칸의 동물 이름 ("토끼") — 상세에 "을묘 · 토끼"로 */
  pickedAnimal?: string;
}

/**
 * 60갑자 도장판 10×6 (톤 v3.3). 자바스크립트 없이 링크로 칸을 고른다 (?cell=N).
 * 모은 칸 = 그 간지의 캐릭터만(contain) + 금 테두리. 농도 = 평균 행복도(옅음 1px → 진함 2px, --ink).
 * 약속 지킨 날이 있는 칸은 두 겹(금 2px + 안쪽 한지 1px + 금 1px). 카드 틀·썸네일·인장 없음.
 * 안 모은 칸 = 빈 도장 자리 + 지지 한 글자. 숫자·이모지는 넣지 않는다. 전환 효과 없음.
 */
export function GanjiGrid({ cells, selected, todayIndex, basePath, pickedEntries = [], pickedAnimal = "" }: Props) {
  const picked = selected !== null ? cells[selected] : null;
  return (
    // 좌우 여백을 화면 가장자리까지 줄여 칸이 36px 이상 (375px 기준 36.6px). 칸 사이 1px
    <div className="-mx-5">
      {/* 열마다 천간이 같다: 甲 열, 乙 열 … 癸 열 */}
      <div className="mb-1 grid grid-cols-10 gap-px text-center font-serif text-[12px] text-muted" aria-hidden>
        {STEMS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <ol className="grid grid-cols-10 gap-px" aria-label="60갑자별 내 행복도">
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
                  <span className="font-serif text-[12px] leading-none text-muted">{c.hanja[1]}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* 선택 칸 상세: 캐릭터만 + "을묘 · 토끼" 글자 + 숫자 줄 (카드 전체는 안 쓴다 — 작은 글씨). 기록 목록은 아래 "내 기록"이 맡는다 */}
      <div className="mx-5 mt-3 min-h-6 text-[15px]" aria-live="polite">
        {picked ? (
          picked.n ? (
            <div className="flex flex-col items-center gap-2">
              {/* 2026-10-09 Q5: 캐릭터 대신 그 간지의 정사각 카드 */}
              <img src={characterOfGanji(picked.ko).cardSrc} alt={`${picked.ko} 카드`} width={1080} height={1080} className="grid-card block h-auto w-[56%] max-w-[220px]" />
              <p className="font-serif text-[20px] leading-none">
                <span className="text-ganji">{picked.ko}</span>
                {pickedAnimal && <span className="text-ink"> · {pickedAnimal}</span>}
              </p>
              <p className="text-center">
                <b className="text-ganji">{picked.ko}일</b> {picked.n}번 · 평균 <b className="font-serif">{picked.mean}</b>
                {picked.keptCount > 0 && <> · 오늘 포인트 {picked.keptCount}번</>}
                {picked.signal === "약함" ? (
                  <span className="text-muted"> (기록 3번부터 믿을 만해요)</span>
                ) : (
                  <span className="text-muted"> · 신호 {picked.signal}</span>
                )}
              </p>
              {pickedEntries.length > 0 && (
                <ul className="flex w-full flex-col gap-1.5 text-[15px]">
                  {pickedEntries.map((e) => (
                    <li key={e.entry_date}>
                      <Link href={`/write?date=${e.entry_date}`} className="flex items-baseline justify-between gap-3 px-1 underline-offset-4 hover:underline">
                        <span>{e.entry_date.replace(/-/g, ".")}</span>
                        <span className="font-serif tabular-nums">
                          행복도 {e.happiness}
                          {e.promise === "kept" && <span className="ml-2 text-[13px] font-sans text-gold-ink">포인트 해냄</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            // 기록 없는 칸: 흐린 카드 = "아직 못 만난 카드" (Q5)
            <div className="flex flex-col items-center gap-2">
              <img src={characterOfGanji(picked.ko).cardSrc} alt={`${picked.ko} 카드 (아직 못 만남)`} width={1080} height={1080} data-unmet="" className="grid-card block h-auto w-[56%] max-w-[220px]" />
              <p>
                <b className="text-ganji">{picked.ko}일</b>은 아직 못 만난 카드예요.
              </p>
            </div>
          )
        ) : (
          <p className="text-muted">칸을 누르면 그 간지의 카드가 보여요. 남색 테두리가 오늘이에요.</p>
        )}
      </div>
    </div>
  );
}
