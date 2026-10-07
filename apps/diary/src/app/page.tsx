import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Booting } from "@/components/Booting";
import { FortuneCard } from "@/components/FortuneCard";
import { FortuneLoading } from "@/components/FortuneLoading";
import { LinkPromptCard } from "@/components/LinkPromptCard";
import { SaveBurst } from "@/components/SaveBurst";
import { TodayEntryCard } from "@/components/TodayEntryCard";
import { createClient, getUser } from "@/lib/supabase/server";
import { birthProfileOf, countEntries, getEntry, getFortuneVote, getLinkPromptState, getSajuProfile, listEntries, listEntriesForStats, type SajuProfileRow } from "@/lib/db";
import { characterOf, characterOfGanji, todayLine } from "@/lib/character";
import { getTodayFortune } from "@/lib/fortune";
import type { EntryLike } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { shouldShowLinkPrompt } from "@/lib/linkPrompt";
import { addDays, formatKoreanDate, hourKST, todayKST } from "@/lib/time";

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
  // 세션이 아직 없는 첫 요청: 뼈대만 그리고 AnonBoot를 기다린다. 리디렉트하지 않는다 (B2)
  if (!user) return <Booting title={formatKoreanDate(today)} cards={2} />;

  const [profile, entry, entries, linkState, entryCount, recent] = await Promise.all([
    getSajuProfile(supabase, user.id),
    getEntry(supabase, user.id, today),
    listEntriesForStats(supabase, user.id),
    getLinkPromptState(supabase, user.id),
    countEntries(supabase, user.id),
    listEntries(supabase, user.id, 8),
  ]);
  // 생년월일이 없으면 먼저 받는다 — /write·/me와 같은 규칙 (B1). 오늘 화면 안에서 폼을 그리지 않는다
  if (!profile) redirect("/onboarding?next=/");

  // 내 캐릭터 = 일주 (톤 v3.3)
  const myCharacter = characterOf(profile.pillars);
  // 팡 카드 아래 지난 도장들: 최근 7개 기록의 행복도 (오늘 제외, 최신순)
  const recentHappiness = recent.filter((e) => e.entry_date !== today).slice(0, 7).map((e) => e.happiness);

  const showLinkPrompt =
    Boolean(entry) && shouldShowLinkPrompt({ isAnonymous: Boolean(user.is_anonymous), entryCount: entries.length, promptCount: linkState.promptCount });

  const fortuneCard = (
    <Suspense fallback={<FortuneLoading character={myCharacter.characterSrc} />}>
      <FortuneSection userId={user.id} profile={profile} entries={entries} today={today} ganjiKo={ganji.ko} defaultOpen={!night || entries.length === 0} />
    </Suspense>
  );

  const writeCard = entry ? (
    <TodayEntryCard entry={entry} today={today} tomorrowKo={tomorrow.ko} justSaved={saved === today} />
  ) : (
    <section className={card}>
      <h2 className="font-serif text-[24px] leading-snug">오늘 하루, 어땠어요?</h2>
      <p className="mt-2 text-[15px] text-muted">행복도 하나만 골라도 돼요. 30초면 끝나요.</p>
      {/* 금색 면 버튼은 화면에 하나 — 이것 */}
      <Link href="/write" className={goldButton}>
        오늘 기록하기
      </Link>
    </section>
  );

  return (
    <main className="flex flex-col gap-5">
      {/* 저장 완료 "팡" — 방금 저장하고 돌아왔을 때 한 번 (톤 v3.1). 카드는 오늘 일진 캐릭터 + char-frame 틀 (05 v3.5) */}
      {entry && saved === today && (
        <SaveBurst
          ganjiKo={ganji.ko}
          ganjiHanja={ganji.hanja}
          characterSrc={characterOfGanji(ganji.ko).characterSrc}
          recentHappiness={recentHappiness}
          happiness={entry.happiness}
          kept={entry.promise === "kept"}
          signature={`${today}|${entry.happiness}|${entry.moods.join(",")}|${entry.note ?? ""}|${entry.promise ?? ""}`}
        />
      )}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* 제목 한 줄 (v3.2): 날짜도 송명 같은 크기. 흐린 날짜 줄은 없다 */}
          <h1 className="font-serif text-[26px] leading-snug break-keep">
            {formatKoreanDate(today)},{" "}
            <span className="whitespace-nowrap">
              <span className="text-ganji">{ganji.ko}일</span> <span className="text-muted">{ganji.hanja}</span>
            </span>
          </h1>
          {/* 60칸 띠 대신 한 줄 (v3.3): 오늘 순번 · 기록 일수. 누르면 "나"로 */}
          <p className="mt-1 text-[14px] text-muted">
            <Link href="/me">{todayLine(ganji.index, entryCount)}</Link>
          </p>
        </div>
        {/* 이 화면의 유일한 그림 — 내 캐릭터 (일주, v3.3) */}
        <img
          src={myCharacter.characterSrc}
          alt={`내 캐릭터 ${myCharacter.ganjiKo} ${myCharacter.animal}`}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain"
        />
      </header>

      {/* 순서 고정: 운세 카드가 늘 위, 기록 카드가 아래 (톤 v3) */}
      {fortuneCard}
      {writeCard}
      {/* 첫 저장 직후(그리고 7건째) 한 번: Google 연결 안내 (docs/ANON_START.md 2절) */}
      {showLinkPrompt && <LinkPromptCard nextCount={linkState.promptCount + 1} />}
    </main>
  );
}
