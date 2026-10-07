import { redirect } from "next/navigation";
import { Booting } from "@/components/Booting";
import { getUser } from "@/lib/supabase/server";
import { getEntry, getSajuProfile, readCachedFortune } from "@/lib/db";
import { dayGanji } from "@/lib/ganji";
import { formatKoreanDate, parseYmd, todayKST } from "@/lib/time";
import { EntryForm } from "./EntryForm";

export const dynamic = "force-dynamic";

export default async function WritePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: requested } = await searchParams;
  const today = todayKST();
  const date = requested && parseYmd(requested) && requested <= today ? requested : today;
  const ganji = dayGanji(date);
  // "10월 5일" — 요일은 뺀다
  const dateLabel = formatKoreanDate(date).replace(/\s*\S+요일$/, "");

  const { supabase, user } = await getUser();
  // 세션이 아직 없는 첫 요청: 리디렉트하지 않고 뼈대만 그린다. AnonBoot가 곧 새로 그린다 (docs/ANON_START.md 1절, B2)
  if (!user) return <Booting title={`${dateLabel} ${ganji.ko}일, ${date === today ? "오늘" : "그날"} 하루`} cards={1} />;

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
        <h1 className="mt-1 font-serif text-[26px] leading-snug">
          {dateLabel} <span className="text-ganji">{ganji.ko}일</span>, {date === today ? "오늘" : "그날"} 하루
        </h1>
      </header>
      <EntryForm
        date={date}
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
