"use client";

import Link from "next/link";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import { dayHappiness } from "@/lib/journal/homeStats";
import {
  CORE_STATE_CODES,
  DOMAIN_POOL_CODES,
  ORDINAL_LABELS,
  isOrdinalScore,
  journalScoreToOrdinal,
  type OrdinalScore,
} from "@/lib/journal/checkin/catalog";
import { happinessTone, ordinalTone } from "@/lib/journal/statsTone";
import type { JournalEntry } from "@/lib/journal/types";

type Props = {
  entry: JournalEntry;
  onClose: () => void;
  /**
   * 있으면 「이전 일기 작성」 CTA 표시 (헤더 완료 팝업 등).
   * 미기록 중 가장 최근 날짜 ISO.
   */
  previousWriteDate?: string | null;
};

function resolveOrdinal(opts: {
  ordinal: number | null | undefined;
  isNotApplicable?: boolean;
  scoreFallback: number | null;
}): { label: string; score: string; tone: string } | null {
  if (opts.isNotApplicable) {
    return { label: "해당 없음", score: "-", tone: "var(--px-text2)" };
  }
  let ordinal: OrdinalScore | null = null;
  if (isOrdinalScore(opts.ordinal)) ordinal = opts.ordinal;
  else if (opts.scoreFallback != null) {
    ordinal = journalScoreToOrdinal(opts.scoreFallback);
  }
  if (ordinal == null) return null;
  return {
    label: ORDINAL_LABELS[ordinal],
    score: String(ordinal),
    tone: ordinalTone(ordinal),
  };
}

function ScoreRow({
  name,
  ordinal,
  isNotApplicable,
  scoreFallback,
}: {
  name: string;
  ordinal: number | null | undefined;
  isNotApplicable?: boolean;
  scoreFallback: number | null;
}) {
  const resolved = resolveOrdinal({ ordinal, isNotApplicable, scoreFallback });
  if (!resolved) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className="text-sm font-semibold"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {name}
      </span>
      <span className="shrink-0 text-right">
        <span
          className="text-sm font-black tabular-nums"
          style={{ color: resolved.tone }}
        >
          {resolved.score}
        </span>
        <span className="stats-label ml-1.5">{resolved.label}</span>
      </span>
    </div>
  );
}

/**
 * 기록 캘린더용 하루 보고서 — 읽기 전용.
 * 수정은 「수정하기」로 체크인 에디터 이동.
 */
export default function JournalDayReportModal({
  entry,
  onClose,
  previousWriteDate,
}: Props) {
  const happiness = dayHappiness(entry);
  const ganji = getPillarsForDate(entry.entryDate).dayPillar.ganjiKo;
  const moods =
    entry.moodLabels?.length > 0
      ? entry.moodLabels
      : entry.moodLabel
        ? [entry.moodLabel]
        : [];
  const tags = entry.tags.map((t) => getTagName(t.tagCode)).filter(Boolean);
  const scoreByCode = new Map<string, number>(
    entry.scores
      .filter((s) => !s.isNotApplicable && s.finalScore != null)
      .map((s) => [s.categoryCode, s.finalScore as number])
  );

  const coreRows = CORE_STATE_CODES.map((code) => {
    const raw = entry.coreStates?.[code];
    return {
      code,
      name: getCategoryByCode(code)?.name ?? code,
      ordinal: raw?.ordinal ?? null,
      isNotApplicable: raw?.isNotApplicable,
      scoreFallback: scoreByCode.get(code) ?? null,
    };
  });

  const domainRows = (entry.domainScores ?? [])
    .filter((d) => (DOMAIN_POOL_CODES as readonly string[]).includes(d.code))
    .map((d) => ({
      code: d.code,
      name: getCategoryByCode(d.code)?.name ?? d.code,
      ordinal: d.ordinal,
      isNotApplicable: d.isNotApplicable,
      scoreFallback: scoreByCode.get(d.code) ?? null,
    }));

  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${entry.entryDate}T12:00:00+09:00`).getDay()
  ];

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.entryDate} 기록 보고서`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto border-2 space-y-4 p-4"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg2)",
          boxShadow: "4px 4px 0 #000",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="stats-label">
              {weekday}요일 ·{" "}
              <span style={{ color: "var(--px-accent)", fontWeight: 900 }}>
                {ganji}일
              </span>
            </p>
            <p
              className="text-lg font-black tabular-nums"
              style={{ color: "var(--px-text)" }}
            >
              {entry.entryDate.replace(/-/g, ".")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 text-xs font-bold border"
            style={{
              borderColor: "var(--px-border)",
              color: "var(--px-text2)",
            }}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        {happiness != null && (
          <div
            className="p-3 border-2 flex items-end justify-between gap-3"
            style={{
              borderColor: "var(--px-border)",
              background: `color-mix(in srgb, ${happinessTone(happiness)} 16%, var(--px-bg3))`,
            }}
          >
            <div>
              <p className="stats-label">행복도</p>
              <p
                className="text-3xl font-black tabular-nums leading-none mt-1"
                style={{ color: happinessTone(happiness) }}
              >
                {happiness.toFixed(1)}
                <span className="stats-metric-unit !text-sm">/10</span>
              </p>
            </div>
            {moods.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1 max-w-[55%]">
                {moods.map((m) => (
                  <span
                    key={m}
                    className="px-1.5 py-0.5 text-[11px] font-bold border"
                    style={{
                      borderColor: "var(--px-border)",
                      color: "var(--px-text-on-panel)",
                      background: "var(--px-bg2)",
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {coreRows.some((r) => resolveOrdinal(r)) && (
          <section className="space-y-1">
            <p className="stats-label">핵심 상태</p>
            <div
              className="px-3 py-1 border-2 space-y-0"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg3)",
              }}
            >
              {coreRows.map((r, i) => (
                <div
                  key={r.code}
                  style={
                    i < coreRows.length - 1
                      ? { borderBottom: "1px solid var(--px-border)" }
                      : undefined
                  }
                >
                  <ScoreRow {...r} />
                </div>
              ))}
            </div>
          </section>
        )}

        {domainRows.some((r) => resolveOrdinal(r)) && (
          <section className="space-y-1">
            <p className="stats-label">선택 영역</p>
            <div
              className="px-3 py-1 border-2"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            >
              {domainRows.map((r, i) => (
                <div
                  key={r.code}
                  style={
                    i < domainRows.length - 1
                      ? { borderBottom: "1px solid var(--px-border)" }
                      : undefined
                  }
                >
                  <ScoreRow {...r} />
                </div>
              ))}
            </div>
          </section>
        )}

        {tags.length > 0 && (
          <section className="space-y-1.5">
            <p className="stats-label">오늘 있었던 일</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-1 text-xs font-bold border"
                  style={{
                    borderColor: "var(--px-border)",
                    color: "var(--px-text-on-panel)",
                    background: "var(--px-bg3)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            {entry.mainEventText?.trim() && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {entry.mainEventText.trim()}
              </p>
            )}
          </section>
        )}

        {entry.content?.trim() && (
          <section className="space-y-1.5">
            <p className="stats-label">일기</p>
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--px-text-on-panel)", lineHeight: 1.7 }}
            >
              {entry.content.trim()}
            </p>
          </section>
        )}

        {!happiness &&
          !coreRows.some((r) => resolveOrdinal(r)) &&
          !entry.content?.trim() &&
          tags.length === 0 && (
            <p className="ui-hint text-center py-4">표시할 내용이 거의 없어요.</p>
          )}

        <div
          className="flex flex-col gap-2 pt-1 sticky bottom-0 pb-1"
          style={{ background: "var(--px-bg2)" }}
        >
          {previousWriteDate && (
            <Link
              href={`/journal?date=${previousWriteDate}`}
              className="w-full py-2.5 text-sm font-black text-center border-2"
              style={{
                borderColor: "var(--px-accent)",
                color: "var(--px-accent)",
                background:
                  "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))",
                boxShadow: "2px 2px 0 #000",
              }}
              onClick={() => {
                onClose();
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureUiClick }) => {
                    captureUiClick(
                      ANALYTICS_EVENTS.homeTodayEntryClicked,
                      "day_report_previous_write",
                      {
                        mode: "previous_write",
                        target_date: previousWriteDate,
                      }
                    );
                  }
                );
              }}
            >
              이전 일기 작성
              <span
                className="ml-1.5 text-[11px] font-bold tabular-nums"
                style={{ color: "var(--px-text2)" }}
              >
                {previousWriteDate.replace(/-/g, ".")}
              </span>
            </Link>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-bold border-2"
              style={{
                borderColor: "var(--px-border)",
                color: "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              닫기
            </button>
            <Link
              href={`/journal?date=${entry.entryDate}`}
              className="ui-primary-btn flex-1 py-2.5 text-sm text-center"
              onClick={() => {
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureEvent, captureUiClick }) => {
                    captureEvent(ANALYTICS_EVENTS.pastEntryOpened, {
                      source: "day_report_edit",
                      has_entry: true,
                    });
                    captureUiClick(
                      ANALYTICS_EVENTS.entryListEditClicked,
                      "entry_list_edit"
                    );
                  }
                );
              }}
            >
              수정하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
