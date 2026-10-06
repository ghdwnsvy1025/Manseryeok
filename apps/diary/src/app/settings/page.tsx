import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { ClearAllButton } from "@/components/ClearAllButton";
import { InstallHint } from "@/components/InstallHint";
import { LinkGoogleButton } from "@/components/LinkGoogleButton";
import { NotificationSettings } from "@/components/NotificationSettings";
import { getNotificationSettings, getSajuProfile } from "@/lib/db";
import { hourOf } from "@/lib/remind";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const card = "card-frame card-paper";
/** 카드 안 목록의 한 줄. 줄 사이는 괘선 색의 얇은 선 */
const row = "border-t border-line/25 px-5 py-5 first:border-t-0";

/** 설정 — 한지 카드 한 장에 목록: Google 연결 · 알림 · 생년월일 · 앱으로 두기 · 로그아웃/기록 지우기 (docs/ANON_START.md 3절, 톤 v3.2) */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, user } = await getUser();

  if (!user) {
    return (
      <main className="flex flex-col gap-5">
        <header>
          <h1 className="font-serif text-[26px] leading-snug">설정</h1>
        </header>
        <section className={`${card} p-5`} aria-busy="true" aria-live="polite">
          <span aria-hidden className="brush-loading" />
          <p className="mt-3 text-[15px] text-muted">준비하고 있어요</p>
        </section>
      </main>
    );
  }

  const anonymous = Boolean(user.is_anonymous);
  const [profile, notif] = await Promise.all([getSajuProfile(supabase, user.id), getNotificationSettings(supabase, user.id)]);

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between">
        <h1 className="font-serif text-[26px] leading-snug">설정</h1>
        <Link href="/me" className="text-sm text-muted underline underline-offset-4">
          나로
        </Link>
      </header>

      <section className={card}>
        {/* Google 연결 — 이 화면의 금색 면 버튼은 이것 하나 */}
        <div className={row}>
          <h2 className="font-serif text-[20px] leading-snug">Google 연결</h2>
          {anonymous ? (
            <>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">아직 이 기기에만 있는 기록이에요. Google로 연결하면 기기를 바꿔도 남아요.</p>
              {error === "link" && (
                <p role="alert" className="mt-3 text-[15px] text-danger">
                  이 Google 계정은 이미 다른 기록과 연결돼 있어요. 그 기록으로 가려면 아래에서 기록을 지운 뒤 로그인 화면에서 Google로 들어가요.
                </p>
              )}
              {error === "1" && (
                <p role="alert" className="mt-3 text-[15px] text-danger">
                  연결하지 못했어요. 다시 눌러 주세요.
                </p>
              )}
              <div className="mt-4 flex flex-col">
                <LinkGoogleButton next="/settings" />
              </div>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-muted">연결됨 · {user.email ?? "Google"}</p>
          )}
        </div>

        <div className={row}>
          <h2 className="font-serif text-[20px] leading-snug">알림</h2>
          <div className="mt-3 flex flex-col gap-3">
            <NotificationSettings
              enabled={Boolean(notif?.enabled && notif.web_push)}
              remindHour={notif ? Math.max(20, Math.min(23, hourOf(notif.remind_at))) : 21}
              kakaoChannelUrl="https://pf.kakao.com/_WJJxiX"
            />
          </div>
        </div>

        <div className={row}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-[20px] leading-snug">생년월일</h2>
            <Link href="/onboarding?next=/settings" className="text-sm text-muted underline underline-offset-4">
              {profile ? "고치기" : "넣기"}
            </Link>
          </div>
          <p className="mt-2 font-serif text-[17px] text-ink">
            {profile
              ? `${profile.calendar === "lunar" ? "음력" : "양력"} ${profile.birth_year}.${profile.birth_month}.${profile.birth_day}${
                  profile.birth_hour !== null ? ` ${String(profile.birth_hour).padStart(2, "0")}:${String(profile.birth_minute).padStart(2, "0")}` : " · 시간 모름"
                }`
              : "아직 넣지 않았어요."}
          </p>
        </div>

        <div className={row}>
          <h2 className="font-serif text-[20px] leading-snug">앱으로 두기</h2>
          <div className="mt-3">
            <InstallHint />
          </div>
        </div>

        <div className={`${row} py-4`}>
          {anonymous ? (
            <ClearAllButton />
          ) : (
            <form action={signOutAction}>
              <button type="submit" className="text-sm text-faint underline underline-offset-4">
                로그아웃
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
