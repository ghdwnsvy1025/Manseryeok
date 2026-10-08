import Link from "next/link";
import { redirect } from "next/navigation";
import { BRANCH_META, STEM_META, getTenGod, type Element, type StemHanja } from "@saju/engine";
import { getUser } from "@/lib/supabase/server";
import { GanjiGrid } from "@/components/GanjiGrid";
import { Booting } from "@/components/Booting";
import { ShareCard } from "@/components/ShareCard";
import { shareCardText, shareMessage } from "@/lib/share";
import { characterOf, characterOfGanji } from "@/lib/character";
import { TEN_GOD_THEME } from "@/lib/fortune/base";
import { StatsSummary } from "@/components/StatsSummary";
import { countEntries, getSajuProfile, listEntries, listEntriesForStats } from "@/lib/db";
import { fitPercent } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { byBranch, byElement, byStem, ganjiGrid, highlights } from "@/lib/stats/ganji";
import { formatKoreanDate, todayKST } from "@/lib/time";
import type { PillarSnapshot } from "@/lib/profile";

export const dynamic = "force-dynamic";

const ELEMENT_KO: Record<Element, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };

/** 나무패에 적을 정보 (v3.2): 십신(일간 기준, 일주는 "나") + 천간·지지 오행. 서버에서 한 번 계산해 props로 */
interface PillarInfo {
  p: PillarSnapshot;
  tenGod: string;
  stemElement: Element;
  branchElement: Element;
}

function pillarInfo(p: PillarSnapshot | null, dayStem: string, self: boolean): PillarInfo | null {
  if (!p) return null;
  const stemMeta = STEM_META[p.stem as StemHanja];
  const branchMeta = BRANCH_META[p.branch as keyof typeof BRANCH_META];
  if (!stemMeta || !branchMeta) return null;
  return {
    p,
    tenGod: self ? "나" : getTenGod(dayStem as StemHanja, p.stem as StemHanja),
    stemElement: stemMeta.element,
    branchElement: branchMeta.element,
  };
}

/** 오행 글자색 (톤 v3.6) — 나무패 안의 천간·지지 한자에만. 토큰 el-* (globals.css @theme) */
const ELEMENT_TEXT: Record<Element, string> = {
  wood: "text-el-wood",
  fire: "text-el-fire",
  earth: "text-el-earth",
  metal: "text-el-metal",
  water: "text-el-water",
};

/** 나무패 하나 (키트 wood-tablet). 위 천간 한자 / 가운데 지지 한자(각각 그 오행 색, v3.6) / 아래 십신 + 오행 글자. 일주 패에 "나" 금색.
    오행 점은 뺐다 — 글자색이 생겨 중복 */
function PillarCell({ label, info }: { label: string; info: PillarInfo | null }) {
  const self = info?.tenGod === "나";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="wood-tablet flex min-h-[148px] w-full flex-col items-center justify-center gap-1 font-serif text-[28px] leading-none text-ganji">
        <span className={info ? ELEMENT_TEXT[info.stemElement] : undefined}>{info ? info.p.stem : "·"}</span>
        <span className={info ? ELEMENT_TEXT[info.branchElement] : undefined}>{info ? info.p.branch : "·"}</span>
        {info && (
          <span className="mt-1 flex flex-col items-center gap-0.5 font-sans text-[13px] leading-tight text-ink">
            <span className={self ? "text-[12px] font-bold text-gold-ink" : ""}>{info.tenGod}</span>
            <span className="text-[12px] text-muted">
              {ELEMENT_KO[info.stemElement]}
              {ELEMENT_KO[info.branchElement]}
            </span>
          </span>
        )}
      </div>
      <span className="text-[13px] text-muted">
        {label}
        {info && <span className="text-muted"> · {info.p.ko}</span>}
      </span>
    </div>
  );
}

/** 나무패 아래 "자세히" — 내 기둥에 든 십신의 한글 뜻 한 줄씩 (TEN_GOD_THEME 읽기만). 접힘 기본 */
function TenGodDetails({ infos }: { infos: (PillarInfo | null)[] }) {
  const theme = TEN_GOD_THEME as Record<string, string>;
  const rows: PillarInfo[] = [];
  for (const i of infos) {
    if (!i || i.tenGod === "나" || !theme[i.tenGod]) continue;
    if (rows.some((r) => r.tenGod === i.tenGod)) continue;
    rows.push(i);
  }
  if (rows.length === 0) return null;
  return (
    <details className="mt-3">
      <summary className="tap cursor-pointer list-none text-[15px] text-muted underline underline-offset-4 [&::-webkit-details-marker]:hidden">
        자세히
      </summary>
      <ul className="mt-1 flex flex-col gap-1 text-[15px] leading-relaxed text-ink">
        {rows.map((i) => (
          <li key={i.tenGod}>
            {i.tenGod}: {theme[i.tenGod]}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ cell?: string }> }) {
  const { cell } = await searchParams;
  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: 리디렉트하지 않고 뼈대만 그린다. AnonBoot가 곧 새로 그린다 (docs/ANON_START.md 1절, B2)
  if (!user) return <Booting title="나" cards={3} />;
  const [profile, entries, total, all] = await Promise.all([
    getSajuProfile(supabase, user.id),
    listEntries(supabase, user.id, 30),
    countEntries(supabase, user.id),
    listEntriesForStats(supabase, user.id),
  ]);
  // 생년월일이 없으면 먼저 받는다 (로그인 사용자와 같은 규칙)
  if (!profile) redirect("/onboarding?next=/me");
  const me = characterOf(profile.pillars);
  const h = highlights(all);
  const card = shareCardText(h, profile?.name ?? null);
  const share = card ? shareMessage(card) : null;
  const selected = cell !== undefined && /^\d{1,2}$/.test(cell) && Number(cell) < 60 ? Number(cell) : null;
  const todayIndex = dayGanji(todayKST()).index;
  const cells = ganjiGrid(all);
  const pickedAnimal = selected === null ? "" : characterOfGanji(cells[selected].ko).animal;
  const infos = [
    pillarInfo(profile.pillars.hour, profile.pillars.day.stem, false),
    pillarInfo(profile.pillars.day, profile.pillars.day.stem, true),
    pillarInfo(profile.pillars.month, profile.pillars.day.stem, false),
    pillarInfo(profile.pillars.year, profile.pillars.day.stem, false),
  ];

  return (
    <main className="flex flex-col gap-6">
      <header className="relative flex flex-col items-center pt-2">
        {/* 설정은 한곳에 모았다 (docs/ANON_START.md 3절): Google 연결 · 알림 · 생년월일 · 앱으로 두기 · 로그아웃 */}
        <Link href="/settings" className="tap absolute -top-3 right-0 text-sm text-muted underline underline-offset-4">
          설정
        </Link>
        {/* 제목 자리 = 내 카드 (v3.3 → v3.8 정사각): 폭 54%, 이 화면의 그림 하나. 카드 자체가 테두리를 가지고 있어 틀을 더 두르지 않는다 */}
        <img src={me.cardSrc} alt={`내 카드 ${me.ganjiKo}`} width={1080} height={1080} className="h-auto w-[54%] max-w-[220px]" />
        <h1 className="mt-3 font-serif text-[20px] leading-snug">
          {profile.name !== "손님" && <>{profile.name} · </>}<span className="text-ganji">{me.ganjiKo}일</span> · {me.animal}
        </h1>
        {/* 익명일 때만: 기록이 이 기기에 묶여 있다는 작은 줄 (전수조사 C "익명 기기 종속 상시 안내") */}
        {user.is_anonymous && (
          <p className="mt-1 text-[13px] text-muted">
            이 기기에만 저장돼요 ·{" "}
            <Link href="/settings" className="underline underline-offset-4">
              설정에서 Google 연결
            </Link>
          </p>
        )}
      </header>

      <section className="card-frame card-paper p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[22px]">내 사주</h2>
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
                : " · 시간 모름"}
            </p>
            {/* 사주는 오른쪽에서 왼쪽으로 읽는다: 시 · 일 · 월 · 년 */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <PillarCell label="시" info={infos[0]} />
              <PillarCell label="일" info={infos[1]} />
              <PillarCell label="월" info={infos[2]} />
              <PillarCell label="년" info={infos[3]} />
            </div>
            <TenGodDetails infos={infos} />
          </>
        ) : (
          <p className="mt-2 text-[15px] text-muted">생년월일을 넣으면 내 사주와 운세가 보여요.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-[22px]">간지별 내 행복도</h2>
          <p className="mt-1 text-sm text-muted">60가지 날 가운데 나는 어떤 날에 행복했는지. 기록한 날의 동물이 칸에 찍혀요.</p>
        </div>
        <GanjiGrid
          cells={cells}
          selected={selected}
          todayIndex={todayIndex}
          basePath="/me"
          pickedEntries={selected === null ? [] : all.filter((e) => e.day_ganji_index === selected)}
          pickedAnimal={pickedAnimal}
        />
        <StatsSummary h={h} fitPercent={fitPercent(all.length)} stems={byStem(all)} branches={byBranch(all)} elements={byElement(all)} />
      </section>

      <section className="flex flex-col gap-3">
        <ShareCard card={card} cardSrc={me.cardSrc} title={share?.title ?? ""} text={share?.text ?? ""} />
      </section>

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
                      {formatKoreanDate(e.entry_date)} · <span className="text-ganji">{e.day_stem}{e.day_branch}일</span>
                    </span>
                    {e.note ? (
                      <span className="mt-0.5 block truncate font-hand text-[20px] leading-snug text-ink">{e.note}</span>
                    ) : (
                      e.moods.length === 0 && <span className="block text-sm text-muted">행복도만 남김</span>
                    )}
                    {e.moods.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.moods.map((m) => (
                          <span key={m} className="tag tag--on h-6 px-0.5 text-[12px] text-paper-2">
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
