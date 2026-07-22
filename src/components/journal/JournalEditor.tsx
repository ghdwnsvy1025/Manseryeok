"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { EVENT_TAG_CATALOG, getTagName } from "@/lib/journal/eventTagCatalog";
import {
  getEnabledCodesOrdered,
  loadCategoryPreferencesLocal,
} from "@/lib/journal/preferences";
import {
  MOOD_OPTIONS,
  SCORE_LABELS,
  type CategoryCode,
  type JournalEntry,
} from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";
import { scheduleAstrologySnapshotAfterJournalSave } from "@/lib/astrology/scheduleAfterJournal";
import { schedulePersonalizationTrainAfterJournalSave } from "@/lib/personalization/scheduleAfterJournal";

type ScoreUi = {
  rawScore: 1 | 2 | 3 | 4 | 5 | null;
  isNotApplicable: boolean;
};

type Props = {
  initialDate?: string;
};

export default function JournalEditor({ initialDate }: Props) {
  const [date, setDate] = useState(initialDate ?? todayDateString());
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [content, setContent] = useState("");
  const [overall, setOverall] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [mainEvent, setMainEvent] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreUi>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [existingId, setExistingId] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [message, setMessage] = useState("");
  const [savedSummary, setSavedSummary] = useState<JournalEntry | null>(null);

  const completedScoreCount = useMemo(() => {
    return enabledCodes.filter((code) => {
      const s = scores[code];
      return s && (s.isNotApplicable || s.rawScore != null);
    }).length;
  }, [enabledCodes, scores]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setSavedSummary(null);
      setMessage("");
      try {
        const storage = await getJournalStorage();
        const prefs = await storage.getPreferences();
        const enabled = getEnabledCodesOrdered(prefs);
        if (cancelled) return;
        if (enabled.length < 4) {
          setNeedsOnboarding(true);
          setEnabledCodes(loadCategoryPreferencesLocal().filter((p) => p.enabled).map((p) => p.categoryCode));
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
              rawScore: s.rawScore,
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

  const handleSave = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const storage = await getJournalStorage();
      const scorePayload = enabledCodes.map((categoryCode) => {
        const s = scores[categoryCode];
        if (!s) {
          return { categoryCode, rawScore: null, isNotApplicable: false };
        }
        return {
          categoryCode,
          rawScore: s.isNotApplicable ? null : s.rawScore,
          isNotApplicable: s.isNotApplicable,
        };
      });

      const saved = await storage.save({
        entryDate: date,
        content,
        overallSatisfaction: overall,
        moodLabel: mood,
        mainEventText: mainEvent.trim() || null,
        scores: scorePayload,
        tagCodes: tags,
        existingId,
      });
      setExistingId(saved.id);
      setSavedSummary(saved);
      setMessage("저장됐어요.");
      // 사주 스냅샷·개인화 학습은 일기 저장과 분리 — 실패해도 일기 유지
      scheduleAstrologySnapshotAfterJournalSave({
        localDate: saved.entryDate,
      });
      schedulePersonalizationTrainAfterJournalSave({
        localDate: saved.entryDate,
        categoryKeys: Object.keys(scorePayload),
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setStatus("idle");
    }
  };

  if (needsOnboarding) {
    return (
      <div className="p-4 border-2 space-y-3" style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}>
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          기록할 카테고리를 먼저 선택해주세요
        </p>
        <p className="ui-hint">최소 4개 · 권장 6개 · 최대 9개</p>
        <Link href="/journal/categories" className="ui-primary-btn inline-block px-4 py-3 text-sm">
          카테고리 선택하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="space-y-1">
        <p className="ui-section-title">■ 새 일기</p>
        <label className="block text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          기록 날짜
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border-2 text-sm"
            style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", color: "var(--px-text)" }}
          />
        </label>
        <Link href="/journal/categories" className="text-xs font-bold underline" style={{ color: "#60a5fa" }}>
          카테고리 설정
        </Link>
      </header>

      <section className="space-y-2">
        <p className="ui-section-title">하루 만족도</p>
        <div className="flex flex-wrap gap-1">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={overall === n}
              onClick={() => setOverall(n)}
              className="px-3 py-2 text-xs font-bold border-2"
              style={{
                borderColor: overall === n ? "var(--px-accent)" : "var(--px-border)",
                color: overall === n ? "var(--px-accent)" : "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="ui-section-title">기분</p>
        <div className="flex flex-wrap gap-1">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => setMood(mood === m ? null : m)}
              className="px-2 py-1.5 text-[11px] font-bold border"
              style={{
                borderColor: mood === m ? "var(--px-accent)" : "var(--px-border)",
                color: mood === m ? "var(--px-accent)" : "var(--px-text2)",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex justify-between items-baseline">
          <p className="ui-section-title">카테고리 점수</p>
          <p className="ui-hint">
            입력 {completedScoreCount}/{enabledCodes.length}
          </p>
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
              <div className="flex flex-wrap gap-1">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${cat?.name} ${SCORE_LABELS[n]}`}
                    aria-pressed={!s.isNotApplicable && s.rawScore === n}
                    onClick={() =>
                      setScore(code, { rawScore: n, isNotApplicable: false })
                    }
                    className="px-2 py-1.5 text-[11px] font-bold border"
                    style={{
                      borderColor:
                        !s.isNotApplicable && s.rawScore === n
                          ? "var(--px-accent)"
                          : "var(--px-border)",
                      color:
                        !s.isNotApplicable && s.rawScore === n
                          ? "var(--px-accent)"
                          : "var(--px-text2)",
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={s.isNotApplicable}
                  onClick={() =>
                    setScore(code, { rawScore: null, isNotApplicable: true })
                  }
                  className="px-2 py-1.5 text-[11px] font-bold border"
                  style={{
                    borderColor: s.isNotApplicable ? "var(--px-accent)" : "var(--px-border)",
                    color: s.isNotApplicable ? "var(--px-accent)" : "var(--px-text2)",
                  }}
                >
                  해당 없음
                </button>
              </div>
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
          placeholder="오늘의 이야기를 남겨보세요."
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
        {status === "saving" ? "저장 중…" : existingId ? "수정 저장" : "저장"}
      </button>

      {message && <p className="ui-hint">{message}</p>}

      {savedSummary && (
        <div
          className="p-3 border-2 space-y-1"
          style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
          role="status"
        >
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            기록 요약
          </p>
          <p className="ui-hint">
            {savedSummary.entryDate} · 만족도 {savedSummary.overallSatisfaction ?? "-"} · 기분{" "}
            {savedSummary.moodLabel ?? "-"}
          </p>
          <p className="ui-hint">
            점수 {savedSummary.scores.filter((s) => s.rawScore != null).length}개 · 해당 없음{" "}
            {savedSummary.scores.filter((s) => s.isNotApplicable).length}개 · 태그{" "}
            {savedSummary.tags.map((t) => getTagName(t.tagCode)).join(", ") || "없음"}
          </p>
        </div>
      )}
    </div>
  );
}
