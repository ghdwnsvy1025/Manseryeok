"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bootAnonAction } from "@/app/actions";
import { track } from "@/lib/analytics";
import { forgetAccount, readLastAccount, type LastAccount } from "@/lib/accountMemory";
import { callbackHref } from "@/lib/googleLink";
import { createClient } from "@/lib/supabase/client";

/**
 * /restore의 선택 (ANON_START.md 8절).
 * - Google 계정이었다: "Google로 기록 찾기"(기존 계정으로 로그인 — 기록이 그대로) + "새로 시작하기".
 * - 익명이었다: 되찾을 길이 없다고 솔직히 말하고 "새로 시작하기". 이번엔 Google을 붙여 두라고 권한다.
 * "새로 시작하기"는 예전 AnonBoot가 하던 일(익명 시작 → 사용자 행) 뒤 next로. 기록이 없으면(다른 창에서 직접 열림) 바로 새로 시작.
 */
export function RestoreChoices({ next }: { next: string }) {
  const router = useRouter();
  const [last, setLast] = useState<LastAccount | null | undefined>(undefined);
  const [busy, setBusy] = useState<"google" | "fresh" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = readLastAccount();
    setLast(v);
    if (v) track("session_lost", { had: v.anonymous ? "anon" : "google" });
  }, []);

  async function google() {
    setBusy("google");
    setError(null);
    track("login_start", { provider: "google", mode: "fresh", from: "restore" });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackHref(window.location.origin, "fresh", next) },
    });
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (error) {
      console.error("Google 로그인(기록 찾기)", error);
      setError("Google 로그인 창을 열지 못했어요. 다시 눌러 주세요.");
      setBusy(null);
    }
  }

  async function fresh() {
    setBusy("fresh");
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error || !signed.user) {
        console.error("익명 시작 실패", error ?? new Error("사용자 없음"));
        setError("시작하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
        setBusy(null);
        return;
      }
      try {
        await bootAnonAction();
      } catch (e) {
        console.error("익명 사용자 행 만들기 실패", e);
      }
    }
    forgetAccount();
    track("session_lost_fresh", {});
    router.replace(next);
    router.refresh();
  }

  useEffect(() => {
    // 기록 없이 들어왔으면(주소로 직접 연 경우) 물을 것이 없다
    if (last === null) void fresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  if (!last) return null;

  return (
    <>
      <header>
        <h1 className="font-serif text-[26px] leading-snug">{last.anonymous ? "이 기기의 기록을 열 수 없어요" : "전에 쓰던 기록이 있어요"}</h1>
      </header>
      <section className="card-frame card-paper flex flex-col gap-3 p-5">
        {last.anonymous ? (
          <>
            <p className="text-[15px] leading-relaxed text-muted">이 기기의 로그인 정보가 지워졌어요. 가입 없이 쓰던 기록은 로그인 정보가 없으면 다시 열 수 없어요.</p>
            <p className="text-[15px] leading-relaxed text-muted">새로 시작한 뒤 설정에서 Google을 연결해 두면, 다음엔 기록을 찾을 수 있어요.</p>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-muted">로그인이 풀렸어요. Google로 다시 들어가면 기록이 그대로 있어요.</p>
            <button
              type="button"
              onClick={google}
              disabled={busy !== null}
              className="gold-plate mt-2 flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink disabled:opacity-60"
            >
              {busy === "google" ? "Google로 이동하는 중…" : "Google로 기록 찾기"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={fresh}
          disabled={busy !== null}
          className={
            last.anonymous
              ? "gold-plate mt-2 flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink disabled:opacity-60"
              : "flex h-13 items-center justify-center rounded-xl border border-frame text-[16px] font-bold text-ink disabled:opacity-60"
          }
        >
          {busy === "fresh" ? "시작하는 중…" : "새로 시작하기"}
        </button>
        {!last.anonymous && <p className="px-1 text-center text-[14px] text-muted">새로 시작하면 전에 쓰던 기록은 이 화면에서 보이지 않아요.</p>}
        {error && (
          <p role="alert" className="text-[15px] text-danger">
            {error}
          </p>
        )}
      </section>
    </>
  );
}
