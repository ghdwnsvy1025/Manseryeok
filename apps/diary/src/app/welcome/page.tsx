import { redirect } from "next/navigation";
import { SaveBurst } from "@/components/SaveBurst";
import { OnboardingDoneTrack } from "@/components/track/OnboardingDoneTrack";
import { TrackedLink } from "@/components/track/TrackedLink";
import { characterOf } from "@/lib/character";
import { getSajuProfile } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 온보딩 직후 한 번 보이는 공개 화면 (톤 v3.3): 내 일주 카드가 팡 → "당신의 카드는 기축 · 소예요" → 금색 버튼으로 오늘 화면.
 * 프로필을 처음 만들 때만 saveProfileAction이 여기로 보낸다. 새로고침하면 다시 보여도 무방 (쿼리·저장소 없음).
 * 세션·프로필이 없으면 온보딩으로. 모양(팡 키프레임·글자 크기·간격)은 디자이너 몫 — 여기는 구조만.
 */
export default async function WelcomePage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/onboarding");
  const profile = await getSajuProfile(supabase, user.id);
  if (!profile) redirect("/onboarding");
  const me = characterOf(profile.pillars);

  return (
    <main className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-start gap-7 overflow-clip pt-12 pb-6 text-center">
      {/* 팡 연출의 카드 부분만 재사용 (mode="reveal": 오버레이·도장·자동 이동 없음). 조각 흩날림은 카드 뒤에서.
          v3.8: characterSrc를 넘기면 실루엣(검은 컷아웃) → 1.2초 뒤 팡 → 정사각 카드. 무대는 위에서 고정(justify-start) —
          실루엣 글자가 사라지고 글·버튼이 나타나도 카드 자리가 움직이지 않는다. 글·버튼(.burst-text)은 실루엣 동안 CSS가 숨긴다 */}
      <SaveBurst mode="reveal" ganjiKo={me.ganjiKo} cardSrc={me.cardSrc} characterSrc={me.characterSrc} />
      {/* 온보딩 폼이 남긴 표가 있으면 onboarding_done (측정.md) */}
      <OnboardingDoneTrack />
      {/* 글은 카드 팡 뒤 150ms, 버튼은 그 다음 — 같은 saved-in 전환 한 번씩 */}
      <div className="burst-text px-2">
        <h1 className="font-serif text-[24px] leading-snug break-keep">
          당신의 카드는 <span className="text-ganji">{me.ganjiKo}일</span> 카드예요
        </h1>
        <p className="mt-2 text-[16px] leading-[1.6] text-muted break-keep">
          {me.ganjiKo}({profile.pillars.day.stem}
          {profile.pillars.day.branch}) = 태어난 날의 간지예요
        </p>
        <p className="mt-1 text-[16px] leading-[1.6] text-muted break-keep">60갑자 중 당신의 날이에요</p>
        {/* v3.31 (명세 30): 하루 흐름 세 줄 — 튜토리얼 대신. 머리는 한지 띠지(나 탭 머리표와 같은 재료), 번호·금색·그림 없음.
            순서가 아니라 하루의 모양이라 번호를 붙이지 않는다. 글과 같은 burst-text 전환 안에 들어온다 */}
        <dl className="day-flow">
          <dt className="day-flow__head">낮</dt>
          <dd className="day-flow__text">오늘 운세를 읽어요</dd>
          <dt className="day-flow__head">밤</dt>
          <dd className="day-flow__text">
            행복도 하나, 한 줄이면 돼요<span className="day-flow__aside">30초</span>
          </dd>
          <dt className="day-flow__head">쌓이면</dt>
          <dd className="day-flow__text">운세와 내 하루가 얼마나 맞았는지 보여요</dd>
        </dl>
      </div>
      {/* 금색 면 버튼 — 이 화면에 하나. 자동 이동 없음 */}
      <TrackedLink event="welcome_start_click" href="/" className="burst-text burst-text--late gold-plate flex h-14 w-full max-w-[320px] items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink">
        오늘 운세 보기
      </TrackedLink>
    </main>
  );
}
