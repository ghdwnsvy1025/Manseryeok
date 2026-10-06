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

/** 양식지 칸 위 작은 라벨 */
const cellLabel = "text-[12px] leading-none text-muted";
/** 띠지 고르기 — 안 고름: 한지 띠 + 보조색 글자 / 고름: 남색 띠 + 한지색 글자 */
const tagOff = "tag h-9 cursor-pointer px-1 text-[15px] text-muted";
const tagOn = "tag tag--on h-9 cursor-pointer px-1 text-[15px] font-bold text-paper-2";

/** 띠지로 고르는 라디오 — 고른 띠지만 남색으로 물든다 */
function TagRadio<T extends string>({
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
    <label className="inline-flex">
      <input type="radio" name={name} value={value} checked={on} onChange={() => onChange(value)} className="peer sr-only" />
      <span className={`${on ? tagOn : tagOff} peer-focus-visible:outline-2 peer-focus-visible:outline-gold`}>{label}</span>
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
 * 생년월일 입력 = 호적 서류 (톤 v3.2). 키트 form-sheet 양식지 위에 괘선 칸마다 숫자(Song Myung 22px).
 * 칸은 globals.css의 .form-sheet__rows 격자로 양식지 행에 맞춘다 — 절대 위치 없음.
 * 양식지 행 순서: 양력/음력(반) · 이름 또는 "태어난 날"(한 칸) · 연월일(삼분) · 시각·몰라요(한 칸) · 시분(반) · 태어난 곳(낮은 칸) · 성별(삼분).
 * name=·value=·서버 액션·검증 문구는 기능 쪽 그대로.
 */
export function ProfileForm({ next, initial, serverAction = saveProfileAction, askName = true, submitLabel = "저장" }: ProfileFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(serverAction, { error: null });
  const [gender, setGender] = useState<"male" | "female" | null>(initial?.gender ?? null);
  const [calendar, setCalendar] = useState<"solar" | "lunar">(initial?.calendar ?? "solar");
  const [leap, setLeap] = useState(initial?.isLeapMonth ?? false);
  const [timeUnknown, setTimeUnknown] = useState(initial?.timeUnknown ?? false);

  // form action 대신 onSubmit으로 보낸다. React 19는 action 폼을 제출 뒤 비우는데,
  // 서버에서 오류가 났을 때 적은 내용이 사라지면 안 된다.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <div className="form-sheet">
        <div className="form-sheet__rows">
          {/* 1. 양력 | 음력 (음력이면 윤달 띠지가 옆에) */}
          <div className="form-sheet__row form-sheet__row--half" role="radiogroup" aria-label="달력">
            <div className="form-sheet__cell form-sheet__cell--row">
              <span className={cellLabel}>달력</span>
              <TagRadio name="calendar" value="solar" current={calendar} label="양력" onChange={setCalendar} />
            </div>
            <div className="form-sheet__cell form-sheet__cell--row">
              <TagRadio name="calendar" value="lunar" current={calendar} label="음력" onChange={setCalendar} />
              {calendar === "lunar" && (
                <label className="inline-flex">
                  <input type="checkbox" name="isLeapMonth" checked={leap} onChange={(e) => setLeap(e.target.checked)} className="peer sr-only" />
                  <span className={`${leap ? tagOn : tagOff} peer-focus-visible:outline-2 peer-focus-visible:outline-gold`}>윤달</span>
                </label>
              )}
            </div>
          </div>

          {/* 2. 이름(Google 사용자) 또는 "태어난 날" 머리 칸 */}
          <div className="form-sheet__row">
            {askName ? (
              <div className="form-sheet__cell form-sheet__cell--row">
                <label htmlFor="name" className={`${cellLabel} shrink-0`}>
                  이름
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={initial?.name}
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="불릴 이름"
                  className="form-sheet__input form-sheet__input--right"
                  required
                />
              </div>
            ) : (
              <div className="form-sheet__cell form-sheet__cell--row">
                <span className="font-serif text-[17px] text-ink">태어난 날</span>
                <span className="text-[13px] text-muted">{calendar === "lunar" ? "음력 날짜 그대로" : "양력 날짜 그대로"}</span>
              </div>
            )}
          </div>

          {/* 3. 연 | 월 | 일 */}
          <div className="form-sheet__row form-sheet__row--third">
            <div className="form-sheet__cell">
              <span className={cellLabel}>태어난 해</span>
              <input name="birthYear" inputMode="numeric" maxLength={4} placeholder="1995" defaultValue={initial?.birthYear} aria-label="태어난 해" className="form-sheet__input" required />
            </div>
            <div className="form-sheet__cell">
              <span className={cellLabel}>달</span>
              <input name="birthMonth" inputMode="numeric" maxLength={2} placeholder="월" defaultValue={initial?.birthMonth} aria-label="태어난 달" className="form-sheet__input" required />
            </div>
            <div className="form-sheet__cell">
              <span className={cellLabel}>날</span>
              <input name="birthDay" inputMode="numeric" maxLength={2} placeholder="일" defaultValue={initial?.birthDay} aria-label="태어난 날" className="form-sheet__input" required />
            </div>
          </div>

          {/* 4. 태어난 시각 머리 칸 + 시간을 몰라요 띠지 */}
          <div className="form-sheet__row">
            <div className="form-sheet__cell form-sheet__cell--row">
              <span className="font-serif text-[17px] text-ink">태어난 시각</span>
              <label className="inline-flex">
                <input
                  type="checkbox"
                  name="timeUnknown"
                  checked={timeUnknown}
                  onChange={(e) => setTimeUnknown(e.target.checked)}
                  className="peer sr-only"
                />
                <span className={`${timeUnknown ? tagOn : tagOff} peer-focus-visible:outline-2 peer-focus-visible:outline-gold`}>시간을 몰라요</span>
              </label>
            </div>
          </div>

          {/* 5. 시 | 분 — 몰라요를 고르면 칸은 그대로 두고 비운다 (양식지 행이 흔들리지 않게) */}
          <div className="form-sheet__row form-sheet__row--half">
            <div className="form-sheet__cell">
              <span className={cellLabel}>시 (0~23)</span>
              {timeUnknown ? (
                <span aria-hidden className="h-10 text-center font-serif text-[22px] leading-10 text-faint">
                  —
                </span>
              ) : (
                <input name="birthHour" inputMode="numeric" maxLength={2} placeholder="시" defaultValue={initial?.birthHour} aria-label="태어난 시" className="form-sheet__input" />
              )}
            </div>
            <div className="form-sheet__cell">
              <span className={cellLabel}>분</span>
              {timeUnknown ? (
                <span aria-hidden className="h-10 text-center font-serif text-[22px] leading-10 text-faint">
                  —
                </span>
              ) : (
                <input name="birthMinute" inputMode="numeric" maxLength={2} placeholder="분" defaultValue={initial?.birthMinute} aria-label="태어난 분" className="form-sheet__input" />
              )}
            </div>
          </div>

          {/* 6. 태어난 곳 (낮은 칸) */}
          <div className="form-sheet__row">
            <div className="form-sheet__cell form-sheet__cell--row">
              <label htmlFor="city" className="font-serif text-[17px] text-ink">
                태어난 곳
              </label>
              <span className="relative inline-flex items-center">
                <select id="city" name="city" defaultValue={initial?.city ?? "seoul"} className="form-sheet__select">
                  {CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span aria-hidden className="pointer-events-none absolute right-0 text-[13px] text-muted">
                  ▾
                </span>
              </span>
            </div>
          </div>

          {/* 7. 성별 | 여성 | 남성 */}
          <div className="form-sheet__row form-sheet__row--third" role="radiogroup" aria-label="성별">
            <div className="form-sheet__cell">
              <span className="font-serif text-[17px] text-ink">성별</span>
            </div>
            <div className="form-sheet__cell items-center">
              <TagRadio name="gender" value="female" current={gender} label="여성" onChange={setGender} />
            </div>
            <div className="form-sheet__cell items-center">
              <TagRadio name="gender" value="male" current={gender} label="남성" onChange={setGender} />
            </div>
          </div>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-[15px] text-danger">
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
