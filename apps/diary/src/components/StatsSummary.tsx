import type { ReactNode } from "react";
import type { Bucket, Highlights } from "@/lib/stats/ganji";
import type { AreaAverage, Habit, MoodCount, Streak } from "@/lib/stats/extra";
import { happinessTier, moodTone } from "@/lib/entry";

interface Props {
  h: Highlights;
  fitPercent: number;
  stems: Bucket[];
  branches: Bucket[];
  elements: Bucket[];
  moods: MoodCount[];
  /** 가장 행복한 날·힘든 날 카드 (2026-10-31, "하면 좋아요" 칸 자리). 부모가 그려 넘긴다 (BestWorstDays) */
  days?: ReactNode;
  /** 최근 30일 영역별 평균 (2026-10-31). 매긴 날이 하나도 없으면 막대를 그리지 않는다 */
  areas?: AreaAverage[];
  streak: Streak;
  /** v3.21 기록 습관 (자세한 통계 맨 위) */
  habit?: Habit;
  /** 최근 30일 그래프 (HappinessChart). 부모가 그려 넘긴다 */
  chart: ReactNode;
}

/**
 * 세로 막대 한 줄 (Q6 = A). 칸은 늘 전부(천간 10 · 지지 12 · 오행 5) — 자리가 고정돼야 한눈에 비교된다.
 * 막대 높이 = 평균 행복도((mean−1)/9), 위에 평균 숫자, 아래 글자와 횟수. 기록 없는 칸은 빈 자리.
 * 오행 줄은 data-el로 오행 색. 모양은 디자이너(.bars*).
 */
function Bars({ title, items, element = false }: { title: string; items: Bucket[]; element?: boolean }) {
  return (
    <div className="bars" data-kind={element ? "element" : "ganji"}>
      <p className="bars__title text-[14px] font-bold">{title}</p>
      <ol className="bars__row" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((b) => {
          const pct = b.mean === null ? 0 : Math.max(4, ((b.mean - 1) / 9) * 100);
          return (
            <li key={b.key} className="bars__col" data-empty={b.n ? undefined : ""} data-el={element ? b.key : undefined} aria-label={`${b.ko} ${b.n ? `평균 ${b.mean}, ${b.n}번` : "기록 없음"}`}>
              <span className="bars__value">{b.mean ?? ""}</span>
              <span className="bars__track">
                <span className="bars__fill" style={{ height: `${pct}%` }} />
              </span>
              <span className="bars__label">{element ? b.key : b.ko}</span>
              <span className="bars__n">{b.n || ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 맞춤도 + 지표 세 칸 + 30일 그래프 + 사실 한 줄들 + 천간·지지·오행 한 판. 기간 약속·재촉 문구는 쓰지 않는다 */
export function StatsSummary({ h, fitPercent, stems, branches, elements, moods, habit, chart, days, areas }: Props) {
  // v3.13: 점 대신 이름–값 줄 (왼쪽 무엇, 오른쪽 간지 + 평균 + 횟수).
  // 2026-10-31: 날짜 하나를 집는 "가장 행복한 날" 카드가 생겨, 간지 평균 줄은 "나와 잘 맞는 간지 / 버거운 간지"로 이름을 바꿨다
  const facts: { label: string; ganji: string; mean: number | null; n: number }[] = [];
  if (h.bestGanji) facts.push({ label: "나와 잘 맞는 간지", ganji: `${h.bestGanji.ko}일`, mean: h.bestGanji.mean, n: h.bestGanji.n });
  if (h.worstGanji && h.worstGanji.index !== h.bestGanji?.index)
    facts.push({ label: "버거운 간지", ganji: `${h.worstGanji.ko}일`, mean: h.worstGanji.mean, n: h.worstGanji.n });
  const areaRows = areas?.some((a) => a.n > 0) ? areas : null;

  return (
    <div className="flex flex-col gap-4">
      {/* v3.22: 달력 바로 아래 그래프 — 제목 없이 달력과 한 덩어리 */}
      {h.total > 0 && <div className="hchart-wrap card-frame card-light card-paper px-5 py-4">{chart}</div>}

      {/* v3.22 기록 습관: 큰 숫자 "N일째" + 최고, 최근 30일 도장 점 30개, 이번 달·30일 기록률. 모양은 디자이너(.habit*) */}
      {h.total > 0 && habit && (
        <div className="habit card-frame card-light card-paper px-5 py-4" aria-label="기록 습관">
          <div className="habit__head">
            <span className="habit__label">연속 기록</span>
            <span className="habit__value">
              {habit.current}
              <small>일째</small>
            </span>
            <span className="habit__best">최고 {habit.best}일</span>
          </div>
          <ol className="habit__dots" aria-label={`최근 30일 중 ${habit.last30.filter(Boolean).length}일 기록`}>
            {habit.last30.map((on, k) => (
              <li key={k} className="habit__dot" data-on={on ? "" : undefined} data-today={k === habit.last30.length - 1 ? "" : undefined} />
            ))}
          </ol>
          {/* v3.23: 점 줄의 뜻 — 양 끝에 "30일 전"과 "오늘" 두 단어만 */}
          <p className="habit__ends" aria-hidden>
            <span>30일 전</span>
            <span>오늘</span>
          </p>
          <dl className="kv habit__kv mt-3">
            <div className="kv__row">
              <dt>이번 달 기록</dt>
              <dd>{habit.thisMonth}일</dd>
            </div>
            <div className="kv__row">
              <dt>최근 30일 기록률</dt>
              <dd>{habit.rate30}%</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 2026-10-31: 영역별 평균(최근 30일) — 막대 길이 = 평균 단계(1~5). 모양은 디자이너(.area-bars*) */}
      {h.total > 0 && areaRows && (
        <div className="area-bars card-frame card-light card-paper px-5 py-4" aria-label="영역별 행복도, 최근 30일">
          <p className="text-[15px] font-bold">
            영역별 행복도 <span className="text-[13px] font-normal text-muted">최근 30일 평균</span>
          </p>
          <ol className="area-bars__list mt-3 flex flex-col gap-2">
            {areaRows.map((a) => (
              <li key={a.key} className="area-bars__row" data-empty={a.n ? undefined : ""} aria-label={`${a.label} ${a.n ? `평균 ${a.mean}단계, ${a.n}일` : "기록 없음"}`}>
                <span className="area-bars__label">{a.label}</span>
                <span className="area-bars__track">
                  <span className="area-bars__fill" style={{ width: `${a.mean === null ? 0 : (a.mean / 5) * 100}%` }} data-tier={a.mean === null ? undefined : happinessTier(a.mean * 2)} />
                </span>
                <span className="area-bars__value">{a.mean ?? "–"}</span>
                <span className="area-bars__n">{a.n ? `${a.n}일` : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 2026-10-31: "하면 좋아요" 칸 자리 = 가장 행복한 날·힘든 날 카드 두 장 (BestWorstDays) */}
      {h.total > 0 && days}

      {/* 자주 고른 기분 — 지표 두 칸에서 한 줄로 */}
      {h.total > 0 && (
        <div className="metric metric--moods card-frame card-light card-paper px-5 py-4">
          <span className="metric__label">자주 고른 기분</span>
          {moods.length ? (
            <span className="metric__chips">
              {moods.map((m) => (
                <span key={m.mood} className="metric__chip" data-tone={moodTone(m.mood)}>
                  {m.mood}
                  <small>{m.n}</small>
                </span>
              ))}
            </span>
          ) : (
            <span className="metric__sub">아직 없음</span>
          )}
        </div>
      )}

      {/* v3.17 정리: 자주 보지 않는 통계는 접는다 — 맞춤도 · 잘 맞는 간지 · 글자별 막대. 모양은 디자이너(.more-stats*) */}
      {h.total > 0 && (
        <details className="more-stats me-sep card-frame card-light card-paper">
          <summary className="more-stats__summary tap cursor-pointer list-none [&::-webkit-details-marker]:hidden">자세한 통계</summary>
          <div className="mt-3 flex flex-col gap-4">

            <div className="card-frame card-light card-paper px-5 py-4">
              <div className="flex items-baseline justify-between">
                {/* v3.14: 맞춤도 뜻은 "?"를 누르면 한 줄 (details, JS 없음) */}
                <details className="fit-help">
                  <summary className="text-[15px] font-bold [&::-webkit-details-marker]:hidden">
                    맞춤도 <span className="fit-help__q" aria-label="맞춤도가 뭔가요">?</span>
                  </summary>
                  <p className="fit-help__text">내 기록이 운세 점수에 반영된 정도예요. 기록이 쌓일수록 올라요.</p>
                </details>
                <span className="font-serif text-[32px] leading-none">
                  {fitPercent}
                  <span className="text-[17px] text-muted">%</span>
                </span>
              </div>
              {/* 맞춤도 게이지 — 0~100 */}
              <span className="meter mt-2" aria-hidden>
                <span className="meter__fill" style={{ width: `${fitPercent}%` }} />
              </span>
              {/* v3.14 Q3 = A: 설명 문장 대신 숫자 세 칸 (숫자 크게, 이름 아래 작게). 모양은 디자이너(.stat3*) */}
              <ul className="stat3 mt-3" aria-label="기록 요약">
                <li className="stat3__item">
                  <span className="stat3__value">
                    {h.total}
                    <small>일</small>
                  </span>
                  <span className="stat3__label">기록</span>
                </li>
                <li className="stat3__item">
                  <span className="stat3__value">{h.overallMean ?? "–"}</span>
                  <span className="stat3__label">평균 행복도</span>
                </li>
                <li className="stat3__item">
                  <span className="stat3__value">
                    {h.unseen}
                    <small>개</small>
                  </span>
                  <span className="stat3__label">안 겪은 간지</span>
                </li>
              </ul>
            </div>

            {facts.length > 0 && (
              <dl className="kv kv--facts card-frame card-light card-paper px-5 py-4">
                {facts.map((f) => (
                  <div key={f.label} className="kv__row">
                    <dt>{f.label}</dt>
                    <dd>
                      <span className="text-ganji">{f.ganji}</span>
                      <span className="kv__num" data-tier={f.mean !== null ? happinessTier(f.mean) : undefined}>{f.mean}</span>
                      <span className="kv__n">{f.n}번</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {/* 천간·지지·오행 한 판 (Q6 = A). 접기 없음. v3.14: 기록 3건 전엔 아무것도 그리지 않는다(안내 카드 없음) */}
            {h.total < 3 ? null : (
              <div className="card-frame card-light card-paper flex flex-col gap-5 px-5 py-4">
                <p className="text-[15px] font-bold">
                  글자별 내 행복도 <span className="mt-1 block text-[13px] font-normal text-muted">막대 높이는 평균, 아래 숫자는 횟수예요</span>
                </p>
                <Bars title="천간" items={stems} />
                <Bars title="지지" items={branches} />
                <Bars title="오행" items={elements} element />
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
