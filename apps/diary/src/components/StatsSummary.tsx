import type { ReactNode } from "react";
import type { Bucket, Highlights } from "@/lib/stats/ganji";
import { Bars } from "@/components/GlyphBars";
import Link from "next/link";
import type { AreaAverage, FortuneAccuracy, Habit, MoodCount, Streak, Unlock } from "@/lib/stats/extra";
import { happinessTier, moodTone } from "@/lib/entry";

interface Props {
  h: Highlights;
  fitPercent: number;
  stems: Bucket[];
  branches: Bucket[];
  elements: Bucket[];
  moods: MoodCount[];
  /** 있었던 일(상태) 통계. 부모가 그려 넘긴다 (StateStats) */
  states?: ReactNode;
  /** 최근 30일 영역별 평균 (2026-10-31). 매긴 날이 하나도 없으면 막대를 그리지 않는다 */
  areas?: AreaAverage[];
  streak: Streak;
  /** v3.21 기록 습관 (자세한 통계 맨 위) */
  habit?: Habit;
  /** 최근 30일 그래프 (HappinessChart). 부모가 그려 넘긴다 */
  chart: ReactNode;
  /** 그래프를 그릴 만큼 기록이 있는지(최근 30일 2일 이상). 아니면 그래프 자리 대신 "다음에 열리는 것" (2026-10-31) */
  chartReady?: boolean;
  /** 다음에 열리는 통계 하나 (nextUnlock). 다 열렸으면 null */
  unlock?: Unlock | null;
  /** 운세 적중률 (맞아요/아니에요). 답한 날이 없으면 숨김 */
  accuracy?: FortuneAccuracy;
  /** 자세한 통계 안 영역 칸: 육각형 + 영역별 글자 막대. 부모가 그려 넘긴다. 영역 점수가 없으면 null */
  areaDetail?: ReactNode;
  /** 기록이 하나도 없을 때 "첫 기록" 버튼이 갈 곳 */
  writeHref?: string;
}

/** 기록 0일 = 첫 기록 카드 하나. 그 뒤 = 접힌 "자세한 통계" 서랍 하나(명세 47) — 그래프 · 기록 습관 · 영역 · 기분 · 있었던 일 · 맞춤도 · 글자별 막대. 기간 약속·재촉 문구는 쓰지 않는다 */
export function StatsSummary({ h, fitPercent, stems, branches, elements, moods, habit, chart, states, areas, chartReady = true, unlock = null, accuracy, areaDetail, writeHref = "/write" }: Props) {
  // v3.13: 점 대신 이름–값 줄 (왼쪽 무엇, 오른쪽 간지 + 평균 + 횟수).
  // 2026-10-31: 날짜 하나를 집는 "가장 행복한 날" 카드가 생겨, 간지 평균 줄은 "나와 잘 맞는 간지 / 버거운 간지"로 이름을 바꿨다
  const facts: { label: string; ganji: string; mean: number | null; n: number }[] = [];
  if (h.bestGanji) facts.push({ label: "나와 잘 맞는 간지", ganji: `${h.bestGanji.ko}일`, mean: h.bestGanji.mean, n: h.bestGanji.n });
  if (h.worstGanji && h.worstGanji.index !== h.bestGanji?.index)
    facts.push({ label: "버거운 간지", ganji: `${h.worstGanji.ko}일`, mean: h.worstGanji.mean, n: h.worstGanji.n });
  const areaRows = areas?.some((a) => a.n > 0) ? areas : null;

  // 2026-10-31 사용자: 데이터가 없을 때 블록마다 안내문을 늘어놓지 않는다. 기록 0일 = 첫 기록 카드 하나, 그 뒤 = "다음에 열리는 것" 하나.
  if (h.total === 0) {
    return (
      <div className="first-record card-frame card-light card-paper flex flex-col gap-3 px-5 py-5">
        <p className="font-serif text-[20px] leading-snug">첫 기록을 남기면 여기가 채워져요</p>
        {/* v3.35: 날짜 자리 = 빈 도장판 칸(키트 stamp-board-cell-empty), 열리는 것은 15px 먹색. 모양은 .first-record__* */}
        <ol className="first-record__ladder flex flex-col text-[15px]">
          {[
            ["1일", "가장 행복한 날과 연속 기록"],
            ["2일", "행복도 그래프"],
            ["3일", "글자별 내 행복도"],
          ].map(([day, what]) => (
            <li key={day} className="first-record__step flex">
              <span className="first-record__day">{day}</span>
              <span>{what}</span>
            </li>
          ))}
        </ol>
        <Link href={writeHref} className="gold-plate mt-1 flex h-13 items-center justify-center rounded-xl text-[16px] font-bold text-gold-ink">
          오늘 기록하기
        </Link>
      </div>
    );
  }

  // 명세 47 (톤 v3.51): 본문에는 통계 카드가 없다 — 그래프 · 기록 습관 · 영역 · 기분 · 있었던 일 · 맞춤도 · 글자별 막대가 전부 "자세한 통계" 서랍 안으로 내려왔다.
  // 빼는 것은 없고 자리만 옮겼다. 서랍 안은 카드 속 카드가 되지 않게 틀을 벗기고 녹갈 0.5px 괘선으로만 나눈다(.more-stats .card-light)
  // "적중"이라는 말과 백분율은 쓰지 않는다(명세 47) — 다음에 열리는 것의 이름도 화면에서는 "운세에 답한 날"로 읽는다(이름은 lib/stats/extra.ts nextUnlock이 준다)
  const unlockTitle = unlock ? (unlock.title === "운세 적중률" ? "운세에 답한 날" : unlock.title) : "";
  return (
    <details className="more-stats me-sep card-frame card-light card-paper">
      <summary className="more-stats__summary tap cursor-pointer list-none [&::-webkit-details-marker]:hidden">자세한 통계</summary>
      <div className="mt-3 flex flex-col gap-4">
        {/* 다음에 열리는 통계 하나 — 진행 점(have/need)과 한 줄. 모양은 디자이너(.unlock*) */}
        {unlock && (
          <div className="unlock card-frame card-light card-paper flex items-center gap-3 px-5 py-3.5" aria-label={`다음에 열리는 것: ${unlockTitle}`}>
            <span className="unlock__dots flex gap-1" aria-hidden>
              {Array.from({ length: unlock.need }, (_, i) => (
                <span key={i} className="unlock__dot" data-on={i < unlock.have ? "" : undefined} />
              ))}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="unlock__title text-[15px] font-bold">{unlockTitle}</span>
              <span className="unlock__how text-[13px] text-muted">{unlock.how}</span>
            </span>
          </div>
        )}

        {/* 영역 칩이 달린 그래프(한 달 · 1년). 그릴 기록이 모자라면 자리째 빼고 위 "다음에 열리는 것"이 말한다 */}
        {chartReady && <div className="hchart-wrap card-frame card-light card-paper px-5 py-4">{chart}</div>}

        {/* v3.22 기록 습관: 큰 숫자 "N일째" + 최고, 최근 30일 도장 점 30개, 이번 달·30일 기록률. 모양은 디자이너(.habit*) */}
        {habit && (
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
        {areaRows && (
          <div className="area-bars card-frame card-light card-paper px-5 py-4" aria-label="영역별 행복도, 최근 30일">
            <p className="text-[15px] font-bold">
              영역별 행복도 <span className="text-[13px] font-normal text-muted">최근 30일 평균, 10점 기준</span>
            </p>
            <ol className="area-bars__list mt-3 flex flex-col gap-2">
              {areaRows.map((a) => (
                <li key={a.key} className="area-bars__row" data-empty={a.n ? undefined : ""} aria-label={`${a.label} ${a.n && a.mean !== null ? `평균 ${Math.round(a.mean * 20) / 10}점, ${a.n}일` : "기록 없음"}`}>
                  <span className="area-bars__label">{a.label}</span>
                  <span className="area-bars__track">
                    <span className="area-bars__fill" style={{ width: `${a.mean === null ? 0 : (a.mean / 5) * 100}%` }} data-tier={a.mean === null ? undefined : happinessTier(a.mean * 2)} />
                  </span>
                  {/* 2026-10-31: 하루 행복도와 같은 10점 기준으로 (단계 평균 × 2) */}
                  <span className="area-bars__value">{a.mean === null ? "–" : Math.round(a.mean * 20) / 10}</span>
                  <span className="area-bars__n">{a.n ? `${a.n}일` : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 2026-10-31 사용자 Q4: 영역별 점수 — 육각형(이번 달·지난달) + 영역 칩으로 천간·지지·오행 막대 */}
        {areaDetail && (
          <div className="area-detail card-frame card-light card-paper flex flex-col gap-5 px-5 py-4">
            <p className="text-[15px] font-bold">
              영역별 행복도 <span className="text-[13px] font-normal text-muted">10점 기준</span>
            </p>
            {areaDetail}
          </div>
        )}

        {/* 자주 고른 기분 — 지표 두 칸에서 한 줄로 */}
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

        {/* 2026-11-14 있었던 일(상태) 통계 — 부모가 그려 넘긴다(StateStats). 쓰기 화면의 "있었던 일 → 그래서 마음은"과 같은 묶음 */}
        {states}

        {/* 운세 카드의 맞아요/아니에요를 모은 것(2026-10-31). 명세 47: "적중" · 백분율 없이 날 수와 최근 열 번 점만. 점수 계산에는 쓰지 않는다 */}
        {accuracy && accuracy.answered > 0 && (
          <div className="accuracy metric card-frame card-light card-paper px-5 py-4">
            <span className="metric__label">운세에 답한 날</span>
            <span className="metric__sub">
              맞아요 {accuracy.hit}일, 답한 날 {accuracy.answered}일
            </span>
            <span className="accuracy__dots flex gap-1" aria-label={`최근 ${accuracy.recent.length}번 중 맞아요 ${accuracy.recent.filter((v) => v === 1).length}번`}>
              {accuracy.recent.map((v, i) => (
                <span key={i} className="accuracy__dot" data-hit={v === 1 ? "" : undefined} />
              ))}
            </span>
          </div>
        )}

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
            <p className="text-[15px] font-bold">글자별 내 행복도</p>
            <Bars title="천간" items={stems} />
            <Bars title="지지" items={branches} />
            <Bars title="오행" items={elements} element />
          </div>
        )}
      </div>
    </details>
  );
}
