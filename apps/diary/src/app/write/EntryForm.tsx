"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { saveEntryAction, type FormState } from "@/app/actions";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { AREA_LEVELS, AREAS, MAX_NOTE, MAX_TOMORROW_NOTE, MOOD_PICK, STATE_AXES, areaCount, canonicalMood, isPickMood, moodTone, stateCount, type AreaKey, type Areas, type StateKey, type StateLevel, type States } from "@/lib/entry";
import { track } from "@/lib/analytics";
import { lengthBucket } from "@/lib/analytics/core";

/** 어느 날의 기록인지 — 이용 통계용 (날짜 자체는 보내지 않는다) */
export type WriteWhen = "today" | "last_night" | "past";

interface Props {
  date: string;
  when?: WriteWhen;
  /** "한 줄" 안내 문구. 과거 날짜면 "그날…" (B7). 없으면 오늘 문구 */
  notePlaceholder?: string;
  initial: { happiness: number; areas: Areas | null; states?: States | null; moods: string[]; note: string; tomorrowNote: string } | null;
  /**
   * 저장 버튼을 누르는 순간 미리 받아 둘 그림(팡 조각·카드·틀). 쓰기 화면이 열릴 때 preload하면 기록을 안 쓰고 나가는
   * 사람도 전부 받았다(전체검토 C-P1) — 저장을 누른 뒤 서버 왕복 동안 받으면 팡이 뜰 때쯤 이미 와 있다
   */
  warmAssets?: readonly string[];
}

/** 지난 기록의 기분을 지금 고르기의 이름으로 (행복함 → 기쁨). 묶이지 않는 이름(바쁨·생각 많음·아픔)은 그대로 두고 hidden으로 지킨다 */
const toPick = (ms: readonly string[]): string[] => [...new Set(ms.map(canonicalMood))];

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
 * - 행복도: 1~10 도장 하나(필수). 2026-11-01 사용자 결정 — 영역 평균 × 2로 정하던 것을 되돌렸다(6줄이 다 채워야 하는 것처럼 보였고, 평균이 내 느낌과 어긋났다).
 * - 오늘 있었던 일 (2026-11-14): 하루의 속도 + 십신 다섯 갈래(사람·말·돈·책임·생각)를 세 단계로, 선택. 갈래마다 "더 적기"를 펼치면 세부 낱말.
 *   영역 점수는 평가라 별일 없는 날엔 안 매기게 됐다 — 상태는 묘사라 매일 고를 수 있다. "평범한 하루"는 안 고른 줄을 전부 가운데로 채운다.
 *   같은 단계를 다시 누르면 비운다.
 * - 영역: 여섯 영역 5단계 도장, 선택. 2026-11-14부터 접어 둔다(지난 기록과 영역 통계는 그대로). 같은 도장을 다시 누르면 비운다.
 * - 그래서 마음은: 기분 네 갈래(들뜸·편안·날카로움·가라앉음) 21개, 개수 제한 없음. 저장 이름은 예전 기분 이름 그대로.
 * - 한 줄 메모, 그리고 "내일의 나에게" 쪽지(100자, 다음 날 오늘 화면 위에 펼쳐진다) — "오늘의 포인트" 자리를 대신한다.
 * 폼 필드: happiness=1~10, state_<key>=1~3, state_tags(여러 개), area_<key>=1~5, moods, note, tomorrow_note.
 */
export function EntryForm({ date, when = "today", notePlaceholder, initial, warmAssets = [] }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntryAction, { error: null });
  const [happiness, setHappiness] = useState<number | null>(initial?.happiness ?? null);
  const [areas, setAreas] = useState<Areas>(initial?.areas ?? {});
  const [states, setStates] = useState<States>(initial?.states ?? {});
  const [moods, setMoods] = useState<string[]>(toPick(initial?.moods ?? []));
  const [note, setNote] = useState(initial?.note ?? "");
  const [tomorrowNote, setTomorrowNote] = useState(initial?.tomorrowNote ?? "");
  // 행복도 없이 저장을 누르면 그 자리로 데려가 이유를 보여 준다 (버튼을 막아 두면 눌러도 반응이 없어 저장된 줄 안다)
  const [missingHappiness, setMissingHappiness] = useState(false);
  const happinessRef = useRef<HTMLFieldSetElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    const h = Number(fd.get("happiness"));
    if (h >= 1 && h <= 10) setHappiness((cur) => cur ?? h);
    const picked: Areas = {};
    for (const a of AREAS) {
      const v = Number(fd.get(`area_${a.key}`));
      if (v >= 1 && v <= 5) picked[a.key] = v;
    }
    if (areaCount(picked)) setAreas((cur) => (areaCount(cur) ? cur : picked));
    const st: States = {};
    for (const a of STATE_AXES) {
      const v = Number(fd.get(`state_${a.key}`));
      if (v >= 1 && v <= 3) st[a.key] = v as StateLevel;
    }
    const tags = fd.getAll("state_tags").filter((t): t is string => typeof t === "string");
    if (tags.length) st.tags = tags;
    if (stateCount(st) || tags.length) setStates((cur) => (stateCount(cur) || cur.tags?.length ? cur : st));
    const ms = fd.getAll("moods").filter((m): m is string => typeof m === "string");
    if (ms.length) setMoods((cur) => (cur.length ? cur : ms));
    const n = fd.get("note");
    if (typeof n === "string" && n) setNote((cur) => cur || n);
    const t = fd.get("tomorrow_note");
    if (typeof t === "string" && t) setTomorrowNote((cur) => cur || t);
  }, []);

  function pickHappiness(n: number) {
    setMissingHappiness(false);
    setHappiness(n);
  }

  function pickArea(key: AreaKey, level: number) {
    // 같은 도장을 다시 누르면 비운다 — 오늘 해당 없는 영역
    setAreas((cur) => {
      const next = { ...cur };
      if (next[key] === level) delete next[key];
      else next[key] = level;
      return next;
    });
  }

  function pickState(key: StateKey, level: StateLevel) {
    // 같은 단계를 다시 누르면 비운다
    setStates((cur) => {
      const next = { ...cur };
      if (next[key] === level) delete next[key];
      else next[key] = level;
      return next;
    });
  }

  function toggleStateTag(tag: string) {
    setStates((cur) => {
      const tags = cur.tags ?? [];
      const nextTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
      const next = { ...cur };
      if (nextTags.length) next.tags = nextTags;
      else delete next.tags;
      return next;
    });
  }

  /** 평범한 하루: 아직 안 고른 줄을 전부 가운데(보통)로 */
  function fillPlain() {
    setStates((cur) => {
      const next = { ...cur };
      for (const a of STATE_AXES) if (typeof next[a.key] !== "number") next[a.key] = 2;
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
      track("diary_save_blocked", { reason: "happiness", when });
      setMissingHappiness(true);
      happinessRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      happinessRef.current?.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    const data = new FormData(e.currentTarget);
    track("diary_save", {
      when,
      edit: Boolean(initial),
      happiness,
      areas_count: areaCount(areas),
      states_count: stateCount(states),
      state_tags_count: states.tags?.length ?? 0,
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
  const stCount = stateCount(states);
  const stateTags = states.tags ?? [];

  return (
    <>
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="entryDate" value={date} />

      {/* 카드 종이 한 장 */}
      <div className="card-frame card-paper flex flex-col gap-7 p-5">
        <fieldset ref={happinessRef} className="entry-happy">
          <legend className="text-[17px] font-bold">행복도</legend>
          <p className={`entry-areas__total mt-1 text-sm ${missingHappiness && happiness === null ? "font-bold text-danger" : "text-muted"}`} aria-live="polite">
            {happiness !== null
              ? (
                // 도장을 누를 때마다 숫자가 "팡" — key가 바뀌면 .entry-areas__score[data-pop] 애니메이션이 한 번 돈다 (명세 31 6절)
                <span className="entry-areas__sum">
                  <span key={happiness} className="entry-areas__score" data-pop="">
                    {happiness}
                  </span>
                  <span className="entry-areas__hint">점, {hint(happiness)}</span>
                </span>
              )
              : missingHappiness
                ? "행복도를 먼저 골라 주세요"
                : "1부터 10까지, 도장 하나"}
          </p>
          {/* 2026-10-31 사용자 Q3: 행복도를 분홍 막대로 — 10점 기준으로 차오른다(--h 0~1). 모양은 디자이너(.happy-bar) */}
          {happiness !== null && (
            <span className="happy-bar mt-2" role="meter" aria-label="행복도" aria-valuemin={0} aria-valuemax={10} aria-valuenow={happiness} style={{ "--h": happiness / 10 } as React.CSSProperties}>
              <span className="happy-bar__fill" />
            </span>
          )}
          {/* 도장 열 10개 — 375px에서 5 × 2줄(카드 안쪽 267px → 도장 약 47px, 손가락 자리 40px 이상). 10개 한 줄이면 23px이라 두 줄 (명세 34) */}
          <div className="entry-happy__stamps mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const on = happiness === n;
              return (
                <label key={n} className="relative">
                  <input type="radio" name="happiness" value={n} checked={on} onChange={() => pickHappiness(n)} aria-label={`${n}점`} className="peer sr-only" />
                  {/* 찍힘은 CSS `input:checked +`가 바로 그린다 (하이드레이션 전 첫 탭). 단계 면은 data-level(1~3 남색 · 4~5 종이 · 6~7 금빛 · 8~10 moss — 달력 v3.22 네 단계와 같은 기준) */}
                  <span
                    data-level={n}
                    className={`stamp entry-happy__stamp flex aspect-square cursor-pointer items-center justify-center font-serif peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${on ? "stamp--on" : ""}`}
                  >
                    {n}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* 오늘 있었던 일 (2026-11-14, 명세 37 · 톤 v3.41): 하루의 속도 + 십신 다섯 갈래. 줄마다 세 단계 라디오(state_<key>), 갈래 줄은 "더 적기"를 펼치면 세부 낱말(state_tags).
            한 줄 = 이름 열 52px + 세 단계 띠지 세 열(줄마다 같은 세로선). "더 적기"는 이름 아래 작은 글자 — 이름 칸 전체가 손가락 자리. 모양은 globals.css v3.41 블록 */}
        <fieldset className="entry-states">
          <legend className="entry-states__legend">
            <span className="entry-states__title">오늘 있었던 일</span>
            <span className="entry-states__note">
              별일 없으면 안 골라도 돼요 {stCount > 0 && <span className="text-ganji">({stCount})</span>}
            </span>
          </legend>
          <button type="button" className="entry-states__plain" onClick={fillPlain} disabled={stCount === STATE_AXES.length}>
            평범한 하루
          </button>
          <div className="entry-states__rows">
            {STATE_AXES.map((a) => {
              const picked = a.tags.filter((t) => stateTags.includes(t.key)).length;
              return (
                <div key={a.key} className="entry-state" data-axis={a.key} data-group={a.group ?? undefined}>
                  <div className="entry-state__main" role="radiogroup" aria-label={a.label}>
                    <span className="entry-state__label">{a.label}</span>
                    <div className="entry-state__levels">
                      {a.levels.map((word, i) => {
                        const level = (i + 1) as StateLevel;
                        const on = states[a.key] === level;
                        return (
                          <label key={level} className="entry-state__level">
                            <input
                              type="radio"
                              name={`state_${a.key}`}
                              value={level}
                              checked={on}
                              onChange={() => pickState(a.key, level)}
                              onClick={() => {
                                // 이미 고른 단계를 누르면 change가 안 난다 — 여기서 비운다
                                if (on) pickState(a.key, level);
                              }}
                              className="peer sr-only"
                            />
                            <span data-level={level} className={`tag state-tag cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${on ? "tag--on" : ""}`}>
                              {word}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {a.tags.length > 0 && (
                    <details className="entry-state__more" open={picked > 0 || undefined}>
                      <summary className="entry-state__more-head">
                        <span className="entry-state__more-word">더 적기</span> {picked > 0 && <span className="entry-state__more-n text-ganji">({picked})</span>}
                      </summary>
                      <div className="entry-state__tags">
                        {a.tags.map((t) => {
                          const on = stateTags.includes(t.key);
                          return (
                            <label key={t.key} className="entry-state__tag">
                              <input type="checkbox" name="state_tags" value={t.key} checked={on} onChange={() => toggleStateTag(t.key)} className="peer sr-only" />
                              <span className={`tag state-tag state-tag--detail cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${on ? "tag--on" : ""}`}>{t.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* 그래서 마음은 (2026-11-14, 명세 37): 기분 네 갈래 21개. value는 예전 기분 이름 그대로(name), 화면 말은 label */}
        {/* 무리 = 이름 열(상태 줄과 같은 52px 세로선) + 오른쪽 띠지 — 무리 이름이 띠지와 섞이지 않는다 (톤 v3.41) */}
        <fieldset className="entry-moods">
          <legend className="entry-moods__legend">
            <span className="entry-moods__title">그래서 마음은</span>
            <span className="entry-moods__note">
              몇 개든, 안 골라도 돼요 {moods.length > 0 && <span className="text-ganji">({moods.length})</span>}
            </span>
          </legend>
          <div className="entry-moods__groups">
            {MOOD_PICK.map((sec) => (
              <div key={sec.key} className="entry-moods__group" data-group={sec.key}>
                <p className="entry-moods__head">{sec.label}</p>
                <div className="entry-moods__tags">
                  {sec.moods.map((m) => {
                    const on = moods.includes(m.name);
                    return (
                      <label key={m.name}>
                        <input type="checkbox" name="moods" value={m.name} checked={on} onChange={() => toggleMood(m.name)} className="peer sr-only" />
                        <span
                          data-tone={moodTone(m.name)}
                          className={`tag mood-tag h-9 cursor-pointer text-[14px] peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${
                            on ? "tag--on font-bold text-paper-2" : "text-ink"
                          }`}
                        >
                          {m.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* 지난 기록의 기분 가운데 지금 고르기에 없는 것(바쁨·생각 많음·아픔, 목록 밖)은 잃지 않게 그대로 보낸다 */}
          {moods
            .filter((m) => !isPickMood(m))
            .map((m) => (
              <input key={m} type="hidden" name="moods" value={m} />
            ))}
        </fieldset>

        {/* 영역 점수는 접어 둔다 (2026-11-14): 좋았거나 힘들었던 날에만 펼쳐 매긴다. 지난 기록에 영역이 있으면 펼친 채로 */}
        <details className="entry-areas-fold" open={count > 0 || undefined}>
          <summary className="entry-areas-fold__head">
            <span className="entry-areas-fold__title">영역 점수</span>{" "}
            <span className="entry-areas__note">좋았거나 힘들었던 영역만 {count > 0 && <span className="text-ganji">({count})</span>}</span>
          </summary>
          {/* 영역은 선택 중의 선택 — 접힌 한 줄이 머리다(톤 v3.41). 펼친 안쪽의 legend는 같은 말이라 보조 기술에만 남긴다. 여섯 줄·도장·양 끝 글은 v3.32·v3.38 그대로 */}
          <fieldset className="entry-areas">
            <legend className="sr-only">
              영역
              <span>
                오늘 있었던 것만, 안 골라도 돼요 {count > 0 && <span>({count})</span>}
              </span>
            </legend>
            <div className="entry-areas__rows flex flex-col gap-2">
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
        </details>

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
