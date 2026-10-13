import Link from "next/link";
import { characterOfGanji } from "@/lib/character";
import { happinessTier, moodTone } from "@/lib/entry";

interface Props {
  date: string;
  /** 그날 간지 한글 ("병진") — 서버가 계산해 넘긴다(클라이언트에서 엔진을 부르지 않게) */
  ganjiKo: string;
  entry: { happiness: number; moods: string[]; note: string | null } | null;
}

/**
 * 달력에서 고른 날의 상세 (v3.14 → v3.15). 머리는 간지 이름만("병진", 2026-10-10 Q3 = B — 날짜는 고른 칸 테두리가 말한다).
 * v3.25: 큰 정사각 카드 대신 머리 한 줄 = 그날 일주 얼굴 + 간지 이름 + 행복도 도장. 아래 기분 띠지 + 한 줄 메모 + "고치기".
 * 기록이 없으면 흐린 얼굴 + "이 날 기록하기". 카드 전체는 60갑자 보기에서 본다.
 * 서버·클라이언트 어디서든 그릴 수 있는 순수 컴포넌트(CalendarView가 클라이언트에서 쓴다). 모양은 디자이너(.day-detail*).
 */
export function CalendarDayDetail({ date, ganjiKo, entry }: Props) {
  // 간지가 없으면(예상 밖 날짜) 그리지 않는다 — 이전 핫 리로드에서 characterOfGanji(undefined)로 터진 적이 있다
  if (!ganjiKo) return null;
  const card = characterOfGanji(ganjiKo);
  return (
    <section className="day-detail mt-4" aria-label={`${date} ${ganjiKo}일 기록`}>
      <div className="day-detail__head" data-empty={entry ? undefined : ""}>
        <img src={card.faceSrc} alt={`${ganjiKo} 얼굴`} width={512} height={512} className="day-detail__face" />
        <p className="day-detail__date text-ganji">{ganjiKo}</p>
        {entry && (
          <span className="day-detail__stamp" data-tier={happinessTier(entry.happiness)} aria-label={`행복도 ${entry.happiness}`}>
            {entry.happiness}
          </span>
        )}
      </div>
      {entry ? (
        <>
          {entry.moods.length > 0 && (
            <ul className="day-detail__moods mt-3 flex flex-wrap justify-center gap-2" aria-label="기분">
              {entry.moods.map((m) => (
                <li key={m} data-tone={moodTone(m)} className="tag tag--on h-8 px-1 text-[14px] text-paper-2">
                  {m}
                </li>
              ))}
            </ul>
          )}
          {entry.note && <p className="day-detail__note ruled mt-3 font-hand text-[17px] break-keep text-ink">{entry.note}</p>}
          <p className="mt-3 text-center">
            <Link href={`/write?date=${date}`} className="tap text-sm text-muted underline underline-offset-4">
              고치기
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-center text-[15px] text-muted">이 날은 아직 기록이 없어요.</p>
          <Link href={`/write?date=${date}`} className="gold-plate mt-3 flex h-12 items-center justify-center rounded-xl text-[16px] font-bold text-gold-ink">
            이 날 기록하기
          </Link>
        </>
      )}
    </section>
  );
}
