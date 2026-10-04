import Link from "next/link";
import { clearGuestAction, guestProfileAction } from "@/app/actions";
import { FortuneCard } from "@/components/FortuneCard";
import { getUser } from "@/lib/supabase/server";
import { getEntry, getFortuneVote, getSajuProfile, listEntriesForStats } from "@/lib/db";
import { getTodayFortune } from "@/lib/fortune";
import type { FortuneContent } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { guestKeyOf, readGuestProfile } from "@/lib/guest";
import { computeProfile } from "@/lib/profile";
import { addDays, formatKoreanDate, hourKST, todayKST } from "@/lib/time";
import { ProfileForm } from "./onboarding/ProfileForm";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const today = todayKST();
  const ganji = dayGanji(today);
  const tomorrow = dayGanji(addDays(today, 1));
  const night = hourKST() >= 18 || hourKST() < 5;

  const { supabase, user } = await getUser();
  const [profile, entry] = user
    ? await Promise.all([getSajuProfile(supabase, user.id), getEntry(supabase, user.id, today)])
    : [null, null];

  // 운세: 로그인 + 프로필이면 기록까지 반영, 게스트는 쿠키의 생년월일로
  let fortune: FortuneContent | null = null;
  let vote: 1 | -1 | null = null;
  let guestHasProfile = false;
  let fortuneError: string | null = null;
  try {
    if (user && profile) {
      const entries = await listEntriesForStats(supabase, user.id);
      [fortune, vote] = await Promise.all([
        getTodayFortune({ date: today, pillars: profile.pillars, entries, owner: { userId: user.id } }),
        getFortuneVote(supabase, user.id, today),
      ]);
    } else if (!user) {
      const guest = await readGuestProfile();
      if (guest) {
        guestHasProfile = true;
        const computed = computeProfile({ ...guest, name: "손님" });
        if (computed.ok) {
          fortune = await getTodayFortune({ date: today, pillars: computed.value.pillars, entries: [], owner: { guestKey: guestKeyOf(guest) } });
        }
      }
    }
  } catch (e) {
    console.error("오늘 운세", e);
    fortuneError = "운세를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.";
  }

  const writeCard = !user ? (
    <section className="rounded-3xl border border-line bg-surface p-6">
      <h2 className="text-lg font-bold">기록은 로그인하고 남겨요</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        기록이 쌓일수록 운세가 내 하루에 맞춰져요. 기기를 바꿔도 기록은 남아요.
      </p>
      <Link href="/login" className="mt-5 flex h-13 items-center justify-center rounded-2xl bg-lamp font-bold text-lamp-ink">
        Google로 시작하기
      </Link>
    </section>
  ) : entry ? (
    <section className="rounded-3xl border border-line bg-surface p-6">
      <p className="text-sm text-lamp">{saved === today ? "저장했어요" : "오늘 기록, 고마워요"}</p>
      <h2 className="mt-1 font-serif text-2xl font-bold leading-snug">오늘도 한 줄 남겼어요</h2>
      <p className="mt-3 text-[15px] text-muted">
        행복도 <b className="text-ink">{entry.happiness}</b>
        {entry.moods.length > 0 && <> · {entry.moods.join(", ")}</>}
      </p>
      {entry.note && <p className="mt-2 line-clamp-2 text-[15px] text-ink/90">“{entry.note}”</p>}
      <p className="mt-5 border-t border-line pt-4 text-[15px]">
        내일은 <b className="text-moon">{tomorrow.ko}일</b>이에요.
      </p>
      <Link href={`/write?date=${today}`} className="mt-4 inline-block text-sm text-muted underline underline-offset-4">
        오늘 기록 고치기
      </Link>
    </section>
  ) : (
    <section className="rounded-3xl border border-line bg-surface p-6">
      <h2 className="font-serif text-2xl font-bold leading-snug">오늘 하루, 어땠어요?</h2>
      <p className="mt-2 text-[15px] text-muted">행복도 하나만 골라도 돼요. 30초면 끝나요.</p>
      <Link href="/write" className="mt-5 flex h-13 items-center justify-center rounded-2xl bg-lamp font-bold text-lamp-ink">
        오늘 기록하기
      </Link>
    </section>
  );

  let fortuneCard: React.ReactNode;
  if (fortune) {
    fortuneCard = (
      <>
        <FortuneCard fortune={fortune} canVote={Boolean(user)} vote={vote} defaultOpen={!night || !user} />
        {!user && guestHasProfile && (
          <form action={clearGuestAction} className="-mt-2 text-right">
            <button type="submit" className="text-xs text-faint underline underline-offset-4">
              다른 생년월일로 보기
            </button>
          </form>
        )}
      </>
    );
  } else if (fortuneError) {
    fortuneCard = (
      <section className="rounded-3xl border border-line p-6 text-muted">
        <h2 className="text-lg font-bold text-ink">오늘의 운세</h2>
        <p className="mt-2 text-[15px]">{fortuneError}</p>
      </section>
    );
  } else if (user) {
    fortuneCard = (
      <section className="rounded-3xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">생년월일을 알려 주세요</h2>
        <p className="mt-2 text-[15px] text-muted">내 사주로 오늘 운세를 계산해요. 한 번만 넣으면 돼요.</p>
        <Link
          href="/onboarding?next=/"
          className="mt-5 flex h-13 items-center justify-center rounded-2xl border border-lamp font-bold text-lamp"
        >
          생년월일 넣기
        </Link>
      </section>
    );
  } else {
    fortuneCard = (
      <section className="rounded-3xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">오늘 운세, 생년월일만 넣으면 바로 보여요</h2>
        <p className="mt-2 mb-6 text-[15px] text-muted">이 기기에만 남고 서버에 저장하지 않아요.</p>
        <ProfileForm next="/" initial={null} serverAction={guestProfileAction} askName={false} submitLabel="오늘 운세 보기" />
      </section>
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-muted">{formatKoreanDate(today)}</p>
        <h1 className="mt-1 font-serif text-[28px] font-bold">
          오늘은 <span className="text-moon">{ganji.ko}일</span>
          <span className="ml-2 text-lg font-normal text-faint">{ganji.hanja}</span>
        </h1>
      </header>
      {/* 밤에는 기록을, 낮에는 운세를 먼저 */}
      {night ? (
        <>
          {writeCard}
          {fortuneCard}
        </>
      ) : (
        <>
          {fortuneCard}
          {writeCard}
        </>
      )}
    </main>
  );
}
