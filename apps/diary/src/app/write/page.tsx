import Link from "next/link";
import { redirect } from "next/navigation";
import { Booting } from "@/components/Booting";
import { BurstPreload } from "@/components/BurstPreload";
import { characterOfGanji } from "@/lib/character";
import { getUser } from "@/lib/supabase/server";
import { getEntry, getSajuProfile, readCachedFortune } from "@/lib/db";
import { dayGanji } from "@/lib/ganji";
import { addDays, formatKoreanDate, hourKST, todayKST } from "@/lib/time";
import { NIGHT_CUTOFF_HOUR, nightCarryDate, resolveWriteDate, writeDateLinks } from "@/lib/writeNav";
import { WritePreload } from "@/components/WritePreload";
import { EntryForm } from "./EntryForm";

export const dynamic = "force-dynamic";

export default async function WritePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: requested } = await searchParams;
  const today = todayKST();
  // 잘못됐거나 미래·2020년 이전 날짜면 오늘로 열고 한 줄 알려 준다
  const resolved = resolveWriteDate(requested, today);
  const adjusted = resolved.adjusted;

  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: 리디렉트하지 않고 뼈대만 그린다. AnonBoot가 곧 새로 그린다 (docs/ANON_START.md 1절, B2)
  if (!user) return <Booting title="오늘 하루" cards={1} />;

  // 새벽 4시 전, 날짜 없이 열었으면 "어젯밤" (어제 기록이 아직 없을 때만). 이 시간대에만 쿼리 하나 더
  let date = resolved.date;
  let carried = false;
  if (!requested && hourKST() < NIGHT_CUTOFF_HOUR) {
    const yesterday = addDays(today, -1);
    const y = await getEntry(supabase, user.id, yesterday);
    const carry = nightCarryDate(today, hourKST(), Boolean(y));
    if (carry) {
      date = carry;
      carried = true;
    }
  }
  const ganji = dayGanji(date);
  // "10월 5일" — 요일은 뺀다
  const dateLabel = formatKoreanDate(date).replace(/\s*\S+요일$/, "");
  const isToday = date === today;
  // 날짜 앞뒤 이동 (B7): 어제로는 2020-01-01까지, 내일로는 오늘까지
  const nav = writeDateLinks(date, today);

  // 운세 do 문장은 캐시에서만 읽는다 — 쓰기 화면이 운세 계산·모델 호출을 유발하면 안 된다. 캐시가 없으면 약속 블록 생략
  const [existing, profile, cachedFortune] = await Promise.all([
    getEntry(supabase, user.id, date),
    getSajuProfile(supabase, user.id),
    readCachedFortune(supabase, user.id, date),
  ]);
  // 생년월일이 없으면 먼저 받는다 (로그인 사용자와 같은 규칙)
  if (!profile) redirect(`/onboarding?next=${encodeURIComponent(`/write?date=${date}`)}`);
  // 기존 기록에 약속 문장이 남아 있으면 그것이 그날의 약속 (운세가 뒤에 바뀌어도 약속은 그대로)
  const promiseText = existing?.promise_text ?? cachedFortune?.doText ?? null;

  return (
    <main>
      <header className="mb-5">
        {existing && <p className="text-sm text-muted">기록 고치기</p>}
        {adjusted && <p className="text-sm text-muted">그 날짜는 쓸 수 없어 오늘 날짜로 열었어요</p>}
        {/* 새벽 4시 전 "어젯밤" 안내 — 오늘로 바꾸는 길을 바로 옆에 (모양은 디자이너 .night-carry) */}
        {carried && (
          <p className="night-carry text-sm">
            어젯밤({dateLabel}) 기록으로 남겨요{" "}
            <Link href={`/write?date=${today}`} className="underline underline-offset-4">
              오늘로 바꾸기
            </Link>
          </p>
        )}
        <h1 className="mt-1 font-serif text-[26px] leading-snug">
          {dateLabel} <span className="text-ganji">{ganji.ko}일</span>, {isToday ? "오늘" : carried ? "어젯밤" : "그날"} 하루
        </h1>
        {/* 날짜 앞뒤 이동 (B7). 없는 쪽은 자리만 비운다 */}
        <nav aria-label="다른 날" className="mt-2 flex items-center justify-between text-sm text-muted">
          {nav.prev ? (
            <Link href={nav.prev} className="underline underline-offset-4">
              ‹ 어제
            </Link>
          ) : (
            <span />
          )}
          {nav.next ? (
            <Link href={nav.next} className="underline underline-offset-4">
              내일 ›
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </header>
      {/* 저장 뒤 팡에 쓸 그날 캐릭터·틀·도장을 미리 받아 둔다 (전수조사 B8) */}
      <BurstPreload cardSrc={characterOfGanji(ganji.ko).cardSrc} />
      <WritePreload />
      <EntryForm
        date={date}
        notePlaceholder={isToday ? "오늘 기억하고 싶은 일 하나" : carried ? "어젯밤까지의 하루, 기억하고 싶은 일 하나" : "그날 기억하고 싶은 일 하나"}
        promiseText={promiseText}
        initial={
          existing
            ? { happiness: existing.happiness, moods: existing.moods, note: existing.note ?? "", promise: existing.promise ?? null }
            : null
        }
      />
    </main>
  );
}
