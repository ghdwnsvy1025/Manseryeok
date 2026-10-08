import type { ReactNode } from "react";
import type { Bucket, Highlights } from "@/lib/stats/ganji";
import type { MoodCount, PointStats, Streak } from "@/lib/stats/extra";

interface Props {
  h: Highlights;
  fitPercent: number;
  stems: Bucket[];
  branches: Bucket[];
  elements: Bucket[];
  /** 2026-10-09 Q4: 행복도 말고 보여 주는 지표 */
  points: PointStats;
  moods: MoodCount[];
  streak: Streak;
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
export function StatsSummary({ h, fitPercent, stems, branches, elements, points, moods, streak, chart }: Props) {
  const facts: string[] = [];
  if (h.bestGanji) facts.push(`가장 행복한 날은 ${h.bestGanji.ko}일(${h.bestGanji.hanja}) · 평균 ${h.bestGanji.mean}, ${h.bestGanji.n}번`);
  if (h.worstGanji && h.worstGanji.index !== h.bestGanji?.index)
    facts.push(`가장 힘든 날은 ${h.worstGanji.ko}일(${h.worstGanji.hanja}) · 평균 ${h.worstGanji.mean}, ${h.worstGanji.n}번`);

  return (
    <div className="flex flex-col gap-4">
      <div className="card-frame card-paper px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">맞춤도</span>
          <span className="font-serif text-[32px] leading-none">
            {fitPercent}
            <span className="text-[17px] text-muted">%</span>
          </span>
        </div>
        {/* 맞춤도 게이지 — 0~100 */}
        <span className="meter mt-2" aria-hidden>
          <span className="meter__fill" style={{ width: `${fitPercent}%` }} />
        </span>
        <p className="mt-2 text-sm text-muted">기록이 쌓일수록 올라요 · 지금 {h.total}일</p>
        <p className="mt-1 text-sm text-muted">
          {h.overallMean !== null && <>평균 행복도 {h.overallMean} · </>}아직 안 겪은 간지 {h.unseen}개
        </p>
      </div>

      {/* 지표 세 칸 (Q4 = A+B+D): 연속 기록 · 오늘의 포인트 · 자주 고른 기분 */}
      {h.total > 0 && (
        <ul className="metrics" aria-label="내 지표">
          <li className="metric">
            <span className="metric__label">연속 기록</span>
            <span className="metric__value">
              {streak.current}
              <small>일</small>
            </span>
            <span className="metric__sub">최고 {streak.best}일</span>
          </li>
          <li className="metric">
            <span className="metric__label">포인트 해봄</span>
            <span className="metric__value">
              {points.rate === null ? "·" : points.rate}
              {points.rate !== null && <small>%</small>}
            </span>
            <span className="metric__sub">
              {points.answered === 0
                ? "아직 답한 날 없음"
                : points.keptMean !== null && points.missedMean !== null
                  ? `해본 날 ${points.keptMean} · 못 한 날 ${points.missedMean}`
                  : `${points.kept}/${points.answered}일`}
            </span>
          </li>
          <li className="metric metric--moods">
            <span className="metric__label">자주 고른 기분</span>
            {moods.length ? (
              <span className="metric__chips">
                {moods.map((m) => (
                  <span key={m.mood} className="metric__chip">
                    {m.mood}
                    <small>{m.n}</small>
                  </span>
                ))}
              </span>
            ) : (
              <span className="metric__sub">아직 없음</span>
            )}
          </li>
        </ul>
      )}

      {/* 행복도 그래프 (Q7) */}
      {h.total > 0 && (
        <div className="card-frame card-paper px-5 py-4">
          <p className="text-[15px] font-bold">최근 30일 행복도</p>
          <div className="mt-3">{chart}</div>
        </div>
      )}

      {facts.length > 0 && (
        <ul className="flex flex-col gap-2 text-[15px] leading-relaxed">
          {facts.map((f) => (
            <li key={f} className="border-l-2 border-gold pl-3">
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* 천간·지지·오행 한 판 (Q6 = A). 접기 없음. 기록 3건 전엔 한 줄 안내 */}
      {h.total < 3 ? (
        <p className="card-frame card-paper px-5 py-4 text-[15px] text-muted">기록이 3일 쌓이면 천간·지지·오행별 행복도가 막대로 보여요.</p>
      ) : (
        <div className="card-frame card-paper flex flex-col gap-5 px-5 py-4">
          <p className="text-[15px] font-bold">
            글자별 내 행복도 <span className="mt-1 block text-[13px] font-normal text-muted">막대 = 평균 · 아래 숫자 = 횟수</span>
          </p>
          <Bars title="천간" items={stems} />
          <Bars title="지지" items={branches} />
          <Bars title="오행" items={elements} element />
        </div>
      )}
    </div>
  );
}
