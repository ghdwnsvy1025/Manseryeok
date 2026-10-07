import { RetryButton } from "@/components/RetryButton";
import { getUser } from "@/lib/supabase/server";
import { getSajuProfile } from "@/lib/db";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { supabase, user } = await getUser();
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // 세션이 아직 없는 첫 요청: 리디렉트하지 않고 준비 중을 그린다 (docs/ANON_START.md 1절)
  if (!user) {
    return (
      <main>
        <header className="mb-6">
          <h1 className="font-serif text-[26px] leading-snug">태어난 날을 적어요</h1>
        </header>
        <section className="card-frame card-paper p-5" aria-busy="true" aria-live="polite">
          <span aria-hidden className="brush-loading" />
          <p className="mt-3 text-[15px] text-muted">준비하고 있어요</p>
          <RetryButton className="mt-3" />
        </section>
      </main>
    );
  }

  const existing = await getSajuProfile(supabase, user.id);
  // 익명 사용자는 이름을 묻지 않는다 ("손님"). Google 사용자나 이미 이름을 둔 사람은 묻는다
  const askName = !user.is_anonymous || Boolean(existing && existing.name !== "손님");

  return (
    <main>
      <header className="mb-6">
        <p className="text-sm text-muted">{existing ? "생년월일 고치기" : "처음 한 번만"}</p>
        <h1 className="mt-1 font-serif text-[26px] leading-snug">태어난 날을 적어요</h1>
        <p className="mt-2 text-[15px] text-muted">내 사주로 오늘 운세를 계산해요. 이 정보는 나만 볼 수 있어요.</p>
      </header>
      {/* 한지 카드 한 장 안에 입력칸 (v3.3 — 양식지 없음) */}
      <section className="card-frame card-paper p-5">
      <ProfileForm
        next={safeNext}
        askName={askName}
        submitLabel="내 카드 보기"
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
      </section>
    </main>
  );
}
