"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJournalStorage } from "@/lib/journal/getStorage";
import {
  JOURNAL_PROGRESS_CHANGED_EVENT,
  notifyJournalProgressChanged,
} from "@/lib/journal/streak";
import { notifyProgressCelebration } from "@/lib/ui/motionEvents";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import {
  CHECKIN_VERSION_V2,
  MOOD_OPTIONS,
  type JournalEntry,
} from "@/lib/journal/types";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import { todayDateString } from "@/lib/diary/dayPillar";
import { addDaysToDateString } from "@/lib/forecast/tomorrowContext";
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
  DOMAIN_POOL_CODES,
  MAX_CHECKIN_TAGS,
  MAX_MOODS,
  NONE_SPECIAL_TAG,
  adaptLegacyCoreStates,
  journalScoreToOrdinal,
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
import { trackContentExposure } from "@/lib/journal/exposure";
import { celebrateClick } from "@/lib/ui/clickBurst";
import {
  buildSavedCheckInForm,
  isSavedFormComplete,
  peekLastSavedEntry,
  peekLastSavedForm,
  setLastSavedCheckIn,
  type SavedCheckInForm,
} from "@/lib/journal/lastSavedCheckIn";
import { peekDayQuote, setDayQuote } from "@/lib/journal/dayQuoteCache";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const HAPPINESS_PINK = "#f472b6";
const FEATURED_TAG_CODES = [
  NONE_SPECIAL_TAG,
  "work_pressure",
  "achievement",
  "meeting",
  "conflict",
  "family",
  "exercise",
  "rest",
  "illness",
  "big_spend",
] as const;
const ALL_CHECKIN_TAG_CODES = CHECKIN_TAG_GROUPS.flatMap(
  (group) => group.tagCodes
);
/** 사건 반응용 — 핵심 상태(매우 나쁨~좋음)와 구분 */
const EVENT_REACTION_LABELS: Record<OrdinalScore, string> = {
  1: "전혀",
  2: "조금",
  3: "보통",
  4: "꽤",
  5: "아주",
};

type Props = {
  initialDate?: string;
};

function emptyCore(): Record<CoreStateCode, CoreStateUi> {
  return {
    energy: { ordinal: null, isNotApplicable: false },
    focus_execution: { ordinal: null, isNotApplicable: false },
    physical_condition: { ordinal: null, isNotApplicable: false },
    emotional_balance: { ordinal: null, isNotApplicable: false },
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
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? todayDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);

  // URL ?date= 변경 시 state 동기화 (홈「수정」진입)
  useEffect(() => {
    if (!initialDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return;
    setDate((prev) => (prev === initialDate ? prev : initialDate));
  }, [initialDate]);

  const dateParts = useMemo(() => parseDateParts(date), [date]);
  const todayIso = useMemo(() => todayDateString(), []);
  const isToday = date === todayIso;
  const canGoNext = date < todayIso;

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.click();
    }
  };

  const shiftDate = (delta: number) => {
    const next = addDaysToDateString(date, delta);
    if (next > todayIso) return;
    setDate(next);
  };

  const [content, setContent] = useState("");
  /** 자유 일기 시작(diary_started)은 날짜당 한 번만 발화한다. */
  const diaryStartedRef = useRef<string | null>(null);
  const [happiness, setHappiness] = useState<HappinessScore | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [mainEvent, setMainEvent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [core, setCore] = useState<Record<CoreStateCode, CoreStateUi>>(emptyCore);
  const [domains, setDomains] = useState<DomainStateUi[]>([]);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [existingId, setExistingId] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [message, setMessage] = useState("");
  const [draftHint, setDraftHint] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const loadedDateRef = useRef<string | null>(null);
  const bootstrappedRef = useRef(false);
  const prevReloadTokenRef = useRef<number | null>(null);
  const allEntriesRef = useRef<JournalEntry[]>([]);
  const metaLoadedRef = useRef(false);
  /** 저장 직후 pagehide 등이 빈/옛 초안을 다시 쓰지 못하게 */
  const suppressDraftPersistRef = useRef(false);
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [personalImportance, setPersonalImportance] = useState<
    Partial<Record<DomainCode, number>>
  >({});
  const [sajuProfile, setSajuProfile] = useState<SajuProfile | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [savedEntry, setSavedEntry] = useState<JournalEntry | null>(null);
  const [saveMeta, setSaveMeta] = useState<JournalSaveResult["xp"] | null>(null);
  const [openAiStatus, setOpenAiStatus] = useState<OpenAiCallStatus | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
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
  const [showOptional, setShowOptional] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [fieldError, setFieldError] = useState<
    | { scope: "happiness"; message: string }
    | { scope: "core"; code: CoreStateCode; message: string }
    | null
  >(null);

  const happinessRef = useRef<HTMLDivElement>(null);
  const coreRefs = useRef<Partial<Record<CoreStateCode, HTMLDivElement | null>>>(
    {}
  );

  /** 필수 = 행복도 + 핵심 상태 4개 (점수 필수, 해당 없음 불가) */
  const requiredDone = useMemo(() => {
    let n = happiness != null ? 1 : 0;
    for (const code of CORE_STATE_CODES) {
      const row = core[code];
      if (row && row.ordinal != null && !row.isNotApplicable) n += 1;
    }
    return n;
  }, [happiness, core]);
  const requiredTotal = 1 + CORE_STATE_CODES.length;
  const allRequiredDone = requiredDone >= requiredTotal;

  const hasMeaningfulEvent =
    tags.length > 0 && !tags.includes(NONE_SPECIAL_TAG);
  const visibleTagCodes = useMemo(
    () =>
      showAllTags
        ? ALL_CHECKIN_TAG_CODES
        : Array.from(new Set([...FEATURED_TAG_CODES, ...tags])),
    [showAllTags, tags]
  );
  const recommendedDomainCodes = useMemo(
    () =>
      selectDailyDomains({
        tagCodes: tags,
        recentEntries: allEntries,
        asOfDate: date,
        personalImportance,
      }),
    [tags, allEntries, date, personalImportance]
  );

  const scrollToField = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const enabledCodes = useMemo(
    () => [...CORE_STATE_CODES, ...domains.map((d) => d.code)],
    [domains]
  );

  const uniqueDays = useMemo(
    () => new Set(allEntries.map((e) => e.entryDate)).size,
    [allEntries]
  );

  const syncDomainsFromTags = useCallback(
    (
      nextTags: string[],
      preserve: DomainStateUi[],
      expandAll = showAllDomains
    ) => {
      const selected = expandAll
        ? [...DOMAIN_POOL_CODES]
        : selectDailyDomains({
            tagCodes: nextTags,
            recentEntries: allEntries,
            asOfDate: date,
            personalImportance,
          });
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
    },
    [allEntries, date, showAllDomains, personalImportance]
  );

  const toggleTag = (code: string) => {
    setTags((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        next = prev.filter((t) => t !== code);
      } else if (code === NONE_SPECIAL_TAG) {
        next = [NONE_SPECIAL_TAG];
      } else if (prev.includes(NONE_SPECIAL_TAG)) {
        next = [code];
      } else if (prev.length >= MAX_CHECKIN_TAGS) {
        return prev;
      } else {
        next = [...prev, code];
      }
      const hasEvent =
        next.length > 0 && !next.includes(NONE_SPECIAL_TAG);
      if (!hasEvent) {
        setShowAllDomains(false);
        if (next.includes(NONE_SPECIAL_TAG)) setMainEvent("");
      }
      setDomains((d) =>
        syncDomainsFromTags(next, d, hasEvent ? showAllDomains : false).map(
          (row) =>
            hasEvent
              ? row
              : { ...row, ordinal: null, isNotApplicable: false }
        )
      );
      return next;
    });
  };

  const applySavedForm = useCallback((form: SavedCheckInForm) => {
    setExistingId(form.entryId);
    setDraftHint("");
    setContent(form.content);
    setShowOptional(Boolean(form.content?.trim()));
    setHappiness(form.happiness);
    setMoods(form.moods.slice(0, MAX_MOODS));
    setMainEvent(form.mainEvent);
    setTags(form.tagCodes.slice(0, MAX_CHECKIN_TAGS));
    const nextCore = emptyCore();
    for (const code of CORE_STATE_CODES) {
      const row = form.core[code];
      if (!row) continue;
      nextCore[code] = {
        ordinal: row.isNotApplicable ? null : row.ordinal,
        isNotApplicable: false,
      };
    }
    setCore(nextCore);
    setDomains(
      form.domains.length > 0
        ? form.domains.map((d) => ({
            code: d.code,
            ordinal: d.isNotApplicable ? null : d.ordinal,
            isNotApplicable: false,
          }))
        : syncDomainsFromTags(form.tagCodes, [])
    );
    suppressDraftPersistRef.current = true;
  }, [syncDomainsFromTags]);

  const applyDayFromList = useCallback(
    (targetDate: string, list: JournalEntry[]) => {
      const snapForm = peekLastSavedForm(targetDate);
      // 필수(행복도+핵심4)까지 갖춘 스냅샷만 우선 — 불완전 스냅샷이 빈 core로 덮어쓰지 않게
      if (isSavedFormComplete(snapForm)) {
        clearCheckInDraft(targetDate);
        applySavedForm(snapForm!);
        return;
      }

      const existing =
        list.find((e) => e.entryDate === targetDate) ??
        peekLastSavedEntry(targetDate);

      if (existing) {
        clearCheckInDraft(targetDate);
        setExistingId(existing.id);
        setDraftHint("");
        setContent(existing.content);
        // 자유 일기가 있으면 선택 섹션을 열어 바로 보이게
        setShowOptional(Boolean(existing.content?.trim()));
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
        setTags(
          existing.tags.map((t) => t.tagCode).slice(0, MAX_CHECKIN_TAGS)
        );

        const nextCore = emptyCore();
        if (existing.coreStates) {
          const adapted = adaptLegacyCoreStates(existing.coreStates);
          for (const code of CORE_STATE_CODES) {
            const row = adapted[code];
            nextCore[code] = {
              ordinal:
                row.isNotApplicable || row.ordinal == null
                  ? null
                  : (row.ordinal as OrdinalScore),
              isNotApplicable: false,
            };
          }
        } else {
          for (const s of existing.scores) {
            if (
              !(CORE_STATE_CODES as readonly string[]).includes(s.categoryCode)
            ) {
              continue;
            }
            const code = s.categoryCode as CoreStateCode;
            const score =
              s.isNotApplicable
                ? null
                : s.userScore ?? s.finalScore ?? null;
            nextCore[code] = {
              ordinal: score != null ? journalScoreToOrdinal(score) : null,
              isNotApplicable: Boolean(s.isNotApplicable),
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
              isNotApplicable: false,
            }))
          );
        } else {
          const fromScores = existing.scores
            .filter(
              (s) =>
                (DOMAIN_POOL_CODES as readonly string[]).includes(s.categoryCode) &&
                !s.isNotApplicable &&
                (s.userScore != null || s.finalScore != null)
            )
            .map((s) => {
              const score = s.userScore ?? s.finalScore;
              return {
                code: s.categoryCode as DomainCode,
                ordinal:
                  score != null ? journalScoreToOrdinal(score) : null,
                isNotApplicable: false,
              };
            });
          setDomains(
            fromScores.length > 0
              ? fromScores
              : syncDomainsFromTags(
                  existing.tags.map((t) => t.tagCode),
                  []
                )
          );
        }
        suppressDraftPersistRef.current = true;
        return;
      }

      const draft = loadCheckInDraft(targetDate);
      setExistingId(undefined);
      suppressDraftPersistRef.current = false;
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
            ? draft.domains.map((d) => ({
                ...d,
                ordinal: d.isNotApplicable ? null : d.ordinal,
                isNotApplicable: false,
              }))
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
        setDraftHint("");
      }
    },
    [applySavedForm, syncDomainsFromTags]
  );

  useEffect(() => {
    allEntriesRef.current = allEntries;
  }, [allEntries]);

  const applyDayFromListRef = useRef(applyDayFromList);
  applyDayFromListRef.current = applyDayFromList;

  // 저장 직후 홈→수정: 네트워크보다 먼저 스냅샷으로 폼을 채운다
  useLayoutEffect(() => {
    const snap = peekLastSavedForm(date);
    if (!isSavedFormComplete(snap)) return;
    applyDayFromListRef.current(date, allEntriesRef.current);
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    const dateChanged = loadedDateRef.current !== date;
    const reloadChanged = prevReloadTokenRef.current !== reloadToken;
    const isFirst = loadedDateRef.current === null;
    loadedDateRef.current = date;
    prevReloadTokenRef.current = reloadToken;

    if (dateChanged) {
      setShowComplete(false);
      setSavedEntry(null);
      setSaveMeta(null);
      setOpenAiStatus(null);
      setAiSummary(null);
      setAiExtracting(false);
      setQuote(null);
      setQuoteOpenAi(null);
      setMessage("");
      setDraftHint("");
      setShowOptional(false);
      setShowAllTags(false);
      setShowAllDomains(false);
    }

    // 날짜만 바뀐 경우: 이미 받아 둔 목록으로 즉시 폼 전환 (네트워크 없음)
    if (
      !isFirst &&
      bootstrappedRef.current &&
      dateChanged &&
      !reloadChanged
    ) {
      applyDayFromListRef.current(date, allEntriesRef.current);
      setStatus("idle");
      return;
    }

    (async () => {
      // 첫 진입/외부 갱신만 로딩. 날짜 전환은 위에서 즉시 처리.
      if (!bootstrappedRef.current) setStatus("loading");
      try {
        const storage = await getJournalStorage();

        // 사주/온보딩은 세션당 1회. 목록과 병렬로 돌린다.
        // 오늘(선택 날짜)은 getByDate로 한 번 더 확인해 list 레이스를 막는다.
        const listPromise = storage.list();
        const byDatePromise = storage.getByDate(date).catch(() => null);
        const onboardingPromise = metaLoadedRef.current
          ? Promise.resolve(null as Partial<Record<DomainCode, number>> | null)
          : fetch("/api/journal/onboarding")
              .then(async (res) => {
                if (!res.ok) return null;
                const json = (await res.json()) as {
                  profile?: { personalImportance?: Record<string, number> };
                };
                return (json.profile?.personalImportance ??
                  {}) as Partial<Record<DomainCode, number>>;
              })
              .catch(() => null);

        if (!metaLoadedRef.current) {
          setSajuProfile(loadLocalSajuProfile());
          void loadPrimarySajuProfile()
            .then((remote) => {
              if (!cancelled && remote) setSajuProfile(remote);
            })
            .catch(() => {
              /* keep local */
            });
        }

        const [list, byDate, importance] = await Promise.all([
          listPromise,
          byDatePromise,
          onboardingPromise,
        ]);
        if (cancelled) return;

        const merged =
          byDate && !list.some((e) => e.entryDate === date)
            ? [byDate, ...list]
            : byDate
              ? list.map((e) => (e.entryDate === date ? byDate : e))
              : list;

        setAllEntries(merged);
        allEntriesRef.current = merged;
        if (importance) {
          setPersonalImportance(importance);
        }
        metaLoadedRef.current = true;
        bootstrappedRef.current = true;
        // 목록만 갱신되는 경우(시드·다른 탭 저장 등) 작성 중인 선택을 덮어쓰지 않는다.
        // 다만 저장 직후 progress 이벤트로 재로드될 때는 스냅샷/byDate로 복구한다.
        if (
          isFirst ||
          dateChanged ||
          (reloadChanged &&
            (Boolean(byDate) || isSavedFormComplete(peekLastSavedForm(date))))
        ) {
          applyDayFromListRef.current(date, merged);
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
    // applyDayFromList 는 ref 로 최신값을 쓰므로 deps 에 넣지 않는다.
    // (showAllDomains/allEntries 변경 시 콜백 identity 가 바뀌며 폼이 리셋되던 버그 방지)
  }, [date, reloadToken]);

  // 시드 삭제 등으로 저장소가 바뀌면 다시 로드
  useEffect(() => {
    const onProgress = () => setReloadToken((n) => n + 1);
    window.addEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
    return () => {
      window.removeEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
    };
  }, []);

  // 자동 임시저장 — 아직 저장되지 않은 새 작성 중일 때만 (탭 이동 복원용)
  useEffect(() => {
    if (status !== "idle") return;
    if (existingId) return;
    if (suppressDraftPersistRef.current) return;

    const persist = () => {
      if (suppressDraftPersistRef.current) return;
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
      const hasContent =
        Boolean(content.trim()) ||
        Boolean(mainEvent.trim()) ||
        happiness != null ||
        moods.length > 0 ||
        tags.length > 0 ||
        Object.values(core).some((c) => c.ordinal != null || c.isNotApplicable) ||
        domains.some((d) => d.ordinal != null);
      setDraftHint(hasContent ? "임시 저장됨" : "");
    };

    const t = window.setTimeout(persist, 1200);

    const flushNow = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", flushNow);
    window.addEventListener("pagehide", persist);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", flushNow);
      window.removeEventListener("pagehide", persist);
    };
  }, [
    date,
    content,
    mainEvent,
    happiness,
    moods,
    tags,
    core,
    domains,
    status,
    existingId,
  ]);

  const toggleMood = (m: string) => {
    setMoods((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m);
      if (prev.length >= MAX_MOODS) return prev;
      return [...prev, m];
    });
  };

  const setCoreRow = (code: CoreStateCode, next: CoreStateUi) => {
    setCore((prev) => ({ ...prev, [code]: next }));
    setFieldError((e) => (e?.scope === "core" && e.code === code ? null : e));
  };

  const changeHappiness = (value: HappinessScore | null) => {
    setHappiness(value);
    setFieldError((e) => (e?.scope === "happiness" ? null : e));
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
    const cached = peekDayQuote(entry.entryDate);
    if (cached) {
      setQuote(cached.quote);
      setQuoteOpenAi({ kind: "skipped", detail: "cached_same_day" });
      setQuoteMeta({
        contentType: cached.contentType,
        sourceLabel: cached.sourceLabel,
        authorName: cached.authorName,
        workTitle: cached.workTitle,
        deliveryId: cached.deliveryId,
      });
      setQuoteLoading(false);
      return;
    }

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
      const text = data.sentence ?? data.quote ?? null;
      setQuote(text);
      setQuoteOpenAi(data.openAi ?? null);
      const meta = {
        contentType: data.contentType ?? null,
        sourceLabel: data.sourceLabel ?? null,
        authorName: data.authorName ?? null,
        workTitle: data.workTitle ?? null,
        deliveryId: data.delivery?.deliveryId ?? null,
      };
      setQuoteMeta(meta);
      if (text?.trim()) {
        setDayQuote({
          entryDate: entry.entryDate,
          quote: text,
          ...meta,
          at: Date.now(),
        });
      }
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

  /** 저장 payload 조립 (AI 점수는 선택적으로 병합) */
  const buildSaveInput = (
    aiByCode: Record<string, number | null>,
    aiConfidenceByCode: Record<string, number | null>
  ) => {
    // 생활영역은 선택 입력 — 미응답(ordinal null)은 scores/enabled에 넣지 않는다
    const answeredDomains = domains.filter(
      (d) => d.ordinal != null && !d.isNotApplicable
    );
    const scorePayload = buildCheckInScoreRows({
      core,
      domains: answeredDomains,
    }).map((row) => ({
      ...row,
      aiScore: row.isNotApplicable ? null : aiByCode[row.categoryCode] ?? null,
      aiConfidence: row.isNotApplicable
        ? null
        : aiConfidenceByCode[row.categoryCode] ?? null,
    }));
    const happinessValue = happiness as HappinessScore;
    const saveEnabledCodes = [
      ...CORE_STATE_CODES,
      ...answeredDomains.map((d) => d.code),
    ];
    return {
      entryDate: date,
      content,
      overallSatisfaction: happinessValue,
      happinessScore: happinessValue,
      moodLabel: moods[0] ?? null,
      moodLabels: moods,
      mainEventText: mainEvent.trim() || null,
      scores: scorePayload,
      tagCodes: tags,
      enabledCodes: saveEnabledCodes,
      relaxEnabledCount: true,
      coreStates: buildCoreStatesPayload(core),
      domainScores: buildDomainScoresPayload(answeredDomains),
      checkinVersion: CHECKIN_VERSION_V2,
      existingId,
    };
  };

  /**
   * 본문이 있으면 AI 점수·요약을 추출하고, 저장된 항목을 갱신한다.
   * 저장 이후 백그라운드로 실행되어 저장 버튼을 막지 않는다.
   */
  const runBackgroundAi = async (entryId: string, entries: JournalEntry[]) => {
    let summary: string | null = null;
    if (!content.trim()) {
      setAiExtracting(false);
      setOpenAiStatus({ kind: "skipped", detail: "본문 없음" });
      // 본문이 없으면 재저장 없이 방금 저장한 항목으로 문장만 생성
      const saved = entries.find((e) => e.id === entryId);
      if (saved) void fetchQuote(saved, null, entries);
      return;
    }

    setAiExtracting(true);
    const aiByCode: Record<string, number | null> = {};
    const aiConfidenceByCode: Record<string, number | null> = {};
    let extractStatus: OpenAiCallStatus = { kind: "used" };
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
        scores?: Record<
          string,
          { score?: number | null; confidence?: number | null }
        >;
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
          const cf = data.scores?.[code]?.confidence;
          aiConfidenceByCode[code] =
            typeof cf === "number" && Number.isFinite(cf)
              ? Math.max(0, Math.min(1, cf))
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

    setOpenAiStatus(extractStatus);
    setAiSummary(summary);
    setAiExtracting(false);

    let latest = entries;
    const hasAiScore = Object.values(aiByCode).some((v) => v != null);
    if (hasAiScore) {
      try {
        const storage = await getJournalStorage();
        const reSaved =
          storage.saveWithMeta != null
            ? await storage.saveWithMeta({
                ...buildSaveInput(aiByCode, aiConfidenceByCode),
                existingId: entryId,
              })
            : {
                entry: await storage.save({
                  ...buildSaveInput(aiByCode, aiConfidenceByCode),
                  existingId: entryId,
                }),
              };
        // XP는 최초 저장에서만 지급되므로 재축하하지 않는다.
        setSavedEntry(reSaved.entry);
        latest = await storage.list();
        setAllEntries(latest);
        setSavedUniqueDays(new Set(latest.map((e) => e.entryDate)).size);
        void fetchQuote(reSaved.entry, summary, latest);
        return;
      } catch {
        /* 재저장 실패 시 방금 저장본으로 문장 생성 */
      }
    }

    const saved = latest.find((e) => e.id === entryId);
    if (saved) void fetchQuote(saved, summary, latest);
  };

  const handleSave = async () => {
    setMessage("");
    setOpenAiStatus(null);
    setAiSummary(null);
    setFieldError(null);
    const editingExisting = Boolean(existingId);

    // 인라인 필수 검증 — 빠진 첫 항목으로 스크롤
    if (happiness == null) {
      setFieldError({ scope: "happiness", message: "행복도를 골라주세요." });
      scrollToField(happinessRef.current);
      return;
    }
    for (const code of CORE_STATE_CODES) {
      const row = core[code];
      if (!row || row.ordinal == null || row.isNotApplicable) {
        setFieldError({
          scope: "core",
          code,
          message: "1~5 중 하나를 골라주세요.",
        });
        scrollToField(coreRefs.current[code] ?? null);
        return;
      }
    }

    const check = validateCheckInSave({
      happiness,
      moods,
      tagCodes: tags,
      core,
      domains,
    });
    if (!check.ok) {
      setMessage(check.error);
      return;
    }

    setStatus("saving");

    try {
      const serverCheck = await fetch("/api/journal/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          happiness,
          moods,
          tagCodes: tags,
          core,
          domains,
        }),
      });
      if (!serverCheck.ok) {
        const data = (await serverCheck.json().catch(() => ({}))) as {
          error?: string;
        };
        setMessage(data.error ?? "서버 검증에 실패했어요.");
        setStatus("idle");
        return;
      }
    } catch {
      // 오프라인 등 — 로컬 validateCheckInSave는 통과했으므로 저장 계속
    }

    try {
      // 1) AI 없이 먼저 저장 — 버튼을 오래 막지 않는다.
      const storage = await getJournalStorage();
      const saveInput = buildSaveInput({}, {});

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
      suppressDraftPersistRef.current = true;
      setExistingId(result.entry.id);
      setSavedEntry(result.entry);
      setSaveMeta(result.xp);
      setLastSavedCheckIn(
        result.entry,
        buildSavedCheckInForm({
          entry: result.entry,
          content,
          mainEvent,
          happiness,
          moods,
          tagCodes: tags,
          core,
          domains: domains.filter(
            (d) => d.ordinal != null && !d.isNotApplicable
          ),
        })
      );
      // 저장 완료 팝업 + 축하 이펙트 (닫으면 홈)
      setQuote(null);
      setQuoteLoading(true);
      setQuoteOpenAi(null);
      setQuoteMeta({
        contentType: null,
        sourceLabel: null,
        authorName: null,
        workTitle: null,
        deliveryId: null,
      });
      setShowComplete(true);
      notifyJournalProgressChanged();
      notifyProgressCelebration({
        gainedXp: result.xp.gainedXp,
        leveledUp: result.xp.leveledUp,
        level: result.xp.level,
        previousLevel: result.xp.previousLevel,
        wasFirstSaveOfDay: result.xp.wasFirstSaveOfDay,
        suppressXpToast: true,
      });

      void reportQuestionFeedback({
        questionDate: date,
        eventType: "led_to_write",
        payload: {
          entryId: result.entry.id,
          wasFirstSaveOfDay: result.xp.wasFirstSaveOfDay,
          checkinVersion: CHECKIN_VERSION_V2,
        },
      });

      void trackContentExposure({
        eventDate: date,
        contentType: "checkin",
        contentId: result.entry.id,
        eventType: "checkin_completed",
        metadata: {
          checkinVersion: CHECKIN_VERSION_V2,
          wasFirstSaveOfDay: result.xp.wasFirstSaveOfDay,
          domains: domains.filter((d) => d.ordinal != null).length,
        },
      });
      if (content.trim().length > 0) {
        void trackContentExposure({
          eventDate: date,
          contentType: "free_diary",
          contentId: result.entry.id,
          eventType: "diary_completed",
          metadata: { chars: content.trim().length },
        });
      }

      const list = await storage.list();
      setAllEntries(list);
      setSavedUniqueDays(new Set(list.map((e) => e.entryDate)).size);

      scheduleAstrologySnapshotAfterJournalSave({
        localDate: result.entry.entryDate,
      });
      schedulePersonalizationTrainAfterJournalSave({
        localDate: result.entry.entryDate,
        categoryKeys: saveInput.enabledCodes,
      });

      setStatus("idle");
      if (editingExisting) {
        // 수정 저장: OpenAI 재추출·재생성 없이 기존 문장 재사용
        setAiExtracting(false);
        setOpenAiStatus({ kind: "skipped", detail: "수정 저장 — 기존 분석 유지" });
        setAiSummary(null);
        void fetchQuote(result.entry, null, list);
      } else {
        void runBackgroundAi(result.entry.id, list);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장에 실패했어요.");
      setStatus("idle");
    }
  };

  const requiredBadge = (
    <span
      className="text-[10px] font-black px-1.5 py-0.5 border"
      style={{
        borderColor: HAPPINESS_PINK,
        color: HAPPINESS_PINK,
        background: `color-mix(in srgb, ${HAPPINESS_PINK} 12%, transparent)`,
      }}
    >
      필수
    </span>
  );

  return (
    <div className="space-y-4 pb-24">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <p className="ui-section-title">■ 오늘 상태 체크</p>
            <span className="ui-hint">약 1분이면 충분해요</span>
          </div>
          {draftHint && <p className="ui-hint shrink-0">{draftHint}</p>}
        </div>
        <div className="space-y-1.5" aria-label={`기록 날짜 ${date}`}>
          <div className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="shrink-0 w-11 border-2 flex items-center justify-center text-lg font-black"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg3)",
                color: "var(--px-text-on-panel)",
              }}
              aria-label="하루 전"
              title="하루 전"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={openDatePicker}
              className="flex-1 min-w-0 border-2 px-3 py-2.5 text-left"
              style={{
                borderColor: "var(--px-accent)",
                background: "var(--px-bg2)",
                boxShadow: "2px 2px 0 #000",
              }}
              aria-label="날짜 바꾸기"
              title="달력 열기"
            >
              <p
                className="text-[10px] font-bold leading-none"
                style={{ color: "var(--px-text2)" }}
              >
                {isToday ? "오늘 기록" : "다른 날 기록"}
              </p>
              <p
                className="mt-1 text-base font-black tabular-nums leading-tight"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {dateParts.year}년 {Number(dateParts.month)}월{" "}
                {Number(dateParts.day)}일{" "}
                <span style={{ color: "var(--px-accent)" }}>
                  {dateParts.weekday}요일
                </span>
              </p>
            </button>

            <button
              type="button"
              onClick={() => shiftDate(1)}
              disabled={!canGoNext}
              className="shrink-0 w-11 border-2 flex items-center justify-center text-lg font-black disabled:opacity-35"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg3)",
                color: "var(--px-text-on-panel)",
              }}
              aria-label="하루 뒤"
              title={canGoNext ? "하루 뒤" : "오늘 이후는 선택할 수 없어요"}
            >
              ›
            </button>
          </div>

          <input
            ref={dateInputRef}
            type="date"
            value={date}
            max={todayIso}
            onChange={(e) => {
              const next = e.target.value;
              if (!next) return;
              setDate(next > todayIso ? todayIso : next);
            }}
            className="sr-only"
            tabIndex={-1}
          />

          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayIso)}
              className="text-[11px] font-black underline"
              style={{ color: "var(--px-accent)" }}
            >
              오늘로 돌아가기
            </button>
          )}
        </div>
      </header>

      <TodayQuestionCard
        todayDate={date}
        enabledCodes={[...CORE_STATE_CODES]}
        entries={allEntries}
        sajuProfile={sajuProfile}
      />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="ui-section-title">■ 오늘의 기록</p>
          {content.trim().length > 0 && (
            <p className="ui-hint shrink-0 tabular-nums">
              {content.trim().length}자
            </p>
          )}
        </div>
        {content.trim().length === 0 && (
          <p className="ui-hint">
            한 줄만 적어도 AI가 오늘 감정·점수를 읽어 운세와 문장에 반영해요.
          </p>
        )}
        <textarea
          value={content}
          onChange={(e) => {
            const next = e.target.value;
            if (next.trim().length > 0 && diaryStartedRef.current !== date) {
              diaryStartedRef.current = date;
              void trackContentExposure({
                eventDate: date,
                contentType: "free_diary",
                eventType: "diary_started",
              });
            }
            setContent(next);
          }}
          rows={4}
          placeholder="예) 오늘은 회의가 길었지만, 끝나고 산책하니 좀 풀렸다."
          className="w-full px-3 py-2 border-2 text-sm resize-none"
          style={{
            background: "var(--px-bg3)",
            borderColor: content.trim()
              ? "var(--px-accent)"
              : "var(--px-border)",
            color: "var(--px-text-on-panel)",
          }}
        />
        {content.trim().length > 0 && (
          <p className="ui-hint">
            고마워요. 남긴 글로 오늘의 문장과 운세가 더 잘 맞아요.
          </p>
        )}
      </section>

      <section
        ref={happinessRef}
        className="space-y-3 p-3 border-2 scroll-mt-4"
        style={{
          borderColor:
            fieldError?.scope === "happiness" ? "#ef4444" : HAPPINESS_PINK,
          background: `color-mix(in srgb, ${HAPPINESS_PINK} 10%, var(--px-bg2))`,
          boxShadow: `3px 3px 0 color-mix(in srgb, ${HAPPINESS_PINK} 45%, #000)`,
        }}
      >
        <div className="flex items-center gap-2">
          <p
            className="text-base font-black tracking-wide"
            style={{ color: HAPPINESS_PINK }}
          >
            ■ 행복도 (0~10)
          </p>
          {requiredBadge}
        </div>
        <HappinessSlider
          label="행복도"
          value={happiness}
          onChange={changeHappiness}
        />
        {fieldError?.scope === "happiness" && (
          <p className="text-[11px] font-bold" style={{ color: "#ef4444" }}>
            {fieldError.message}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex justify-between items-baseline gap-2">
          <p className="ui-section-title">■ 기분</p>
          <p className="ui-hint">
            {moods.length}/{MAX_MOODS}
          </p>
        </div>
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
                onClick={(e) => {
                  const wasOn = moods.includes(m);
                  toggleMood(m);
                  // 선택할 때만 이펙트 (해제는 조용히)
                  if (!wasOn && !blocked) {
                    celebrateClick(e, { variant: "mood", label: m });
                  }
                }}
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
        <div className="flex items-center gap-2">
          <p className="ui-section-title">■ 핵심 상태</p>
          {requiredBadge}
        </div>
        {CORE_STATE_CODES.map((code) => {
          const cat = getCategoryByCode(code);
          const s = core[code];
          const errored = fieldError?.scope === "core" && fieldError.code === code;
          return (
            <div
              key={code}
              ref={(el) => {
                coreRefs.current[code] = el;
              }}
              className="p-3 border-2 space-y-2 scroll-mt-4"
              style={{
                borderColor: errored ? "#ef4444" : "var(--px-border)",
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
                value={s.ordinal}
                onChange={(n) =>
                  setCoreRow(code, { ordinal: n, isNotApplicable: false })
                }
              />
              {errored && (
                <p className="text-[11px] font-bold" style={{ color: "#ef4444" }}>
                  {fieldError.message}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          aria-expanded={showOptional}
          className="w-full text-left px-3 py-3 border-2"
          style={{
            borderColor: allRequiredDone
              ? "var(--px-accent)"
              : "var(--px-border)",
            background: allRequiredDone
              ? "color-mix(in srgb, var(--px-accent) 10%, var(--px-bg2))"
              : "var(--px-bg2)",
            color: "var(--px-text-on-panel)",
            boxShadow: allRequiredDone ? "2px 2px 0 #000" : "none",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="ui-section-title">
              {showOptional ? "■ 접기" : "■ 무슨 일이 있었나요? (선택)"}
            </span>
            <span className="ui-hint shrink-0">
              {showOptional ? "▲" : "▼"}
            </span>
          </div>
        </button>
      </div>

      {showOptional && (
        <div className="space-y-4">
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="ui-hint">최대 {MAX_CHECKIN_TAGS}개</p>
              <p className="ui-hint tabular-nums shrink-0">
                {tags.length}/{MAX_CHECKIN_TAGS}
              </p>
            </div>

            {visibleTagCodes.includes(NONE_SPECIAL_TAG) && (
              <div>
                {(() => {
                  const on = tags.includes(NONE_SPECIAL_TAG);
                  return (
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(NONE_SPECIAL_TAG)}
                      className="min-h-10 px-3 py-2 text-sm font-bold border-2"
                      style={{
                        borderColor: on
                          ? "var(--px-accent)"
                          : "var(--px-border)",
                        color: on
                          ? "var(--px-accent)"
                          : "var(--px-text-on-panel)",
                        background: on
                          ? "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg3))"
                          : "var(--px-bg3)",
                        boxShadow: on ? "2px 2px 0 #000" : "none",
                      }}
                    >
                      {getTagName(NONE_SPECIAL_TAG)}
                    </button>
                  );
                })()}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {visibleTagCodes
                .filter((code) => code !== NONE_SPECIAL_TAG)
                .map((code) => {
                  const on = tags.includes(code);
                  const blocked = !on && tags.length >= MAX_CHECKIN_TAGS;
                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={blocked}
                      aria-pressed={on}
                      onClick={() => toggleTag(code)}
                      className="min-h-10 px-3 py-2 text-sm font-bold border-2 disabled:opacity-40"
                      style={{
                        borderColor: on
                          ? "var(--px-accent)"
                          : "var(--px-border)",
                        color: on
                          ? "var(--px-accent)"
                          : "var(--px-text-on-panel)",
                        background: on
                          ? "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg3))"
                          : "var(--px-bg3)",
                        boxShadow: on ? "2px 2px 0 #000" : "none",
                      }}
                    >
                      {getTagName(code)}
                    </button>
                  );
                })}
            </div>

            <button
              type="button"
              className="ui-hint underline"
              onClick={() => setShowAllTags((v) => !v)}
            >
              {showAllTags ? "접기" : "더 보기"}
            </button>
          </section>

          {hasMeaningfulEvent && (
            <section
              className="space-y-3 pt-3"
              style={{ borderTop: "2px solid var(--px-border)" }}
            >
              {domains.map((d) => {
                const cat = getCategoryByCode(d.code);
                const isRecommended = recommendedDomainCodes.includes(d.code);
                return (
                  <div
                    key={d.code}
                    className="p-3 border-2 space-y-2"
                    style={{
                      borderColor: d.ordinal
                        ? "var(--px-accent)"
                        : "var(--px-border)",
                      background: "var(--px-bg2)",
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="ui-hint font-bold">
                        {cat?.name ?? d.code}
                      </p>
                      {showAllDomains && (
                        <span className="ui-hint">
                          {isRecommended ? "추천" : "직접 추가"}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm font-black leading-snug"
                      style={{ color: "var(--px-text-on-panel)" }}
                    >
                      {cat?.question}
                    </p>
                    <OrdinalPicker
                      label={cat?.name ?? d.code}
                      value={d.ordinal}
                      labels={EVENT_REACTION_LABELS}
                      onChange={(n) =>
                        setDomainRow(d.code, {
                          ordinal: n,
                          isNotApplicable: false,
                        })
                      }
                    />
                  </div>
                );
              })}

              <button
                type="button"
                className="ui-hint underline"
                onClick={() => {
                  setShowAllDomains((v) => {
                    const next = !v;
                    setDomains((d) => syncDomainsFromTags(tags, d, next));
                    return next;
                  });
                }}
              >
                {showAllDomains ? "추천만 보기" : "다른 영역도 고르기"}
              </button>

              <div className="space-y-1 pt-1">
                <label htmlFor="checkin-main-event" className="ui-hint">
                  특히 기억할 일 (선택)
                </label>
                <input
                  id="checkin-main-event"
                  type="text"
                  value={mainEvent}
                  onChange={(e) => setMainEvent(e.target.value)}
                  placeholder="예) 팀 발표를 무사히 마침"
                  className="w-full px-3 py-2 border-2 text-sm"
                  style={{
                    background: "var(--px-bg3)",
                    borderColor: "var(--px-border)",
                    color: "var(--px-text)",
                  }}
                />
              </div>
            </section>
          )}
        </div>
      )}

      <div
        className="sticky bottom-0 pt-3 pb-1 space-y-1.5 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, var(--px-bg) 88%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className="flex-1 h-1.5 border overflow-hidden"
            style={{
              borderColor: "var(--px-border)",
              background: "var(--px-bg3)",
            }}
            aria-hidden
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${Math.round((requiredDone / requiredTotal) * 100)}%`,
                background: allRequiredDone
                  ? "var(--px-accent)"
                  : HAPPINESS_PINK,
              }}
            />
          </div>
          <p
            className="text-[11px] font-bold tabular-nums shrink-0"
            style={{
              color: allRequiredDone ? "var(--px-accent)" : "var(--px-text2)",
            }}
          >
            {allRequiredDone
              ? `필수 ${requiredTotal}/${requiredTotal} 완료`
              : `필수 ${requiredDone}/${requiredTotal}`}
          </p>
        </div>
        <button
          type="button"
          className="ui-primary-btn w-full py-3 text-sm pointer-events-auto"
          disabled={status !== "idle"}
          onClick={() => void handleSave()}
        >
          {status === "saving"
            ? "저장 중…"
            : existingId
              ? "수정 저장"
              : "저장"}
        </button>
        {message && (
          <p className="text-[11px] font-bold" style={{ color: "#ef4444" }}>
            {message}
          </p>
        )}
      </div>

      <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
        예전 입력 화면이 필요하면{" "}
        <Link href="/journal?legacy=1" className="underline">
          여기
        </Link>
      </p>

      {showComplete && savedEntry && saveMeta && (
        <JournalSaveCompleteModal
          entry={savedEntry}
          xp={saveMeta}
          uniqueDays={savedUniqueDays || uniqueDays}
          openAiExtract={openAiStatus}
          aiSummary={aiSummary}
          aiExtracting={aiExtracting}
          quote={quote}
          quoteOpenAi={quoteOpenAi}
          quoteLoading={quoteLoading}
          contentType={quoteMeta.contentType}
          sourceLabel={quoteMeta.sourceLabel}
          authorName={quoteMeta.authorName}
          workTitle={quoteMeta.workTitle}
          deliveryId={quoteMeta.deliveryId}
          onClose={() => {
            setShowComplete(false);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
