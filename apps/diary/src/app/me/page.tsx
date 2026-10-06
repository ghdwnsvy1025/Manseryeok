import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { getUser } from "@/lib/supabase/server";
import { GanjiGrid } from "@/components/GanjiGrid";
import { InstallHint } from "@/components/InstallHint";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ShareCard } from "@/components/ShareCard";
import { shareCardText, shareMessage } from "@/lib/share";
import { hourOf } from "@/lib/remind";
import { StatsSummary } from "@/components/StatsSummary";
import { countEntries, getNotificationSettings, getSajuProfile, listEntries, listEntriesForStats } from "@/lib/db";
import { fitPercent } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { byBranch, byElement, byStem, ganjiGrid, highlights } from "@/lib/stats/ganji";
import { formatKoreanDate, todayKST } from "@/lib/time";
import type { PillarSnapshot } from "@/lib/profile";

export const dynamic = "force-dynamic";

/** 나무패 하나 (키트 wood-tablet). 일주 패만 금빛 테두리 */
function PillarCell({ label, p, primary = false }: { label: string; p: PillarSnapshot | null; primary?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`wood-tablet flex min-h-[132px] w-full flex-col items-center justify-center gap-1 font-serif text-[28px] leading-none text-ganji ${
          primary ? "outline-2 outline-offset-2 outline-gold" : ""
        }`}
      >
        <span>{p ? p.stem : "·"}</span>
        <span>{p ? p.branch : "·"}</span>
      </div>
      <span className="text-[13px] text-muted">
        {label}
        {p && <span className="text-faint"> · {p.ko}</span>}
      </span>
    </div>
  );
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ cell?: string }> }) {
  const { cell } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/me");
  const [profile, entries, total, all, notif] = await Promise.all([
    getSajuProfile(supabase, user.id),
    listEntries(supabase, user.id, 30),
    countEntries(supabase, user.id),
    listEntriesForStats(supabase, user.id),
    getNotificationSettings(supabase, user.id),
  ]);
  const h = highlights(all);
  const card = shareCardText(h, profile?.name ?? null);
  const share = card ? shareMessage(card) : null;
  const selected = cell !== undefined && /^\d{1,2}$/.test(cell) && Number(cell) < 60 ? Number(cell) : null;
  const todayIndex = dayGanji(todayKST()).index;

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{user.email}</p>
        <h1 className="mt-1 font-serif text-[26px]">{profile ? `${profile.name}의 밤` : "나"}</h1>
      </header>

      <section className="card-frame card-paper p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[22px]">내 사주</h2>
          <Link href="/onboarding?next=/me" className="text-sm text-muted underline underline-offset-4">
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
            <div className="mt-4 grid grid-cols-4 gap-3">
              <PillarCell label="시" p={profile.pillars.hour} />
              <PillarCell label="일" p={profile.pillars.day} primary />
              <PillarCell label="월" p={profile.pillars.month} />
              <PillarCell label="년" p={profile.pillars.year} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-muted">생년월일을 넣으면 내 사주와 운세가 보여요.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-[22px]">간지별 내 행복도</h2>
          <p className="mt-1 text-sm text-muted">60가지 날 가운데 나는 어떤 날에 행복했는지. 기록한 날의 동물이 칸에 들어와요.</p>
        </div>
        <GanjiGrid cells={ganjiGrid(all)} selected={selected} todayIndex={todayIndex} basePath="/me" />
        <StatsSummary h={h} fitPercent={fitPercent(all.length)} stems={byStem(all)} branches={byBranch(all)} elements={byElement(all)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-[22px]">내일도 오게</h2>
        <NotificationSettings
          enabled={Boolean(notif?.enabled && notif.web_push)}
          remindHour={notif ? Math.max(20, Math.min(23, hourOf(notif.remind_at))) : 21}
          kakaoChannelUrl="https://pf.kakao.com/_WJJxiX"
        />
        <InstallHint />
        <ShareCard card={card} title={share?.title ?? ""} text={share?.text ?? ""} />
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
                      e.moods.length === 0 && <span className="block text-sm text-faint">행복도만 남김</span>
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

      <form action={signOutAction}>
        <button type="submit" className="text-sm text-faint underline underline-offset-4">
          로그아웃
        </button>
      </form>
    </main>
  );
}
