import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { getUser } from "@/lib/supabase/server";
import { countEntries, getSajuProfile, listEntries } from "@/lib/db";
import { formatKoreanDate } from "@/lib/time";
import type { PillarSnapshot } from "@/lib/profile";

export const dynamic = "force-dynamic";

function PillarCell({ label, p }: { label: string; p: PillarSnapshot | null }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3">
      <span className="text-xs text-faint">{label}</span>
      <span className="font-serif text-2xl leading-tight text-moon">{p ? p.stem : "·"}</span>
      <span className="font-serif text-2xl leading-tight text-moon">{p ? p.branch : "·"}</span>
      <span className="text-xs text-muted">{p ? p.ko : "모름"}</span>
    </div>
  );
}

export default async function MePage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/me");
  const [profile, entries, total] = await Promise.all([
    getSajuProfile(supabase, user.id),
    listEntries(supabase, user.id, 30),
    countEntries(supabase, user.id),
  ]);

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{user.email}</p>
        <h1 className="mt-1 font-serif text-[26px] font-bold">{profile ? `${profile.name}의 밤` : "나"}</h1>
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold">내 사주</h2>
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
            <div className="mt-4 grid grid-cols-4 gap-2">
              <PillarCell label="시" p={profile.pillars.hour} />
              <PillarCell label="일" p={profile.pillars.day} />
              <PillarCell label="월" p={profile.pillars.month} />
              <PillarCell label="년" p={profile.pillars.year} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-muted">생년월일을 넣으면 내 사주와 운세가 보여요.</p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold">내 기록</h2>
          <span className="text-sm text-muted">모두 {total}일</span>
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-[15px] text-muted">
            아직 기록이 없어요. 오늘 밤 첫 줄을 남겨 보세요.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.id}>
                <Link href={`/write?date=${e.entry_date}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg font-bold text-lamp">
                    {e.happiness}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">
                      {formatKoreanDate(e.entry_date)} · <span className="text-moon">{e.day_stem}{e.day_branch}일</span>
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {[e.moods.join(", "), e.note].filter(Boolean).join(" · ") || "행복도만 남김"}
                    </span>
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
