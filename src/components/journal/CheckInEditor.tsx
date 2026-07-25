"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import {
  CHECKIN_VERSION_V2,
  MOOD_OPTIONS,
  type JournalEntry,
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
import type { HappinessScore } from "@/lib/journal/happinessScale";
import {
  CHECKIN_TAG_GROUPS,
  CORE_STATE_CODES,
  MAX_CHECKIN_TAGS,
  MAX_MOODS,
  type CoreStateCode,
  type DomainCode,
  type OrdinalScore,
} from "@/lib/journal/checkin/catalog";
import { selectDailyDomains } from "@/lib/journal/checkin/selectDomains";
import {
  clearCheckInDraft,
  loadCheckInDraft,
  saveCheckInDraft,
} from "@/lib/journal/checkin/draft";
import {
  buildCheckInScoreRows,
  buildCoreStatesPayload,
  buildDomainScoresPayload,
} from "@/lib/journal/checkin/mapToScores";
import { validateCheckInSave } from "@/lib/journal/checkin/validation";
import type { CoreStateUi, DomainStateUi } from "@/lib/journal/checkin/validation";
import TodayQuestionCard from "@/components/journal/TodayQuestionCard";
import JournalSaveCompleteModal from "@/components/journal/JournalSaveCompleteModal";
import HappinessSlider from "@/components/journal/HappinessSlider";
import OrdinalPicker from "@/components/journal/OrdinalPicker";
import { reportQuestionFeedback } from "@/lib/journal/reportQuestionFeedback";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const HAPPINESS_PINK = "#f472b6";

type Props = {
  initialDate?: string;
};

function emptyCore(): Record<CoreStateCode, CoreStateUi> {
  return {
    emotional_balance: { ordinal: null, isNotApplicable: false },
    energy: { ordinal: null, isNotApplicable: false },
    recovery_sleep: { ordinal: null, isNotApplicable: false },
    focus_execution: { ordinal: null, isNotApplicable: false },
  };
}

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

export default function CheckInEditor({ initialDate }: Props) {
  const [date, setDate] = useState(initialDate ?? todayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateParts = useMemo(() => parseDateParts(date), [date]);

  const [content, setContent] = useState("");
  const [happiness, setHappiness] = useState<HappinessScore | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [mainEvent, setMainEvent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [core, setCore] = useState<Record<CoreStateCode, CoreStateUi>>(emptyCore);
  const [domains, setDomains] = useState<DomainStateUi[]>([]);
  const [existingId, setExistingId] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [message, setMessage] = useState("");
  const [draftHint, setDraftHint] = useState("");
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
  const [quoteMeta, setQuoteMeta] = useState<{
    contentType: string | null;
    sourceLabel: string | null;
    authorName: string | null;
    workTitle: string | null;
    deliveryId: string | null;
  }>({
    contentType: null,
    sourceLabel: null,
    authorName: null,
    workTitle: null,
    deliveryId: null,
  });
  const [savedUniqueDays, setSavedUniqueDays] = useState(0);

  const enabledCodes = useMemo(
    () => [...CORE_STATE_CODES, ...domains.map((d) => d.code)],
    [domains]
  );

  const uniqueDays = useMemo(
    () => new Set(allEntries.map((e) => e.entryDate)).size,
    [allEntries]
  );

  const syncDomainsFromTags = (
    nextTags: string[],
    preserve: DomainStateUi[]
  ) => {
    const selected = selectDailyDomains(nextTags);
    const prevMap = new Map(preserve.map((d) => [d.code, d]));
    return selected.map((code) => {
      const prev = prevMap.get(code);
      return (
        prev ?? {
          code,
          ordinal: null as OrdinalScore | null,
          isNotApplicable: false,
        }
      );
    });
  };

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
      setDraftHint("");
      try {
        const storage = await getJournalStorage();
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

        const existing = await storage.getByDate(date);
        if (cancelled) return;

        if (existing) {
          setExistingId(existing.id);
          setContent(existing.content);
          const h =
            existing.happinessScore != null
              ? (existing.happinessScore as HappinessScore)
              : existing.overallSatisfaction != null
                ? (existing.overallSatisfaction as HappinessScore)
                : null;
          setHappiness(h);
          const labels =
            existing.moodLabels?.length > 0
              ? existing.moodLabels
              : existing.moodLabel
                ? [existing.moodLabel]
                : [];
          setMoods(labels.slice(0, MAX_MOODS));
          setMainEvent(existing.mainEventText ?? "");
          setTags(existing.tags.map((t) => t.tagCode).slice(0, MAX_CHECKIN_TAGS));

          const nextCore = emptyCore();
          if (existing.coreStates) {
            for (const code of CORE_STATE_CODES) {
              const row = existing.coreStates[code];
              if (!row) continue;
              nextCore[code] = {
                ordinal:
                  row.isNotApplicable || row.ordinal == null
                    ? null
                    : (row.ordinal as OrdinalScore),
                isNotApplicable: Boolean(row.isNotApplicable),
              };
            }
          } else {
            for (const s of existing.scores) {
              if (!(CORE_STATE_CODES as readonly string[]).includes(s.categoryCode)) {
                continue;
              }
              const code = s.categoryCode as CoreStateCode;
              nextCore[code] = {
                ordinal: null,
                isNotApplicable: s.isNotApplicable,
              };
            }
          }
          setCore(nextCore);

          if (existing.domainScores && existing.domainScores.length > 0) {
            setDomains(
              existing.domainScores.map((d) => ({
                code: d.code as DomainCode,
                ordinal:
                  d.isNotApplicable || d.ordinal == null
                    ? null
                    : (d.ordinal as OrdinalScore),
                isNotApplicable: Boolean(d.isNotApplicable),
              }))
            );
          } else {
            setDomains(
              syncDomainsFromTags(
                existing.tags.map((t) => t.tagCode),
                []
              )
            );
          }
        } else {
          const draft = loadCheckInDraft(date);
          setExistingId(undefined);
          if (draft) {
            setContent(draft.content);
            setHappiness(draft.happiness);
            setMoods(draft.moods);
            setMainEvent(draft.mainEvent);
            setTags(draft.tagCodes);
            setCore({ ...emptyCore(), ...draft.core } as Record<
              CoreStateCode,
              CoreStateUi
            >);
            setDomains(
              draft.domains.length > 0
                ? draft.domains
                : syncDomainsFromTags(draft.tagCodes, [])
            );
            setDraftHint("임시 저장한 내용을 불러왔어요.");
          } else {
            setContent("");
            setHappiness(null);
            setMoods([]);
            setMainEvent("");
            setTags([]);
            setCore(emptyCore());
            setDomains(syncDomainsFromTags([], []));
          }
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

  // 자동 임시저장
  useEffect(() => {
    if (status !== "idle") return;
    const t = window.setTimeout(() => {
      saveCheckInDraft({
        entryDate: date,
        content,
        mainEvent,
        happiness,
        moods,
        tagCodes: tags,
        core,
        domains,
        updatedAt: new Date().toISOString(),
      });
      setDraftHint("임시 저장됨");
    }, 1200);
    return () => window.clearTimeout(t);
  }, [date, content, mainEvent, happiness, moods, tags, core, domains, status]);

  const toggleMood = (m: string) => {
    setMoods((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m);
      if (prev.length >= MAX_MOODS) return prev;
      return [...prev, m];
    });
  };

  const toggleTag = (code: string) => {
    setTags((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        next = prev.filter((t) => t !== code);
      } else if (prev.length >= MAX_CHECKIN_TAGS) {
        return prev;
      } else {
        next = [...prev, code];
      }
      setDomains((d) => syncDomainsFromTags(next, d));
      return next;
    });
  };

  const setCoreRow = (code: CoreStateCode, next: CoreStateUi) => {
    setCore((prev) => ({ ...prev, [code]: next }));
  };

  const setDomainRow = (code: DomainCode, next: Omit<DomainStateUi, "code">) => {
    setDomains((prev) =>
      prev.map((d) => (d.code === code ? { ...d, ...next } : d))
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
    setQuoteMeta({
      contentType: null,
      sourceLabel: null,
      authorName: null,
      workTitle: null,
      deliveryId: null,
    });
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
        sentence?: string;
        quote?: string;
        openAi?: OpenAiCallStatus;
        contentType?: string;
        sourceLabel?: string;
        authorName?: string | null;
        workTitle?: string | null;
        delivery?: { deliveryId?: string | null };
      };
      setQuote(data.sentence ?? data.quote ?? null);
      setQuoteOpenAi(data.openAi ?? null);
      setQuoteMeta({
        contentType: data.contentType ?? null,
        sourceLabel: data.sourceLabel ?? null,
        authorName: data.authorName ?? null,
        workTitle: data.workTitle ?? null,
        deliveryId: data.delivery?.deliveryId ?? null,
      });
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

    const check = validateCheckInSave({
      happiness,
      moods,
      tagCodes: tags,
      core,
      domains,
    });
    if (!check.ok) {
      setMessage(check.error);
      setStatus("idle");
      return;
    }

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
              moodLabel: moods[0] ?? null,
              moodLabels: moods,
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

      const scorePayload = buildCheckInScoreRows({ core, domains }).map(
        (row) => ({
          ...row,
          aiScore: row.isNotApplicable
            ? null
            : aiByCode[row.categoryCode] ?? null,
        })
      );

      const happinessValue = happiness as HappinessScore;
      const storage = await getJournalStorage();
      const saveInput = {
        entryDate: date,
        content,
        overallSatisfaction: happinessValue,
        happinessScore: happinessValue,
        moodLabel: moods[0] ?? null,
        moodLabels: moods,
        mainEventText: mainEvent.trim() || null,
        scores: scorePayload,
        tagCodes: tags,
        enabledCodes,
        relaxEnabledCount: true,
        coreStates: buildCoreStatesPayload(core),
        domainScores: buildDomainScoresPayload(domains),
        checkinVersion: CHECKIN_VERSION_V2,
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

      clearCheckInDraft(date);
      setExistingId(result.entry.id);
      setSavedEntry(result.entry);
      setSaveMeta(result.xp);
      setShowComplete(true);
      setMessage(
        result.xp.wasFirstSaveOfDay
          ? "저장됐어요."
          : "오늘의 기록이 최신 내용으로 반영되었어요."
      );

      void reportQuestionFeedback({
        questionDate: date,
        eventType: "led_to_write",
        payload: {
          entryId: result.entry.id,
          wasFirstSaveOfDay: result.xp.wasFirstSaveOfDay,
          checkinVersion: CHECKIN_VERSION_V2,
        },
      });

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

  return (
    <div className="space-y-4 pb-8">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="ui-section-title">■ 오늘 상태 체크</p>
          {draftHint && <p className="ui-hint shrink-0">{draftHint}</p>}
        </div>
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

      <TodayQuestionCard
        todayDate={date}
        enabledCodes={[...CORE_STATE_CODES]}
        entries={allEntries}
        sajuProfile={sajuProfile}
      />

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
          ■ 행복도 (0~10)
        </p>
        <HappinessSlider
          label="행복도"
          value={happiness}
          onChange={setHappiness}
        />
      </section>

      <section className="space-y-2">
        <div className="flex justify-between items-baseline gap-2">
          <p className="ui-section-title">기분</p>
          <p className="ui-hint">
            {moods.length}/{MAX_MOODS}
          </p>
        </div>
        <p className="ui-hint">최대 {MAX_MOODS}개까지 고를 수 있어요</p>
        <div className="grid grid-cols-4 gap-2">
          {MOOD_OPTIONS.map((m) => {
            const on = moods.includes(m);
            const blocked = !on && moods.length >= MAX_MOODS;
            return (
              <button
                key={m}
                type="button"
                disabled={blocked}
                aria-pressed={on}
                onClick={() => toggleMood(m)}
                className="min-h-[3.25rem] px-2 py-2.5 text-sm font-black border-2 leading-tight disabled:opacity-40"
                style={{
                  borderColor: on ? "var(--px-accent)" : "var(--px-border)",
                  color: on ? "var(--px-accent)" : "var(--px-text)",
                  background: on
                    ? "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))"
                    : "var(--px-bg3)",
                  boxShadow: on ? "2px 2px 0 #000" : "none",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="ui-section-title">핵심 상태 (매일)</p>
        {CORE_STATE_CODES.map((code) => {
          const cat = getCategoryByCode(code);
          const s = core[code];
          return (
            <div
              key={code}
              className="p-3 border-2 space-y-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
              }}
            >
              <p
                className="text-sm font-black"
                style={{ color: "var(--px-accent)" }}
              >
                {cat?.name ?? code}
              </p>
              <p className="ui-hint">{cat?.question}</p>
              <OrdinalPicker
                label={cat?.name ?? code}
                value={s.isNotApplicable ? null : s.ordinal}
                disabled={s.isNotApplicable}
                onChange={(n) =>
                  setCoreRow(code, { ordinal: n, isNotApplicable: false })
                }
              />
              <button
                type="button"
                aria-pressed={s.isNotApplicable}
                onClick={() =>
                  setCoreRow(code, { ordinal: null, isNotApplicable: true })
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
        <div className="flex justify-between items-baseline gap-2">
          <p className="ui-section-title">사건 태그</p>
          <p className="ui-hint">
            {tags.length}/{MAX_CHECKIN_TAGS}
          </p>
        </div>
        <p className="ui-hint">
          최대 {MAX_CHECKIN_TAGS}개 · 고르면 아래 생활영역이 바뀌어요
        </p>
        {CHECKIN_TAG_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1">
            <p
              className="text-[11px] font-black"
              style={{ color: "var(--px-text2)" }}
            >
              {group.name}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.tagCodes.map((code) => {
                const on = tags.includes(code);
                const blocked = !on && tags.length >= MAX_CHECKIN_TAGS;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={blocked}
                    aria-pressed={on}
                    onClick={() => toggleTag(code)}
                    className="px-2 py-1.5 text-[11px] font-bold border disabled:opacity-40"
                    style={{
                      borderColor: on ? "var(--px-accent)" : "var(--px-border)",
                      color: on ? "var(--px-accent)" : "var(--px-text2)",
                    }}
                  >
                    {getTagName(code)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <p className="ui-section-title">오늘 열린 생활영역</p>
        <p className="ui-hint">태그·기본 순서로 하루 2개만 묻습니다</p>
        {domains.map((d) => {
          const cat = getCategoryByCode(d.code);
          return (
            <div
              key={d.code}
              className="p-3 border-2 space-y-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
              }}
            >
              <p
                className="text-sm font-black"
                style={{ color: "var(--px-accent)" }}
              >
                {cat?.name ?? d.code}
              </p>
              <p className="ui-hint">{cat?.question}</p>
              <OrdinalPicker
                label={cat?.name ?? d.code}
                value={d.isNotApplicable ? null : d.ordinal}
                disabled={d.isNotApplicable}
                onChange={(n) =>
                  setDomainRow(d.code, {
                    ordinal: n,
                    isNotApplicable: false,
                  })
                }
              />
              <button
                type="button"
                aria-pressed={d.isNotApplicable}
                onClick={() =>
                  setDomainRow(d.code, {
                    ordinal: null,
                    isNotApplicable: true,
                  })
                }
                className="px-2 py-1.5 text-[11px] font-bold border"
                style={{
                  borderColor: d.isNotApplicable
                    ? "var(--px-accent)"
                    : "var(--px-border)",
                  color: d.isNotApplicable
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

      <p className="ui-hint">
        예전 입력 화면이 필요하면{" "}
        <Link href="/journal?legacy=1" className="underline font-bold">
          여기
        </Link>
        를 눌러주세요.
      </p>

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
          contentType={quoteMeta.contentType}
          sourceLabel={quoteMeta.sourceLabel}
          authorName={quoteMeta.authorName}
          workTitle={quoteMeta.workTitle}
          deliveryId={quoteMeta.deliveryId}
          onClose={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
