"use client";

/**
 * "나" 탭.
 *
 * 왜 이 탭이 생겼나 —
 * 계획서는 "나" 탭을 `/saju`(원국 표)에 연결하자고 했다. 실제로 그 화면을 열어보니
 * 첫 화면이 `辛 식신 未 비견 丁 乙 己` 였다. 사주를 아는 사람만 읽는 화면이다.
 * 그걸 탭의 얼굴로 두면 이 앱을 쓰는 사람 대부분은 거기서 닫는다.
 *
 * 그래서 순서를 뒤집었다.
 *   1) 읽을 수 있는 말      — 무엇을 타고났고, 기운이 어디로 쏠려 있는가
 *   2) 이 앱이 알아낸 나    — 운세 맞춤도 + 나에게 오는 날들 (우리만 가진 것)
 *   3) 원국 표는 "자세히"   — 지우지 않고 링크 하나 뒤로 보낸다
 *
 * 그리고 이 탭이 링크 0곳이던 화면들(`/saju/other`, `/saju/profiles`)의 통로가 된다.
 *
 * 오행 막대를 여기 두지 않는 이유 —
 * 한 번 넣어 봤다가 뺐다. `/saju` 의 오행 분포율은 지장간까지 가중해서 세고
 * (토 36% · 목 16.9% …), 가설 엔진의 `natalSummary` 는 천간·지지 여덟 자리만 센다
 * (흙 50% · 나머지 13%). 둘 다 명리에서 쓰는 방식이지만 **한 탭 차이로 다른 숫자가
 * 보이면 사용자는 어느 쪽도 못 믿는다.** 정확한 분포는 `/saju` 한 곳에만 둔다.
 * 여기서는 카드 판정과 같은 뿌리에서 나온 한 줄만 말한다.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { JournalEntry } from "@/lib/journal/types";
import type { SajuProfile } from "@/lib/diary/types";
import { getJournalStorage } from "@/lib/journal/getStorage";
import {
  loadLocalSajuProfiles,
  loadPrimarySajuProfile,
} from "@/lib/diary/profileStorage";
import { buildHomeCompletion } from "@/lib/hypothesis/homeCompletion";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { natalPlainLines } from "@/lib/hypothesis/natalPlain";
import { findYongsin, yongsinPlainLine } from "@/lib/saju/yongsin";
import HypothesisCardList from "@/components/hypothesis/HypothesisCardList";
import {
  loadDay0Answers,
  type Day0Answers,
} from "@/lib/hypothesis/day0Answers";

export default function MePage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [profile, setProfile] = useState<SajuProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const list = loadLocalSajuProfiles();
      return list.find((p) => p.isPrimary) ?? list[0] ?? null;
    } catch {
      return null;
    }
  });
  const [axesOpen, setAxesOpen] = useState(false);
  // 첫날 짐작 — localStorage 라 화면이 뜬 뒤에 읽는다 (서버 화면과 어긋나지 않게)
  const [day0, setDay0] = useState<Day0Answers | null>(null);
  useEffect(() => {
    setDay0(loadDay0Answers(profile?.id));
  }, [profile?.id]);


  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const storage = await getJournalStorage();
        const list = await storage.list();
        if (!cancelled) setEntries(list);
      } catch {
        /* 저장소가 죽어도 화면은 뜬다 */
      }
      try {
        const remote = await loadPrimarySajuProfile();
        if (!cancelled && remote) setProfile(remote);
      } catch {
        /* 로컬 프로필 유지 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fit = useMemo(
    () => buildHomeCompletion({ pillars: profile?.pillars, entries }),
    [profile?.pillars, entries]
  );

  const natal = useMemo(() => {
    if (!profile?.pillars) return null;
    try {
      return buildNatalSummary(profile.pillars);
    } catch {
      return null;
    }
  }, [profile?.pillars]);

  const plain = natal ? natalPlainLines(natal) : null;

  // 용신 — 사주 원국 화면과 같은 오행 분포에서 나온다.
  // (natalSummary 의 여덟 자리 개수가 아니라 지장간까지 가중한 그 숫자)
  const yongsin = useMemo(() => {
    const p = profile?.pillars;
    if (!p) return null;
    try {
      return findYongsin({
        year: p.year,
        month: p.month,
        day: p.day,
        hour: p.hour ?? null,
      });
    } catch {
      return null;
    }
  }, [profile?.pillars]);
  const percent = fit?.completion.percent ?? 0;
  const settled = fit ? fit.cards.length - fit.waitingCount : 0;

  return (
    <main className="p-4 space-y-6 max-w-lg mx-auto w-full pb-8">
      {/* ── 1층. 읽을 수 있는 말 ───────────────────── */}
      <section className="space-y-1.5">
        <p className="ui-hint">{profile?.label?.trim() || "나"}</p>
        {plain ? (
          <>
            <h1
              className="text-2xl font-black leading-snug"
              style={{ color: "var(--px-text)" }}
            >
              {plain.origin}
            </h1>
            {/*
              plain.balance("쇠가 넉넉하고…")를 여기 두었다가 뺐다.
              바로 아래 용신이 "불 기운이 가장 많아요"라고 말하는데, 둘의 근거가
              다른 계산이라 **한 화면에서 가장 많은 오행이 두 개**로 보였다.
              오행 쏠림은 용신 구역 한 곳에서만 말한다 — 그쪽이 사주 원국 화면과 같은 숫자다.
            */}
          </>
        ) : (
          <>
            <h1
              className="text-2xl font-black leading-snug"
              style={{ color: "var(--px-text)" }}
            >
              생년월일을
              <br />
              먼저 알려주세요
            </h1>
            <p className="ui-guide">
              그래야 어떤 날에 어떤 사람인지 찾아드릴 수 있어요.
            </p>
          </>
        )}

      </section>

      {/* ── 1.5층. 용신 ────────────────────────────
          "이게 뭔지" 를 먼저 말하고 한자를 뒤에 둔다.
          용신은 사주에서 제일 자주 듣는 말인데 대부분 뜻을 모른다. */}
      {yongsin && (
        <section className="space-y-2">
          <h2 className="ui-section-title">나에게 필요한 기운</h2>
          <div className="px-card p-3 space-y-2">
            <p className="ui-guide">{yongsinPlainLine(yongsin)}</p>

            <div className="flex flex-wrap gap-1.5">
              {yongsin.ganji.map((g) => (
                <span
                  key={g.hanja}
                  className="px-2 py-1 text-xs font-black"
                  style={{
                    background: `color-mix(in srgb, var(--px-accent) 16%, var(--px-bg3))`,
                    color: "var(--px-accent)",
                    borderRadius: "8px",
                  }}
                >
                  {g.hanja} {g.ko}
                  {g.slot && g.slot !== "그 밖" && (
                    <span
                      className="ml-1 text-[10px] font-medium"
                      style={{ color: "var(--px-text2)" }}
                    >
                      {g.slot}
                    </span>
                  )}
                </span>
              ))}
            </div>

            <p className="ui-hint">
              {yongsin.source === "tzone"
                ? "내 사주 안(시간·일지·월간)에 이미 있어요 — 이걸 용신이라고 해요"
                : "내 사주 안에는 없어요. 이 기운을 가진 날이 나를 도와줍니다"}
            </p>
          </div>
        </section>
      )}

      {/* ── 2층. 이 앱이 알아낸 나 ─────────────────── */}
      {fit && (
        <section className="space-y-2">
          <button
            type="button"
            className="w-full text-left space-y-1.5"
            aria-expanded={axesOpen}
            onClick={() => setAxesOpen((v) => !v)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="ui-section-title">운세 맞춤도</span>
              <span
                className="text-lg font-black tabular-nums"
                style={{ color: "var(--px-accent)" }}
              >
                {percent}%
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden"
              style={{ background: "var(--px-bg3)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${percent}%`,
                  background: "var(--px-accent)",
                }}
              />
            </div>
            <p className="ui-hint">
              {axesOpen ? "접기" : "무엇이 이 숫자를 만드는지 보기"}
            </p>
          </button>

          {axesOpen && (
            <div className="space-y-1.5 pt-1">
              {fit.completion.axes.map((axis) => (
                <div
                  key={axis.key}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="ui-hint">{axis.label}</span>
                  <span
                    className="text-xs font-bold tabular-nums shrink-0"
                    style={{ color: "var(--px-text2)" }}
                  >
                    {axis.detail}
                  </span>
                </div>
              ))}
              <p className="ui-hint pt-1">{fit.completion.nextStep}</p>
            </div>
          )}
        </section>
      )}

      {/* ── 3층. 나에게 오는 날들 ──────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="ui-section-title">나에게 오는 날들</h2>
          {fit && (
            <span className="ui-hint tabular-nums">
              {settled}/{fit.cards.length} 확인됨
            </span>
          )}
        </div>
        <HypothesisCardList
          cards={fit?.cards ?? []}
          pillars={profile?.pillars}
          day0={day0}
        />
      </section>

      {/* ── 4층. 더 보기 — 지금까지 갈 길이 없던 화면들 ─ */}
      <section className="space-y-2">
        <h2 className="ui-section-title">더 보기</h2>
        {[
          { href: "/saju", label: "사주 원국 자세히", hint: "천간·지지·대운 표" },
          { href: "/saju/profiles", label: "프로필 관리", hint: "생년월일 고치기·추가" },
          { href: "/saju/other", label: "다른 사람 사주 보기", hint: "저장하지 않아요" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-card flex items-center justify-between gap-3 p-3"
          >
            <span className="min-w-0">
              <span
                className="block text-sm font-bold"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {item.label}
              </span>
              <span className="block ui-hint">{item.hint}</span>
            </span>
            <span
              className="text-sm font-black shrink-0"
              style={{ color: "var(--px-text2)" }}
            >
              →
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
