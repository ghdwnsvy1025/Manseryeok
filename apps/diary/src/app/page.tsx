import Link from "next/link";
import { clearGuestAction, guestProfileAction } from "@/app/actions";
import { FortuneCard } from "@/components/FortuneCard";
import { TodayEntryCard } from "@/components/TodayEntryCard";
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

/** 한지 카드 공통 — 키트 테두리(card-frame) 위에 카드 종이(card-paper) */
const card = "card-frame card-paper p-5";
/** 금색 면 버튼 — 키트 gold-wash. 화면에 하나만. 밤에는 조금 커진다(56→60px) */
const goldButtonBase = "gold-plate mt-5 flex items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink";
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
  const goldButton = `${goldButtonBase} ${sky === "day" ? "h-14" : "h-15"}`;

  const { supabase, user } = await getUser();
  const [profile, entry] = user
    ? await Promise.all([getSajuProfile(supabase, user.id), getEntry(supabase, user.id, today)])
    : [null, null];

  // 운세: 로그인 + 프로필이면 기록까지 반영, 게스트는 쿠키의 생년월일로
  let fortune: FortuneContent | null = null;
  let vote: 1 | -1 | null = null;
  let guestHasProfile = false;
  let fortuneError: string | null = null;
  // 60칸 띠에 기록한 간지를 표시하려고 try 밖에 둔다
  const recordedGanji = new Set<number>();
  try {
    if (user && profile) {
      const entries = await listEntriesForStats(supabase, user.id);
      for (const e of entries) recordedGanji.add(Number(e.day_ganji_index));
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
    <TodayEntryCard entry={entry} today={today} tomorrowKo={tomorrow.ko} justSaved={saved === today} />
  ) : (
    <section className={card}>
      <h2 className="font-serif text-[24px] leading-snug">오늘 하루, 어땠어요?</h2>
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
        <FortuneCard
          fortune={fortune}
          dateLabel={formatKoreanDate(today).replace(/\s*\S+요일$/, "")}
          ganjiKo={ganji.ko}
          canVote={Boolean(user)}
          vote={vote}
          defaultOpen={!night || !user}
        />
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
          <h1 className="mt-1 font-serif text-[32px] leading-tight">
            오늘은 <span className="text-ganji">{ganji.ko}일</span>
            <span className="ml-2 text-[28px] text-muted">{ganji.hanja}</span>
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

      {/* 60칸 띠 — 60갑자 중 오늘 위치에 금빛 점, 기록한 간지는 흐린 점. 누르면 "나"로 */}
      <Link
        href="/me"
        aria-label={`60갑자 띠 — 오늘은 ${ganji.index + 1}번째 ${ganji.ko}일. 나 화면으로`}
        className="-mt-2 grid grid-cols-30 gap-px"
      >
        {Array.from({ length: 60 }, (_, i) => (
          <span key={i} aria-hidden className={`h-[10px] ${i === ganji.index ? "bg-gold" : recordedGanji.has(i) ? "bg-line/40" : "border border-line/20"}`} />
        ))}
      </Link>

      {/* 순서 고정: 운세 카드가 늘 위, 기록 카드가 아래 (톤 v3) */}
      {fortuneCard}
      {writeCard}
    </main>
  );
}
