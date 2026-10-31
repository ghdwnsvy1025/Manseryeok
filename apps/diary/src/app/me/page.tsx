import Link from "next/link";
import { redirect } from "next/navigation";
import type { Element } from "@saju/engine";
import { getUser } from "@/lib/supabase/server";
import { GanjiGrid } from "@/components/GanjiGrid";
import { BurstPreload } from "@/components/BurstPreload";
import { SaveBurst } from "@/components/SaveBurst";
import { Booting } from "@/components/Booting";
import { characterOf, characterOfGanji } from "@/lib/character";
import { StatsSummary } from "@/components/StatsSummary";
import { TrackOnMount } from "@/components/track/TrackOnMount";
import { birthProfileOf, countEntries, getEntry, getSajuProfile, listEntries, listEntriesInMonth, listEntriesForStats, listFortuneScores } from "@/lib/db";
import { sajuChart } from "@/lib/saju/chart";
import { paidReadingOpen } from "@/lib/sajucow";
import { SajuChartPanel } from "@/components/SajuChartPanel";
import { FoldButton } from "@/components/FoldButton";
import { areaAverages, bestWorstDays, growingSeries, habitOf, happinessSeries, monthlySeries, moodTop, streakOf, type PickedDay } from "@/lib/stats/extra";
import { BestWorstDays, type DayCard, type ForecastCard } from "@/components/BestWorstDays";
import { forecastMonth, nextMonthOf, type ForecastDay } from "@/lib/stats/forecast";
import { HappinessChart } from "@/components/HappinessChart";
import { MonthCalendar, type DayInfo } from "@/components/MonthCalendar";
import { buildMonth, resolveMonth } from "@/lib/calendar";
import { addDays, formatKoreanDate, parseYmd } from "@/lib/time";
import { fitPercent } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { byBranch, byElement, byStem, ganjiGrid, highlights } from "@/lib/stats/ganji";
import { todayKST } from "@/lib/time";

export const dynamic = "force-dynamic";


/** 오행 글자색 (톤 v3.6) — 내 사주 요약의 여덟 글자. 토큰 el-* (globals.css @theme) */
const ELEMENT_TEXT: Record<Element, string> = {
  wood: "text-el-wood",
  fire: "text-el-fire",
  earth: "text-el-earth",
  metal: "text-el-metal",
  water: "text-el-water",
};
const ELEMENT_KO: Record<Element, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };

export default async function MePage({ searchParams }: { searchParams: Promise<{ cell?: string; view?: string; m?: string; d?: string; saved?: string; at?: string; saju?: string }> }) {
  const { cell, view, m, d, saved, at, saju } = await searchParams;
  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: 리디렉트하지 않고 뼈대만 그린다. AnonBoot가 곧 새로 그린다 (docs/ANON_START.md 1절, B2)
  if (!user) return <Booting title="나" cards={3} />;
  const today = todayKST();
  // 달력: 보여 줄 달(?d가 있으면 그 달). 그 달 기록을 한 번에 받아 날짜 상세를 클라이언트에서 바로 그린다 (v3.15)
  const dParam = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : null;
  const calYm = resolveMonth(dParam ? dParam.slice(0, 7) : m, today);
  // 2026-10-24: 저장하면 쓰기 폼이 여기로 온다 (/me?d=날짜&saved=날짜&at=시각, actions.ts). 팡은 저장한 날의 기록으로 — 오늘 화면에서 옮겨 왔다
  const savedDate = saved && parseYmd(saved) && saved <= today ? saved : null;
  const [profile, total, all, fortuneScores, monthEntries, savedEntry, recent, paidOpen] = await Promise.all([
    getSajuProfile(supabase, user.id),
    countEntries(supabase, user.id),
    listEntriesForStats(supabase, user.id),
    // 1년 보기(월별 평균)까지 — 최근 12달 (2026-10-31)
    listFortuneScores(supabase, user.id, `${addDays(today, -365).slice(0, 7)}-01`),
    listEntriesInMonth(supabase, user.id, calYm),
    savedDate ? getEntry(supabase, user.id, savedDate) : Promise.resolve(null),
    savedDate ? listEntries(supabase, user.id, 8) : Promise.resolve([]),
    // 만세력의 유료 풀이 버튼 — 결제가 열렸는지 (바이럴에 5분 캐시로 묻는다, 실패하면 닫힘)
    paidReadingOpen(),
  ]);
  // 생년월일이 없으면 먼저 받는다 (로그인 사용자와 같은 규칙)
  if (!profile) redirect("/onboarding?next=/me");
  const me = characterOf(profile.pillars);
  // 팡 재료: 저장한 날의 일진 카드 + 그날 행복도 도장 + 지난 도장(최근 7개, 그날 제외)
  const burstEntry = savedDate ? savedEntry : null;
  const burstGanji = dayGanji(savedDate ?? today);
  const burstCharacter = characterOfGanji(burstGanji.ko);
  const burstWhen = !savedDate || savedDate === today ? "오늘" : savedDate === addDays(today, -1) ? "어제" : formatKoreanDate(savedDate).replace(/\s*\S+요일$/, "");
  const recentHappiness = recent.filter((e) => e.entry_date !== savedDate).slice(0, 7).map((e) => e.happiness);
  const h = highlights(all);
  const selected = cell !== undefined && /^\d{1,2}$/.test(cell) && Number(cell) < 60 ? Number(cell) : null;
  const todayIndex = dayGanji(today).index;
  // v3.14 Q6: 기본은 달력. 60갑자는 ?view=grid (칸 선택 ?cell=이 있으면 60갑자)
  const isCal = view !== "grid" && cell === undefined;
  const pickedDay = isCal ? dParam : null;
  const calMonth = buildMonth(calYm, all, today);
  const calDays: Record<string, DayInfo> = {};
  const byDate = new Map(monthEntries.map((e) => [e.entry_date, e]));
  for (const c of calMonth.weeks.flat()) {
    if (!c.date || c.isFuture) continue;
    const e = byDate.get(c.date);
    calDays[c.date] = {
      ganjiKo: dayGanji(c.date).ko,
      entry: e ? { happiness: e.happiness, moods: e.moods, note: e.note, areas: e.areas ?? null, tomorrowNote: e.tomorrow_note ?? null } : null,
    };
  }
  // 2026-10-09 Q4·Q7: 행복도 말고 보여 줄 지표 + 최근 30일 그래프(운세 점수 겹침, 빈 날은 비움)
  // 2026-10-31: "하면 좋아요" 지표 대신 가장 행복한 날·힘든 날 (지금 보는 달 / 전체), 영역별 평균 막대
  const toCard = (p: PickedDay | null): DayCard | null => {
    if (!p) return null;
    const g = dayGanji(p.date);
    return { date: p.date, label: formatKoreanDate(p.date).replace(/\s*\S+요일$/, ""), happiness: p.happiness, moods: p.moods, ganjiKo: g.ko, faceSrc: characterOfGanji(g.ko).faceSrc };
  };
  // 다음 달 좋은 날·조심할 날 예상 (2026-10-31): 오늘 운세 점수와 같은 계산을 다음 달 매일에 (코드만, 약 0.2초)
  const nextYm = nextMonthOf(today.slice(0, 7));
  const fc = forecastMonth({ pillars: profile.pillars, profile: birthProfileOf(profile), entries: all, ym: nextYm });
  const toForecast = (f: ForecastDay | null): ForecastCard | null =>
    f ? { date: f.date, label: formatKoreanDate(f.date).replace(/\s*\S+요일$/, ""), ganjiKo: f.ganjiKo, faceSrc: characterOfGanji(f.ganjiKo).faceSrc, reason: f.reason } : null;
  const forecastMarks: Record<string, "best" | "worst"> = {};
  if (fc.best) forecastMarks[fc.best.date] = "best";
  if (fc.worst) forecastMarks[fc.worst.date] = "worst";
  const monthPick = bestWorstDays(all, calYm);
  const allPick = bestWorstDays(all);
  const dayCards = (
    <BestWorstDays
      month={{ label: `${Number(calYm.slice(5, 7))}월`, best: toCard(monthPick.best), worst: toCard(monthPick.worst) }}
      all={{ best: toCard(allPick.best), worst: toCard(allPick.worst) }}
      next={{ label: `${Number(nextYm.slice(5, 7))}월`, ym: nextYm, best: toForecast(fc.best), worst: toForecast(fc.worst) }}
    />
  );
  const areaAvg = areaAverages(all, today, 30);
  const moods = moodTop(all, 3);
  const streak = streakOf(all, today);
  const series = growingSeries(happinessSeries(all, fortuneScores, today, 30));
  const yearSeries = growingSeries(monthlySeries(all, fortuneScores, today, 12));
  const cells = ganjiGrid(all);
  // 2026-10-31: 내 사주는 요약 카드, 누르면 그 아래에 만세력이 펼쳐진다 (SajuChartPanel)
  const chart = sajuChart(profile.pillars, birthProfileOf(profile), today);
  // v3.10: 오늘 화면에서 뺀 "기록 N일째"를 여기로. 60칸 중 채운 칸 = 기록이 1건 이상인 간지 수
  const filledCells = cells.filter((c) => c.n > 0).length;

  return (
    <main className="flex flex-col gap-6">
      <TrackOnMount event="stats_view" props={{ view: isCal ? "calendar" : "grid" }} />
      {/* 저장 완료 "팡" — 방금 저장하고 온 한 번 (톤 v3.1, 카드는 저장한 날 일진 + char-frame 틀, 05 v3.5). 2026-10-24 오늘 화면에서 여기로.
          닫히면 아래 #me-records(달력·그래프)로 내려간다 (SaveBurst) */}
      {burstEntry && savedDate && <BurstPreload cardSrc={burstCharacter.cardSrc} />}
      {/* 저장 성공은 여기서 센다 (쓰기 폼은 redirect로 끝나 성공을 모른다). at로 한 번만 — 새로고침에 다시 안 센다 */}
      {burstEntry && savedDate && (
        <TrackOnMount event="diary_saved" props={{ when: savedDate === today ? "today" : savedDate === addDays(today, -1) ? "yesterday" : "past" }} once={`saved:${savedDate}|${at ?? ""}`} />
      )}
      {burstEntry && savedDate && (
        <SaveBurst
          ganjiKo={burstGanji.ko}
          ganjiHanja={burstGanji.hanja}
          cardSrc={burstCharacter.cardSrc}
          recentHappiness={recentHappiness}
          happiness={burstEntry.happiness}
          when={burstWhen}
          signature={`${savedDate}|${at ?? ""}|${burstEntry.happiness}|${burstEntry.moods.join(",")}|${burstEntry.note ?? ""}|${burstEntry.promise ?? ""}`}
        />
      )}
      <header className="relative flex flex-col items-center pt-2">
        {/* 설정은 한곳에 모았다 (docs/ANON_START.md 3절): Google 연결 · 알림 · 생년월일 · 앱으로 두기 · 로그아웃 */}
        <Link href="/settings" prefetch={true} className="tap absolute -top-3 right-0 text-sm text-muted underline underline-offset-4">
          설정
        </Link>
        {/* 제목 자리 = 내 카드 (v3.3 → v3.8 정사각): 폭 54%, 이 화면의 그림 하나. 카드 자체가 테두리를 가지고 있어 틀을 더 두르지 않는다 */}
        <img src={me.cardSrc} alt={`내 카드 ${me.ganjiKo}`} width={1080} height={1080} className="h-auto w-[54%] max-w-[220px]" />
        <h1 className="mt-3 font-serif text-[20px] leading-snug">
          {profile.name !== "손님" ? <>{profile.name}의 카드, </> : <>나의 카드, </>}
          <span className="text-ganji">{me.ganjiKo}</span>
        </h1>
        {/* v3.13: 점 대신 이름–값 줄맞춤. "이 기기에만 저장돼요"는 설정에만 (2026-10-10) */}
        <dl className="kv me-progress mt-3 w-full max-w-[260px]">
          <div className="kv__row">
            <dt>기록</dt>
            <dd>{total}일</dd>
          </div>
          <div className="kv__row">
            <dt>모은 카드</dt>
            <dd>
              {filledCells} / 60장
              <span className="kv__bar" aria-hidden>
                <span style={{ width: `${(filledCells / 60) * 100}%` }} />
              </span>
            </dd>
          </div>
        </dl>
      </header>

      {/* 2026-10-31 내 사주 요약 (나무패 서랍 대신): 여덟 글자 · 중심 기운 · 용신 한 줄씩. 누르면 바로 아래에 만세력 한 판이 펼쳐지고
          맨 아래 "접기" — 따로 창으로 가지 않는다(사용자, 같은 날). 아래 달력·통계는 그대로 이어진다. 모양은 디자이너(.saju-summary*) */}
      <details id="saju" className="saju-summary-fold group" open={saju === "open"}>
        <summary className="saju-summary card-frame card-light card-paper flex cursor-pointer list-none flex-col gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <h2 className="sec-tag">내 사주</h2>
          <span className="saju-summary__preview font-serif text-[17px]" lang="zh-Hant" aria-label="내 사주 여덟 글자">
            {chart.columns.map((c) =>
              c.unknown ? (
                <span key={c.pos} className="saju-summary__pillar text-muted">
                  ??
                </span>
              ) : (
                <span key={c.pos} className="saju-summary__pillar">
                  <span className={c.stemElement ? ELEMENT_TEXT[c.stemElement] : undefined}>{c.stem}</span>
                  <span className={c.branchElement ? ELEMENT_TEXT[c.branchElement] : undefined}>{c.branch}</span>
                </span>
              ),
            )}
          </span>
        </span>
        {/* 2026-10-31 사용자 Q5: 오행을 그림으로 — 다섯 동그라미, 크기·채움이 분포율(--pct 0~1). 모양은 디자이너(.saju-summary__elements) */}
        <ul className="saju-summary__elements" aria-label="오행 분포">
          {chart.elements.map((e) => (
            <li key={e.el} className="saju-summary__element" data-el={e.el} data-zero={e.pct === 0 ? "" : undefined} style={{ "--pct": e.pct / 100 } as React.CSSProperties} aria-label={`${e.ko} ${e.pct}%`}>
              <span className="saju-summary__el-dot" aria-hidden />
              <span className={`saju-summary__el-label font-serif ${ELEMENT_TEXT[e.el]}`}>{e.ko}</span>
              <span className="saju-summary__el-pct text-[12px] tabular-nums text-muted">{e.pct}%</span>
            </li>
          ))}
        </ul>
        {/* 중심 기운 · 용신 · 희신 — 이름 열과 값 열을 맞춘 세 줄. 용신·희신 오행은 만세력 안과 같은 오행 도장(.saju-yongsin__el) */}
        <dl className="kv saju-summary__rows">
          <div className="kv__row">
            <dt>중심 기운</dt>
            <dd>
              {chart.center.centerGroup}, {chart.center.strengthPlain}
            </dd>
          </div>
          {chart.yongsin && (
            <>
              <div className="kv__row">
                <dt>용신</dt>
                <dd>
                  <span className="saju-yongsin__el" data-el={chart.yongsin.use} data-rank="use">
                    {ELEMENT_KO[chart.yongsin.use]}
                  </span>{" "}
                  <span className="text-muted">{chart.yongsin.useGroup}</span>
                </dd>
              </div>
              <div className="kv__row">
                <dt>희신</dt>
                <dd>
                  <span className="saju-yongsin__el" data-el={chart.yongsin.hee} data-rank="hee">
                    {ELEMENT_KO[chart.yongsin.hee]}
                  </span>{" "}
                  <span className="text-muted">{chart.yongsin.heeGroup}</span>
                </dd>
              </div>
            </>
          )}
        </dl>
        <span className="saju-summary__more self-end text-sm text-muted">
          <span className="group-open:hidden">만세력 펼치기 ›</span>
          <span className="hidden group-open:inline">펼쳐 보는 중 ▾</span>
        </span>
      </summary>
        <div className="saju-summary-fold__body mt-5 flex flex-col gap-5">
          <p className="flex items-center justify-between px-1 text-sm text-muted">
            <span>
              {profile.calendar === "lunar" ? "음력" : "양력"} {profile.birth_year}.{profile.birth_month}.{profile.birth_day}
              {profile.birth_hour !== null ? ` ${String(profile.birth_hour).padStart(2, "0")}:${String(profile.birth_minute).padStart(2, "0")}` : " 시간 모름"}
            </span>
            <Link href="/onboarding?next=/me" className="tap underline underline-offset-4">
              고치기
            </Link>
          </p>
          <SajuChartPanel chart={chart} ganjiKo={me.ganjiKo} faceSrc={me.faceSrc} open={paidOpen} />
          <FoldButton />
        </div>
      </details>

      <section id="me-records" className="me-sep me-sep--wide flex flex-col gap-4">
        <div>
          {/* v3.22: 머리표·설명 문장 없음 — 달력은 보면 안다. v3.13 Q6 = B: 같은 자리에서 60갑자 / 달력 전환 (링크, JS 없음). 모양은 디자이너(.view-switch) */}
          <nav className="view-switch" aria-label="보기">
            <Link href="/me" scroll={false} aria-current={isCal ? "page" : undefined} className="view-switch__item" data-icon="calendar">
              달력
            </Link>
            <Link href="/me?view=grid" scroll={false} aria-current={isCal ? undefined : "page"} className="view-switch__item" data-icon="grid">
              60갑자
            </Link>
          </nav>
        </div>
        {isCal ? (
          <MonthCalendar cal={calMonth} days={calDays} initialSelected={pickedDay} today={today} forecast={forecastMarks} />
        ) : (
          <GanjiGrid
            cells={cells}
            selected={selected}
            todayIndex={todayIndex}
            basePath="/me?view=grid"
            pickedEntries={selected === null ? [] : all.filter((e) => e.day_ganji_index === selected)}
          />
        )}
        <StatsSummary h={h} fitPercent={fitPercent(all.length)} stems={byStem(all)} branches={byBranch(all)} elements={byElement(all)} days={dayCards} areas={areaAvg} moods={moods} streak={streak} habit={habitOf(all, today)} chart={<HappinessChart series={series} yearSeries={yearSeries} emptyArt={me.characterSrc} />} />
      </section>
      {/* v3.16: "내 카드 공유" 섹션은 없앴다 — 공유는 오늘 화면 운세 카드의 "공유"(오늘의 운세 한 장)로 */}

      {/* v3.17 정리: "내 기록" 목록은 뺐다 — 달력에서 날짜를 누르면 같은 내용(카드·행복도·기분·메모·고치기)이 나온다 */}
    </main>
  );
}
