"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { saveProfileAction, type FormState } from "@/app/actions";
import { CITIES } from "@/lib/cities";
import type { ProfileField } from "@/lib/profile";

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

/** 입력 묶음 위 작은 라벨 (Pretendard 14px 보조색) */
const groupLabel = "text-[14px] leading-none text-muted";

/** 세그먼트의 한 칸 = 종이 띠지 (v3.8, 쓰기 화면 `.tag`와 같은 재료). 라디오는 sr-only(name/value 그대로), 고른 쪽은 `input:checked + .tag`가 남색 띠로 그린다 */
function SegRadio<T extends string>({
  name,
  value,
  current,
  label,
  onChange,
}: {
  name: string;
  value: T;
  current: T | null;
  label: string;
  onChange: (v: T) => void;
}) {
  const on = current === value;
  return (
    <label className="contents">
      <input type="radio" name={name} value={value} checked={on} onChange={() => onChange(value)} aria-label={label} className="peer sr-only" />
      <span className="tag seg__cell">{label}</span>
    </label>
  );
}

interface ProfileFormProps {
  next: string;
  initial: ProfileFormValues | null;
  /** 기본은 saveProfileAction. 테스트·다른 화면에서 바꿔 끼울 수 있다 */
  serverAction?: (prev: FormState, form: FormData) => Promise<FormState>;
  /** 익명 사용자는 이름을 받지 않는다 (서버가 "손님"으로 저장) */
  askName?: boolean;
  submitLabel?: string;
}

/**
 * 생년월일 입력 (톤 v3.3 "양식지 제거, 깨끗하게"). 한지 카드 한 장 안에 입력칸만.
 * 입력칸 .field: 56px · 녹갈 1px · paper-3 바탕 · 숫자 Song Myung 22px. 상태만 분명히 —
 * 빈 칸 = 흐린 자리표시 / 입력 중 = 금색 2px / 채움 = 먹색 글자 / 오류 = 먹색 1.5px + 아래 danger 한 줄.
 * 양·음력, 성별, 시간 모름은 종이 띠지 두 장 .seg > .tag (v3.8 — 쓰기 화면의 기분 띠지와 같은 재료). 윤달은 음력일 때만 띠지 하나. 도시 select도 같은 입력칸 모양.
 * name=·value=·서버 액션·검증 문구는 기능 쪽 그대로. 카드 틀(card-frame card-paper)은 부모(온보딩 페이지)가 두른다.
 * v3.6: 연→월→일→시→분 자동 포커스 이동(자릿수가 차면 다음, 백스페이스로 비면 이전). 시·도 목록은 CITIES 그대로.
 */
export function ProfileForm({ next, initial, serverAction = saveProfileAction, askName = true, submitLabel = "저장" }: ProfileFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(serverAction, { error: null });
  const [gender, setGender] = useState<"male" | "female" | null>(initial?.gender ?? null);
  const [calendar, setCalendar] = useState<"solar" | "lunar">(initial?.calendar ?? "solar");
  const [leap, setLeap] = useState(initial?.isLeapMonth ?? false);
  const [timeUnknown, setTimeUnknown] = useState(initial?.timeUnknown ?? false);
  // 서버 검증이 걸린 묶음(B3). 그 묶음만 오류 표시 — 날짜는 연·월·일 칸, 시각은 시·분 칸, 세그먼트는 먹색 1.5px 테두리
  const field: ProfileField | undefined = state.error ? state.field : undefined;
  const invalidAt = (f: ProfileField) => (field === f ? true : undefined);
  const segClass = (f: ProfileField) => (field === f ? "seg seg--invalid" : "seg");
  /** 그 묶음 바로 아래 danger 한 줄 */
  const errorAt = (f: ProfileField) =>
    field === f ? (
      <p role="alert" className="text-[15px] text-danger">
        {state.error}
      </p>
    ) : null;

  // 자동 이동 (톤 v3.6): 연(4)·월(2)·일(2)·시(2)·분(2) — 자릿수가 차면 다음 칸, 백스페이스로 빈 칸에서 누르면 이전 칸.
  // 값은 건드리지 않는다(name/value 그대로). 시간을 모르면 일 다음 칸은 없다
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const order = [yearRef, monthRef, dayRef, hourRef, minuteRef];
  const digits = [4, 2, 2, 2, 2];
  function advance(i: number) {
    return (e: FormEvent<HTMLInputElement>) => {
      const v = e.currentTarget.value.replace(/\D/g, "");
      if (v.length >= digits[i]) {
        const next = order[i + 1]?.current;
        if (next) {
          next.focus();
          next.select();
        }
      }
    };
  }
  function retreat(i: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Backspace" || e.currentTarget.value !== "") return;
      const prev = order[i - 1]?.current;
      if (!prev) return;
      e.preventDefault();
      prev.focus();
      const n = prev.value.length;
      prev.setSelectionRange?.(n, n);
    };
  }

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

      {askName && (
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className={groupLabel}>
            이름
          </label>
          <input id="name" name="name" defaultValue={initial?.name} maxLength={40} autoComplete="nickname" placeholder="불릴 이름" className="field field--text" aria-invalid={invalidAt("name")} required />
          {errorAt("name")}
        </div>
      )}

      {/* 양력 | 음력 — 음력이면 아래 윤달 체크 한 줄 */}
      <div className="flex flex-col gap-2">
        <span className={groupLabel} id="calendar-label">
          달력
        </span>
        <div className={segClass("calendar")} role="radiogroup" aria-labelledby="calendar-label">
          <SegRadio name="calendar" value="solar" current={calendar} label="양력" onChange={setCalendar} />
          <SegRadio name="calendar" value="lunar" current={calendar} label="음력" onChange={setCalendar} />
        </div>
        {calendar === "lunar" && (
          <label className="seg seg--one">
            <input type="checkbox" name="isLeapMonth" checked={leap} onChange={(e) => setLeap(e.target.checked)} className="peer sr-only" />
            <span className="tag seg__cell">윤달이에요</span>
          </label>
        )}
        {errorAt("calendar")}
      </div>

      {/* 연 · 월 · 일 */}
      <div className="flex flex-col gap-2">
        <span className={groupLabel}>태어난 날 {calendar === "lunar" ? "(음력 그대로)" : ""}</span>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
          <input ref={yearRef} onInput={advance(0)} name="birthYear" inputMode="numeric" maxLength={4} placeholder="1995" defaultValue={initial?.birthYear} aria-label="태어난 해" aria-invalid={invalidAt("date")} className="field" required />
          <input ref={monthRef} onInput={advance(1)} onKeyDown={retreat(1)} name="birthMonth" inputMode="numeric" maxLength={2} placeholder="월" defaultValue={initial?.birthMonth} aria-label="태어난 달" aria-invalid={invalidAt("date")} className="field" required />
          <input ref={dayRef} onInput={advance(2)} onKeyDown={retreat(2)} name="birthDay" inputMode="numeric" maxLength={2} placeholder="일" defaultValue={initial?.birthDay} aria-label="태어난 날" aria-invalid={invalidAt("date")} className="field" required />
        </div>
        {errorAt("date")}
      </div>

      {/* 태어난 시각 — 세그먼트 "알아요 | 몰라요"(체크박스 name=timeUnknown 유지) + 시 · 분 */}
      <div className="flex flex-col gap-2">
        <span className={groupLabel} id="time-label">
          태어난 시각
        </span>
        <input type="checkbox" name="timeUnknown" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} className="sr-only" tabIndex={-1} aria-hidden />
        <div className="seg" role="group" aria-labelledby="time-label">
          <button type="button" aria-pressed={!timeUnknown} onClick={() => setTimeUnknown(false)} className={`tag seg__cell${!timeUnknown ? " tag--on" : ""}`}>
            알아요
          </button>
          <button type="button" aria-pressed={timeUnknown} onClick={() => setTimeUnknown(true)} className={`tag seg__cell${timeUnknown ? " tag--on" : ""}`}>
            몰라요
          </button>
        </div>
        {!timeUnknown && (
          <div className="grid grid-cols-2 gap-2">
            <input ref={hourRef} onInput={advance(3)} onKeyDown={retreat(3)} name="birthHour" inputMode="numeric" maxLength={2} placeholder="시 (0~23)" defaultValue={initial?.birthHour} aria-label="태어난 시" aria-invalid={invalidAt("time")} className="field" />
            <input ref={minuteRef} onKeyDown={retreat(4)} name="birthMinute" inputMode="numeric" maxLength={2} placeholder="분" defaultValue={initial?.birthMinute} aria-label="태어난 분" aria-invalid={invalidAt("time")} className="field" />
          </div>
        )}
        {errorAt("time")}
      </div>

      {/* 태어난 곳 — 같은 입력칸 모양의 select */}
      <div className="flex flex-col gap-2">
        <label htmlFor="city" className={groupLabel}>
          태어난 곳
        </label>
        <span className="relative block">
          <select id="city" name="city" defaultValue={initial?.city ?? "seoul"} aria-invalid={invalidAt("city")} className="field field--select">
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[13px] text-muted">
            ▾
          </span>
        </span>
        {/* 지역은 진태양시 보정에만 쓰인다 (lib/profile.ts computeProfile) — 왜 묻는지 한 줄 */}
        <p className="text-[13px] leading-[1.5] text-muted break-keep">태어난 곳의 경도로 시간을 보정해요. 시간을 모르면 영향이 없어요.</p>
        {errorAt("city")}
      </div>

      {/* 성별 */}
      <div className="flex flex-col gap-2">
        <span className={groupLabel} id="gender-label">
          성별
        </span>
        <div className={segClass("gender")} role="radiogroup" aria-labelledby="gender-label">
          <SegRadio name="gender" value="female" current={gender} label="여성" onChange={setGender} />
          <SegRadio name="gender" value="male" current={gender} label="남성" onChange={setGender} />
        </div>
        {errorAt("gender")}
      </div>

      {/* 묶음을 모르는 오류(저장 실패·준비 중)는 버튼 위 한 줄 */}
      {state.error && !field && (
        <p role="alert" className="-mt-2 text-[15px] text-danger">
          {state.error}
        </p>
      )}

      {/* 금색 면 버튼 — 이 화면에 하나 */}
      <button type="submit" disabled={pending} className="gold-plate h-14 rounded-xl text-[17px] font-bold text-gold-ink disabled:opacity-50">
        {pending ? "계산하는 중…" : submitLabel}
      </button>
    </form>
  );
}
