"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { saveEntryAction, type FormState } from "@/app/actions";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { AREA_LEVELS, AREAS, MAX_NOTE, MAX_TOMORROW_NOTE, MOOD_GROUPS, MOODS, areaCount, happinessFromAreas, moodTone, type AreaKey, type Areas } from "@/lib/entry";
import { track } from "@/lib/analytics";
import { lengthBucket } from "@/lib/analytics/core";

/** 어느 날의 기록인지 — 이용 통계용 (날짜 자체는 보내지 않는다) */
export type WriteWhen = "today" | "last_night" | "past";

interface Props {
  date: string;
  when?: WriteWhen;
  /** "한 줄" 안내 문구. 과거 날짜면 "그날…" (B7). 없으면 오늘 문구 */
  notePlaceholder?: string;
  initial: { happiness: number; areas: Areas | null; moods: string[]; note: string; tomorrowNote: string } | null;
  /**
   * 저장 버튼을 누르는 순간 미리 받아 둘 그림(팡 조각·카드·틀). 쓰기 화면이 열릴 때 preload하면 기록을 안 쓰고 나가는
   * 사람도 전부 받았다(전체검토 C-P1) — 저장을 누른 뒤 서버 왕복 동안 받으면 팡이 뜰 때쯤 이미 와 있다
   */
  warmAssets?: readonly string[];
}

const MOOD_SECTIONS: { tone: keyof typeof MOOD_GROUPS; label: string }[] = [
  { tone: "pos", label: "좋았어요" },
  { tone: "neutral", label: "그저 그래요" },
  { tone: "neg", label: "아쉬웠어요" },
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
 * 쓰기 폼 — 일기장 페이지 한 장 (톤 v3, 2026-10-31 개편).
 * - 행복도: 여섯 영역(일·공부/돈/건강/가족/연애/대인관계)을 5단계 도장으로, 매긴 영역만. 하루 행복도 = 평균 × 2 (서버가 같은 식으로 다시 계산).
 *   같은 도장을 다시 누르면 비운다. 영역이 없는 이전 기록을 고칠 땐 영역을 안 건드리면 그 행복도를 그대로 둔다(hidden happiness).
 * - 기분: 좋았어요 / 그저 그래요 / 아쉬웠어요 세 무리, 개수 제한 없음.
 * - 한 줄 메모, 그리고 "내일의 나에게" 쪽지(100자, 다음 날 오늘 화면 위에 펼쳐진다) — "오늘의 포인트" 자리를 대신한다.
 * 폼 필드: area_<key>=1~5, moods, note, tomorrow_note, (이전 기록이면) happiness.
 */
export function EntryForm({ date, when = "today", notePlaceholder, initial, warmAssets = [] }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntryAction, { error: null });
  const [areas, setAreas] = useState<Areas>(initial?.areas ?? {});
  const [moods, setMoods] = useState<string[]>(initial?.moods ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [tomorrowNote, setTomorrowNote] = useState(initial?.tomorrowNote ?? "");
  // 영역 없이 저장을 누르면 그 자리로 데려가 이유를 보여 준다 (버튼을 막아 두면 눌러도 반응이 없어 저장된 줄 안다)
  const [missingAreas, setMissingAreas] = useState(false);
  const areasRef = useRef<HTMLFieldSetElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 이전 방식 기록(영역 없음)을 고칠 때: 영역을 하나도 안 매기면 그 행복도를 그대로 둔다
  const legacyHappiness = initial && areaCount(initial.areas) === 0 ? initial.happiness : null;
  const fromAreas = happinessFromAreas(areas);
  const happiness = fromAreas ?? legacyHappiness;

  // 이용 통계 (측정.md): 열림 한 번, 저장 시도·막힘·오류. 본문·날짜는 보내지 않는다
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("diary_write_open", { when, edit: Boolean(initial) });
  }, [when, initial]);
  useEffect(() => {
    if (state.error) track("diary_save_error", { when });
  }, [state, when]);

  // 하이드레이션 전에 누른 값을 잃지 않는다 (2026-10-08 진단: 폰에서 JS가 붙기 전 첫 탭은 native 입력만 바뀌고
  // React 상태는 비어 "첫 클릭이 안 먹은" 것처럼 보였다). 그림은 CSS `input:checked +`가 바로 그리고, 여기서 DOM 값을 상태로 끌어온다.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const picked: Areas = {};
    for (const a of AREAS) {
      const v = Number(fd.get(`area_${a.key}`));
      if (v >= 1 && v <= 5) picked[a.key] = v;
    }
    if (areaCount(picked)) setAreas((cur) => (areaCount(cur) ? cur : picked));
    const ms = fd.getAll("moods").filter((m): m is string => typeof m === "string");
    if (ms.length) setMoods((cur) => (cur.length ? cur : ms));
    const n = fd.get("note");
    if (typeof n === "string" && n) setNote((cur) => cur || n);
    const t = fd.get("tomorrow_note");
    if (typeof t === "string" && t) setTomorrowNote((cur) => cur || t);
  }, []);

  function pickArea(key: AreaKey, level: number) {
    setMissingAreas(false);
    // 같은 도장을 다시 누르면 비운다 — 오늘 해당 없는 영역
    setAreas((cur) => {
      const next = { ...cur };
      if (next[key] === level) delete next[key];
      else next[key] = level;
      return next;
    });
  }

  function toggleMood(m: string) {
    setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  // form action 대신 onSubmit으로 보낸다. React 19는 action 폼을 제출 뒤 비우는데,
  // 서버에서 오류가 났을 때 적은 내용이 사라지면 안 된다.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (happiness === null) {
      track("diary_save_blocked", { reason: "areas", when });
      setMissingAreas(true);
      areasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      areasRef.current?.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    const data = new FormData(e.currentTarget);
    track("diary_save", {
      when,
      edit: Boolean(initial),
      happiness,
      areas_count: areaCount(areas),
      mood: moods[0] ?? null,
      moods_count: moods.length,
      length_bucket: lengthBucket(note.trim().length),
      tomorrow_note: tomorrowNote.trim().length > 0,
    });
    // 팡 그림은 지금부터 받는다 — 서버 저장 왕복(수백 ms)이 끝나면 대개 도착해 있다
    for (const src of warmAssets) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
    startTransition(() => action(data));
  }

  const count = areaCount(areas);
  /** 매긴 영역 단계(영역 순서대로) — 평균 계산 줄 */
  const areaValues = AREAS.map((a) => areas[a.key]).filter((v): v is number => typeof v === "number");

  return (
    <>
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="entryDate" value={date} />
      {/* 영역을 안 매긴 이전 기록: 그 행복도를 그대로 */}
      {fromAreas === null && legacyHappiness !== null && <input type="hidden" name="happiness" value={legacyHappiness} />}

      {/* 카드 종이 한 장 */}
      <div className="card-frame card-paper flex flex-col gap-7 p-5">
        <fieldset ref={areasRef} className="entry-areas">
          <legend className="text-[17px] font-bold">행복도</legend>
          <p className={`entry-areas__total mt-1 text-sm ${missingAreas && happiness === null ? "font-bold text-danger" : "text-muted"}`} aria-live="polite">
            {fromAreas !== null
              ? (
                <>
                  {/* 2026-10-31 사용자: 도장을 누를 때마다 행복도가 "팡" 하며 바뀌고, 평균 계산이 그 자리에서 보인다.
                      key가 바뀌면 다시 그려져 .entry-areas__score[data-pop] 애니메이션이 한 번 돈다 (모양은 디자이너, 명세 31 6절).
                      v3.33: 숫자 송명 32px 먹색이 이 카드의 주인공 — "N점, 말"은 한 묶음(.entry-areas__sum), 계산 줄은 옆 또는 아래 줄 */}
                  <span className="entry-areas__sum">
                    <span key={`${fromAreas}-${count}`} className="entry-areas__score" data-pop="">
                      {fromAreas}
                    </span>
                    <span className="entry-areas__hint">점, {hint(fromAreas)}</span>
                  </span>
                  <span className="entry-areas__calc" aria-hidden>
                    ({areaValues.join(" + ")}) ÷ {count} = {(areaValues.reduce((x, y) => x + y, 0) / count).toFixed(1)}, × 2
                  </span>
                </>
              )
              : legacyHappiness !== null
                ? `예전 기록 ${legacyHappiness}점 — 영역을 고르면 평균으로 바뀌어요`
                : missingAreas
                  ? "영역을 하나 이상 골라 주세요"
                  : "오늘 있었던 영역만, 도장 하나씩"}
          </p>
          {/* 2026-10-31 사용자 Q3: 행복도를 분홍 막대로 — 10점 기준으로 차오른다(--h 0~1). 모양은 디자이너(.happy-bar) */}
          {happiness !== null && (
            <span className="happy-bar mt-2" role="meter" aria-label="행복도" aria-valuemin={0} aria-valuemax={10} aria-valuenow={happiness} style={{ "--h": happiness / 10 } as React.CSSProperties}>
              <span className="happy-bar__fill" />
            </span>
          )}
          <div className="entry-areas__rows mt-3 flex flex-col gap-2">
            {AREAS.map((a) => (
              <div key={a.key} className="entry-area" role="radiogroup" aria-label={a.label}>
                <span className="entry-area__label">{a.label}</span>
                <div className="entry-area__stamps">
                  {AREA_LEVELS.map((word, i) => {
                    const level = i + 1;
                    const on = areas[a.key] === level;
                    return (
                      <label key={level} className="relative">
                        <input
                          type="radio"
                          name={`area_${a.key}`}
                          value={level}
                          checked={on}
                          onChange={() => pickArea(a.key, level)}
                          onClick={() => {
                            // 이미 고른 도장을 누르면 change가 안 난다 — 여기서 비운다
                            if (on) pickArea(a.key, level);
                          }}
                          aria-label={`${a.label} ${word}`}
                          className="peer sr-only"
                        />
                        {/* 단계 색은 data-level(1~2 남색 · 3 종이 · 4~5 금빛, 달력 네 단계와 같은 계열). 찍힘은 CSS `input:checked +`가 바로 그린다 */}
                        <span
                          data-level={level}
                          className={`stamp entry-stamp flex aspect-square cursor-pointer items-center justify-center font-serif peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${
                            on ? "stamp--on" : ""
                          }`}
                        >
                          {level}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="entry-areas__ends mt-2 flex justify-between text-[12px] text-muted" aria-hidden>
            <span>{AREA_LEVELS[0]}</span>
            <span>{AREA_LEVELS[4]}</span>
          </p>
        </fieldset>

        <fieldset className="entry-moods">
          <legend className="text-[17px] font-bold">기분</legend>
          <p className="mt-1 text-sm text-muted">
            몇 개든, 안 골라도 돼요 {moods.length > 0 && <span className="text-ganji">({moods.length})</span>}
          </p>
          {MOOD_SECTIONS.map((sec) => (
            <div key={sec.tone} className="entry-moods__group mt-4" data-tone={sec.tone}>
              <p className="entry-moods__head text-[13px] font-bold text-muted">{sec.label}</p>
              <div className="entry-moods__tags mt-2 flex flex-wrap gap-1.5">
                {MOOD_GROUPS[sec.tone].map((m) => {
                  const on = moods.includes(m);
                  return (
                    <label key={m}>
                      <input type="checkbox" name="moods" value={m} checked={on} onChange={() => toggleMood(m)} className="peer sr-only" />
                      <span
                        data-tone={moodTone(m)}
                        className={`tag mood-tag h-9 cursor-pointer text-[14px] peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${
                          on ? "tag--on font-bold text-paper-2" : "text-ink"
                        }`}
                      >
                        {m}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {/* 지난 기록에 목록 밖 기분이 있으면(없어야 하지만) 잃지 않게 */}
          {moods
            .filter((m) => !(MOODS as readonly string[]).includes(m))
            .map((m) => (
              <input key={m} type="hidden" name="moods" value={m} />
            ))}
        </fieldset>

        <div>
          <label htmlFor="note" className="text-[17px] font-bold">
            한 줄
          </label>
          {/* 편지지 괘선 위에 손글씨. 안내 문구(placeholder)는 앱 글이라 본문 서체 */}
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notePlaceholder ?? "오늘 기억하고 싶은 일 하나"}
            className="ruled mt-2 w-full resize-none bg-transparent px-1 font-hand text-[17px] break-keep text-ink placeholder:font-sans placeholder:text-[16px] placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* 내일의 나에게 (2026-10-31, "오늘의 포인트" 자리): 쪽지(키트 note-slip) 한 장. 다음 날 오늘 화면 위에 펼쳐진다 */}
        <div className="note-slip entry-tomorrow">
          <label htmlFor="tomorrow_note" className="note-slip__label">
            내일의 나에게 <span className="note-slip__sub">내일 아침 오늘 화면에 펼쳐져요</span>
          </label>
          <textarea
            id="tomorrow_note"
            name="tomorrow_note"
            rows={2}
            maxLength={MAX_TOMORROW_NOTE}
            value={tomorrowNote}
            onChange={(e) => setTomorrowNote(e.target.value)}
            placeholder="내일의 나에게 한마디"
            className="note-slip__text mt-1 w-full resize-none bg-transparent font-hand text-[17px] break-keep text-ink placeholder:font-sans placeholder:text-[15px] placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-ink"
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
    {/* 고치기 모드에서만: 두 번 눌러 지우기 (actions.ts deleteEntryAction) */}
    {initial && <DeleteEntryButton date={date} />}
    </>
  );
}
