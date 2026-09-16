"use client";

/**
 * Day 0 — 가설 카드 덱
 *
 * 생년월일을 저장한 직후, 노동의 대가로 뜬다.
 * 한 장씩 넘기며 "지금 맞는 것 같은지" 답한다. 8장이면 40초.
 *
 * 이 답은 판정에 쓰지 않는다 — 이유는 `lib/hypothesis/day0Answers.ts` 참고.
 */
import { useEffect, useMemo, useState } from "react";
import type { SajuProfile } from "@/lib/diary/types";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import { METRICS, type HypothesisRule } from "@/lib/hypothesis/types";
import {
  saveDay0Answers,
  type Day0Guess,
} from "@/lib/hypothesis/day0Answers";

type Props = {
  profile: SajuProfile;
  onDone: () => void;
};

const CHOICES: Array<{ value: Day0Guess; label: string }> = [
  { value: "agree", label: "맞아요" },
  { value: "disagree", label: "글쎄요" },
  { value: "unsure", label: "모르겠어요" },
];

export default function HypothesisIntro({ profile, onDone }: Props) {
  const rules = useMemo<HypothesisRule[]>(() => {
    try {
      return generateHypotheses(buildNatalSummary(profile.pillars));
    } catch {
      return [];
    }
  }, [profile.pillars]);

  const [index, setIndex] = useState(0);
  const [guesses, setGuesses] = useState<Record<string, Day0Guess>>({});
  const [finished, setFinished] = useState(false);

  // 카드를 한 장도 못 뽑았으면 붙잡아두지 않는다
  useEffect(() => {
    if (rules.length === 0) onDone();
  }, [rules.length, onDone]);

  if (rules.length === 0) return null;

  const total = rules.length;
  const agreed = Object.values(guesses).filter((g) => g === "agree").length;

  function answer(rule: HypothesisRule, value: Day0Guess) {
    const next = { ...guesses, [rule.id]: value };
    setGuesses(next);

    if (index + 1 >= total) {
      saveDay0Answers(profile.id, next, rules.map((r) => r.id));
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  }

  function skipAll() {
    saveDay0Answers(profile.id, guesses, rules.map((r) => r.id));
    onDone();
  }

  // ── 마지막 요약 ──
  if (finished) {
    return (
      <main className="min-h-screen flex flex-col justify-center gap-6 p-5 max-w-lg mx-auto">
        <div className="space-y-2">
          <p className="ui-hint">{total}가지 날 중</p>
          <p
            className="font-black leading-tight"
            style={{ fontSize: "2rem", color: "var(--px-accent)" }}
          >
            {agreed}가지가 당신에게
            <br />
            있다고 하셨어요
          </p>
        </div>

        <div
          className="p-4 space-y-2"
          style={{
            background: "var(--px-bg3)",
            border: "2px solid var(--px-border)",
          }}
        >
          <p className="ui-guide">
            지금은 당신의 짐작이고, 사주의 짐작입니다. 둘 다 아직 근거가 없어요.
          </p>
          <p className="ui-guide">
            <strong style={{ color: "var(--px-text)" }}>
              오늘부터 30초씩 기록하면, 그 날들의 정체가 하나씩 밝혀집니다.
            </strong>{" "}
            빠른 건 3주, 늦은 건 두 달쯤 걸려요.
          </p>
        </div>

        <button type="button" className="ui-primary-btn w-full" onClick={onDone}>
          오늘 첫 기록 하러 가기
        </button>
      </main>
    );
  }

  // ── 카드 한 장 ──
  const rule = rules[index]!;
  const isLast = index + 1 === total;

  return (
    <main className="min-h-screen flex flex-col gap-5 p-5 max-w-lg mx-auto">
      <header className="space-y-2 pt-2">
        <p className="ui-hint">
          이런 날, 있으신가요? · {index + 1} / {total}
        </p>
        <div
          className="h-2 overflow-hidden"
          style={{
            border: "2px solid var(--px-border)",
            background: "var(--px-bg3)",
          }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${((index + 1) / total) * 100}%`,
              background: "var(--px-accent)",
            }}
          />
        </div>
      </header>

      <section
        className="flex-1 flex flex-col justify-center gap-4 p-5"
        style={{
          background: "var(--px-bg2)",
          border: "2px solid var(--px-border)",
          boxShadow: "var(--sh-4)",
        }}
      >
        <span
          className="self-start px-2 py-1 text-xs font-bold"
          style={{
            background: "var(--px-bg3)",
            color: "var(--px-text2)",
            border: "1px solid var(--px-border)",
          }}
        >
          {METRICS[rule.metric].label}
        </span>

        <p
          className="font-bold leading-relaxed"
          style={{ fontSize: "1.25rem", color: "var(--px-text-on-panel)" }}
        >
          {rule.copy.claim}
        </p>

        <p
          className="ui-hint"
          style={{ borderLeft: "2px solid var(--px-border)", paddingLeft: ".7rem" }}
        >
          {rule.copy.basis}
        </p>
      </section>

      <div className="space-y-3">
        <p className="ui-hint text-center">이런 날, 있으신가요?</p>
        <div className="flex gap-2">
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className="flex-1 px-btn py-3 text-sm font-bold"
              onClick={() => answer(rule, choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </div>
        {!isLast && (
          <button
            type="button"
            className="ui-hint w-full underline"
            onClick={skipAll}
          >
            나중에 볼게요
          </button>
        )}
      </div>
    </main>
  );
}
