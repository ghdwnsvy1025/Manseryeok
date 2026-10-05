import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getEntry } from "@/lib/db";
import { dayGanji } from "@/lib/ganji";
import { formatKoreanDate, parseYmd, todayKST } from "@/lib/time";
import { EntryForm } from "./EntryForm";

export const dynamic = "force-dynamic";

export default async function WritePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: requested } = await searchParams;
  const today = todayKST();
  const date = requested && parseYmd(requested) && requested <= today ? requested : today;

  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/write?date=${date}`)}`);
  const existing = await getEntry(supabase, user.id, date);
  const ganji = dayGanji(date);
  // "10월 5일" — 요일은 뺀다
  const dateLabel = formatKoreanDate(date).replace(/\s*\S+요일$/, "");

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
        initial={existing ? { happiness: existing.happiness, moods: existing.moods, note: existing.note ?? "" } : null}
      />
    </main>
  );
}
