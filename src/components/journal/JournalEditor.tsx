"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { EVENT_TAG_CATALOG } from "@/lib/journal/eventTagCatalog";
import {
  getEnabledCodesOrdered,
  loadCategoryPreferencesLocal,
} from "@/lib/journal/preferences";
import {
  MOOD_OPTIONS,
  type CategoryCode,
  type JournalEntry,
  type JournalScore,
} from "@/lib/journal/types";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import { todayDateString } from "@/lib/diary/dayPillar";
import {
  loadLocalSajuProfile,
  loadPrimarySajuProfile,
} from "@/lib/diary/profileStorage";
import type { SajuProfile } from "@/lib/diary/types";
import { scheduleAstrologySnapshotAfterJournalSave } from "@/lib/astrology/scheduleAfterJournal";
import { schedulePersonalizationTrainAfterJournalSave } from "@/lib/personalization/scheduleAfterJournal";
import type { JournalSaveResult } from "@/lib/journal/storage";
import TodayQuestionCard from "@/components/journal/TodayQuestionCard";
import JournalSaveCompleteModal from "@/components/journal/JournalSaveCompleteModal";
import ScoreSlider from "@/components/journal/ScoreSlider";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const HAPPINESS_PINK = "#f472b6";

type ScoreUi = {
  rawScore: JournalScore | null;
  isNotApplicable: boolean;
};

type Props = {
  initialDate?: string;
};

function parseDateParts(iso: string) {
  const [y, m, d] = iso.split("-");
  const weekday =
    WEEKDAY_KO[new Date(`${iso}T12:00:00+09:00`).getDay()] ?? "";
  return {
    year: y ?? "----",
    month: m ?? "--",
    day: d ?? "--",
    weekday,
  };
}

export default function JournalEditor({ initialDate }: Props) {
  const [date, setDate] = useState(initialDate ?? todayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateParts = useMemo(() => parseDateParts(date), [date]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [content, setContent] = useState("");
  const [overall, setOverall] = useState<JournalScore | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [mainEvent, setMainEvent] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreUi>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [existingId, setExistingId] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [message, setMessage] = useState("");
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [sajuProfile, setSajuProfile] = useState<SajuProfile | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [savedEntry, setSavedEntry] = useState<JournalEntry | null>(null);
  const [saveMeta, setSaveMeta] = useState<JournalSaveResult["xp"] | null>(null);
  const [openAiStatus, setOpenAiStatus] = useState<OpenAiCallStatus | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [quoteOpenAi, setQuoteOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [savedUniqueDays, setSavedUniqueDays] = useState(0);

  const completedScoreCount = useMemo(() => {
    return enabledCodes.filter((code) => {
      const s = scores[code];
      return s && (s.isNotApplicable || s.rawScore != null);
    }).length;
  }, [enabledCodes, scores]);

  const uniqueDays = useMemo(
    () => new Set(allEntries.map((e) => e.entryDate)).size,
    [allEntries]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setShowComplete(false);
      setSavedEntry(null);
      setSaveMeta(null);
      setOpenAiStatus(null);
      setAiSummary(null);
      setQuote(null);
      setQuoteOpenAi(null);
      setMessage("");
      try {
        const storage = await getJournalStorage();
        const prefs = await storage.getPreferences();
        const enabled = getEnabledCodesOrdered(prefs);
        const list = await storage.list();
        if (cancelled) return;
        setAllEntries(list);

        setSajuProfile(loadLocalSajuProfile());
        try {
          const remote = await loadPrimarySajuProfile();
          if (!cancelled && remote) setSajuProfile(remote);
        } catch {
          /* keep local */
        }

        if (enabled.length < 4) {
          setNeedsOnboarding(true);
          setEnabledCodes(
            loadCategoryPreferencesLocal()
              .filter((p) => p.enabled)
              .map((p) => p.categoryCode)
          );
        } else {
          setNeedsOnboarding(false);
          setEnabledCodes(enabled);
        }

        const existing = await storage.getByDate(date);
        if (cancelled) return;
        if (existing) {
          setExistingId(existing.id);
          setContent(existing.content);
          setOverall(existing.overallSatisfaction);
          setMood(existing.moodLabel);
          setMainEvent(existing.mainEventText ?? "");
          setTags(existing.tags.map((t) => t.tagCode));
          const map: Record<string, ScoreUi> = {};
          for (const s of existing.scores) {
            map[s.categoryCode] = {
              rawScore: s.userScore ?? s.rawScore,
              isNotApplicable: s.isNotApplicable,
            };
          }
          setScores(map);
        } else {
          setExistingId(undefined);
          setContent("");
          setOverall(null);
          setMood(null);
          setMainEvent("");
          setTags([]);
          setScores({});
        }
      } catch (e) {
        if (!cancelled) {
          setMessage(e instanceof Error ? e.message : "불러오기 실패");
        }
      } finally {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const setScore = (code: string, next: ScoreUi) => {
    setScores((prev) => ({ ...prev, [code]: next }));
  };

  const toggleTag = (code: string) => {
    setTags((prev) =>
      prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code]
    );
  };

  const fetchQuote = async (
    entry: JournalEntry,
    summary: string | null,
    entries: JournalEntry[]
  ) => {
    setQuoteLoading(true);
    setQuote(null);
    setQuoteOpenAi(null);
    try {
      const res = await fetch("/api/journal/today-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry,
          allEntries: entries,
          enabledCodes,
          sajuProfile,
          aiSummary: summary,
        }),
      });
      const data = (await res.json()) as {
        quote?: string;
        openAi?: OpenAiCallStatus;
      };
      setQuote(data.quote ?? null);
      setQuoteOpenAi(data.openAi ?? null);
    } catch (err) {
      setQuoteOpenAi({
        kind: "failed",
        reason: "network",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSave = async () => {
    setStatus("saving");
    setMessage("");
    setOpenAiStatus(null);
    setAiSummary(null);
    try {
      let aiByCode: Record<string, number | null> = {};
      let extractStatus: OpenAiCallStatus = {
        kind: "skipped",
        detail: "본문 없음",
      };
      let summary: string | null = null;

      if (content.trim()) {
        try {
          const res = await fetch("/api/journal/extract-scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content,
              enabledCodes,
              moodLabel: mood,
              mainEventText: mainEvent.trim() || null,
            }),
          });
          const data = (await res.json()) as {
            scores?: Record<string, { score?: number | null }>;
            summary?: string | null;
            openAi?: OpenAiCallStatus;
            error?: string;
          };
          if (!res.ok) {
            extractStatus = {
              kind: "failed",
              reason: "request_failed",
              detail: data.error ?? `HTTP ${res.status}`,
            };
          } else {
            extractStatus = data.openAi ?? { kind: "used" };
            summary = data.summary ?? null;
            for (const code of enabledCodes) {
              const sc = data.scores?.[code]?.score;
              aiByCode[code] =
                typeof sc === "number" && sc >= 1 && sc <= 10
                  ? Math.round(sc)
                  : null;
            }
          }
        } catch (err) {
          extractStatus = {
            kind: "failed",
            reason: "network",
            detail: err instanceof Error ? err.message : String(err),
          };
        }
      }

      setOpenAiStatus(extractStatus);
      setAiSummary(summary);

      const storage = await getJournalStorage();
      const scorePayload = enabledCodes.map((categoryCode) => {
        const s = scores[categoryCode];
        const userScore = s?.isNotApplicable ? null : s?.rawScore ?? null;
        const isNotApplicable = Boolean(s?.isNotApplicable);
        const aiScore = isNotApplicable ? null : aiByCode[categoryCode] ?? null;
        return {
          categoryCode,
          userScore,
          rawScore: userScore,
          aiScore,
          isNotApplicable,
        };
      });

      const saveInput = {
        entryDate: date,
        content,
        overallSatisfaction: overall,
        moodLabel: mood,
        mainEventText: mainEvent.trim() || null,
        scores: scorePayload,
        tagCodes: tags,
        enabledCodes,
        existingId,
      };

      const result =
        storage.saveWithMeta != null
          ? await storage.saveWithMeta(saveInput)
          : {
              entry: await storage.save(saveInput),
              xp: {
                gainedXp: 0,
                dayXp: 0,
                wasFirstSaveOfDay: false,
                totalXp: 0,
                level: 0,
                leveledUp: false,
                previousLevel: 0,
              },
            };

      setExistingId(result.entry.id);
      setSavedEntry(result.entry);
      setSaveMeta(result.xp);
      setShowComplete(true);
      setMessage(
        result.xp.wasFirstSaveOfDay
          ? "저장됐어요."
          : "오늘의 기록이 최신 내용으로 반영되었어요."
      );

      const list = await storage.list();
      setAllEntries(list);
      setSavedUniqueDays(new Set(list.map((e) => e.entryDate)).size);

      void fetchQuote(result.entry, summary, list);

      scheduleAstrologySnapshotAfterJournalSave({
        localDate: result.entry.entryDate,
      });
      schedulePersonalizationTrainAfterJournalSave({
        localDate: result.entry.entryDate,
        categoryKeys: enabledCodes,
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setStatus("idle");
    }
  };

  if (needsOnboarding) {
    return (
      <div
        className="p-4 border-2 space-y-3"
        style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
      >
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          기록할 카테고리를 먼저 선택해주세요
        </p>
        <p className="ui-hint">최소 4개 · 권장 6개 · 최대 9개</p>
        <Link
          href="/journal/categories"
          className="ui-primary-btn inline-block px-4 py-3 text-sm"
        >
          카테고리 선택하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="space-y-2">
        <p className="ui-section-title">■ 새 일기</p>
        <div
          className="flex items-stretch gap-1.5"
          aria-label={`기록 날짜 ${date}`}
        >
          <button
            type="button"
            onClick={() => {
              const el = dateInputRef.current;
              if (!el) return;
              try {
                el.showPicker?.();
              } catch {
                el.click();
              }
            }}
            className="shrink-0 px-2.5 border-2 flex items-center justify-center text-sm font-black"
            style={{
              borderColor: "var(--px-border2)",
              background: "var(--px-bg3)",
              color: "var(--px-accent)",
              boxShadow: "2px 2px 0 #000",
            }}
            aria-label="날짜 바꾸기"
            title="날짜 바꾸기"
          >
            날짜
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sr-only"
            tabIndex={-1}
          />
          {(
            [
              { key: "year", value: dateParts.year, hint: "년" },
              { key: "month", value: dateParts.month, hint: "월" },
              { key: "day", value: dateParts.day, hint: "일" },
              { key: "weekday", value: dateParts.weekday, hint: "요일" },
            ] as const
          ).map((part) => (
            <div
              key={part.key}
              className="flex-1 min-w-0 border-2 flex flex-col items-center justify-center py-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
              }}
            >
              <span
                className="text-[9px] font-bold leading-none"
                style={{ color: "var(--px-text2)" }}
              >
                {part.hint}
              </span>
              <span
                className="text-lg font-black tabular-nums leading-none mt-1"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {part.value}
              </span>
            </div>
          ))}
        </div>
      </header>

      {enabledCodes.length >= 4 && (
        <TodayQuestionCard
          todayDate={date}
          enabledCodes={enabledCodes}
          entries={allEntries}
          sajuProfile={sajuProfile}
        />
      )}

      <section
        className="space-y-3 p-3 border-2"
        style={{
          borderColor: HAPPINESS_PINK,
          background: `color-mix(in srgb, ${HAPPINESS_PINK} 10%, var(--px-bg2))`,
          boxShadow: `3px 3px 0 color-mix(in srgb, ${HAPPINESS_PINK} 45%, #000)`,
        }}
      >
        <p
          className="text-base font-black tracking-wide"
          style={{ color: HAPPINESS_PINK }}
        >
          ■ 행복도
        </p>
        <ScoreSlider
          label="행복도"
          value={overall}
          onChange={setOverall}
          tone="happiness"
          size="lg"
        />
      </section>

      <section className="space-y-2">
        <p className="ui-section-title">기분</p>
        <div className="grid grid-cols-4 gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => setMood(mood === m ? null : m)}
              className="min-h-[3.25rem] px-2 py-2.5 text-sm font-black border-2 leading-tight"
              style={{
                borderColor: mood === m ? "var(--px-accent)" : "var(--px-border)",
                color: mood === m ? "var(--px-accent)" : "var(--px-text)",
                background:
                  mood === m
                    ? "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))"
                    : "var(--px-bg3)",
                boxShadow: mood === m ? "2px 2px 0 #000" : "none",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex justify-between items-baseline gap-2">
          <p className="ui-section-title">카테고리 점수</p>
          <div className="flex items-baseline gap-2 shrink-0">
            <p className="ui-hint">
              입력 {completedScoreCount}/{enabledCodes.length}
            </p>
            <Link
              href="/journal/categories"
              className="text-xs font-bold underline"
              style={{ color: "#60a5fa" }}
            >
              카테고리 설정
            </Link>
          </div>
        </div>
        {enabledCodes.map((code) => {
          const cat = getCategoryByCode(code);
          const s = scores[code] ?? { rawScore: null, isNotApplicable: false };
          return (
            <div
              key={code}
              className="p-3 border-2 space-y-2"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
            >
              <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                {cat?.name ?? code}
              </p>
              <p className="ui-hint">{cat?.question}</p>
              <ScoreSlider
                label={cat?.name ?? code}
                value={s.isNotApplicable ? null : s.rawScore}
                disabled={s.isNotApplicable}
                onChange={(n) =>
                  setScore(code, { rawScore: n, isNotApplicable: false })
                }
              />
              <button
                type="button"
                aria-pressed={s.isNotApplicable}
                onClick={() =>
                  setScore(code, { rawScore: null, isNotApplicable: true })
                }
                className="px-2 py-1.5 text-[11px] font-bold border"
                style={{
                  borderColor: s.isNotApplicable
                    ? "var(--px-accent)"
                    : "var(--px-border)",
                  color: s.isNotApplicable
                    ? "var(--px-accent)"
                    : "var(--px-text2)",
                }}
              >
                해당 없음
              </button>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <p className="ui-section-title">사건 태그</p>
        <p className="ui-hint">여러 개 선택 가능 · 없어도 저장 가능 (권장 0~3)</p>
        <div className="flex flex-wrap gap-1">
          {EVENT_TAG_CATALOG.map((t) => {
            const on = tags.includes(t.tagCode);
            return (
              <button
                key={t.tagCode}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t.tagCode)}
                className="px-2 py-1.5 text-[11px] font-bold border"
                style={{
                  borderColor: on ? "var(--px-accent)" : "var(--px-border)",
                  color: on ? "var(--px-accent)" : "var(--px-text2)",
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="ui-section-title">자유 일기</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="오늘의 이야기를 남겨보세요. (저장 시 AI가 점수를 보조 추출합니다)"
          className="w-full px-3 py-2 border-2 text-sm resize-none"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border)",
            color: "var(--px-text-on-panel)",
          }}
        />
      </section>

      <section className="space-y-2">
        <p className="ui-section-title">가장 크게 영향을 준 사건 (선택)</p>
        <input
          type="text"
          value={mainEvent}
          onChange={(e) => setMainEvent(e.target.value)}
          className="w-full px-3 py-2 border-2 text-sm"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border)",
            color: "var(--px-text)",
          }}
        />
      </section>

      <button
        type="button"
        className="ui-primary-btn w-full py-3 text-sm"
        disabled={status !== "idle"}
        onClick={() => void handleSave()}
      >
        {status === "saving"
          ? "AI 분석·저장 중…"
          : existingId
            ? "수정 저장"
            : "저장"}
      </button>

      {message && <p className="ui-hint">{message}</p>}

      {showComplete && savedEntry && saveMeta && (
        <JournalSaveCompleteModal
          entry={savedEntry}
          xp={saveMeta}
          uniqueDays={savedUniqueDays || uniqueDays}
          openAiExtract={openAiStatus}
          aiSummary={aiSummary}
          quote={quote}
          quoteOpenAi={quoteOpenAi}
          quoteLoading={quoteLoading}
          onClose={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
