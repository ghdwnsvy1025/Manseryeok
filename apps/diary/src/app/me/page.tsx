import Link from "next/link";
import { redirect } from "next/navigation";
import { BRANCH_META, ELEMENT_ORDER, STEM_META, calculateElementDistribution, calculateHiddenStems, getTenGod, type Element, type ElementKo, type StemHanja } from "@saju/engine";
import { getUser } from "@/lib/supabase/server";
import { GanjiGrid } from "@/components/GanjiGrid";
import { Booting } from "@/components/Booting";
import { characterOf, characterOfGanji } from "@/lib/character";
import { StatsSummary } from "@/components/StatsSummary";
import { countEntries, getSajuProfile, listEntriesInMonth, listEntries, listEntriesForStats, listFortuneScores } from "@/lib/db";
import { moodTone } from "@/lib/entry";
import { growingSeries, happinessSeries, moodTop, pointStats, streakOf } from "@/lib/stats/extra";
import { HappinessChart } from "@/components/HappinessChart";
import { MonthCalendar, type DayInfo } from "@/components/MonthCalendar";
import { buildMonth, resolveMonth } from "@/lib/calendar";
import { addDays } from "@/lib/time";
import { fitPercent } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { byBranch, byElement, byStem, ganjiGrid, highlights } from "@/lib/stats/ganji";
import { formatKoreanDate, todayKST } from "@/lib/time";
import type { PillarSnapshot } from "@/lib/profile";

export const dynamic = "force-dynamic";


/** 나무패에 적을 정보 (v3.2): 십신(일간 기준, 일주는 "나") + 천간·지지 오행. 서버에서 한 번 계산해 props로 */
interface PillarInfo {
  p: PillarSnapshot;
  /** 천간의 십신 (일간은 "나") — 패 위에 */
  tenGod: string;
  /** 지지 정기(지장간 본기)의 십신 — 패 아래에. v3.9 */
  branchTenGod: string;
  stemElement: Element;
  branchElement: Element;
}

type Pillars4 = { year: PillarSnapshot; month: PillarSnapshot; day: PillarSnapshot; hour: PillarSnapshot | null };

function pillarInfo(p: PillarSnapshot | null, dayStem: string, self: boolean, branchTenGod: string): PillarInfo | null {
  if (!p) return null;
  const stemMeta = STEM_META[p.stem as StemHanja];
  const branchMeta = BRANCH_META[p.branch as keyof typeof BRANCH_META];
  if (!stemMeta || !branchMeta) return null;
  return {
    p,
    tenGod: self ? "나" : getTenGod(dayStem as StemHanja, p.stem as StemHanja),
    branchTenGod,
    stemElement: stemMeta.element,
    branchElement: branchMeta.element,
  };
}

/** 네 지지의 정기 십신 (엔진 calculateHiddenStems, 일간 기준). 시주가 없으면 hour는 "" */
function branchTenGods(pillars: Pillars4): Record<"year" | "month" | "day" | "hour", string> {
  const toInput = (p: PillarSnapshot) => ({ stem: { hanja: p.stem }, branch: { hanja: p.branch }, ganji: `${p.stem}${p.branch}` });
  const r = calculateHiddenStems({
    year: toInput(pillars.year),
    month: toInput(pillars.month),
    day: toInput(pillars.day),
    hour: pillars.hour ? toInput(pillars.hour) : null,
  });
  const out = { year: "", month: "", day: "", hour: "" };
  for (const item of r.items) {
    const main = item.hiddenStems.find((h) => h.role === "main") ?? item.hiddenStems[item.hiddenStems.length - 1];
    out[item.pillar] = main?.tenGod ?? "";
  }
  return out;
}

/** 오행 분포율 (엔진 calculateElementDistribution의 percentage — 합·조후 반영). 목화토금수 순, 정수 % */
function elementPercents(pillars: Pillars4): { el: ElementKo; pct: number }[] {
  const order = [pillars.hour, pillars.day, pillars.month, pillars.year].filter((p): p is PillarSnapshot => p !== null);
  const stems = order.map((p) => p.ko.slice(0, 1)).join("");
  const branches = order.map((p) => p.ko.slice(1, 2)).join("");
  const d = calculateElementDistribution(stems, branches);
  return ELEMENT_ORDER.map((el) => ({ el, pct: Math.round(d.percentage[el]) }));
}

const ELEMENT_KO_TO_EN: Record<ElementKo, Element> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" };

/** 오행 글자색 (톤 v3.6) — 나무패 안의 천간·지지 한자에만. 토큰 el-* (globals.css @theme) */
const ELEMENT_TEXT: Record<Element, string> = {
  wood: "text-el-wood",
  fire: "text-el-fire",
  earth: "text-el-earth",
  metal: "text-el-metal",
  water: "text-el-water",
};

/** 나무패 하나 (키트 wood-tablet). v3.9: 위 천간 십신(일주는 "나" 금색) / 천간 한자 / 지지 한자(각각 오행 색) / 아래 지지 정기 십신.
    오행 글자("금토")는 뺐다 — 글자색이 이미 오행 */
function PillarCell({ label, info }: { label: string; info: PillarInfo | null }) {
  const self = info?.tenGod === "나";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="wood-tablet pillar flex min-h-[156px] w-full flex-col items-center justify-center gap-1 font-serif text-[28px] leading-none text-ganji">
        {info && <span className={`pillar-god pillar-god--stem font-sans text-[12px] leading-tight ${self ? "font-bold text-gold-ink" : "text-ink"}`}>{info.tenGod}</span>}
        <span className={info ? ELEMENT_TEXT[info.stemElement] : undefined}>{info ? info.p.stem : ""}</span>
        <span className={info ? ELEMENT_TEXT[info.branchElement] : undefined}>{info ? info.p.branch : ""}</span>
        {info && <span className="pillar-god pillar-god--branch font-sans text-[12px] leading-tight text-ink">{info.branchTenGod}</span>}
      </div>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

/** 나무패 아래 "자세히" — v3.9: 오행 분포율 다섯 막대(목화토금수, 오행 색). 접힘 기본. 모양은 디자이너(.elements-*) */
function ElementDetails({ rows }: { rows: { el: ElementKo; pct: number }[] }) {
  // 가장 큰 값 줄의 값 글자만 먹색 굵게 (10 v3.9)
  const top = Math.max(...rows.map((r) => r.pct));
  return (
    <details className="mt-3">
      <summary className="tap cursor-pointer list-none text-[15px] text-muted underline underline-offset-4 [&::-webkit-details-marker]:hidden">
        자세히
      </summary>
      <ul className="elements mt-2 flex flex-col gap-1.5" aria-label="오행 분포율">
        {rows.map((r) => (
          <li key={r.el} className={`elements__row flex items-center gap-2 text-[14px] ${ELEMENT_TEXT[ELEMENT_KO_TO_EN[r.el]]}`} data-el={ELEMENT_KO_TO_EN[r.el]}>
            <span className="elements__label font-serif">{r.el}</span>
            <span className="elements__track relative flex-1">
              <span className="elements__fill absolute inset-y-0 left-0 bg-current" style={{ width: `${Math.max(2, r.pct)}%` }} />
            </span>
            <span className={`elements__value w-10 text-right tabular-nums ${r.pct === top ? "font-bold text-ink" : "text-muted"}`}>{r.pct}%</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ cell?: string; view?: string; m?: string; d?: string }> }) {
  const { cell, view, m, d } = await searchParams;
  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: 리디렉트하지 않고 뼈대만 그린다. AnonBoot가 곧 새로 그린다 (docs/ANON_START.md 1절, B2)
  if (!user) return <Booting title="나" cards={3} />;
  const today = todayKST();
  // 달력: 보여 줄 달(?d가 있으면 그 달). 그 달 기록을 한 번에 받아 날짜 상세를 클라이언트에서 바로 그린다 (v3.15)
  const dParam = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : null;
  const calYm = resolveMonth(dParam ? dParam.slice(0, 7) : m, today);
  const [profile, entries, total, all, fortuneScores, monthEntries] = await Promise.all([
    getSajuProfile(supabase, user.id),
    listEntries(supabase, user.id, 30),
    countEntries(supabase, user.id),
    listEntriesForStats(supabase, user.id),
    listFortuneScores(supabase, user.id, addDays(today, -29)),
    listEntriesInMonth(supabase, user.id, calYm),
  ]);
  // 생년월일이 없으면 먼저 받는다 (로그인 사용자와 같은 규칙)
  if (!profile) redirect("/onboarding?next=/me");
  const me = characterOf(profile.pillars);
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
    calDays[c.date] = { ganjiKo: dayGanji(c.date).ko, entry: e ? { happiness: e.happiness, moods: e.moods, note: e.note } : null };
  }
  // 2026-10-09 Q4·Q7: 행복도 말고 보여 줄 지표 + 최근 30일 그래프(운세 점수 겹침, 빈 날은 비움)
  const points = pointStats(all);
  const moods = moodTop(all, 3);
  const streak = streakOf(all, today);
  const series = growingSeries(happinessSeries(all, fortuneScores, today, 30));
  const cells = ganjiGrid(all);
  const bt = branchTenGods(profile.pillars);
  const infos = [
    pillarInfo(profile.pillars.hour, profile.pillars.day.stem, false, bt.hour),
    pillarInfo(profile.pillars.day, profile.pillars.day.stem, true, bt.day),
    pillarInfo(profile.pillars.month, profile.pillars.day.stem, false, bt.month),
    pillarInfo(profile.pillars.year, profile.pillars.day.stem, false, bt.year),
  ];
  const elements = elementPercents(profile.pillars);
  // v3.10: 오늘 화면에서 뺀 "기록 N일째"를 여기로. 60칸 중 채운 칸 = 기록이 1건 이상인 간지 수
  const filledCells = cells.filter((c) => c.n > 0).length;

  return (
    <main className="flex flex-col gap-6">
      <header className="relative flex flex-col items-center pt-2">
        {/* 설정은 한곳에 모았다 (docs/ANON_START.md 3절): Google 연결 · 알림 · 생년월일 · 앱으로 두기 · 로그아웃 */}
        <Link href="/settings" prefetch={true} className="tap absolute -top-3 right-0 text-sm text-muted underline underline-offset-4">
          설정
        </Link>
        {/* 제목 자리 = 내 카드 (v3.3 → v3.8 정사각): 폭 54%, 이 화면의 그림 하나. 카드 자체가 테두리를 가지고 있어 틀을 더 두르지 않는다 */}
        <img src={me.cardSrc} alt={`내 카드 ${me.ganjiKo}`} width={1080} height={1080} className="h-auto w-[54%] max-w-[220px]" />
        <h1 className="mt-3 font-serif text-[20px] leading-snug">
          {profile.name !== "손님" && <>{profile.name}의 </>}<span className="text-ganji">{me.ganjiKo}일</span>
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

      {/* v3.15 Q1 = A: 접힌 상태가 기본. 제목 줄에 여덟 글자(시·일·월·년, 오행 색) 미리보기, 누르면 생년월일·나무패·오행 분포. 모양은 디자이너(.saju-fold*) */}
      <details className="saju-fold card-frame card-paper p-5">
        <summary className="saju-fold__summary flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <h2 className="font-serif text-[22px]">내 사주</h2>
          <span className="saju-fold__preview font-serif text-[17px]" lang="zh-Hant" aria-label="내 사주 여덟 글자">
            {infos.map((info, k) =>
              info ? (
                <span key={k} className="saju-fold__pillar">
                  <span className={ELEMENT_TEXT[info.stemElement]}>{info.p.stem}</span>
                  <span className={ELEMENT_TEXT[info.branchElement]}>{info.p.branch}</span>
                </span>
              ) : (
                <span key={k} className="saju-fold__pillar text-muted">
                  ??
                </span>
              ),
            )}
          </span>
        </summary>
        <div className="mt-3 flex justify-end">
          <Link href="/onboarding?next=/me" className="tap text-sm text-muted underline underline-offset-4">
            {profile ? "고치기" : "넣기"}
          </Link>
        </div>
        {profile ? (
          <>
            <p className="mt-1 text-sm text-muted">
              {profile.calendar === "lunar" ? "음력" : "양력"} {profile.birth_year}.{profile.birth_month}.{profile.birth_day}
              {profile.birth_hour !== null
                ? ` ${String(profile.birth_hour).padStart(2, "0")}:${String(profile.birth_minute).padStart(2, "0")}`
                : " 시간 모름"}
            </p>
            {/* 사주는 오른쪽에서 왼쪽으로 읽는다: 시 · 일 · 월 · 년 */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <PillarCell label="시" info={infos[0]} />
              <PillarCell label="일" info={infos[1]} />
              <PillarCell label="월" info={infos[2]} />
              <PillarCell label="년" info={infos[3]} />
            </div>
            <ElementDetails rows={elements} />
          </>
        ) : (
          <p className="mt-2 text-[15px] text-muted">생년월일을 넣으면 내 사주와 운세가 보여요.</p>
        )}
      </details>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-[22px]">내 행복도</h2>
          {/* v3.13 Q6 = B: 같은 자리에서 60갑자 / 달력 전환 (링크, JS 없음). 모양은 디자이너(.view-switch) */}
          <nav className="view-switch mt-2" aria-label="보기">
            <Link href="/me" scroll={false} aria-current={isCal ? "page" : undefined} className="view-switch__item" data-icon="calendar">
              달력
            </Link>
            <Link href="/me?view=grid" scroll={false} aria-current={isCal ? undefined : "page"} className="view-switch__item" data-icon="grid">
              60갑자
            </Link>
          </nav>
          <p className="mt-2 text-sm text-muted">
            {isCal ? "날마다 남긴 행복도가 도장으로 찍혀요. 날짜를 누르면 그날 카드와 기록이 아래에 나와요." : "60가지 날 가운데 나는 어떤 날에 행복했는지. 기록한 날의 동물이 칸에 찍혀요."}
          </p>
        </div>
        {isCal ? (
          <MonthCalendar cal={calMonth} days={calDays} initialSelected={pickedDay} today={today} />
        ) : (
          <GanjiGrid
            cells={cells}
            selected={selected}
            todayIndex={todayIndex}
            basePath="/me?view=grid"
            pickedEntries={selected === null ? [] : all.filter((e) => e.day_ganji_index === selected)}
          />
        )}
        <StatsSummary h={h} fitPercent={fitPercent(all.length)} stems={byStem(all)} branches={byBranch(all)} elements={byElement(all)} points={points} moods={moods} streak={streak} chart={<HappinessChart series={series} />} />
      </section>
      {/* v3.16: "내 카드 공유" 섹션은 없앴다 — 공유는 오늘 화면 운세 카드의 "공유"(오늘의 운세 한 장)로 */}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[22px]">내 기록</h2>
          <span className="text-sm text-muted">모두 {total}일</span>
        </div>
        {entries.length === 0 ? (
          <p className="card-frame card-paper mt-3 p-5 text-[15px] text-muted">
            아직 기록이 없어요. 오늘 밤 첫 줄을 남겨 보세요.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {entries.map((e) => (
              <li key={e.id}>
                <Link href={`/write?date=${e.entry_date}`} className="card-frame card-paper flex items-start gap-4 px-4 py-3">
                  {/* 왼쪽 숫자 칸은 행복도 */}
                  <span className="w-9 shrink-0 pt-0.5 text-center font-serif text-[24px] leading-none">{e.happiness}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">
                      {formatKoreanDate(e.entry_date)} <span className="ml-1.5 text-ganji">{e.day_stem}{e.day_branch}일</span>
                    </span>
                    {e.note ? (
                      <span className="mt-0.5 block truncate font-hand text-[20px] leading-snug text-ink">{e.note}</span>
                    ) : (
                      e.moods.length === 0 && <span className="block text-sm text-muted">행복도만 남김</span>
                    )}
                    {e.moods.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.moods.map((m) => (
                          <span key={m} data-tone={moodTone(m)} className="tag tag--on h-6 px-0.5 text-[12px] text-paper-2">
                            {m}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
