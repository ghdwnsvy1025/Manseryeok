import Link from "next/link";
import { GoogleButton } from "./GoogleButton";

/**
 * 기존 Google 사용자용. 앱 안에서 여기로 오는 링크는 없고, 주소를 직접 치면 열린다 (docs/ANON_START.md 2절).
 * 세션이 익명이면 GoogleButton이 로그인 대신 연결(linkIdentity)을 한다 — 익명 기록이 새 계정으로 갈라지지 않게.
 * 모양(톤 v3.2): 한지 위에 글과 버튼만. 카드 없음, 그림 없음, 금색 면은 Google 버튼 하나.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col justify-center">
      <p className="text-sm text-muted">사주읽는밤 일기</p>
      <h1 className="mt-2 font-serif text-[30px] leading-snug text-ink">
        이미 Google로 쓰던 분은
        <br />
        여기서 이어가요
      </h1>
      <p className="mt-4 text-[16px] leading-[1.7] text-muted">
        처음이라면 로그인 없이 바로 시작해도 돼요. 기록은 나중에 설정에서 Google로 연결하면 기기를 바꿔도 남아요.
      </p>
      {error === "link" && (
        <p role="alert" className="mt-6 border-l-2 border-gold pl-3 text-[15px] leading-relaxed text-danger">
          이 Google 계정은 이미 다른 기록과 연결돼 있어요. 아래 &quot;기존 Google 계정으로 로그인&quot;을 누르면 그 기록으로 가요 (지금 기기의 기록은 이 기기에 남지 않아요).
        </p>
      )}
      {error === "1" && (
        <p role="alert" className="mt-6 text-[15px] text-danger">
          로그인하지 못했어요. 다시 눌러 주세요.
        </p>
      )}
      <GoogleButton next={next} offerFreshLogin={error === "link"} />
      <Link href="/" className="mt-5 text-center text-[15px] text-muted underline underline-offset-4">
        로그인 없이 시작하기
      </Link>
    </main>
  );
}
