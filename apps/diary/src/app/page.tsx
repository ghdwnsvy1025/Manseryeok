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

/** 한지 카드 공통 — 키트 테두리(card-frame) 위에 한지 표면 */
const card = "card-frame bg-paper-2 p-5";
/** 금색 면 버튼 — 키트 gold-wash. 화면에 하나만 */
const goldButton = "gold-plate mt-5 flex h-13 items-center justify-center rounded-xl font-bold text-gold-ink";
/** 테두리 버튼 */
const lineButton = "mt-5 flex h-13 items-center justify-center rounded-xl border border-frame font-bold text-ink";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const today = todayKST();
  const ganji = dayGanji(today);
  const tomorrow = dayGanji(addDays(today, 1));
  const hour = hourKST();
  const night = hour >= 18 || hour < 5;
  // 밤에 번지는 남색 — 유일한 장치 (globals.css main[data-sky])
  const sky = hour >= 21 || hour < 5 ? "night" : hour >= 18 ? "dusk" : "day";

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

  // 금색 면 버튼은 화면에 하나. 게스트 생년월일 폼이 보일 때는 그 폼의 버튼이 금색이라 Google 버튼은 테두리형
  const guestFormShown = !user && !fortune && !fortuneError;

  const writeCard = !user ? (
    <section className={card}>
      <h2 className="text-lg font-bold">기록은 로그인하고 남겨요</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        기록이 쌓일수록 운세가 내 하루에 맞춰져요. 기기를 바꿔도 기록은 남아요.
      </p>
      <Link href="/login" className={guestFormShown ? lineButton : goldButton}>
        Google로 시작하기
      </Link>
    </section>
  ) : entry ? (
    <section className={card}>
      <p className={`text-sm font-bold text-gold ${saved === today ? "saved-line" : ""}`}>
        {saved === today ? "저장했어요" : "오늘 기록, 고마워요"}
      </p>
      <h2 className="mt-1 font-serif text-2xl font-bold leading-snug">오늘도 한 줄 남겼어요</h2>
      <p className="mt-3 text-[15px] text-muted">
        행복도 <b className="text-ink">{entry.happiness}</b>
        {entry.moods.length > 0 && <> · {entry.moods.join(", ")}</>}
      </p>
      {entry.note && <p className="mt-2 line-clamp-2 text-[15px] text-ink/90">“{entry.note}”</p>}
      <span aria-hidden className="rule mt-5" />
      <p className="mt-3 text-[17px]">
        내일은 <b className="text-ganji">{tomorrow.ko}일</b>이에요.
      </p>
      <Link href={`/write?date=${today}`} className="mt-4 inline-block text-sm text-muted underline underline-offset-4">
        오늘 기록 고치기
      </Link>
    </section>
  ) : (
    <section className={card}>
      <h2 className="font-serif text-2xl font-bold leading-snug">오늘 하루, 어땠어요?</h2>
      <p className="mt-2 text-[15px] text-muted">행복도 하나만 골라도 돼요. 30초면 끝나요.</p>
      <Link href="/write" className={goldButton}>
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
      <section className={`${card} text-muted`}>
        <h2 className="text-lg font-bold text-ink">오늘의 운세</h2>
        <p className="mt-2 text-[15px]">{fortuneError}</p>
      </section>
    );
  } else if (user) {
    fortuneCard = (
      <section className={card}>
        <h2 className="text-lg font-bold">생년월일을 알려 주세요</h2>
        <p className="mt-2 text-[15px] text-muted">내 사주로 오늘 운세를 계산해요. 한 번만 넣으면 돼요.</p>
        <Link href="/onboarding?next=/" className={lineButton}>
          생년월일 넣기
        </Link>
      </section>
    );
  } else {
    fortuneCard = (
      <section className={card}>
        <h2 className="text-lg font-bold">오늘 운세, 생년월일만 넣으면 바로 보여요</h2>
        <p className="mt-2 mb-6 text-[15px] text-muted">이 기기에만 남고 서버에 저장하지 않아요.</p>
        <ProfileForm next="/" initial={null} serverAction={guestProfileAction} askName={false} submitLabel="오늘 운세 보기" />
      </section>
    );
  }

  return (
    <main data-sky={sky} className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{formatKoreanDate(today)}</p>
          <h1 className="mt-1 font-serif text-[30px] font-bold leading-tight">
            오늘은 <span className="text-ganji">{ganji.ko}일</span>
            <span className="ml-2 text-[28px] font-normal text-muted">{ganji.hanja}</span>
          </h1>
        </div>
        {/* 이 화면의 유일한 그림 — 그날 일진의 동물 (바이럴 60갑자 세트) */}
        <img
          src={`/characters/${ganji.ko}.webp`}
          alt={`${ganji.ko} 동물`}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain"
        />
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
