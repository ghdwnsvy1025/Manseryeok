"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Element } from "@/lib/saju/constants";
import {
  aggregateHappinessByCharacters,
  type CharacterHappiness,
} from "@/lib/journal/statsInsight";
import { deltaTone, happinessTone } from "@/lib/journal/statsTone";
import type { JournalEntry } from "@/lib/journal/types";
import {
  buildPatternCharDetail,
  formatShortDateKo,
  type PatternCharDetail,
  type PatternCharKind,
} from "@/lib/journal/stats/patternCharDetail";
import {
  getLocalViewProfileId,
  loadLocalSajuProfile,
  loadLocalSajuProfiles,
} from "@/lib/diary/profileStorage";
import JournalDayReportModal from "@/components/stats/JournalDayReportModal";
import { usePlayWhenVisible } from "@/hooks/usePlayWhenVisible";

const ELEM_COLORS: Record<Element, string> = {
  wood: "#4ade80",
  fire: "#f87171",
  earth: "#fbbf24",
  metal: "#cbd5e1",
  water: "#60a5fa",
};

const UNLOCK_DAYS = 2;

type Tab = PatternCharKind;

type Props = {
  entries: JournalEntry[];
  uniqueDays: number;
};

function formatSignedDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  return rounded.toFixed(1);
}

function HappinessTile({
  row,
  compact,
  onOpen,
  revealIndex = 0,
}: {
  row: CharacterHappiness;
  compact?: boolean;
  onOpen: () => void;
  revealIndex?: number;
}) {
  /** 0회만 비움 — 1회여도 그날 행복도가 곧 평균 */
  const insufficient = row.count < 1;
  const borderColor = row.element
    ? ELEM_COLORS[row.element]
    : row.average != null
      ? happinessTone(row.average)
      : "var(--px-border)";
  const washColor = row.element
    ? ELEM_COLORS[row.element]
    : row.average != null
      ? happinessTone(row.average)
      : "var(--px-border2)";
  const fillOpacity =
    insufficient || row.average == null
      ? 0.04
      : Math.max(0.06, Math.min(0.18, (row.average / 10) * 0.18));
  const showDelta =
    row.deltaFromOverall != null && Math.abs(row.deltaFromOverall) >= 0.1;
  const delta = row.deltaFromOverall ?? 0;

  return (
    <div
      className="stats-tile-reveal js-play-when-visible"
      style={{ ["--si" as string]: revealIndex }}
    >
    <button
      type="button"
      onClick={onOpen}
      className={`relative border-2 text-center flex flex-col items-center justify-center w-full ${
        compact ? "px-1.5 py-2 min-h-[4.1rem]" : "px-2 py-2.5 min-h-[4.4rem]"
      }`}
      style={{
        borderColor,
        background: `color-mix(in srgb, ${washColor} ${Math.round(
          fillOpacity * 100
        )}%, var(--px-bg2))`,
        opacity: insufficient ? 0.55 : 1,
      }}
      aria-label={`${row.key} 상세 보기`}
    >
      <span
        className={`block font-black leading-none ${
          compact ? "text-sm" : "text-base"
        }`}
        style={{ color: "var(--px-text2)" }}
      >
        {row.key}
      </span>
      {insufficient || row.average == null ? (
        <span
          className="block mt-1.5 text-sm font-bold"
          style={{ color: "var(--px-text2)" }}
        >
          —
        </span>
      ) : (
        <>
          <span
            className={`block mt-1 font-black tabular-nums leading-none ${
              compact ? "text-lg" : "text-xl"
            }`}
            style={{ color: "var(--px-text)" }}
          >
            {row.average.toFixed(1)}
          </span>
          {showDelta ? (
            <span
              className="mt-1 text-xs font-extrabold tabular-nums leading-none"
              style={{ color: deltaTone(delta, 0) }}
              aria-label={`평균 대비 ${formatSignedDelta(delta)}`}
            >
              {formatSignedDelta(delta)}
            </span>
          ) : (
            <span
              className="mt-1 text-xs font-bold leading-none"
              style={{ color: "var(--px-border2)" }}
            >
              ·
            </span>
          )}
        </>
      )}
      <span
        className="absolute bottom-0.5 right-0.5 text-[9px] font-bold"
        style={{ color: "var(--px-text2)" }}
      >
        {row.count}회
      </span>
    </button>
    </div>
  );
}

function PatternCharSheet({
  detail,
  onClose,
  onOpenDay,
  onPrev,
  onNext,
}: {
  detail: PatternCharDetail;
  onClose: () => void;
  onOpenDay: (entry: JournalEntry) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { identity, row } = detail;
  const accent = identity.element
    ? ELEM_COLORS[identity.element]
    : "var(--px-accent)";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const navBtnStyle = {
    borderColor: "var(--px-border)",
    background: "var(--px-bg2)",
    color: "var(--px-text)",
    boxShadow: "2px 2px 0 #000",
  } as const;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pattern-char-title"
      onClick={onClose}
    >
      <div
        className="flex items-center gap-1.5 sm:gap-2 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 border-2 text-lg font-black flex items-center justify-center"
          style={navBtnStyle}
          aria-label="이전 글자"
          onClick={onPrev}
        >
          ‹
        </button>

        <div
          className="flex-1 min-w-0 border-2 p-4 space-y-3 motion-modal-card max-h-[85vh] overflow-y-auto"
          style={{
            borderColor: accent,
            background: "var(--px-bg2)",
            boxShadow: "4px 4px 0 #4a3a00",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex items-end gap-2">
              <p
                id="pattern-char-title"
                className="text-4xl font-black leading-none tracking-tight"
                style={{ color: accent }}
              >
                {identity.key}
              </p>
              <span
                className="text-2xl font-black leading-none pb-0.5"
                style={{ color: "var(--px-text)" }}
              >
                {identity.hanja}
              </span>
            </div>
            <button
              type="button"
              className="text-xs font-bold underline shrink-0 mt-1"
              style={{ color: "var(--px-text2)", background: "transparent" }}
              onClick={onClose}
            >
              닫기
            </button>
          </div>

          <p
            className="text-[13px] font-bold leading-snug"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {identity.meaningSentence}
          </p>
          {detail.tenGodSentence && (
            <p
              className="text-[13px] font-bold leading-snug"
              style={{ color: "var(--px-text2)" }}
            >
              {detail.tenGodSentence}
            </p>
          )}

          {row.count < 1 ? (
            <p
              className="text-sm font-extrabold"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              아직 기록 없음
            </p>
          ) : (
            <>
              <div
                className="grid grid-cols-2 gap-2 border-2 p-3"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg3)",
                }}
              >
                <div>
                  <p
                    className="text-[11px] font-black"
                    style={{ color: "var(--px-text2)" }}
                  >
                    평균 행복
                  </p>
                  <p
                    className="mt-1 text-3xl font-black tabular-nums leading-none"
                    style={{
                      color:
                        row.average != null
                          ? happinessTone(row.average)
                          : "var(--px-text)",
                    }}
                  >
                    {row.average != null ? row.average.toFixed(1) : "—"}
                  </p>
                  <p
                    className="mt-1 text-[11px] font-bold"
                    style={{ color: "var(--px-text2)" }}
                  >
                    {row.count}회
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-[11px] font-black"
                    style={{ color: "var(--px-text2)" }}
                  >
                    전체 대비
                  </p>
                  <p
                    className="mt-1 text-3xl font-black tabular-nums leading-none"
                    style={{
                      color:
                        row.deltaFromOverall != null
                          ? deltaTone(row.deltaFromOverall, 0)
                          : "var(--px-text2)",
                    }}
                  >
                    {row.deltaFromOverall != null
                      ? formatSignedDelta(row.deltaFromOverall)
                      : "—"}
                  </p>
                  {detail.observationLine && (
                    <p
                      className="mt-1 text-[11px] font-bold"
                      style={{ color: "var(--px-accent)" }}
                    >
                      {detail.observationLine}
                    </p>
                  )}
                </div>
              </div>

              {(detail.topMoods.length > 0 || detail.topEvents.length > 0) && (
                <div className="space-y-2">
                  {detail.topMoods.length > 0 && (
                    <div>
                      <p
                        className="text-[11px] font-black mb-1.5"
                        style={{ color: "var(--px-text2)" }}
                      >
                        기분
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {detail.topMoods.map((m) => (
                          <div
                            key={m.label}
                            className="border-2 px-1.5 py-2 text-center min-h-[3.2rem] flex flex-col items-center justify-center"
                            style={{
                              borderColor: "var(--signal-emotion)",
                              background:
                                "color-mix(in srgb, var(--signal-emotion) 14%, var(--px-bg3))",
                              boxShadow: "1px 1px 0 #000",
                            }}
                          >
                            <span
                              className="text-[12px] font-black leading-tight"
                              style={{ color: "var(--signal-emotion)" }}
                            >
                              {m.label}
                            </span>
                            <span
                              className="mt-1 text-[10px] font-bold tabular-nums"
                              style={{ color: "var(--px-text2)" }}
                            >
                              {m.count}회
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail.topEvents.length > 0 && (
                    <div>
                      <p
                        className="text-[11px] font-black mb-1.5"
                        style={{ color: "var(--px-text2)" }}
                      >
                        사건
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.topEvents.map((m) => (
                          <span
                            key={m.label}
                            className="px-2 py-1 border-2 text-[11px] font-bold"
                            style={{
                              borderColor: "var(--px-border)",
                              color: "var(--px-text)",
                              background: "var(--px-bg3)",
                              boxShadow: "1px 1px 0 #000",
                            }}
                          >
                            {m.label}
                            <span
                              className="ml-1 tabular-nums"
                              style={{ color: "var(--px-text2)" }}
                            >
                              {m.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detail.recentDays.length > 0 && (
                <div>
                  <p
                    className="text-[11px] font-black mb-1"
                    style={{ color: "var(--px-text2)" }}
                  >
                    최근
                  </p>
                  <ul className="space-y-1">
                    {detail.recentDays.map((d) => (
                      <li key={d.entryDate}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 border text-left"
                          style={{
                            borderColor: "var(--px-border)",
                            background: "var(--px-bg3)",
                          }}
                          onClick={() => onOpenDay(d.entry)}
                        >
                          <span
                            className="text-sm font-bold"
                            style={{ color: "var(--px-text)" }}
                          >
                            {formatShortDateKo(d.entryDate)}
                          </span>
                          <span
                            className="text-sm font-black tabular-nums"
                            style={{
                              color:
                                d.happiness != null
                                  ? happinessTone(d.happiness)
                                  : "var(--px-text2)",
                            }}
                          >
                            {d.happiness != null
                              ? d.happiness.toFixed(1)
                              : "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 border-2 text-lg font-black flex items-center justify-center"
          style={navBtnStyle}
          aria-label="다음 글자"
          onClick={onNext}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/** 천간·지지별 행복도 — 해금 시 표 기본 펼침 */
export default function CharacterHappinessHeatmap({
  entries,
  uniqueDays,
}: Props) {
  const early = uniqueDays < UNLOCK_DAYS;
  const [tab, setTab] = useState<Tab>("stem");
  const [selected, setSelected] = useState<{
    kind: Tab;
    row: CharacterHappiness;
  } | null>(null);
  const [dayEntry, setDayEntry] = useState<JournalEntry | null>(null);
  const [natalStem, setNatalStem] = useState<string | null>(null);

  useEffect(() => {
    const profiles = loadLocalSajuProfiles();
    const viewId = getLocalViewProfileId();
    const profile =
      (viewId ? profiles.find((p) => p.id === viewId) : null) ??
      profiles.find((p) => p.isPrimary) ??
      profiles[0] ??
      loadLocalSajuProfile();
    setNatalStem(profile?.pillars?.day?.stemHanja ?? null);
  }, []);

  const data = useMemo(
    () => aggregateHappinessByCharacters(entries),
    [entries]
  );

  const detail = useMemo(() => {
    if (!selected) return null;
    return buildPatternCharDetail({
      kind: selected.kind,
      row: selected.row,
      entries,
      natalDayStemHanja: natalStem,
    });
  }, [selected, entries, natalStem]);

  const navRows =
    selected?.kind === "branch" ? data.branches : data.stems;
  const selectedIndex = selected
    ? navRows.findIndex((r) => r.key === selected.row.key)
    : -1;

  const goRelative = (delta: number) => {
    if (!selected || navRows.length === 0) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const next =
      navRows[(idx + delta + navRows.length) % navRows.length]!;
    setSelected({ kind: selected.kind, row: next });
  };

  const rows = tab === "stem" ? data.stems : data.branches;
  const cols = tab === "stem" ? "grid-cols-5" : "grid-cols-4";
  const hasAny = data.stems.some((r) => r.count > 0);
  const unlocked = !early && hasAny;
  const gridRef = usePlayWhenVisible<HTMLDivElement>(
    unlocked,
    ".js-play-when-visible",
    tab
  );

  const openChar = (kind: Tab, row: CharacterHappiness) => {
    setSelected({ kind, row });
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureUiClick }) => {
        captureUiClick(ANALYTICS_EVENTS.patternCharOpened, "pattern_char", {
          kind,
          key: row.key,
          count: row.count,
        });
      }
    );
  };

  return (
    <section className="stats-section" aria-label="나의 사주 패턴">
      <div className="stats-emphasize-head">
        <p className="stats-emphasize-title">사주 패턴</p>
        {!unlocked ? (
          <p
            className="text-xs font-black tabular-nums"
            style={{ color: "var(--px-text2)" }}
          >
            {uniqueDays}/{UNLOCK_DAYS}일
          </p>
        ) : data.overall != null ? (
          <p className="tabular-nums shrink-0 text-right">
            <span
              className="text-lg font-black"
              style={{ color: happinessTone(data.overall) }}
            >
              {data.overall.toFixed(1)}
            </span>
            <span className="stats-metric-unit">/10</span>
          </p>
        ) : null}
      </div>

      {!unlocked ? (
        <div className="stats-panel !shadow-none space-y-1.5">
          <p
            className="text-sm font-extrabold"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {uniqueDays === 0
              ? "기록이 쌓이면 천간·지지 패턴이 열려요"
              : `${uniqueDays}/2일 · 상대 비교는 이틀부터`}
          </p>
          {uniqueDays === 0 ? (
            <Link href="/journal" className="stats-link inline-block">
              기록하기 →
            </Link>
          ) : (
            <div className="stats-progress-track" aria-hidden>
              <div
                className="stats-progress-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((uniqueDays / UNLOCK_DAYS) * 100)
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="stats-panel space-y-2 !shadow-none">
          <div className="flex gap-1.5">
            {(
              [
                ["stem", "천간"],
                ["branch", "지지"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  void import("@/lib/analytics/posthog").then(
                    ({ ANALYTICS_EVENTS, captureUiClick }) => {
                      captureUiClick(
                        ANALYTICS_EVENTS.patternTabSelected,
                        "pattern_tab",
                        { tab: id }
                      );
                    }
                  );
                }}
                className={`stats-chip flex-1 text-center${tab === id ? " is-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div ref={gridRef} className={`grid gap-1.5 ${cols}`}>
            {rows.map((row, i) => (
              <HappinessTile
                key={`${tab}-${row.key}`}
                row={row}
                compact
                revealIndex={i}
                onOpen={() => openChar(tab, row)}
              />
            ))}
          </div>
        </div>
      )}

      {detail && !dayEntry && (
        <PatternCharSheet
          detail={detail}
          onClose={() => setSelected(null)}
          onOpenDay={(entry) => setDayEntry(entry)}
          onPrev={() => goRelative(-1)}
          onNext={() => goRelative(1)}
        />
      )}

      {dayEntry && (
        <JournalDayReportModal
          entry={dayEntry}
          onClose={() => setDayEntry(null)}
        />
      )}
    </section>
  );
}
