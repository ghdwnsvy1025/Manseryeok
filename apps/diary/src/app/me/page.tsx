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
import { stateByGlyph } from "@/lib/stats/states";
import { TrackOnMount } from "@/components/track/TrackOnMount";
import { birthProfileOf, countEntries, getEntry, getSajuProfile, listEntries, listEntriesInMonth, listEntriesForStats, listFortuneScores, listFortuneVotes } from "@/lib/db";
import { sajuChart } from "@/lib/saju/chart";
import { paidReadingOpen } from "@/lib/sajucow";
import { SajuChartPanel } from "@/components/SajuChartPanel";
import { Sheet, SheetTrigger } from "@/components/Sheet";
import { MeForecastChips } from "@/components/MeForecastChips";
import { DaySheet, DayListButton } from "@/components/DaySheet";
import { GanjiSheet } from "@/components/GanjiSheet";
import { GlyphSheet } from "@/components/GlyphSheet";
import { SajuNewDot } from "@/components/SajuNewDot";
import { HappyAnswer, InsightSeals, VersusAnswer } from "@/components/InsightSeals";
import { bestWorstDays, fortuneAccuracy, growingSeries, habitOf, happinessSeries, monthlySeries, moodTop, nextUnlock, streakOf, type PickedDay } from "@/lib/stats/extra";
import { BestWorstDays, type DayCard, type ForecastCard } from "@/components/BestWorstDays";
import { forecastWindow, type ForecastDay } from "@/lib/stats/forecast";
import { forecastVersus, happyWhen, INSIGHT_UNLOCK_DAYS } from "@/lib/stats/insight";
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
  const [profile, total, all, fortuneScores, monthEntries, savedEntry, recent, paidOpen, votes, recordRows] = await Promise.all([
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
    // 운세 적중률 (맞아요/아니에요)
    listFortuneVotes(supabase, user.id),
    // 명세 50 (2026-11-20): 날짜 낱장의 "전체 보기" 목록과, 달력에 없는 달의 날짜 낱장(가장 행복했던 날 등)에 쓴다. 최근 400개
    listEntries(supabase, user.id, 400),
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
      entry: e ? { happiness: e.happiness, moods: e.moods, note: e.note, areas: e.areas ?? null, states: e.states ?? null, tomorrowNote: e.tomorrow_note ?? null } : null,
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
  const toForecast = (f: ForecastDay | null): ForecastCard | null =>
    f ? { date: f.date, label: formatKoreanDate(f.date).replace(/\s*\S+요일$/, ""), ganjiKo: f.ganjiKo, faceSrc: characterOfGanji(f.ganjiKo).faceSrc, reason: f.reason } : null;
  // 명세 47 (2026-11-17): 오늘 다음 날부터 30일의 좋을 날·조심할 날 셋씩(칩은 [0]), 물음 인장 둘의 답. 계산만 해 둔다 — 화면은 디자인 쪽이 붙인다
  const window30 = forecastWindow({ pillars: profile.pillars, profile: birthProfileOf(profile), entries: all, from: today, days: 30, pick: 3 });
  const windowCards = { best: window30.best.map((f) => toForecast(f)!), worst: window30.worst.map((f) => toForecast(f)!) };
  const happy = happyWhen(all, profile.pillars.day.stem);
  const versus = forecastVersus(all, fortuneScores);
  // 명세 50: 있었던 일마다 그날의 행복도 평균(영역별 행복도 자리를 대신한다), 전체 기록 목록(최근 것부터)
  // 명세 52 (2026-11-21): 글자별 행복도의 칸을 누르면 뜨는 낱장 — 그 글자의 날에 있었던 일의 경향. 열쇠 "stem:갑" · "branch:자" · "element:목"
  const glyphStates = stateByGlyph(all);
  const records = recordRows.map((e) => ({
    date: e.entry_date,
    ganjiKo: dayGanji(e.entry_date).ko,
    entry: { happiness: e.happiness, moods: e.moods, note: e.note, areas: e.areas ?? null, states: e.states ?? null, tomorrowNote: e.tomorrow_note ?? null },
  }));
  const insightOpen = all.length >= INSIGHT_UNLOCK_DAYS;
  const insightLeft = Math.max(0, INSIGHT_UNLOCK_DAYS - all.length);
  // 달력 도장(표시 재료): 앞으로 30일의 좋을 날 셋 · 조심할 날 셋 (명세 47 — 전에는 다음 달 하루씩 fc)
  const forecastMarks: Record<string, "best" | "worst"> = {};
  for (const f of window30.best) forecastMarks[f.date] = "best";
  for (const f of window30.worst) forecastMarks[f.date] = "worst";
  const allPick = bestWorstDays(all);
  // 명세 47: 가장 행복했던 날(+ 작게 힘든 날)은 "나는 언제 행복했지?" 낱장 안으로 — 전체 기록의 하루씩
  const dayCards = <BestWorstDays best={toCard(allPick.best)} worst={toCard(allPick.worst)} />;
  const moods = moodTop(all, 3);
  const streak = streakOf(all, today);
  const series = growingSeries(happinessSeries(all, fortuneScores, today, 30));
  const yearSeries = growingSeries(monthlySeries(all, fortuneScores, today, 12));
  // 2026-10-31: 빈 자리는 블록마다 안내하지 않고 "다음에 열리는 것" 하나. 그래프는 최근 30일 기록 2일부터
  const chartReady = series.filter((p) => p.happiness !== null).length >= 2;
  const unlock = nextUnlock({ days: all.length, votes: votes.length, months: yearSeries.filter((p) => p.happiness !== null).length });
  const accuracy = fortuneAccuracy(votes);
  const cells = ganjiGrid(all);
  // 2026-10-31: 내 사주는 요약 카드, 누르면 그 아래에 만세력이 펼쳐진다 (SajuChartPanel)
  const chart = sajuChart(profile.pillars, birthProfileOf(profile), today);
  // v3.10: 오늘 화면에서 뺀 "기록 N일째"를 여기로. 60칸 중 채운 칸 = 기록이 1건 이상인 간지 수
  const filledCells = cells.filter((c) => c.n > 0).length;
  // 명세 47 기록 한 줄에 쓰는 "이번 달 N일" — 전에는 StatsSummary에 넘기는 자리에서 바로 불렀다(같은 habitOf, 한 번만 부르게 올렸다)
  const habit = habitOf(all, today);

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
        {/* 명세 47: 기록 한 줄(전에는 기록 · 모은 카드 두 줄 표). 가운뎃점 대신 간격(톤 v3.13). 모은 카드 수는 60갑자 보기 머리로 갔다 */}
        <p className="me-line mt-2">
          {insightOpen ? (
            <>
              <span>이번 달 {habit.thisMonth}일 기록</span>
              {streak.current > 1 && <span>{streak.current}일째</span>}
            </>
          ) : (
            <span>
              {INSIGHT_UNLOCK_DAYS}일까지 {insightLeft}일 남았어요
            </span>
          )}
        </p>
      </header>

      {/* 명세 48 내 사주 접힌 줄(+ 더하기): 중심 · 힘 두 줄(한자와 사주 용어 없이 쉬운 말만) + 오른쪽에 다섯 힘 막대 맛보기(숫자 · 글자 없이 오행 색, 꾸밈).
          버튼 글귀 "내 사주 그림 보기", 이 기기에서 한 번도 안 열었으면 붉은 점(SajuNewDot). 줄 전체가 버튼, 누르면 만세력 낱장.
          id="saju"는 옛 주소(/me/saju → /me?saju=open#saju)가 닿는 자리 */}
      <SheetTrigger id="saju" target="sheet-saju" className="saju-line card-light card-paper">
        <span className="saju-line__head">
          <span className="saju-line__title">내 사주</span>
          <span className="saju-line__more">
            <SajuNewDot sheetId="sheet-saju" />
            내 사주 그림 보기
          </span>
        </span>
        <span className="saju-line__body">
          <span className="saju-line__rows">
            <span className="saju-line__row">
              <span className="saju-line__k">중심</span>
              <span className="saju-line__v">{chart.center.centerPlain.split(" — ")[0]}</span>
            </span>
            <span className="saju-line__row">
              <span className="saju-line__k">힘</span>
              <span className="saju-line__v">{chart.center.strengthPlain}</span>
            </span>
          </span>
          <span className="saju-line__mini" aria-hidden>
            {chart.power.map((p) => (
              <span key={p.el} className="saju-line__bar" data-el={p.el} data-zero={p.pct === 0 ? "" : undefined} style={{ "--h": p.pct / Math.max(1, ...chart.power.map((x) => x.pct)) } as React.CSSProperties} />
            ))}
          </span>
        </span>
      </SheetTrigger>

      <section id="me-records" className="me-sep me-sep--wide flex flex-col gap-4">
        {/* 명세 47 칩 둘: 앞으로 30일의 가장 좋을 날 · 조심할 날 — 누르면 아래 달력이 그 달로 넘어가 그 칸이 골라진다 */}
        <MeForecastChips best={windowCards.best[0] ?? null} worst={windowCards.worst[0] ?? null} />
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
          <MonthCalendar cal={calMonth} days={calDays} today={today} forecast={forecastMarks} />
        ) : (
          <>
            {/* 명세 47: 모은 카드 수는 머리에서 격자 보기 머리로 */}
            <dl className="kv">
              <div className="kv__row">
                <dt>모은 카드</dt>
                <dd>
                  {filledCells} / 60장
                  <span className="kv__bar" aria-hidden>
                    <span style={{ width: `${(filledCells / 60) * 100}%` }} />
                  </span>
                  {/* 명세 51: 60갑자 보기에도 전체 목록으로 가는 글자 버튼 */}
                  <DayListButton />
                </dd>
              </div>
            </dl>
            <GanjiGrid
              cells={cells}
              selected={selected}
              todayIndex={todayIndex}
              basePath="/me?view=grid"
            />
          </>
        )}
        {/* 명세 47 물음 인장 둘: 기록 7일부터 열린다. 누르면 답 낱장 */}
        <InsightSeals open={insightOpen} left={insightLeft} />
        {/* 기록 0일 = 첫 기록 카드, 그 뒤 = 접힌 "자세한 통계" 서랍 하나(그래프 · 습관 · 기분 · 있었던 일 · 맞춤도 · 글자별) */}
        <StatsSummary h={h} fitPercent={fitPercent(all.length)} stems={byStem(all)} branches={byBranch(all)} elements={byElement(all)} moods={moods} streak={streak} chart={<HappinessChart series={series} yearSeries={yearSeries} emptyArt={me.characterSrc} />} chartReady={chartReady} unlock={unlock} accuracy={accuracy} writeHref="/write" />
      </section>

      {/* ── 낱장 셋 (명세 47): 같은 틀(Sheet). 한 번에 하나만 열린다. 저장 직후(?saved=)에도 저절로 열리지 않는다 ── */}
      {/* 만세력 낱장: 본문에서 옮겨 온 오행 방울 · 중심 기운 · 용신 · 희신 → 생년월일 → 만세력 한 판 → 맨 끝 유료 풀이 권유 한 곳. ?saju=open이면 열린 채 시작 */}
      <Sheet id="sheet-saju" name="saju" title="만세력" initialOpen={saju === "open"}>
        {/* 명세 48: 맨 위 여덟 글자 · 오행 방울 · 요약 세 줄은 뺐다(명식 표 · 다섯 힘 · 풀이 낱말 줄이 맡는다). 생년월일 줄은 표 아래로 */}
        <SajuChartPanel
          chart={chart}
          ganjiKo={me.ganjiKo}
          faceSrc={me.faceSrc}
          open={paidOpen}
          birth={
            <p className="saju-sheet__birth flex items-center justify-between text-sm text-muted">
              <span>
                {profile.calendar === "lunar" ? "음력" : "양력"} {profile.birth_year}.{profile.birth_month}.{profile.birth_day}
                {profile.birth_hour !== null ? ` ${String(profile.birth_hour).padStart(2, "0")}:${String(profile.birth_minute).padStart(2, "0")}` : " 시간 모름"}
              </span>
              <Link href="/onboarding?next=/me" className="tap underline underline-offset-4">
                고치기
              </Link>
            </p>
          }
        />
      </Sheet>
      {/* 글자 낱장(명세 52): "글자별 내 행복도"의 막대 칸을 누르면 뜬다 — 그 글자가 든 날에 있었던 일의 경향(glyphStates)과 그날들 */}
      <GlyphSheet
        glyphs={[
          ...byStem(all).map((b) => ({ id: `stem:${b.ko}`, kind: "stem" as const, name: b.ko, n: b.n, mean: b.mean })),
          ...byBranch(all).map((b) => ({ id: `branch:${b.ko}`, kind: "branch" as const, name: b.ko, n: b.n, mean: b.mean })),
          ...byElement(all).map((b) => ({ id: `element:${b.key}`, kind: "element" as const, name: b.key, n: b.n, mean: b.mean })),
        ]}
        states={glyphStates}
        records={records}
        today={today}
      />
      {/* 간지 낱장(명세 51): 60갑자 칸을 누르면 뜬다. 주소 ?cell=N으로 들어오면 뜬 채 시작한다 */}
      <GanjiSheet cells={cells.map((c) => ({ index: c.index, ko: c.ko, n: c.n, mean: c.mean }))} records={records} todayIndex={todayIndex} today={today} />
      {/* 날짜 낱장과 전체 목록(명세 50): 달력 칸 · 두 날 · 예상의 날 줄 · 목록 어디서 누르든 같은 낱장. 주소 ?d=로 들어오면 뜬 채 시작한다 */}
      <DaySheet records={records} days={calDays} forecast={forecastMarks} forecastCards={windowCards} today={today} />
      {/* 물음 인장의 답 낱장 둘 — 인장이 열렸을 때만 그린다 */}
      {insightOpen && (
        <Sheet id="sheet-happy" name="happy" title="나는 언제 행복했지?">
          <HappyAnswer happy={happy} days={dayCards} chart={<HappinessChart series={series} variant="happy" emptyArt={me.characterSrc} />} />
        </Sheet>
      )}
      {insightOpen && (
        <Sheet id="sheet-versus" name="versus" title="예상은 맞았을까?">
          <VersusAnswer versus={versus} />
        </Sheet>
      )}
      {/* v3.16: "내 카드 공유" 섹션은 없앴다 — 공유는 오늘 화면 운세 카드의 "공유"(오늘의 운세 한 장)로 */}

      {/* v3.17 정리: "내 기록" 목록은 뺐다 — 달력에서 날짜를 누르면 같은 내용(카드·행복도·기분·메모·고치기)이 나온다 */}
    </main>
  );
}
