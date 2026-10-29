import Link from "next/link";
import { isLinkDoneStatus, ONBOARDING_LINK_NEXT, type LinkDoneStatus } from "@/lib/googleLink";

export const dynamic = "force-dynamic";

/**
 * Google 연결·로그인이 "버튼을 누른 창과 다른 브라우저"로 돌아왔을 때의 안내 (docs/ANON_START.md 6절).
 * iOS 홈 화면 앱에서 누르면 Google 화면과 콜백이 Safari·인앱 브라우저에서 끝나 여기로 온다.
 * 세션을 전혀 읽지 않는다 — 이 브라우저의 계정(있다면)과 무관한 말만 한다. 모양은 설정 화면의 한지 카드 하나, 그림 없음.
 * 예외 하나: `exists&next=/welcome`은 첫 화면에서 생년월일을 저장하고 연결하러 간 **같은 창**이다(ANON_START.md 7절) —
 * 기록은 이미 만들어졌으니 "그대로 시작해요"와 내 카드로 가는 버튼을 보인다.
 */
export default async function AuthDonePage({ searchParams }: { searchParams: Promise<{ status?: string; next?: string }> }) {
  const sp = await searchParams;
  const status: LinkDoneStatus = isLinkDoneStatus(sp.status) ? sp.status : "failed";
  const onboarding = status === "exists" && sp.next === ONBOARDING_LINK_NEXT;
  const c = onboarding ? ONBOARDING_EXISTS : COPY[status];

  return (
    <main className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-[26px] leading-snug">{c.title}</h1>
      </header>
      <section className="card-frame card-paper p-5">
        {c.body.map((line) => (
          <p key={line} className="mt-2 text-[15px] leading-relaxed text-muted first:mt-0">
            {line}
          </p>
        ))}
        {onboarding && (
          <div className="mt-5 flex flex-col items-center gap-3">
            {/* 금색 면 버튼 — 이 화면에 하나 */}
            <Link href={ONBOARDING_LINK_NEXT} className="gold-plate flex h-14 w-full items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink">
              내 카드 보기
            </Link>
            <p className="text-center text-[14px] text-muted">
              전에 쓰던 기록으로 가려면{" "}
              <Link href="/login?next=%2F" className="tap underline underline-offset-4">
                여기서 로그인
              </Link>
              해요.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

const BACK = "이 창은 닫고 홈 화면의 '사주읽는밤' 앱으로 돌아가 주세요.";

const COPY: Record<LinkDoneStatus, { title: string; body: string[] }> = {
  linked: {
    title: "Google 연결을 마쳤어요",
    body: [BACK, "앱의 설정에서 '연결됨'으로 보여요. 기록은 그대로예요."],
  },
  exists: {
    title: "이미 쓰고 있는 Google 계정이에요",
    body: [
      "이 Google 계정으로 전에 만든 기록이 따로 있어서, 앱의 기록에 붙일 수 없어요.",
      "앱으로 돌아가 다른 Google 계정으로 연결해 주세요.",
    ],
  },
  "other-browser": {
    title: "앱과 다른 창으로 돌아왔어요",
    body: [
      "홈 화면 앱에서 시작한 로그인은 이 창에서 마칠 수 없어요. 아이폰이 Google 화면을 앱 밖에서 열기 때문이에요.",
      "앱의 기록에 Google을 붙이려던 거라면 앱으로 돌아가 설정의 'Google로 연결하기'를 눌러 주세요.",
    ],
  },
  failed: {
    title: "연결하지 못했어요",
    body: [BACK, "설정의 'Google로 연결하기'를 다시 눌러 주세요."],
  },
};

const ONBOARDING_EXISTS = {
  title: "이미 쓰고 있는 Google 계정이에요",
  body: [
    "이 Google 계정으로 전에 만든 기록이 따로 있어서, 지금 기록에 붙이지 못했어요.",
    "방금 적은 생년월일로 그대로 시작해요. 다른 Google 계정은 나중에 설정에서 연결할 수 있어요.",
  ],
};
