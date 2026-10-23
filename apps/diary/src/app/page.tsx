import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Booting } from "@/components/Booting";
import { BurstPreload } from "@/components/BurstPreload";
import { FortuneCard } from "@/components/FortuneCard";
import { FortunePending } from "@/components/FortunePending";
import { LinkPromptCard } from "@/components/LinkPromptCard";
import { SaveBurst } from "@/components/SaveBurst";
import { SavedPastNotice } from "@/components/SavedPastNotice";
import { TodayEntryCard } from "@/components/TodayEntryCard";
import { TrackOnMount } from "@/components/track/TrackOnMount";
import { getUser } from "@/lib/supabase/server";
import { birthProfileOf, getEntry, getFortuneVote, getLinkPromptState, getSajuProfile, listEntries, listEntriesForStats, readFortuneCacheRow } from "@/lib/db";
import { characterOf, characterOfGanji } from "@/lib/character";
import { cachedFortuneContent, fingerprint, getTodayFortune, type FortuneRequest } from "@/lib/fortune";
import { withLivePersonal } from "@/lib/fortune/live";
import { dayGanji } from "@/lib/ganji";
import { BRANCH_META, STEM_META, type StemHanja } from "@saju/engine";

/** 간지 한자 두 글자를 각자 오행 색으로 (v3.13, 나 화면 나무패와 같은 규칙). 색은 globals.css text-el-* */
const EL_TEXT: Record<string, string> = { wood: "text-el-wood", fire: "text-el-fire", earth: "text-el-earth", metal: "text-el-metal", water: "text-el-water" };
function HanjaByElement({ hanja, label }: { hanja: string; label: string }) {
  const [s, b] = [...hanja];
  const se = STEM_META[s as StemHanja]?.element;
  const be = BRANCH_META[b as keyof typeof BRANCH_META]?.element;
  return (
    <span className="medal-pair__hanja" lang="zh-Hant" aria-label={label}>
      <span className={se ? EL_TEXT[se] : undefined}>{s}</span>
      <span className={be ? EL_TEXT[be] : undefined}>{b}</span>
    </span>
  );
}
import { shouldShowLinkPrompt } from "@/lib/linkPrompt";
import { pointStats, streakOf } from "@/lib/stats/extra";
import { nightCarryDate } from "@/lib/writeNav";
import { addDays, formatKoreanDate, hourKST, parseYmd, todayKST } from "@/lib/time";

export const dynamic = "force-dynamic";
/** 운세 생성(모델 호출 20초 타임아웃 × 최대 3회, 전체 40초 기한)이 응답 뒤(after)에도 끊기지 않게 함수 수명을 늘린다. SDK 옵션은 fortune/llm.ts CLIENT_OPTIONS (A-2) */
export const maxDuration = 60;

/** 한지 카드 공통 — 키트 테두리(card-frame) 위에 카드 종이(card-paper) */
const card = "card-frame card-light card-paper p-5";
/** 금색 면 버튼 — 키트 gold-wash. 화면에 하나만. 늘 56px (v3.1에서 밤 분기 삭제) */
const goldButton = "gold-plate mt-5 flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink";

/**
 * 캐시가 없는(또는 지문이 다른) 날의 운세 생성 — 응답 안에서 기다리지 않는다 (2026-10-23).
 * 여기서 시작만 하고 `after()`로 응답이 끝난 뒤에도 함수가 살아 있게 둔다. 화면은 바로 내려가고,
 * 그 자리의 FortunePending(클라이언트)이 몇 초마다 캐시가 생겼는지 물어 생기면 refresh → FortuneCard.
 * 전엔 Suspense 스트리밍으로 같은 응답 안에서 기다렸다 — 모델이 느린 날(재시도·검수까지 40초)은 응답이
 * 그만큼 열려 있어 첫 진입이 그 뒤로 밀리고, 중간에 끊기면 운세 자리가 빈 채 남았다.
 * 같은 사람·같은 날 요청은 fortune/index.ts의 inFlight가 모델을 한 번만 부르게 묶는다.
 */
function startFortune(req: FortuneRequest): void {
  const running = getTodayFortune(req).then(
    () => undefined,
    (e) => console.error("오늘 운세", e),
  );
  after(() => running);
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ saved?: string; at?: string }> }) {
  const { saved, at } = await searchParams;
  const today = todayKST();
  const ganji = dayGanji(today);
  const hour = hourKST();
  // 밤에는 운세를 접어 두고 기록을 먼저 보이게 한다 (화면 색은 시간과 무관 — v3.1). 기록이 하나도 없는 사람은 늘 펼친다
  const night = hour >= 18 || hour < 5;

  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: 뼈대만 그리고 AnonBoot를 기다린다. 리디렉트하지 않는다 (B2)
  if (!user) return <Booting title={formatKoreanDate(today)} cards={2} />;

  // 한 단계에 전부 읽는다 — 운세 캐시 행·투표도 여기서. 캐시가 맞으면 Suspense 없이 바로 그린다 (전수조사 A-2·3)
  // 방금 저장한 날짜 (오늘·어젯밤·지난 날 모두). 오늘이 아니면 그날 기록을 따로 읽어 팡에 쓴다
  const savedDate = saved && parseYmd(saved) ? saved : null;
  const [profile, entry, entries, linkState, recent, cachedRow, vote, savedOtherEntry] = await Promise.all([
    getSajuProfile(supabase, user.id),
    getEntry(supabase, user.id, today),
    listEntriesForStats(supabase, user.id),
    getLinkPromptState(supabase, user.id),
    listEntries(supabase, user.id, 8),
    readFortuneCacheRow(supabase, user.id, today),
    getFortuneVote(supabase, user.id, today),
    savedDate && savedDate !== today ? getEntry(supabase, user.id, savedDate) : Promise.resolve(null),
  ]);
  // 생년월일이 없으면 먼저 받는다 — /write·/me와 같은 규칙 (B1). 오늘 화면 안에서 폼을 그리지 않는다
  if (!profile) redirect("/onboarding?next=/");

  // 내 캐릭터 = 일주 (톤 v3.3)
  const myCharacter = characterOf(profile.pillars);
  /** 내 일주 한자 ("己丑") — 머리 캐릭터 라벨 (v3.10: 한자만) */
  const myHanja = `${profile.pillars.day.stem}${profile.pillars.day.branch}`;
  // 오늘 일진 캐릭터 — 머리의 두 번째 메달 (v3.6). 팡 카드도 같은 것을 쓴다
  const todayCharacter = characterOfGanji(ganji.ko);
  // 팡 (2026-10-15: 어떤 날짜든 저장하면 무조건 뜬다 — 전엔 오늘만). 카드는 저장한 날의 일진
  const burstEntry = savedDate === today ? entry : savedOtherEntry;
  const burstGanji = savedDate ? dayGanji(savedDate) : ganji;
  const burstCharacter = characterOfGanji(burstGanji.ko);
  // 팡 카드 아래 지난 도장들: 최근 7개 기록의 행복도 (저장한 날 제외, 최신순)
  const recentHappiness = recent.filter((e) => e.entry_date !== savedDate).slice(0, 7).map((e) => e.happiness);

  const showLinkPrompt =
    Boolean(entry) && shouldShowLinkPrompt({ isAnonymous: Boolean(user.is_anonymous), entryCount: entries.length, promptCount: linkState.promptCount });

  const fortuneDateLabel = formatKoreanDate(today).replace(/\s*\S+요일$/, "");
  // 밤에 저장하고 막 돌아온 순간(?saved)은 접지 않는다 — 팡 뒤에 바로 운세를 본다 (전수조사 C)
  const defaultOpen = !night || entries.length === 0 || Boolean(saved);
  // 캐시 히트: 기다릴 것이 없으니 바로 카드. 미스(또는 지문 불일치): 생성은 응답 뒤에 돌리고(startFortune) 자리엔 로딩 카드
  // B5: 캐시는 날짜 단위라 오늘 저장한 기록이 "내 기록으로 본 오늘"에 없다. 내 기록 블록·맞춤도만 현재 기록으로 다시 센다 (점수·글은 캐시 그대로)
  const birth = birthProfileOf(profile);
  const cachedRaw = cachedFortuneContent(cachedRow ?? null, profile.pillars, birth);
  const cachedFortune = cachedRaw ? withLivePersonal(cachedRaw, entries, today) : null;
  let fortuneCard;
  if (cachedFortune) {
    fortuneCard = <FortuneCard fortune={cachedFortune} dateLabel={fortuneDateLabel} ganjiKo={ganji.ko} canVote vote={vote} defaultOpen={defaultOpen} />;
  } else {
    startFortune({ date: today, pillars: profile.pillars, profile: birth, entries, owner: { userId: user.id }, cached: cachedRow });
    // 지문을 넘겨 "지금 원국·입력으로 만든 행"이 생겼을 때만 준비됐다고 본다 (옛 지문 행은 아직 아님)
    fortuneCard = <FortunePending character={myCharacter.characterSrc} date={today} fingerprint={fingerprint(profile.pillars, birth)} />;
  }

  // B8: 과거 날짜를 저장하고 돌아온 경우 — 팡은 오늘만, 과거는 제목 아래 작은 한지 띠 한 번
  const savedPast = saved && saved !== today && parseYmd(saved) ? saved : null;
  const savedPastLabel = savedPast ? formatKoreanDate(savedPast).replace(/\s*\S+요일$/, "") : "";
  const burstWhen = !savedPast ? "오늘" : savedPast === addDays(today, -1) ? "어제" : savedPastLabel;

  // 새벽 4시 전이고 어제 기록이 없으면 "어젯밤" — 쓰기 화면도 같은 규칙으로 어제를 연다 (writeNav.nightCarryDate)
  const carry = nightCarryDate(today, hour, entries.some((e) => e.entry_date === addDays(today, -1)));
  // 오늘의 기록 카드 아래 두 줄 (2026-10-09 Q4 = C): 카드 획득 + 지표
  const sameGanjiTimes = entries.filter((e) => e.day_ganji_index === ganji.index).length;
  const metCards = new Set(entries.map((e) => e.day_ganji_index)).size;
  const streak = streakOf(entries, today);
  const points = pointStats(entries);
  const writeCard = entry ? (
    <TodayEntryCard
      entry={entry}
      today={today}
      ganjiKo={ganji.ko}
      sameGanjiTimes={sameGanjiTimes}
      metCards={metCards}
      streak={streak.current}
      points={points.answered ? { kept: points.kept, answered: points.answered } : null}
      justSaved={saved === today}
    />
  ) : (
    <section className={card}>
      <h2 className="font-serif text-[24px] leading-snug">{carry ? "어젯밤 하루, 어땠어요?" : "오늘 하루, 어땠어요?"}</h2>
      <p className="mt-2 text-[15px] text-muted">
        {carry ? "자정이 지났지만 아직 어젯밤이에요. 어제 날짜로 남겨요." : "행복도 하나만 골라도 돼요. 30초면 끝나요."}
      </p>
      {/* 금색 면 버튼은 화면에 하나 — 이것 */}
      <Link href="/write" className={goldButton}>
        {carry ? "어젯밤 기록하기" : "오늘 기록하기"}
      </Link>
    </section>
  );

  return (
    <main className="flex flex-col gap-5">
      {/* 저장 완료 "팡" — 방금 저장하고 돌아왔을 때 한 번 (톤 v3.1). 카드는 오늘 일진 캐릭터 + char-frame 틀 (05 v3.5) */}
      {burstEntry && <BurstPreload cardSrc={burstCharacter.cardSrc} />}
      {/* 저장 성공은 여기서 센다 (쓰기 폼은 redirect로 끝나 성공을 모른다). at로 한 번만 — 새로고침에 다시 안 센다 */}
      {burstEntry && savedDate && (
        <TrackOnMount event="diary_saved" props={{ when: savedDate === today ? "today" : savedDate === addDays(today, -1) ? "yesterday" : "past" }} once={`saved:${savedDate}|${at ?? ""}`} />
      )}
      {burstEntry && savedDate && (
        <SaveBurst
          ganjiKo={burstGanji.ko}
          ganjiHanja={burstGanji.hanja}
          cardSrc={burstCharacter.cardSrc}
          recentHappiness={recentHappiness}
          happiness={burstEntry.happiness}
          kept={burstEntry.promise === "kept"}
          when={burstWhen}
          signature={`${savedDate}|${at ?? ""}|${burstEntry.happiness}|${burstEntry.moods.join(",")}|${burstEntry.note ?? ""}|${burstEntry.promise ?? ""}`}
        />
      )}
      {/* 머리 (v3.9): 가운데 축. 제목(날짜·간지) → 한 줄 → 두 캐릭터 "나 × 오늘"을 가운데에 크게(각 108px).
          그림은 이 한 쌍이 전부. v3.27: 얼굴 그림(faces)을 달창(moon-window) 창틀 안에 — 내 쪽 금빛 창틀, 오늘 쪽 녹갈 창틀. 색으로 길흉을 말하지 않는다 */}
      <header className="flex flex-col items-center text-center">
        {/* v3.10: 날짜는 위 한 줄(작게). 간지는 캐릭터 라벨이 말한다. 순번·기록 일수 줄은 뺐다(기록 일수는 나 화면 머리로) */}
        <h1 className="today-date">{formatKoreanDate(today)}</h1>
        {savedPast && <SavedPastNotice date={savedPast} label={savedPastLabel} />}
        <div className="medal-pair" aria-label={`나 ${myCharacter.ganjiKo} × 오늘 ${ganji.ko}`}>
          <span className="medal-pair__item">
            <span className="medal medal--me" title={`내 일주 캐릭터 ${myCharacter.ganjiKo}(${myCharacter.animal})`}>
              <img src={myCharacter.faceSrc} alt={`내 캐릭터 ${myCharacter.ganjiKo} ${myCharacter.animal}`} width={100} height={100} data-ganji={myCharacter.ganjiKo} />
              <span className="medal__frame" aria-hidden />
            </span>
            <span className="medal-pair__label">
              <span className="medal-pair__who">나</span>
              <HanjaByElement hanja={myHanja} label={myCharacter.ganjiKo} />
            </span>
          </span>
          <span aria-hidden className="medal-pair__x">
            ×
          </span>
          <span className="medal-pair__item">
            <span className="medal medal--today" title={`오늘 일진 캐릭터 ${ganji.ko}(${todayCharacter.animal})`}>
              <img src={todayCharacter.faceSrc} alt={`오늘 ${ganji.ko}일 캐릭터 ${todayCharacter.animal}`} width={100} height={100} data-ganji={ganji.ko} />
              <span className="medal__frame" aria-hidden />
            </span>
            <span className="medal-pair__label">
              <span className="medal-pair__who">오늘</span>
              <HanjaByElement hanja={ganji.hanja} label={ganji.ko} />
            </span>
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
