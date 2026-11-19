"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Sheet, openSheet } from "@/components/Sheet";
import { openDay, type DayRecord } from "@/components/DaySheet";
import { happinessTier, moodTone } from "@/lib/entry";
import type { GlyphState } from "@/lib/stats/states";

/**
 * 글자 낱장 (명세 52, 톤 v3.56). 앱 주인: "각각의 칸을 누르면 오늘 있었던 일들의 각 영역마다 평균 값이나 상태를 볼 수 있게".
 * "글자별 내 행복도"의 막대 한 칸(천간 열 · 지지 열둘 · 오행 다섯)을 누르면 뜬다. 제목 "갑이 든 날" / "목의 날".
 * 머리 = 평균 행복도 도장(달력 칸과 같은 단계 색) + "N일 기록". 그 아래 "그날 있었던 일" 여섯 줄 —
 *   축 이름 | 세 칸 자(왼쪽 끝 말 — 가운데 — 오른쪽 끝 말) 위에 평균 자리 표식 하나 | N일, 그 아래 한마디("돈 많이 나감").
 *   이 자는 "어느 쪽이었나"이지 좋고 나쁨이 아니다 — 표식은 먹색 하나, 옥색 · 주홍 · 행복도 단계 색을 쓰지 않는다.
 *   고른 날이 2일 미만인 줄은 표식 없이 옅게 + "아직 몰라요".
 * 자주 고른 낱말은 테 띠. 맨 아래 "이 글자가 든 날 보기"를 펼치면 그 날 목록(전체 목록과 같은 줄, 처음 20줄 + 더 보기) → 줄을 누르면 날짜 낱장.
 * 낱장 틀은 Sheet 그대로(닫으면 누른 칸으로 포커스가 돌아간다).
 */
const SHEET_ID = "sheet-glyph";
const OPEN_GLYPH = "glyph:open";
const PAGE = 20;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** 그날 천간의 오행 — 막대(byElement)와 같은 기준 */
const STEM_EL: Record<string, string> = { 갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토", 경: "금", 신: "금", 임: "수", 계: "수" };

export function openGlyph(id: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_GLYPH, { detail: id }));
}

export interface GlyphInfo {
  /** "stem:갑" · "branch:자" · "element:목" — glyphStates의 열쇠와 같다 */
  id: string;
  kind: "stem" | "branch" | "element";
  /** 읽는 이름 한 글자: 갑 · 자 · 목 */
  name: string;
  /** 기록한 날 수 */
  n: number;
  /** 평균 행복도 */
  mean: number | null;
}

const batchim = (s: string): boolean => {
  const code = s.charCodeAt(s.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};
const dowOf = (date: string): string => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

export function GlyphSheet({ glyphs, states, records, today }: { glyphs: GlyphInfo[]; states: Record<string, GlyphState>; /** 전체 기록(최근 것부터, 최대 400) — 그 글자가 든 날을 여기서 고른다 */ records: DayRecord[]; today: string }) {
  const [id, setId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [daysOpen, setDaysOpen] = useState(false);

  const show = useCallback(
    (next: string) => {
      const dialog = document.getElementById(SHEET_ID) as HTMLDialogElement | null;
      if (!dialog || !glyphs.some((g) => g.id === next)) return;
      setId(next);
      setShown(PAGE);
      setDaysOpen(false);
      dialog.querySelector<HTMLElement>(".sheet__body")?.scrollTo(0, 0);
      if (!dialog.open) {
        document.querySelectorAll<HTMLDialogElement>("dialog.sheet[open]").forEach((o) => o !== dialog && o.close());
        openSheet(SHEET_ID);
      }
    },
    [glyphs],
  );

  useEffect(() => {
    const on = (e: Event) => show((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_GLYPH, on);
    return () => window.removeEventListener(OPEN_GLYPH, on);
  }, [show]);

  const glyph = id ? glyphs.find((g) => g.id === id) : undefined;
  const state = id ? states[id] : undefined;
  const days = useMemo(() => {
    if (!glyph) return [];
    return records.filter((r) => (glyph.kind === "stem" ? r.ganjiKo[0] === glyph.name : glyph.kind === "branch" ? r.ganjiKo[1] === glyph.name : STEM_EL[r.ganjiKo[0] ?? ""] === glyph.name));
  }, [glyph, records]);
  const title = glyph ? (glyph.kind === "element" ? `${glyph.name}의 날` : `${glyph.name}${batchim(glyph.name) ? "이" : "가"} 든 날`) : "글자";
  const label = (date: string) => `${date.slice(0, 4) === today.slice(0, 4) ? "" : `${Number(date.slice(0, 4))}년 `}${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

  return (
    <Sheet id={SHEET_ID} name="glyph" title={title}>
      {glyph &&
        (glyph.n === 0 ? (
          <p className="glyph-sheet__none">아직 이 글자가 든 날의 기록이 없어요</p>
        ) : (
          <div className="glyph-sheet">
            <p className="glyph-sheet__head">
              <span className="glyph-sheet__stamp" data-tier={glyph.mean === null ? undefined : happinessTier(glyph.mean)} role="img" aria-label={`평균 행복도 ${glyph.mean}`}>
                {glyph.mean}
              </span>
              <span className="glyph-sheet__count">
                <small>평균 행복도</small>
                {glyph.n}일 기록
              </span>
            </p>
            <section className="glyph-sheet__states" aria-label="그날 있었던 일">
              <h3 className="saju-h">그날 있었던 일</h3>
              {state ? (
                <>
                  <p className="saju-fine">있었던 일을 고른 {state.days}일의 평균이에요</p>
                  <ol className="ruler-rows">
                    {state.rows.map((r) => {
                      const known = r.lean !== null && r.mean !== null;
                      return (
                        <li key={r.axis} className="ruler-row" data-thin={known ? undefined : ""} data-lean={r.lean ?? undefined} aria-label={known ? `${r.label}: ${r.word}, ${r.n}일` : `${r.label}: ${r.n === 1 ? "1일뿐이라 아직 몰라요" : "아직 몰라요"}`}>
                          <span className="ruler-row__name">{r.label}</span>
                          {/* 세 칸 자: 왼쪽 끝 = 1, 가운데 = 2, 오른쪽 끝 = 3. 표식 자리 = (평균 − 1) ÷ 2 */}
                          <span className="ruler" aria-hidden>
                            <span className="ruler__track">{known && <span className="ruler__mark" style={{ "--at": (r.mean! - 1) / 2 } as CSSProperties} />}</span>
                            <span className="ruler__ends">
                              <span>{r.ends[0]}</span>
                              <span>{r.ends[1]}</span>
                            </span>
                          </span>
                          <span className="ruler-row__n" aria-hidden>
                            {r.n}일
                          </span>
                          <span className="ruler-row__word" aria-hidden>
                            {known ? r.word : r.n === 1 ? "1일뿐이라 아직 몰라요" : "아직 몰라요"}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {state.tags.length > 0 && (
                    <p className="glyph-sheet__tags" aria-label="자주 고른 낱말">
                      {state.tags.map((t) => (
                        <span key={t.label} className="glyph-sheet__tag">
                          {t.label} <small>{t.n}</small>
                        </span>
                      ))}
                    </p>
                  )}
                </>
              ) : (
                <p className="glyph-sheet__nostate">이 글자가 든 날에 있었던 일을 고른 기록이 아직 없어요</p>
              )}
            </section>
            {/* 그날들: 펼치면 목록(전체 목록과 같은 줄). 줄을 누르면 이 낱장이 걷히고 날짜 낱장이 뜬다 */}
            {days.length > 0 && (
              <section className="glyph-sheet__days">
                <button type="button" className="glyph-sheet__toggle" aria-expanded={daysOpen} onClick={() => setDaysOpen((v) => !v)}>
                  이 글자가 든 날 보기 <small>{days.length}일</small>
                </button>
                {daysOpen && (
                  <>
                    <ol className="day-list__rows">
                      {days.slice(0, shown).map((r) => {
                        const first = (r.entry.note ?? "").split("\n")[0] ?? "";
                        return (
                          <li key={r.date}>
                            <button type="button" className="day-list__row" aria-haspopup="dialog" onClick={() => openDay(r.date)} aria-label={`${label(r.date)} ${dowOf(r.date)}요일, 행복도 ${r.entry.happiness}. 그날 기록 보기`}>
                              <span className="day-list__stamp" data-tier={happinessTier(r.entry.happiness)} aria-hidden>
                                {r.entry.happiness}
                              </span>
                              <span className="day-list__main">
                                <span className="day-list__top">
                                  <span className="day-list__date">
                                    {label(r.date)} <small>{dowOf(r.date)}</small>
                                  </span>
                                  {r.entry.moods.slice(0, 2).map((m) => (
                                    <span key={m} className="metric__chip" data-tone={moodTone(m)}>
                                      {m}
                                    </span>
                                  ))}
                                </span>
                                {first && <span className="day-list__note">{first}</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    {shown < days.length && (
                      <button type="button" className="day-list__more tap" onClick={() => setShown((n) => n + PAGE)}>
                        더 보기 <small>{days.length - shown}일 남음</small>
                      </button>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        ))}
    </Sheet>
  );
}

/** 글자별 막대의 한 칸 — 누르면 글자 낱장. 모양은 GlyphBars(.bars__col)가 넘긴다 */
export function GlyphButton({ id, className, children, "aria-label": ariaLabel }: { id: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  return (
    <button type="button" className={className} aria-label={ariaLabel} aria-haspopup="dialog" onClick={() => openGlyph(id)}>
      {children}
    </button>
  );
}
