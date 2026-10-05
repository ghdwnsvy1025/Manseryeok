"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { saveEntryAction, type FormState } from "@/app/actions";
import { MAX_MOODS, MAX_NOTE, MOODS } from "@/lib/entry";

interface Props {
  date: string;
  initial: { happiness: number; moods: string[]; note: string } | null;
}

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
export function EntryForm({ date, initial }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntryAction, { error: null });
  const [happiness, setHappiness] = useState<number | null>(initial?.happiness ?? null);
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

  // 모션 2 — 저장이 끝나는 순간. 서버가 응답하는 동안 폼이 아래로 접히며 사라진다 (600ms).
  // 성공이면 그대로 오늘 화면으로 이동하고, 오류면 pending이 풀리며 다시 펼쳐진다.
  const folding = pending ? "origin-bottom scale-y-[0.96] opacity-0" : "origin-bottom";

  return (
    <form onSubmit={onSubmit} className={`flex flex-col gap-5 transition-[transform,opacity] duration-[600ms] ease-out ${folding}`}>
      <input type="hidden" name="entryDate" value={date} />

      {/* 카드 종이 한 장 */}
      <div className="card-frame card-paper flex flex-col gap-7 p-5">
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
                      on ? "stamp--on text-gold-ink" : "text-line"
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
                      on ? "tag--on font-bold text-sky-ink" : "text-ink"
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
