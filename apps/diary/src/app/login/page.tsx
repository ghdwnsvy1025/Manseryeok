import Link from "next/link";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col justify-center">
      <p className="text-sm text-lamp">사주읽는밤 일기</p>
      <h1 className="mt-2 font-serif text-[30px] font-bold leading-snug">
        밤에 한 줄 쓰면,
        <br />
        운세가 내 것이 돼요
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        내 기록이 쌓일수록 어떤 날에 내가 행복한지 보여요. 기록은 계정에 저장돼서 기기를 바꿔도 남아요.
      </p>
      {error && (
        <p role="alert" className="mt-6 text-[15px] text-danger">
          로그인하지 못했어요. 다시 눌러 주세요.
        </p>
      )}
      <GoogleButton next={next} />
      <Link href="/" className="mt-4 text-center text-sm text-muted underline underline-offset-4">
        로그인 없이 오늘 운세만 보기
      </Link>
    </main>
  );
}
