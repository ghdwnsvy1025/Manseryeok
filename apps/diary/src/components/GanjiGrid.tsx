import { GanjiCellButton } from "@/components/GanjiSheet";
import { STEMS, STEM_META, type StemHanja } from "@saju/engine";
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
}

/**
 * 60갑자 도장판 10×6 (톤 v3.3). 자바스크립트 없이 링크로 칸을 고른다 (?cell=N).
 * 모은 칸 = 그 간지의 캐릭터만(contain) + 금 테두리. 농도 = 평균 행복도(옅음 1px → 진함 2px, --ink).
 * 약속 지킨 날이 있는 칸은 두 겹(금 2px + 안쪽 한지 1px + 금 1px). 카드 틀·썸네일·인장 없음.
 * 명세 51 (톤 v3.55): 칸은 링크(?cell=N)가 아니라 버튼 — 누르면 서버를 거치지 않고 간지 낱장이 뜬다. 격자 아래 상세는 없다.
 * 안 모은 칸 = 빈 도장 자리 + 지지 한 글자. 숫자·이모지는 넣지 않는다. 전환 효과 없음.
 */
export function GanjiGrid({ cells, selected, todayIndex, basePath, pickedEntries = [] }: Props) {
  void selected; void basePath; void pickedEntries; // 명세 51: 칸을 누르면 간지 낱장 — 서버가 고른 칸 · 그 날 목록은 더 쓰지 않는다(부르는 쪽 호환으로 받기만 한다)
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
          const isToday = c.index === todayIndex;
          // 1~10 → 0.35~1.0. 기록이 없으면 금 테두리 없음
          const ink = c.mean === null ? 0 : 0.35 + ((c.mean - 1) / 9) * 0.65;
          // v3.14: 오늘 칸은 data-today(작은 점, CSS). 배경은 그 간지 천간의 오행 색 옅게(data-el, CSS). 명세 51: 고른 칸 테두리는 없다(낱장이 뜬다)
          const el = STEM_META[c.hanja[0] as StemHanja]?.element;
          return (
            <li key={c.index}>
              <GanjiCellButton
                index={c.index}
                aria-label={`${c.ko}일 ${c.n ? `${c.n}번, 평균 ${c.mean}` : "기록 없음"}`}
                data-today={isToday ? "" : undefined}
                data-el={el}
                className={`flex aspect-square w-full items-center justify-center rounded-[18%] ${c.n ? "album-cell" : "board-cell"}`}
                style={{ "--ink": ink } as React.CSSProperties}
              >
                {c.n ? (
                  // 모은 칸 = 얼굴만 (v3.25, 작은 칸에서도 표정이 보이게). 지연 로딩
                  <img src={characterOfGanji(c.ko).faceSrc} alt="" width={64} height={64} loading="lazy" decoding="async" className="album-cell__img" />
                ) : (
                  <span className="font-serif text-[12px] leading-none text-muted">{c.hanja[1]}</span>
                )}
              </GanjiCellButton>
            </li>
          );
        })}
      </ol>

      {/* 명세 51: 격자 아래 상세는 없다 — 칸을 누르면 간지 낱장(GanjiSheet)이 뜬다 */}
      <p className="mx-5 mt-3 text-[15px] text-muted">칸을 누르면 그 간지의 기록이 보여요. 작은 점이 있는 칸이 오늘이에요.</p>
    </div>
  );
}
