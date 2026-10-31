import Link from "next/link";
import { redirect } from "next/navigation";
import { Booting } from "@/components/Booting";
import { BURST_ASSETS } from "@/components/BurstPreload";
import { characterOfGanji } from "@/lib/character";
import { getUser } from "@/lib/supabase/server";
import { getEntry, getSajuProfile } from "@/lib/db";
import { dayGanji } from "@/lib/ganji";
import { addDays, formatKoreanDate, hourKST, todayKST } from "@/lib/time";
import { NIGHT_CUTOFF_HOUR, nightCarryDate, resolveWriteDate, writeDateLinks } from "@/lib/writeNav";
import { WritePreload } from "@/components/WritePreload";
import { NightCarryDialog } from "@/components/NightCarryDialog";
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

  // 2026-10-31: "오늘의 포인트"(운세 do) 블록을 뺐다 — 운세 캐시를 더 읽지 않는다
  const [existing, profile] = await Promise.all([getEntry(supabase, user.id, date), getSajuProfile(supabase, user.id)]);
  // 생년월일이 없으면 먼저 받는다 (로그인 사용자와 같은 규칙)
  if (!profile) redirect(`/onboarding?next=${encodeURIComponent(`/write?date=${date}`)}`);

  return (
    <main>
      {/* 2026-10-24: 새벽 0~4시 어제로 열렸으면 "어제 일기를 쓸까요?" 한 번 묻는다 (어제 그대로 / 오늘로). 아래 .night-carry 띠는 그대로 남는다 */}
      {carried && <NightCarryDialog date={date} label={dateLabel} todayHref={`/write?date=${today}`} />}
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
      {/* 쓰기 화면 재료(도장·띠지·쪽지·괘선)만 미리. 팡 그림(카드·틀·조각)은 저장 버튼을 누르는 순간 EntryForm이 받는다 (전체검토 C-P1 — 전에는 열 때마다 preload) */}
      <WritePreload />
      <EntryForm
        date={date}
        when={isToday ? "today" : carried ? "last_night" : "past"}
        warmAssets={[characterOfGanji(ganji.ko).cardSrc, ...BURST_ASSETS]}
        notePlaceholder={isToday ? "오늘 기억하고 싶은 일 하나" : carried ? "어젯밤까지의 하루, 기억하고 싶은 일 하나" : "그날 기억하고 싶은 일 하나"}
        initial={
          existing
            ? { happiness: existing.happiness, areas: existing.areas ?? null, moods: existing.moods, note: existing.note ?? "", tomorrowNote: existing.tomorrow_note ?? "" }
            : null
        }
      />
    </main>
  );
}
