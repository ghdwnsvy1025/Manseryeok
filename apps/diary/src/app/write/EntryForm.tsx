"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { saveEntryAction, type FormState } from "@/app/actions";
import { MAX_MOODS, MAX_NOTE, MOODS, type Promise_ } from "@/lib/entry";

interface Props {
  date: string;
  /** 그날 운세의 "하면 좋아요" 한 줄 = 오늘의 작은 약속 (톤 v3.2). 운세 캐시가 없으면 null → 약속 블록 생략 */
  promiseText: string | null;
  initial: { happiness: number; moods: string[]; note: string; promise: Promise_ | null } | null;
}

/** 약속 세그먼트 3칸. value는 저장 규칙(entry.ts PROMISES)과 같다 */
const PROMISE_OPTIONS: { value: Promise_; label: string }[] = [
  { value: "kept", label: "지켰어요" },
  { value: "missed", label: "못 지켰어요" },
  { value: "na", label: "해당 없음" },
];

const HAPPINESS_HINT: Record<number, string> = {
  1: "많이 힘들었어요",
  3: "힘든 편이었어요",
  5: "그럭저럭",
  7: "괜찮았어요",
  9: "아주 좋았어요",
  10: "최고였어요",
};

function hint(n: number): string {
  for (let k = n; k >= 1; k--) if (HAPPINESS_HINT[k]) return HAPPINESS_HINT[k];
  return "";
}

/**
 * 쓰기 폼 — 일기장 페이지 한 장 (톤 v3).
 * 행복도는 도장(키트 stamp), 기분은 종이 띠지(tag-strip), 메모는 편지지 괘선 위 손글씨.
 * 폼 필드 이름·값과 저장 로직은 그대로다.
 */
export function EntryForm({ date, promiseText, initial }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntryAction, { error: null });
  const [happiness, setHappiness] = useState<number | null>(initial?.happiness ?? null);
  const [promise, setPromise] = useState<Promise_ | null>(initial?.promise ?? null);
  const [moods, setMoods] = useState<string[]>(initial?.moods ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  // 행복도 없이 저장을 누르면 그 자리로 데려가 이유를 보여 준다 (버튼을 막아 두면 눌러도 반응이 없어 저장된 줄 안다)
  const [missingHappiness, setMissingHappiness] = useState(false);
  const happinessRef = useRef<HTMLFieldSetElement>(null);

  function toggleMood(m: string) {
    setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : cur.length < MAX_MOODS ? [...cur, m] : cur));
  }

  // form action 대신 onSubmit으로 보낸다. React 19는 action 폼을 제출 뒤 비우는데,
  // 서버에서 오류가 났을 때 적은 내용이 사라지면 안 된다.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (happiness === null) {
      setMissingHappiness(true);
      happinessRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      happinessRef.current?.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  // 저장이 끝나는 순간의 보상 "팡"(톤 v3.1)은 SaveBurst가 맡는다. 서버 액션이 성공하면 바로 /?saved=날짜로
  // 보내므로(actions.ts) 성공 신호는 이 폼이 아니라 오늘 화면(page.tsx)이 받는다. 여기서는 접힘 전환 없이
  // 버튼만 흐려진다. 오류면 pending이 풀리며 적은 내용이 그대로 남는다.

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="entryDate" value={date} />

      {/* 카드 종이 한 장 */}
      <div className="card-frame card-paper flex flex-col gap-7 p-5">
        {/* 오늘의 작은 약속 (톤 v3.2) — 운세 "하면 좋아요" 한 줄. 운세 캐시가 없던 날은 통째로 생략.
            기능 뼈대만: 문장 + 세그먼트 3칸(name="promise") + hidden promise_text. 금색 띠지·세그먼트 시각은 디자이너가 입힌다 */}
        {promiseText && (
          <fieldset data-promise-block>
            {/* 금색 띠지 한 줄: "오늘 약속 · 문장". 운세 카드의 "하면 좋아요" 띠지와 같은 재료(tag--gold) */}
            <legend className="sr-only">오늘 약속</legend>
            <input type="hidden" name="promise_text" value={promiseText} />
            <p className="tag tag--gold min-h-10 w-full justify-start gap-2 px-1 py-1.5 text-[15px] leading-snug text-gold-ink" data-promise-text>
              <span className="shrink-0 font-bold">오늘 약속</span>
              <span aria-hidden className="shrink-0 opacity-60">·</span>
              <span className="min-w-0 break-keep">{promiseText}</span>
            </p>
            <div className="promise-seg mt-3" role="radiogroup" aria-label="오늘 약속을 지켰는지">
              {PROMISE_OPTIONS.map((o) => {
                const on = promise === o.value;
                return (
                  <label key={o.value} className="contents">
                    <input
                      type="radio"
                      name="promise"
                      value={o.value}
                      checked={on}
                      onChange={() => setPromise(o.value)}
                      className="sr-only"
                    />
                    <span className="promise-seg__cell">{o.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset ref={happinessRef}>
          <legend className="text-[17px] font-bold">행복도</legend>
          <p className={`mt-1 h-5 text-sm ${missingHappiness && happiness === null ? "font-bold text-danger" : "text-muted"}`} aria-live="polite">
            {happiness ? `${happiness} · ${hint(happiness)}` : missingHappiness ? "행복도를 먼저 골라 주세요" : "1부터 10까지, 도장 하나"}
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const on = happiness === n;
              return (
                <label key={n} className="relative">
                  <input
                    type="radio"
                    name="happiness"
                    value={n}
                    checked={on}
                    onChange={() => setHappiness(n)}
                    className="peer sr-only"
                  />
                  <span
                    className={`stamp flex aspect-square cursor-pointer items-center justify-center font-serif text-[22px] peer-focus-visible:outline-2 peer-focus-visible:outline-gold ${
                      on ? "stamp--on text-paper-2" : "text-line"
                    }`}
                  >
                    {n}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[17px] font-bold">기분</legend>
          <p className="mt-1 text-sm text-muted">
            {MAX_MOODS}개까지 · 안 골라도 돼요 {moods.length > 0 && <span className="text-ganji">({moods.length}/{MAX_MOODS})</span>}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-2 gap-y-3">
            {MOODS.map((m) => {
              const on = moods.includes(m);
              const full = !on && moods.length >= MAX_MOODS;
              return (
                <label key={m}>
                  <input
                    type="checkbox"
                    name="moods"
                    value={m}
                    checked={on}
                    disabled={full}
                    onChange={() => toggleMood(m)}
                    className="peer sr-only"
                  />
                  <span
                    className={`tag h-10 cursor-pointer px-2 text-[15px] peer-focus-visible:outline-2 peer-focus-visible:outline-gold ${
                      on ? "tag--on font-bold text-paper-2" : "text-ink"
                    } ${full ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    {m}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="note" className="text-[17px] font-bold">
            한 줄
          </label>
          <p className="mt-1 text-sm text-muted">안 써도 돼요</p>
          {/* 편지지 괘선 위에 손글씨. 안내 문구(placeholder)는 앱 글이라 본문 서체 */}
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="오늘 기억하고 싶은 일 하나"
            className="ruled mt-2 w-full resize-none bg-transparent px-1 font-hand text-[22px] text-ink placeholder:font-sans placeholder:text-[16px] placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-gold"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      )}

      {/* 화면에 금색 면은 이것 하나 */}
      <button
        type="submit"
        disabled={pending}
        className="gold-plate h-14 rounded-xl text-[17px] font-bold text-gold-ink disabled:opacity-40"
      >
        {pending ? "저장하는 중…" : "저장하기"}
      </button>
    </form>
  );
}
