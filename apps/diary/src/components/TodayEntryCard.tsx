import Link from "next/link";
import { moodTone, type Promise_ } from "@/lib/entry";

interface Props {
  entry: { happiness: number; moods: string[]; note: string | null; promise?: Promise_ | null };
  /** 오늘 날짜 (고치기 링크) */
  today: string;
  /** 오늘 간지 한글 ("을묘") — 카드 획득 줄 */
  ganjiKo: string;
  /** 오늘 간지로 기록한 횟수(오늘 포함). 1이면 처음 만난 카드 */
  sameGanjiTimes: number;
  /** 지금까지 만난 카드 수(기록이 있는 간지 수, 60장 중) */
  metCards: number;
  /** 연속 기록 일수 */
  streak: number;
  /** 포인트 해본 비율(0~100). 답한 날이 없으면 null */
  pointRate: number | null;
  /** 방금 저장하고 돌아왔는지 — "저장했어요" 줄이 150ms 늦게 나타난다 */
  justSaved: boolean;
}

/** 오늘 포인트 줄 (v3.7 → 전수조사 C 문구): 글자 + 점. 해봤어요 = 인주 점, 못 했어요 = 먹 점, 해당 없음 = 점 없음 */
const PROMISE_LINE: Record<Promise_, { word: string; dot: string | null }> = {
  kept: { word: "해봤어요", dot: "bg-seal" },
  missed: { word: "못 했어요", dot: "bg-ink-stamp" },
  na: { word: "해당 없음", dot: null },
};

const ORDINAL = ["", "첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];

/**
 * 오늘의 기록 — 일기장의 오늘 페이지 (톤 v3 → 02 v3.7 → v3.12).
 * 숫자가 주인공: 행복도 Song Myung 56px 가운데. 기분 띠지는 data-tone(긍정 금빛 · 무덤덤 · 부정 남색).
 * 메모는 괘선 두 줄 사이에 손글씨로 — 없으면 괘선째 생략. 포인트 줄은 있을 때만.
 * 맨 아래 두 줄 (2026-10-09 Q4 = C, 내일 간지 대신): 카드 획득 / 지표. 모양은 디자이너(.entry-news*).
 */
export function TodayEntryCard({ entry, today, ganjiKo, sameGanjiTimes, metCards, streak, pointRate, justSaved }: Props) {
  const promise = entry.promise ? PROMISE_LINE[entry.promise] : null;
  const cardLine =
    sameGanjiTimes <= 1
      ? `${ganjiKo} 카드를 처음 만났어요 · 60장 중 ${metCards}장`
      : `${ganjiKo} 카드에 ${ORDINAL[sameGanjiTimes] ?? `${sameGanjiTimes}번째`}${sameGanjiTimes <= 10 ? " 번째" : ""} 도장 · 60장 중 ${metCards}장`;
  const metricLine = [`연속 ${streak}일째`, pointRate !== null ? `포인트 해본 비율 ${pointRate}%` : null].filter(Boolean).join(" · ");
  return (
    <section className="card-frame card-paper p-5">
      {justSaved && <p className="saved-line mb-2 text-sm font-bold text-gold">저장했어요</p>}
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-muted">오늘의 기록</h2>
        <Link href={`/write?date=${today}`} className="tap text-sm text-muted underline underline-offset-4">
          고치기
        </Link>
      </div>

      <p className="mt-3 text-center font-serif leading-none">
        <span className="text-[56px] tabular-nums text-ink">{entry.happiness}</span>
        <span className="ml-1 font-sans text-[15px] text-muted">/10</span>
        <span className="mt-1.5 block font-sans text-[11px] text-muted">행복도</span>
      </p>

      {entry.moods.length > 0 && (
        <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="기분">
          {entry.moods.map((m) => (
            <li key={m} data-tone={moodTone(m)} className="tag tag--on h-8 px-1 text-[14px] text-paper-2">
              {m}
            </li>
          ))}
        </ul>
      )}

      {/* 메모가 없으면 괘선까지 통째로 생략한다 — 빈 자리는 비운다 (v3.7) */}
      {entry.note && (
        <>
          <span aria-hidden className="rule rule--light mt-4" />
          <p className="ruled mt-2 line-clamp-3 font-hand text-[22px] text-ink">{entry.note}</p>
          <span aria-hidden className="rule rule--light mt-2" />
        </>
      )}

      {promise && (
        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-muted">
          <span>오늘 포인트 · {promise.word}</span>
          {promise.dot && <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${promise.dot}`} />}
        </p>
      )}

      <div className={`entry-news ${promise ? "mt-3" : "mt-4"}`}>
        <p className="entry-news__card" data-first={sameGanjiTimes <= 1 ? "" : undefined}>
          {cardLine}
        </p>
        <p className="entry-news__metric">{metricLine}</p>
      </div>
    </section>
  );
}
