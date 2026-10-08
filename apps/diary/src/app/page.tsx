import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Booting } from "@/components/Booting";
import { BurstPreload } from "@/components/BurstPreload";
import { FortuneCard } from "@/components/FortuneCard";
import { FortuneLoading } from "@/components/FortuneLoading";
import { LinkPromptCard } from "@/components/LinkPromptCard";
import { RetryButton } from "@/components/RetryButton";
import { SaveBurst } from "@/components/SaveBurst";
import { SavedPastNotice } from "@/components/SavedPastNotice";
import { TodayEntryCard } from "@/components/TodayEntryCard";
import { getUser } from "@/lib/supabase/server";
import { birthProfileOf, countEntries, getEntry, getFortuneVote, getLinkPromptState, getSajuProfile, listEntries, listEntriesForStats, readFortuneCacheRow, type SajuProfileRow } from "@/lib/db";
import { characterOf, characterOfGanji, todayLine } from "@/lib/character";
import { cachedFortuneContent, getTodayFortune, type FortuneCacheLookup } from "@/lib/fortune";
import { withLivePersonal } from "@/lib/fortune/live";
import type { EntryLike } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { shouldShowLinkPrompt } from "@/lib/linkPrompt";
import { addDays, formatKoreanDate, hourKST, parseYmd, todayKST } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 한지 카드 공통 — 키트 테두리(card-frame) 위에 카드 종이(card-paper) */
const card = "card-frame card-paper p-5";
/** 금색 면 버튼 — 키트 gold-wash. 화면에 하나만. 늘 56px (v3.1에서 밤 분기 삭제) */
const goldButton = "gold-plate mt-5 flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink";

/**
 * 운세 카드 — 모델 호출(3~6초)을 기다리는 안쪽 층. 바깥 층은 기다리지 않고 먼저 그려진다 (docs/ANON_START.md 4절).
 * 캐시가 맞는 날은 여기까지 오지 않는다 — 바깥에서 바로 FortuneCard를 그린다. 투표는 바깥 Promise.all이 읽어 넘긴다.
 * 서버 컴포넌트 사이의 props라 직렬화되지 않는다.
 */
async function FortuneSection({
  userId,
  profile,
  entries,
  today,
  ganjiKo,
  defaultOpen,
  cached,
  vote,
}: {
  userId: string;
  profile: SajuProfileRow;
  entries: EntryLike[];
  today: string;
  ganjiKo: string;
  defaultOpen: boolean;
  /** 바깥에서 읽어 둔 캐시 행(지문이 안 맞는 행) 또는 null(없음). undefined면 운세 쪽이 다시 조회 */
  cached: FortuneCacheLookup | null | undefined;
  vote: 1 | -1 | null;
}) {
  try {
    const fortune = await getTodayFortune({ date: today, pillars: profile.pillars, profile: birthProfileOf(profile), entries, owner: { userId }, cached });
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
        <RetryButton className="mt-1" />
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

  // 한 단계에 전부 읽는다 — 운세 캐시 행·투표도 여기서. 캐시가 맞으면 Suspense 없이 바로 그린다 (전수조사 A-2·3)
  const [profile, entry, entries, linkState, entryCount, recent, cachedRow, vote] = await Promise.all([
    getSajuProfile(supabase, user.id),
    getEntry(supabase, user.id, today),
    listEntriesForStats(supabase, user.id),
    getLinkPromptState(supabase, user.id),
    countEntries(supabase, user.id),
    listEntries(supabase, user.id, 8),
    readFortuneCacheRow(supabase, user.id, today),
    getFortuneVote(supabase, user.id, today),
  ]);
  // 생년월일이 없으면 먼저 받는다 — /write·/me와 같은 규칙 (B1). 오늘 화면 안에서 폼을 그리지 않는다
  if (!profile) redirect("/onboarding?next=/");

  // 내 캐릭터 = 일주 (톤 v3.3)
  const myCharacter = characterOf(profile.pillars);
  // 오늘 일진 캐릭터 — 머리의 두 번째 메달 (v3.6). 팡 카드도 같은 것을 쓴다
  const todayCharacter = characterOfGanji(ganji.ko);
  // 팡 카드 아래 지난 도장들: 최근 7개 기록의 행복도 (오늘 제외, 최신순)
  const recentHappiness = recent.filter((e) => e.entry_date !== today).slice(0, 7).map((e) => e.happiness);

  const showLinkPrompt =
    Boolean(entry) && shouldShowLinkPrompt({ isAnonymous: Boolean(user.is_anonymous), entryCount: entries.length, promptCount: linkState.promptCount });

  const fortuneDateLabel = formatKoreanDate(today).replace(/\s*\S+요일$/, "");
  // 밤에 저장하고 막 돌아온 순간(?saved)은 접지 않는다 — 팡 뒤에 바로 운세를 본다 (전수조사 C)
  const defaultOpen = !night || entries.length === 0 || Boolean(saved);
  // 캐시 히트: 기다릴 것이 없으니 fallback 없이 바로 카드. 미스(또는 지문 불일치): 계산·모델 호출은 Suspense 안에서
  // B5: 캐시는 날짜 단위라 오늘 저장한 기록이 "내 기록으로 본 오늘"에 없다. 내 기록 블록·맞춤도만 현재 기록으로 다시 센다 (점수·글은 캐시 그대로)
  const cachedRaw = cachedFortuneContent(cachedRow ?? null, profile.pillars, birthProfileOf(profile));
  const cachedFortune = cachedRaw ? withLivePersonal(cachedRaw, entries, today) : null;
  const fortuneCard = cachedFortune ? (
    <FortuneCard fortune={cachedFortune} dateLabel={fortuneDateLabel} ganjiKo={ganji.ko} canVote vote={vote} defaultOpen={defaultOpen} />
  ) : (
    <Suspense fallback={<FortuneLoading character={myCharacter.characterSrc} />}>
      <FortuneSection
        userId={user.id}
        profile={profile}
        entries={entries}
        today={today}
        ganjiKo={ganji.ko}
        defaultOpen={defaultOpen}
        cached={cachedRow}
        vote={vote}
      />
    </Suspense>
  );

  // B8: 과거 날짜를 저장하고 돌아온 경우 — 팡은 오늘만, 과거는 제목 아래 작은 한지 띠 한 번
  const savedPast = saved && saved !== today && parseYmd(saved) ? saved : null;
  const savedPastLabel = savedPast ? formatKoreanDate(savedPast).replace(/\s*\S+요일$/, "") : "";

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
      {entry && saved === today && <BurstPreload characterSrc={todayCharacter.characterSrc} />}
      {entry && saved === today && (
        <SaveBurst
          ganjiKo={ganji.ko}
          ganjiHanja={ganji.hanja}
          characterSrc={todayCharacter.characterSrc}
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
            <Link href="/me" className="tap">
              {todayLine(ganji.index, entryCount)}
            </Link>
          </p>
          {savedPast && <SavedPastNotice date={savedPast} label={savedPastLabel} />}
        </div>
        {/* 이 화면의 그림 하나 = 두 메달 한 쌍 "나 × 오늘" (v3.6): 왼쪽 내 캐릭터(일주), 오른쪽 오늘 일진 캐릭터. 얼굴·상반신만.
            v3.7: 메달 아래 11px 라벨 "나 · 기축" / "오늘 · 을묘" — 메달이 무엇인지 글자로 */}
        <div className="medal-pair" aria-label={`나 ${myCharacter.ganjiKo} × 오늘 ${ganji.ko}`}>
          <span className="medal-pair__item">
            <span className="medal" title={`내 일주 캐릭터 ${myCharacter.ganjiKo}(${myCharacter.animal})`}>
              <img src={myCharacter.characterSrc} alt={`내 캐릭터 ${myCharacter.ganjiKo} ${myCharacter.animal}`} width={56} height={56} data-ganji={myCharacter.ganjiKo} />
            </span>
            <span className="medal-pair__label">나 · {myCharacter.ganjiKo}</span>
          </span>
          <span aria-hidden className="medal-pair__x">
            ×
          </span>
          <span className="medal-pair__item">
            <span className="medal" title={`오늘 일진 캐릭터 ${ganji.ko}(${todayCharacter.animal})`}>
              <img src={todayCharacter.characterSrc} alt={`오늘 ${ganji.ko}일 캐릭터 ${todayCharacter.animal}`} width={56} height={56} data-ganji={ganji.ko} />
            </span>
            <span className="medal-pair__label">오늘 · {ganji.ko}</span>
          </span>
        </div>
      </header>

      {/* 순서 고정: 운세 카드가 늘 위, 기록 카드가 아래 (톤 v3) */}
      {fortuneCard}
      {writeCard}
      {/* 첫 저장 직후(그리고 7건째) 한 번: Google 연결 안내 (docs/ANON_START.md 2절) */}
      {showLinkPrompt && <LinkPromptCard nextCount={linkState.promptCount + 1} />}
    </main>
  );
}
