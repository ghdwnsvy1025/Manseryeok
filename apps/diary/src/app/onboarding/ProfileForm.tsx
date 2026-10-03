"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { saveProfileAction, type FormState } from "@/app/actions";
import { CITIES } from "@/lib/cities";

export interface ProfileFormValues {
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  timeUnknown: boolean;
  city: string;
}

const field =
  "h-12 w-full rounded-xl border border-line bg-surface px-3 text-center text-[17px] placeholder:text-faint focus:border-lamp focus:outline-none";

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-[16px] text-muted peer-checked:border-lamp peer-checked:font-bold peer-checked:text-lamp peer-focus-visible:outline-2 peer-focus-visible:outline-lamp">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function ProfileForm({ next, initial }: { next: string; initial: ProfileFormValues | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, { error: null });
  const [gender, setGender] = useState<"male" | "female" | null>(initial?.gender ?? null);
  const [calendar, setCalendar] = useState<"solar" | "lunar">(initial?.calendar ?? "solar");
  const [timeUnknown, setTimeUnknown] = useState(initial?.timeUnknown ?? false);

  // form action 대신 onSubmit으로 보낸다. React 19는 action 폼을 제출 뒤 비우는데,
  // 서버에서 오류가 났을 때 적은 내용이 사라지면 안 된다.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="name" className="text-[15px] font-bold">
          이름
        </label>
        <input
          id="name"
          name="name"
          defaultValue={initial?.name}
          maxLength={40}
          autoComplete="nickname"
          placeholder="불릴 이름"
          className={`${field} mt-2 text-left`}
          required
        />
      </div>

      <div>
        <p className="text-[15px] font-bold">성별</p>
        <div className="mt-2">
          <Segmented
            name="gender"
            value={gender}
            onChange={setGender}
            options={[
              { value: "female", label: "여성" },
              { value: "male", label: "남성" },
            ]}
          />
        </div>
      </div>

      <div>
        <p className="text-[15px] font-bold">생년월일</p>
        <div className="mt-2">
          <Segmented
            name="calendar"
            value={calendar}
            onChange={setCalendar}
            options={[
              { value: "solar", label: "양력" },
              { value: "lunar", label: "음력" },
            ]}
          />
        </div>
        <div className="mt-2 grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <input name="birthYear" inputMode="numeric" maxLength={4} placeholder="1995" defaultValue={initial?.birthYear} aria-label="태어난 해" className={field} required />
          <input name="birthMonth" inputMode="numeric" maxLength={2} placeholder="월" defaultValue={initial?.birthMonth} aria-label="태어난 달" className={field} required />
          <input name="birthDay" inputMode="numeric" maxLength={2} placeholder="일" defaultValue={initial?.birthDay} aria-label="태어난 날" className={field} required />
        </div>
        {calendar === "lunar" && (
          <label className="mt-3 flex items-center gap-2 text-[15px] text-muted">
            <input type="checkbox" name="isLeapMonth" defaultChecked={initial?.isLeapMonth} className="h-5 w-5 accent-lamp" />
            윤달이에요
          </label>
        )}
      </div>

      <div>
        <p className="text-[15px] font-bold">태어난 시각</p>
        {!timeUnknown && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input name="birthHour" inputMode="numeric" maxLength={2} placeholder="시 (0~23)" defaultValue={initial?.birthHour} aria-label="태어난 시" className={field} />
            <input name="birthMinute" inputMode="numeric" maxLength={2} placeholder="분" defaultValue={initial?.birthMinute} aria-label="태어난 분" className={field} />
          </div>
        )}
        <label className="mt-3 flex items-center gap-2 text-[15px] text-muted">
          <input
            type="checkbox"
            name="timeUnknown"
            checked={timeUnknown}
            onChange={(e) => setTimeUnknown(e.target.checked)}
            className="h-5 w-5 accent-lamp"
          />
          시간을 몰라요
        </label>
      </div>

      <div>
        <label htmlFor="city" className="text-[15px] font-bold">
          태어난 곳
        </label>
        <select id="city" name="city" defaultValue={initial?.city ?? "seoul"} className={`${field} mt-2 text-left`}>
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="h-14 rounded-2xl bg-lamp text-[17px] font-bold text-lamp-ink disabled:opacity-50">
        {pending ? "계산하는 중…" : "저장"}
      </button>
    </form>
  );
}
