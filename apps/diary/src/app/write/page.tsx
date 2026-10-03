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

  return (
    <main>
      <header className="mb-6">
        <p className="text-sm text-muted">
          {date === today ? "오늘" : formatKoreanDate(date)} · <span className="text-moon">{ganji.ko}일</span>
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-bold">{existing ? "기록 고치기" : "오늘 하루, 어땠어요?"}</h1>
      </header>
      <EntryForm
        date={date}
        initial={existing ? { happiness: existing.happiness, moods: existing.moods, note: existing.note ?? "" } : null}
      />
    </main>
  );
}
