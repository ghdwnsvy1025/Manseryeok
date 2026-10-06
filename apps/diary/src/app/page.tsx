import Link from "next/link";
import { Suspense } from "react";
import { BandHint } from "@/components/BandHint";
import { FortuneCard } from "@/components/FortuneCard";
import { FortuneLoading } from "@/components/FortuneLoading";
import { LinkPromptCard } from "@/components/LinkPromptCard";
import { SaveBurst } from "@/components/SaveBurst";
import { TodayEntryCard } from "@/components/TodayEntryCard";
import { createClient, getUser } from "@/lib/supabase/server";
import { birthProfileOf, getEntry, getFortuneVote, getLinkPromptState, getSajuProfile, listEntriesForStats, type SajuProfileRow } from "@/lib/db";
import { getTodayFortune } from "@/lib/fortune";
import type { EntryLike } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { shouldShowLinkPrompt } from "@/lib/linkPrompt";
import { addDays, formatKoreanDate, hourKST, todayKST } from "@/lib/time";
import { ProfileForm } from "./onboarding/ProfileForm";

export const dynamic = "force-dynamic";

/** 한지 카드 공통 — 키트 테두리(card-frame) 위에 카드 종이(card-paper) */
const card = "card-frame card-paper p-5";
/** 금색 면 버튼 — 키트 gold-wash. 화면에 하나만. 늘 56px (v3.1에서 밤 분기 삭제) */
const goldButton = "gold-plate mt-5 flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink";

/**
 * 운세 카드 — 모델 호출(3~6초)을 기다리는 안쪽 층. 바깥 층은 기다리지 않고 먼저 그려진다 (docs/ANON_START.md 4절).
 * 서버 컴포넌트 사이의 props라 직렬화되지 않는다.
 */
async function FortuneSection({
  userId,
  profile,
  entries,
  today,
  ganjiKo,
  defaultOpen,
}: {
  userId: string;
  profile: SajuProfileRow;
  entries: EntryLike[];
  today: string;
  ganjiKo: string;
  defaultOpen: boolean;
}) {
  try {
    const supabase = await createClient();
    const [fortune, vote] = await Promise.all([
      getTodayFortune({ date: today, pillars: profile.pillars, profile: birthProfileOf(profile), entries, owner: { userId } }),
      getFortuneVote(supabase, userId, today),
    ]);
    return (
      <FortuneCard
        fortune={fortune}
        dateLabel={formatKoreanDate(today).replace(/\s*\S+요일$/, "")}
        ganjiKo={ganjiKo}
        canVote
        vote={vote}
        defaultOpen={defaultOpen}
      />
    );
  } catch (e) {
    console.error("오늘 운세", e);
    return (
      <section className={`${card} text-muted`}>
        <h2 className="text-lg font-bold text-ink">오늘의 운세</h2>
        <p className="mt-2 text-[15px]">운세를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
      </section>
    );
  }
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const today = todayKST();
  const ganji = dayGanji(today);
  const tomorrow = dayGanji(addDays(today, 1));
  const hour = hourKST();
  // 밤에는 운세를 접어 두고 기록을 먼저 보이게 한다 (화면 색은 시간과 무관 — v3.1). 기록이 하나도 없는 사람은 늘 펼친다
  const night = hour >= 18 || hour < 5;

  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: AnonBoot가 곧 익명 세션을 만들고 새로 그린다. 리디렉트하지 않는다
  const [profile, entry, entries, linkState] = user
    ? await Promise.all([
        getSajuProfile(supabase, user.id),
        getEntry(supabase, user.id, today),
        listEntriesForStats(supabase, user.id),
        getLinkPromptState(supabase, user.id),
      ])
    : [null, null, [], { promptedAt: null, promptCount: 0 }];

  // 60칸 띠에 기록한 간지를 표시한다
  const recordedGanji = new Set<number>(entries.map((e) => Number(e.day_ganji_index)));

  const showLinkPrompt =
    Boolean(user && entry) &&
    shouldShowLinkPrompt({ isAnonymous: Boolean(user?.is_anonymous), entryCount: entries.length, promptCount: linkState.promptCount });

  let fortuneCard: React.ReactNode;
  if (!user) {
    fortuneCard = (
      <section className="fortune-loading card-gold card-paper flex flex-col justify-center p-5" aria-busy="true" aria-live="polite">
        <h2 className="text-[15px] text-muted">오늘의 운세</h2>
        <span aria-hidden className="brush-loading mt-3" />
        <p className="mt-3 text-[15px] text-muted">준비하고 있어요</p>
      </section>
    );
  } else if (profile) {
    fortuneCard = (
      <Suspense fallback={<FortuneLoading />}>
        <FortuneSection userId={user.id} profile={profile} entries={entries} today={today} ganjiKo={ganji.ko} defaultOpen={!night || entries.length === 0} />
      </Suspense>
    );
  } else {
    // 생년월일을 아직 안 넣었다 — 오늘 화면에서 바로 받는다. 저장 액션은 운세를 기다리지 않고 돌아오고, 운세는 위의 Suspense가 맡는다
    fortuneCard = (
      <section className={card}>
        <h2 className="text-lg font-bold">오늘 운세, 생년월일만 넣으면 바로 보여요</h2>
        <p className="mt-2 mb-6 text-[15px] text-muted">내 사주로 오늘 운세를 계산해요. 한 번만 넣으면 돼요.</p>
        <ProfileForm next="/" initial={null} askName={false} submitLabel="오늘 운세 보기" />
      </section>
    );
  }

  const writeCard = !user ? (
    <section className={card} aria-busy="true">
      <h2 className="text-[15px] text-muted">오늘의 기록</h2>
      <p className="mt-2 text-[15px] text-muted">준비하고 있어요</p>
    </section>
  ) : entry ? (
    <TodayEntryCard entry={entry} today={today} tomorrowKo={tomorrow.ko} justSaved={saved === today} />
  ) : (
    <section className={card}>
      <h2 className="font-serif text-[24px] leading-snug">오늘 하루, 어땠어요?</h2>
      <p className="mt-2 text-[15px] text-muted">행복도 하나만 골라도 돼요. 30초면 끝나요.</p>
      {/* 금색 면 버튼은 화면에 하나. 생년월일 폼이 보일 때는 그 폼의 버튼이 금색이라 여기서는 테두리형 */}
      <Link href="/write" className={profile ? goldButton : "mt-5 flex h-13 items-center justify-center rounded-xl border border-frame font-bold text-ink"}>
        오늘 기록하기
      </Link>
    </section>
  );

  return (
    <main className="flex flex-col gap-5">
      {/* 저장 완료 "팡" — 방금 저장하고 돌아왔을 때 한 번 (톤 v3.1). 그림은 운세 카드 안의 동물 하나뿐이므로 제목 줄에는 없다 */}
      {user && entry && saved === today && (
        <SaveBurst
          ganjiKo={ganji.ko}
          happiness={entry.happiness}
          kept={entry.promise === "kept"}
          signature={`${today}|${entry.happiness}|${entry.moods.join(",")}|${entry.note ?? ""}|${entry.promise ?? ""}`}
        />
      )}
      <header>
        {/* 제목 한 줄 (v3.2): 날짜도 송명 같은 크기. 흐린 날짜 줄은 없다 */}
        <h1 className="font-serif text-[26px] leading-snug break-keep">
          {formatKoreanDate(today)}, <span className="text-ganji">{ganji.ko}일</span> <span className="text-muted">{ganji.hanja}</span>
        </h1>
      </header>

      {/* 60칸 띠 — 60갑자 중 오늘 위치에 금빛 점, 기록한 간지는 흐린 점. 누르면 "나"로 */}
      <div className="-mt-1 flex flex-col gap-1.5">
        <p className="text-[12px] leading-none text-muted">60갑자 중 오늘 · 기록한 날은 찍혀요</p>
        <Link href="/me" aria-label={`60갑자 띠 — 오늘은 ${ganji.index + 1}번째 ${ganji.ko}일. 나 화면으로`} className="grid grid-cols-30 gap-px">
          {Array.from({ length: 60 }, (_, i) => (
            <span key={i} aria-hidden className={`h-[10px] ${i === ganji.index ? "bg-gold" : recordedGanji.has(i) ? "bg-line/40" : "border border-line/20"}`} />
          ))}
        </Link>
      </div>
      {/* 첫 방문 1회: 띠가 무엇인지 한 줄 (localStorage band-hint-seen) */}
      <BandHint ganjiKo={ganji.ko} nth={ganji.index + 1} />

      {/* 순서 고정: 운세 카드가 늘 위, 기록 카드가 아래 (톤 v3) */}
      {fortuneCard}
      {writeCard}
      {/* 첫 저장 직후(그리고 7건째) 한 번: Google 연결 안내 (docs/ANON_START.md 2절) */}
      {showLinkPrompt && <LinkPromptCard nextCount={linkState.promptCount + 1} />}
    </main>
  );
}
