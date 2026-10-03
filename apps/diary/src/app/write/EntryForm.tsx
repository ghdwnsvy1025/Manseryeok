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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <input type="hidden" name="entryDate" value={date} />

      <fieldset ref={happinessRef}>
        <legend className="text-[17px] font-bold">행복도</legend>
        <p className={`mt-1 h-5 text-sm ${missingHappiness && happiness === null ? "font-bold text-danger" : "text-muted"}`} aria-live="polite">
          {happiness ? `${happiness} · ${hint(happiness)}` : missingHappiness ? "행복도를 먼저 골라 주세요" : "1부터 10까지"}
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <label key={n} className="relative">
              <input
                type="radio"
                name="happiness"
                value={n}
                checked={happiness === n}
                onChange={() => setHappiness(n)}
                className="peer sr-only"
              />
              <span className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-[17px] font-bold text-muted peer-checked:border-lamp peer-checked:bg-lamp peer-checked:text-lamp-ink peer-focus-visible:outline-2 peer-focus-visible:outline-lamp">
                {n}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[17px] font-bold">기분</legend>
        <p className="mt-1 text-sm text-muted">
          {MAX_MOODS}개까지 · 안 골라도 돼요 {moods.length > 0 && <span className="text-lamp">({moods.length}/{MAX_MOODS})</span>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
                  className={`inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-[15px] peer-focus-visible:outline-2 peer-focus-visible:outline-lamp ${
                    on ? "border-lamp bg-lamp/15 font-bold text-lamp" : "border-line bg-surface text-ink/85"
                  } ${full ? "cursor-not-allowed opacity-40" : ""}`}
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
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="오늘 기억하고 싶은 일 하나"
          className="mt-3 w-full resize-none rounded-2xl border border-line bg-surface p-4 text-[16px] leading-relaxed placeholder:text-faint focus:border-lamp focus:outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-2xl bg-lamp text-[17px] font-bold text-lamp-ink disabled:opacity-40"
      >
        {pending ? "저장하는 중…" : "저장"}
      </button>
    </form>
  );
}
