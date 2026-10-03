import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getSajuProfile } from "@/lib/db";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/onboarding");
  const existing = await getSajuProfile(supabase, user.id);

  return (
    <main>
      <header className="mb-7">
        <p className="text-sm text-lamp">{existing ? "생년월일 고치기" : "처음 한 번만"}</p>
        <h1 className="mt-1 font-serif text-[26px] font-bold leading-snug">언제 태어났나요?</h1>
        <p className="mt-2 text-[15px] text-muted">내 사주로 오늘 운세를 계산해요. 이 정보는 나만 볼 수 있어요.</p>
      </header>
      <ProfileForm
        next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"}
        initial={
          existing
            ? {
                name: existing.name,
                gender: existing.gender,
                calendar: existing.calendar,
                isLeapMonth: existing.is_leap_month,
                birthYear: String(existing.birth_year),
                birthMonth: String(existing.birth_month),
                birthDay: String(existing.birth_day),
                birthHour: existing.birth_hour === null ? "" : String(existing.birth_hour),
                birthMinute: existing.birth_minute === null ? "" : String(existing.birth_minute),
                timeUnknown: existing.birth_hour === null,
                city: existing.city,
              }
            : null
        }
      />
    </main>
  );
}
