"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { SajuResult } from "@/lib/saju/types";
import type { Element } from "@/lib/saju/constants";
import { BRANCH_META, ELEMENT_LABELS, STEM_META } from "@/lib/saju/constants";
import { getTenGod, getHiddenStemsByBranch, type HiddenStemByPillar, type HiddenStemWithTenGod, type StemHanja } from "@/lib/saju/hiddenStems";
import ExpertInsightsForSaju from "@/components/saju/ExpertInsightsForSaju";
import CoachmarkOverlay from "@/components/CoachmarkOverlay";
import Link from "next/link";
import {
  hasSeenExploreGuide,
  loadSajuViewMode,
  markExploreGuideSeen,
  markSajuViewModeHintSeen,
  saveSajuViewMode,
  type SajuViewMode,
} from "@/lib/diary/onboarding";
import { useViewMode } from "@/contexts/ViewModeContext";
import {
  calculateElementDistributionFromPillars,
  ELEMENT_EN_TO_KO,
} from "@/lib/saju/elementDistribution";
import { getSewoonYearsForDaeunCycle } from "@/lib/saju/daeun";

// ── 오행별 픽셀 게임 색상 ──
const ELEM: Record<Element, { text: string; bg: string; border: string }> = {
  wood:  { text: "#4ade80", bg: "#052e1688", border: "#4ade8077" },
  fire:  { text: "#f87171", bg: "#2d000088", border: "#f8717177" },
  earth: { text: "#fbbf24", bg: "#2d200088", border: "#fbbf2477" },
  metal: { text: "#cbd5e1", bg: "#0d111788", border: "#cbd5e177" },
  water: { text: "#60a5fa", bg: "#0a0f2e88", border: "#60a5fa77" },
};

const ELEM_KO: Record<Element, string> = {
  wood: "목", fire: "화", earth: "토", metal: "금", water: "수",
};

type PillarKey = "year" | "month" | "day" | "hour";
type AgeMode = "international" | "korean";

type HighlightSelection =
  | { kind: "stem"; source: "pillar" | "daeun-slot" | "daeun-table"; pillar: PillarKey | "all"; element: Element; label: string }
  | { kind: "branch-stem-match"; scope: "pillar" | "daeun"; pillar: PillarKey; label: string; element: Element }
  | null;

type HighlightHintState = {
  char: string;
  kind: "뿌리" | "투출";
  color: string;
};

function isSameHighlightSelection(a: HighlightSelection, b: HighlightSelection): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "stem" && b.kind === "stem") {
    return a.source === b.source && a.pillar === b.pillar && a.element === b.element;
  }
  if (a.kind === "branch-stem-match" && b.kind === "branch-stem-match") {
    return a.scope === b.scope && a.pillar === b.pillar;
  }
  return false;
}

/** 지지 지장간 → 천간 투출 (같은 오행이면 투출로 간주) */
function isHiddenStemHighlighted(
  selection: HighlightSelection,
  context: "pillar" | "daeun",
  pillarKey: PillarKey,
  hiddenStem: HiddenStemWithTenGod,
  touchoElements: Set<Element>,
): boolean {
  if (!selection) return false;
  if (selection.kind === "stem") {
    // 천간 클릭 → 같은 오행 지장간 = 뿌리 (원국·대운 지장간 모두)
    return hiddenStem.element === selection.element;
  }
  if (selection.kind === "branch-stem-match") {
    // 지지 클릭 → 해당 지지의 투출된 지장간 (같은 오행)
    if (context !== selection.scope) return false;
    if (selection.scope === "pillar" && pillarKey !== selection.pillar) return false;
    return touchoElements.has(hiddenStem.element);
  }
  return false;
}

/** 지지 클릭 시, 해당 지장간 오행이 천간으로 투출했는지 */
function isStemTouchoOfBranch(
  selection: HighlightSelection,
  stemElement: Element,
  branchHiddenStems: HiddenStemWithTenGod[] | undefined,
): boolean {
  if (!selection || selection.kind !== "branch-stem-match") return false;
  if (!branchHiddenStems?.length) return false;
  return branchHiddenStems.some((hs) => hs.element === stemElement);
}

/** 천간 클릭 시, 해당 지지(원국/대운)가 뿌리를 가진 경우 */
function branchHasStemRoot(
  selection: HighlightSelection,
  branchHiddenStems: HiddenStemWithTenGod[] | undefined,
): boolean {
  if (!selection || selection.kind !== "stem") return false;
  if (!branchHiddenStems?.length) return false;
  return branchHiddenStems.some((hs) => hs.element === selection.element);
}

type HighlightTone = "source" | "related" | null;

function highlightToneClass(tone: HighlightTone): string {
  if (tone === "source") return "ganji-clickable-source";
  if (tone === "related") return "ganji-clickable-related";
  return "";
}

function daeunGroupHighlightStyle(tone: HighlightTone): CSSProperties {
  if (tone === "source") {
    return {
      border: "2px solid #fbbf24",
      boxShadow: "0 0 14px #fbbf2499",
      background: "#fbbf2422",
    };
  }
  if (tone === "related") {
    return {
      border: "2px solid #c084fc",
      boxShadow: "0 0 14px #c084fc99",
      background: "#c084fc22",
    };
  }
  return {
    border: "1px solid transparent",
    background: "transparent",
  };
}

const PILLAR_META: Record<PillarKey, { ko: string; hanja: string }> = {
  year:  { ko: "년주", hanja: "年柱" },
  month: { ko: "월주", hanja: "月柱" },
  day:   { ko: "일주", hanja: "日柱" },
  hour:  { ko: "시주", hanja: "時柱" },
};

// 전통 사주 표기: 오른쪽부터 年→月→日→時
// 화면 왼쪽부터: 시주, 일주, 월주, 년주
const DISPLAY_ORDER: PillarKey[] = ["hour", "day", "month", "year"];

export default function SajuResult({ result }: { result: SajuResult }) {
  const { isMobile } = useViewMode();
  const charSize = isMobile ? "28px" : "40px";
  const labelSize = "12px";
  /** 연구 모드 대운·년운 — 원국보다 작게 */
  const luckCharSize = isMobile ? "20px" : "28px";
  const luckLabelSize = isMobile ? "11px" : "12px";
  const pillarTitleSize = isMobile ? "13px" : "15px";
  const [showCalcDebug, setShowCalcDebug] = useState(false);
  const [daeunAgeMode, setDaeunAgeMode] = useState<AgeMode>("international");
  const [viewMode, setViewMode] = useState<SajuViewMode>("simple");
  const [showExploreGuide, setShowExploreGuide] = useState(false);
  const [highlightHint, setHighlightHint] = useState<HighlightHintState | null>(null);
  const [highlightSelection, setHighlightSelection] = useState<HighlightSelection>(null);
  const [selectedDaeunOrder, setSelectedDaeunOrder] = useState<number | null>(null);
  const [selectedSewoonYear, setSelectedSewoonYear] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<FlyerData[]>([]);
  const [arrivedSlots, setArrivedSlots] = useState<Set<string>>(new Set());
  const [pumpingSlots, setPumpingSlots] = useState<Set<string>>(new Set());
  const [pumpGeneration, setPumpGeneration] = useState(0);
  const pumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daeunSectionRef = useRef<HTMLDivElement>(null);
  const chartAnchorRef = useRef<HTMLDivElement>(null);
  const scrollAnchorTopRef = useRef<number | null>(null);
  const chartHeightBeforeRef = useRef<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const daeunStemSlotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const daeunBranchSlotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const { pillars, debug, input } = result;
  const daeun = result.daeun;
  const hiddenStems = result.hiddenStems;
  const dayStem = pillars.day.stem.hanja as StemHanja;
  const exploreMode = viewMode === "explore";
  /** 대운 선택 — 기본/연구 모드 공통 */
  const selectedDaeun = daeun.cycles.find((c) => c.order === selectedDaeunOrder) ?? null;
  const selectedSewoon = useMemo(() => {
    if (!selectedDaeun || selectedSewoonYear == null) return null;
    return getSewoonYearsForDaeunCycle(selectedDaeun).find((y) => y.year === selectedSewoonYear) ?? null;
  }, [selectedDaeun, selectedSewoonYear]);
  /** 연구 모드: 각 기둥에 대운 겹침 / 기본 모드: 년주 오른쪽 별도 칸 */
  const overlayDaeun = exploreMode && !!selectedDaeun;
  const overlayYearly = exploreMode && !!selectedSewoon;
  const sideDaeun = !exploreMode && !!selectedDaeun;
  const sideYearly = !exploreMode && !!selectedSewoon;

  useEffect(() => {
    setViewMode(loadSajuViewMode());
  }, []);

  const resetInteractionState = useCallback(() => {
    setHighlightSelection(null);
    setHighlightHint(null);
    setSelectedDaeunOrder(null);
    setSelectedSewoonYear(null);
    setFlyers([]);
    setArrivedSlots(new Set());
    setPumpingSlots(new Set());
    setPumpGeneration((g) => g + 1);
    if (pumpTimerRef.current) {
      clearTimeout(pumpTimerRef.current);
      pumpTimerRef.current = null;
    }
  }, []);

  const handleViewModeChange = (mode: SajuViewMode) => {
    if (mode === viewMode) return;
    captureScrollAnchor();
    resetInteractionState();
    setViewMode(mode);
    saveSajuViewMode(mode);
    if (mode === "explore") {
      markSajuViewModeHintSeen();
      if (!hasSeenExploreGuide()) {
        setShowExploreGuide(true);
      }
    }
  };

  const completeExploreGuide = () => {
    markExploreGuideSeen();
    setShowExploreGuide(false);
  };

  const toggleHighlightWithHint = useCallback((next: Exclude<HighlightSelection, null>) => {
    setHighlightSelection((prev) => {
      const clearing = isSameHighlightSelection(prev, next);
      if (clearing) {
        setHighlightHint(null);
        return null;
      }
      if (next.kind === "stem") {
        setHighlightHint({
          char: next.label,
          kind: "뿌리",
          color: ELEM[next.element].text,
        });
      } else {
        setHighlightHint({
          char: next.label,
          kind: "투출",
          color: ELEM[next.element].text,
        });
      }
      return next;
    });
  }, []);

  const elementDistribution = useMemo(() => {
    const daewoonInput = selectedDaeun
      ? { stem: selectedDaeun.ganji[0], branch: selectedDaeun.ganji[1] }
      : null;
    const yearlyInput = selectedSewoon
      ? { stem: selectedSewoon.ganji[0], branch: selectedSewoon.ganji[1] }
      : null;
    return calculateElementDistributionFromPillars(pillars, daewoonInput, yearlyInput);
  }, [pillars, selectedDaeun, selectedSewoon]);
  const hiddenStemItemsByPillar = Object.fromEntries(
    hiddenStems.items.map((item) => [item.pillar, item])
  ) as Partial<Record<PillarKey, HiddenStemByPillar>>;

  const toggleHighlight = useCallback((next: Exclude<HighlightSelection, null>) => {
    if (!exploreMode) return;
    toggleHighlightWithHint(next);
  }, [exploreMode, toggleHighlightWithHint]);

  const visibleStemElements = useMemo(() => {
    const set = new Set<Element>();
    for (const k of DISPLAY_ORDER) {
      const p = pillars[k];
      if (p) set.add(p.stem.element);
    }
    if (selectedDaeun) {
      const el = STEM_META[selectedDaeun.ganji[0]]?.element;
      if (el) set.add(el);
    }
    if (selectedSewoon) {
      const el = STEM_META[selectedSewoon.ganji[0]]?.element;
      if (el) set.add(el);
    }
    return set;
  }, [pillars, selectedDaeun, selectedSewoon]);

  const highlightBranchHiddenStems = useMemo(() => {
    if (!highlightSelection || highlightSelection.kind !== "branch-stem-match") return undefined;
    if (highlightSelection.scope === "daeun") {
      if (!selectedDaeun) return undefined;
      return getBranchHiddenStemsWithTenGod(selectedDaeun.ganji[1], dayStem);
    }
    return hiddenStemItemsByPillar[highlightSelection.pillar]?.hiddenStems;
  }, [highlightSelection, selectedDaeun, dayStem, hiddenStemItemsByPillar]);

  const touchoElements = useMemo(() => {
    const set = new Set<Element>();
    if (!highlightBranchHiddenStems) return set;
    for (const hs of highlightBranchHiddenStems) {
      if (visibleStemElements.has(hs.element)) set.add(hs.element);
    }
    return set;
  }, [highlightBranchHiddenStems, visibleStemElements]);

  // 오행 분포 (천간·지지 가중합 기반)
  const elemPct: Record<Element, number> = {
    wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
  };
  if (elementDistribution) {
    for (const elem of Object.keys(elemPct) as Element[]) {
      const ko = ELEMENT_EN_TO_KO[elem];
      elemPct[elem] = elementDistribution.percentage[ko];
    }
  }

  const allDaeunSlotIds = useCallback(() => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(`stem-${i}`, `branch-${i}`);
    }
    return ids;
  }, []);

  const triggerMobilePump = useCallback(() => {
    if (pumpTimerRef.current) clearTimeout(pumpTimerRef.current);
    setPumpingSlots(new Set());

    requestAnimationFrame(() => {
      const slots = new Set(allDaeunSlotIds());
      setPumpGeneration((g) => g + 1);
      setArrivedSlots(slots);
      setPumpingSlots(slots);
      pumpTimerRef.current = setTimeout(() => {
        setPumpingSlots(new Set());
        pumpTimerRef.current = null;
      }, 650);
    });
  }, [allDaeunSlotIds]);

  useEffect(() => {
    return () => {
      if (pumpTimerRef.current) clearTimeout(pumpTimerRef.current);
    };
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  const findScrollParent = useCallback((el: HTMLElement | null): HTMLElement | null => {
    let node = el?.parentElement ?? null;
    while (node) {
      const { overflowY } = getComputedStyle(node);
      if (
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  const captureScrollAnchor = useCallback(() => {
    const el = chartAnchorRef.current ?? daeunSectionRef.current;
    if (!el) return;
    chartHeightBeforeRef.current = el.offsetHeight;
    scrollAnchorTopRef.current = el.getBoundingClientRect().top;
  }, []);

  const compensateScrollAnchor = useCallback(() => {
    const el = chartAnchorRef.current ?? daeunSectionRef.current;
    if (!el) return;
    const scrollParent = findScrollParent(el);
    const applyDelta = (delta: number) => {
      if (Math.abs(delta) <= 0.5) return;
      if (scrollParent) scrollParent.scrollTop += delta;
      else window.scrollBy(0, delta);
    };

    // 높이 변화만큼 스크롤 보정 → 아래 내용(카메라)이 튀지 않음
    if (chartHeightBeforeRef.current !== null) {
      const deltaH = el.offsetHeight - chartHeightBeforeRef.current;
      chartHeightBeforeRef.current = null;
      applyDelta(deltaH);
    } else if (scrollAnchorTopRef.current !== null) {
      const newTop = el.getBoundingClientRect().top;
      const delta = newTop - scrollAnchorTopRef.current;
      scrollAnchorTopRef.current = null;
      applyDelta(delta);
    } else {
      scrollAnchorTopRef.current = null;
    }
  }, [findScrollParent]);

  useLayoutEffect(() => {
    compensateScrollAnchor();
  }, [selectedDaeunOrder, exploreMode, compensateScrollAnchor]);

  const handleFlyerArrive = useCallback((slotId: string, flyerId: string) => {
    setArrivedSlots((prev) => new Set(prev).add(slotId));
    setFlyers((prev) => prev.filter((f) => f.id !== flyerId));
  }, []);

  const launchFlyers = useCallback((
    sourceEl: HTMLElement,
    stemChar: string,
    stemColor: string,
    stemElement: Element,
    branchChar: string,
    branchColor: string,
    branchElement: Element,
  ) => {
    const getBottomCenter = (el: HTMLElement | null, fallback: DOMRect) => {
      if (!el) return { x: fallback.left + fallback.width / 2, y: fallback.bottom };
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.bottom };
    };

    const src = sourceEl.getBoundingClientRect();
    const stemPart = sourceEl.querySelector('[data-ganji-part="stem"]') as HTMLElement | null;
    const branchPart = sourceEl.querySelector('[data-ganji-part="branch"]') as HTMLElement | null;
    const stemStart = getBottomCenter(stemPart, src);
    const branchStart = getBottomCenter(branchPart, src);
    const now = Date.now();

    const list: FlyerData[] = [];

    daeunStemSlotRefs.current.forEach((el, i) => {
      if (!el) return;
      list.push({
        id: `st${i}-${now}`,
        slotId: `stem-${i}`,
        char: stemChar,
        color: stemColor,
        element: stemElement,
        sx: stemStart.x,
        sy: stemStart.y,
        getTarget: () => {
          const slot = daeunStemSlotRefs.current[i];
          if (!slot) return stemStart;
          const charEl = slot.querySelector("[data-flyer-char]") as HTMLElement | null;
          if (charEl) {
            const r = charEl.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.bottom };
          }
          const r = slot.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.bottom };
        },
        delay: i * 90,
      });
    });

    daeunBranchSlotRefs.current.forEach((el, i) => {
      if (!el) return;
      list.push({
        id: `br${i}-${now}`,
        slotId: `branch-${i}`,
        char: branchChar,
        color: branchColor,
        element: branchElement,
        sx: branchStart.x,
        sy: branchStart.y,
        getTarget: () => {
          const slot = daeunBranchSlotRefs.current[i];
          if (!slot) return branchStart;
          const charEl = slot.querySelector("[data-flyer-char]") as HTMLElement | null;
          if (charEl) {
            const r = charEl.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.bottom };
          }
          const r = slot.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.bottom };
        },
        delay: i * 90 + 45,
      });
    });

    setFlyers(list);
  }, []);

  const handleDaeunClick = useCallback((
    cycleOrder: number,
    isSelected: boolean,
    sourceEl: HTMLElement | null,
    stemChar: string,
    stemColor: string,
    stemElement: Element,
    branchChar: string,
    branchColor: string,
    branchElement: Element,
  ) => {
    captureScrollAnchor();

    if (isSelected) {
      setSelectedDaeunOrder(null);
      setSelectedSewoonYear(null);
      setFlyers([]);
      setArrivedSlots(new Set());
      setPumpingSlots(new Set());
      setPumpGeneration((g) => g + 1);
      if (pumpTimerRef.current) {
        clearTimeout(pumpTimerRef.current);
        pumpTimerRef.current = null;
      }
      setHighlightSelection((prev) => {
        if (!prev) return prev;
        if (prev.kind === "stem" && (prev.source === "daeun-slot" || prev.source === "daeun-table")) return null;
        if (prev.kind === "branch-stem-match") return null;
        return prev;
      });
      return;
    }

    setSelectedDaeunOrder(cycleOrder);
    setSelectedSewoonYear(null);
    setHighlightSelection((prev) => {
      if (!prev) return prev;
      if (prev.kind === "stem" && (prev.source === "daeun-slot" || prev.source === "daeun-table")) return null;
      if (prev.kind === "branch-stem-match") return null;
      return prev;
    });

    // 기본 모드: 년주 옆 칸에 바로 표시 (비행 연출 없음)
    if (!exploreMode) {
      setFlyers([]);
      setArrivedSlots(new Set());
      setPumpingSlots(new Set());
      return;
    }

    if (isMobile) {
      setFlyers([]);
      triggerMobilePump();
      return;
    }

    setArrivedSlots(new Set());
    setFlyers([]);
    if (!sourceEl) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        launchFlyers(sourceEl, stemChar, stemColor, stemElement, branchChar, branchColor, branchElement);
      });
    });
  }, [exploreMode, launchFlyers, isMobile, triggerMobilePump, captureScrollAnchor]);

  return (
    <>
    <div className="space-y-4" style={{ border: "2px solid var(--px-accent)", boxShadow: isMobile ? "4px 4px 0 #4a3a00" : "6px 6px 0 #4a3a00", overflowAnchor: "none" }}>
      <style>{`
        .daeun-card {
          transition: transform 0.13s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.13s, background 0.1s, border-color 0.1s;
          cursor: pointer;
        }
        .daeun-card:hover  { transform: translateY(-2px); }
        .daeun-card:active { transform: translateY(1px) scale(0.97) !important; transition: transform 0.05s !important; }
        .ganji-clickable {
          cursor: pointer;
          border-radius: 2px;
          /* 항상 동일 아웃라인 폭을 확보해 선택 시 레이아웃 흔들림 방지 */
          box-shadow: 0 0 0 2px transparent;
          transition: background 0.1s, box-shadow 0.1s;
        }
        .ganji-clickable:hover { background: #ffffff11; }
        /* 직접 클릭한 글자 */
        .ganji-clickable-source {
          box-shadow: 0 0 0 2px #fbbf24, 0 0 14px #fbbf2499;
          background: #fbbf2422;
        }
        /* 뿌리·투출 관련 글자 */
        .ganji-clickable-related {
          box-shadow: 0 0 0 2px #c084fc, 0 0 14px #c084fc99;
          background: #c084fc22;
        }
        @keyframes daeun-slot-pump {
          0%   { transform: scale(0.35); opacity: 0.2; }
          55%  { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .daeun-slot-pump {
          animation: daeun-slot-pump 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
      {/* ── 입력 요약 바 ── */}
      <div
        className={`py-2 text-xs font-bold flex flex-wrap gap-x-4 gap-y-1 ${isMobile ? "px-2" : "px-4"}`}
        style={{ background: "var(--px-bg3)", color: "var(--px-text2)", borderBottom: "2px solid var(--px-border2)" }}
      >
        <span>
          <span style={{ color: "var(--px-accent)" }}>INPUT ► </span>
          {input.original.options.calendarType === "lunar"
            ? `음력 ${input.original.year}년 ${input.original.options.isLeapMonth ? "윤" : ""}${input.original.month}월 ${input.original.day}일`
            : `양력 ${input.original.year}년 ${input.original.month}월 ${input.original.day}일`}
          {input.original.hour !== undefined &&
            ` ${input.original.hour}:${input.original.minute ?? 0} KST`}
        </span>
        {input.lunarConversion && (
          <span style={{ color: "#4ade80" }}>
            ▶ 양력: {input.lunarConversion.outputSolar}
          </span>
        )}
      </div>

      <div
        className={`flex flex-wrap items-center justify-center gap-2 ${isMobile ? "px-2 py-2" : "px-4 py-2"}`}
        style={{ background: "var(--px-bg2)", borderBottom: "2px solid var(--px-border)" }}
      >
        {([
          ["simple", "기본 모드"],
          ["explore", "연구 모드"],
        ] as [SajuViewMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleViewModeChange(mode)}
            className={
              viewMode === mode
                ? "ui-action-btn ui-action-btn-selected"
                : "ui-action-btn ui-action-btn-muted"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* 클릭 안내 — 기본 문구 / 연구 모드 선택 시 뿌리·투출 설명 */}
      <div
        className={`text-center font-bold ${isMobile ? "px-2" : "px-4"}`}
        style={{
          color: "#7dd3fc",
          fontSize: isMobile ? "16px" : "17px",
          lineHeight: 1.55,
          minHeight: "1.5rem",
          textShadow: "0 0 10px #7dd3fc66",
          fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
          letterSpacing: "0.02em",
        }}
      >
        {highlightHint ? (
          <>
            <span style={{ color: highlightHint.color, textShadow: `0 0 8px ${highlightHint.color}88` }}>
              {highlightHint.char}
            </span>
            <span>의 {highlightHint.kind} 표시</span>
          </>
        ) : exploreMode ? (
          "글자나 대운을 클릭하세요"
        ) : (
          "대운을 클릭하세요"
        )}
      </div>

      <div className={`pb-4 ${isMobile ? "px-2" : "px-4"}`}>
        {/* ── 사주 + 대운 + 오행 (밀착 레이아웃) ── */}
        <div className="space-y-0" ref={chartAnchorRef}>
        {(() => {
          const daeunStemEl  = selectedDaeun ? STEM_META[selectedDaeun.ganji[0]]?.element  : null;
          const daeunBranchEl = selectedDaeun ? BRANCH_META[selectedDaeun.ganji[1]]?.element : null;
          const daeunSc = daeunStemEl  ? ELEM[daeunStemEl]  : null;
          const daeunBc = daeunBranchEl ? ELEM[daeunBranchEl] : null;

          const daeunBranchHiddenStems = selectedDaeun
            ? getBranchHiddenStemsWithTenGod(selectedDaeun.ganji[1], dayStem)
            : [];

          let daeunStemTenGod = "";
          let daeunBranchTenGod: string | null = null;
          if (selectedDaeun) {
            try {
              daeunStemTenGod = getTenGod(dayStem, selectedDaeun.ganji[0] as StemHanja);
              daeunBranchTenGod =
                daeunBranchHiddenStems.find((s) => s.role === "main")?.tenGod ??
                daeunBranchHiddenStems[daeunBranchHiddenStems.length - 1]?.tenGod ??
                null;
            } catch {
              /* ignore */
            }
          }

          const daeunStemElForGroup = selectedDaeun
            ? STEM_META[selectedDaeun.ganji[0]]?.element
            : undefined;
          const daeunStemGroupTone: HighlightTone =
            highlightSelection?.kind === "stem" && highlightSelection.source === "daeun-slot"
              ? "source"
              : !!daeunStemElForGroup &&
                  isStemTouchoOfBranch(
                    highlightSelection,
                    daeunStemElForGroup,
                    highlightBranchHiddenStems
                  )
              ? "related"
              : null;
          const daeunBranchGroupTone: HighlightTone =
            highlightSelection?.kind === "branch-stem-match" &&
            highlightSelection.scope === "daeun"
              ? "source"
              : branchHasStemRoot(highlightSelection, daeunBranchHiddenStems)
              ? "related"
              : null;

          const yearlyStemEl = selectedSewoon ? STEM_META[selectedSewoon.ganji[0]]?.element : null;
          const yearlyBranchEl = selectedSewoon ? BRANCH_META[selectedSewoon.ganji[1]]?.element : null;
          const yearlySc = yearlyStemEl ? ELEM[yearlyStemEl] : null;
          const yearlyBc = yearlyBranchEl ? ELEM[yearlyBranchEl] : null;

          const yearlyBranchHiddenStems = selectedSewoon
            ? getBranchHiddenStemsWithTenGod(selectedSewoon.ganji[1], dayStem)
            : [];

          let yearlyStemTenGod = "";
          let yearlyBranchTenGod: string | null = null;
          if (selectedSewoon) {
            try {
              yearlyStemTenGod = getTenGod(dayStem, selectedSewoon.ganji[0] as StemHanja);
              yearlyBranchTenGod =
                yearlyBranchHiddenStems.find((s) => s.role === "main")?.tenGod ??
                yearlyBranchHiddenStems[yearlyBranchHiddenStems.length - 1]?.tenGod ??
                null;
            } catch {
              /* ignore */
            }
          }

          const chartColCount = sideYearly ? 6 : sideDaeun ? 5 : 4;
          const pillarGapClass = overlayYearly
            ? isMobile
              ? "gap-3"
              : "gap-4"
            : isMobile
              ? "gap-1.5"
              : "gap-2";
          const colClass = `grid ${
            chartColCount === 6
              ? "grid-cols-6"
              : chartColCount === 5
                ? "grid-cols-5"
                : "grid-cols-4"
          } ${pillarGapClass}`;

          const luckOverlayGap = overlayYearly
            ? isMobile
              ? "gap-3"
              : "gap-4"
            : isMobile
              ? "gap-1.5"
              : "gap-2";

          return (
            <>
            {/* 연구 모드: 각 주 위 — 대운·년운을 그 주 중앙에 바짝 묶음 */}
            {overlayDaeun && selectedDaeun && daeunSc && (
              <div
                className={`grid grid-cols-4 ${luckOverlayGap} mb-1.5 px-0.5 py-0.5`}
                style={daeunGroupHighlightStyle(daeunStemGroupTone)}
              >
                {DISPLAY_ORDER.map((key, i) => {
                  const stemArrived =
                    !selectedDaeun || arrivedSlots.has(`stem-${i}`) || (isMobile && !!selectedDaeun);
                  const stemPumping = pumpingSlots.has(`stem-${i}`);
                  return (
                    <div
                      key={`daeun-stem-${key}`}
                      ref={(el) => {
                        daeunStemSlotRefs.current[i] = el;
                      }}
                      className="flex items-start justify-center min-w-0 w-full"
                    >
                      <div
                        key={`stem-${pumpGeneration}`}
                        className="inline-flex items-start justify-center"
                        style={{
                          visibility: stemArrived ? "visible" : "hidden",
                          gap: 0,
                          columnGap: 0,
                        }}
                      >
                        <DaeunCharBox
                          char={selectedDaeun.ganji[0]}
                          tenGod={daeunStemTenGod}
                          style={daeunSc}
                          showBorder={false}
                          charSize={luckCharSize}
                          labelSize={luckLabelSize}
                          tone={null}
                          pumping={stemPumping}
                          compact
                          onClick={() => {
                            const meta = STEM_META[selectedDaeun.ganji[0]];
                            const el = meta?.element;
                            if (el) {
                              toggleHighlight({
                                kind: "stem",
                                source: "daeun-slot",
                                pillar: key,
                                element: el,
                                label: meta.ko,
                              });
                            }
                          }}
                        />
                        {overlayYearly && selectedSewoon && yearlySc && (
                          <DaeunCharBox
                            char={selectedSewoon.ganji[0]}
                            tenGod={yearlyStemTenGod}
                            style={yearlySc}
                            showBorder={false}
                            charSize={luckCharSize}
                            labelSize={luckLabelSize}
                            tone={null}
                            pumping={false}
                            compact
                            onClick={() => {
                              const meta = STEM_META[selectedSewoon.ganji[0]];
                              const el = meta?.element;
                              if (el) {
                                toggleHighlight({
                                  kind: "stem",
                                  source: "daeun-slot",
                                  pillar: key,
                                  element: el,
                                  label: meta.ko,
                                });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={colClass}>
              {DISPLAY_ORDER.map((key) => {
                const pillar = pillars[key];
                const meta = PILLAR_META[key];

                if (!pillar) {
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center justify-center p-1"
                      style={{
                        background: "var(--px-bg2)",
                        border: "2px solid var(--px-border)",
                        boxShadow: "3px 3px 0 #000",
                        minHeight: isMobile ? "96px" : "200px",
                      }}
                    >
                      <p className="text-xs font-bold text-center" style={{ color: "var(--px-text2)" }}>
                        {meta.ko}<br />
                        <span style={{ fontSize: "12px" }}>{meta.hanja}</span>
                      </p>
                      <p className="text-xs mt-3 text-center leading-relaxed" style={{ color: "var(--px-border2)" }}>
                        시간<br />없음
                      </p>
                    </div>
                  );
                }

                const sc = ELEM[pillar.stem.element];
                const bc = ELEM[pillar.branch.element];
                const stemTenGod = getTenGod(dayStem, pillar.stem.hanja as StemHanja);
                const hiddenStemItem = hiddenStemItemsByPillar[key];
                const branchTenGod =
                  hiddenStemItem?.hiddenStems.find((s) => s.role === "main")?.tenGod ??
                  hiddenStemItem?.hiddenStems[hiddenStemItem.hiddenStems.length - 1]?.tenGod ??
                  null;
                const stemTone: HighlightTone =
                  highlightSelection?.kind === "stem" &&
                  highlightSelection.source === "pillar" &&
                  highlightSelection.pillar === key
                    ? "source"
                    : isStemTouchoOfBranch(
                        highlightSelection,
                        pillar.stem.element,
                        highlightBranchHiddenStems
                      )
                    ? "related"
                    : null;
                const branchTone: HighlightTone =
                  highlightSelection?.kind === "branch-stem-match" &&
                  highlightSelection.scope === "pillar" &&
                  highlightSelection.pillar === key
                    ? "source"
                    : branchHasStemRoot(highlightSelection, hiddenStemItem?.hiddenStems)
                    ? "related"
                    : null;

                return (
                  <div
                    key={key}
                    className={`flex flex-col items-center gap-0 w-full min-w-0 ${isMobile ? "p-1" : "p-2"}`}
                    style={{
                      background: "var(--px-bg2)",
                      border: "2px solid var(--px-border)",
                      boxShadow: "3px 3px 0 #000",
                    }}
                  >
                    <div className="text-center pb-1 w-full" style={{ borderBottom: "1px solid var(--px-border)" }}>
                      <p className="font-black leading-tight" style={{ color: "var(--px-accent)", fontSize: pillarTitleSize }}>{meta.ko}</p>
                      {!isMobile && (
                        <p style={{ color: "var(--px-text2)", fontSize: "12px" }}>{meta.hanja}</p>
                      )}
                    </div>

                    <div className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}
                      style={{ borderBottom: "1px dashed var(--px-border)" }}>
                      {exploreMode ? (
                        <button
                          type="button"
                          className={`ganji-clickable font-black leading-none bg-transparent border-0 p-0 ${highlightToneClass(stemTone)}`}
                          style={{ color: sc.text, fontSize: charSize, textShadow: `0 0 10px ${sc.text}88` }}
                          onClick={() =>
                            toggleHighlight({
                              kind: "stem",
                              source: "pillar",
                              pillar: key,
                              element: pillar.stem.element,
                              label: STEM_META[pillar.stem.hanja]?.ko ?? pillar.stem.ko,
                            })
                          }
                          title="천간 클릭: 뿌리 표시"
                        >
                          {pillar.stem.hanja}
                        </button>
                      ) : (
                        <span
                          className="font-black leading-none"
                          style={{ color: sc.text, fontSize: charSize, textShadow: `0 0 10px ${sc.text}88` }}
                        >
                          {pillar.stem.hanja}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-bold border leading-none"
                          style={{ color: sc.text, borderColor: sc.border, background: sc.bg, fontSize: labelSize, padding: isMobile ? "1px 3px" : undefined }}>
                          {stemTenGod}
                        </span>
                      </div>
                    </div>

                    <div className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}>
                      {exploreMode ? (
                        <button
                          type="button"
                          className={`ganji-clickable font-black leading-none bg-transparent border-0 p-0 ${highlightToneClass(branchTone)}`}
                          style={{ color: bc.text, fontSize: charSize, textShadow: `0 0 10px ${bc.text}88` }}
                          onClick={() =>
                            toggleHighlight({
                              kind: "branch-stem-match",
                              scope: "pillar",
                              pillar: key,
                              label: BRANCH_META[pillar.branch.hanja]?.ko ?? pillar.branch.ko,
                              element: pillar.branch.element,
                            })
                          }
                          title="지지 클릭: 투출 표시"
                        >
                          {pillar.branch.hanja}
                        </button>
                      ) : (
                        <span
                          className="font-black leading-none"
                          style={{ color: bc.text, fontSize: charSize, textShadow: `0 0 10px ${bc.text}88` }}
                        >
                          {pillar.branch.hanja}
                        </span>
                      )}
                      {branchTenGod && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-bold border leading-none"
                            style={{ color: bc.text, borderColor: bc.border, background: bc.bg, fontSize: labelSize, padding: isMobile ? "1px 3px" : undefined }}>
                            {branchTenGod}
                          </span>
                        </div>
                      )}
                    </div>

                    {hiddenStemItem?.hiddenStems?.length ? (
                      <HiddenStemPanel
                        pillarStems={hiddenStemItem.hiddenStems}
                        highlightSelection={highlightSelection}
                        touchoElements={touchoElements}
                        pillarKey={key}
                        isMobile={isMobile}
                      />
                    ) : null}
                  </div>
                );
              })}

              {/* 기본 모드: 선택한 대운을 년주 오른쪽에 표시 (만세력 기둥과 동일 크기) */}
              {sideDaeun && selectedDaeun && daeunSc && daeunBc && (
                <div
                  className={`flex flex-col items-center gap-0 w-full min-w-0 ${isMobile ? "p-1" : "p-2"}`}
                  style={{
                    background: "color-mix(in srgb, #fbbf24 10%, var(--px-bg2))",
                    border: "2px solid #fbbf24",
                    boxShadow: "3px 3px 0 #4a3a00",
                  }}
                >
                  <div className="text-center pb-1 w-full" style={{ borderBottom: "1px solid var(--px-border)" }}>
                    <p className="font-black leading-tight whitespace-nowrap" style={{ color: "#fbbf24", fontSize: labelSize }}>
                      대운
                    </p>
                    {!isMobile && (
                      <p style={{ color: "var(--px-text2)", fontSize: "12px" }}>大運</p>
                    )}
                  </div>
                  <div
                    className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}
                    style={{ borderBottom: "1px dashed var(--px-border)" }}
                  >
                    <span
                      className="font-black leading-none"
                      style={{ color: daeunSc.text, fontSize: charSize, textShadow: `0 0 10px ${daeunSc.text}88` }}
                    >
                      {selectedDaeun.ganji[0]}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="font-bold border leading-none"
                        style={{
                          color: daeunSc.text,
                          borderColor: daeunSc.border,
                          background: daeunSc.bg,
                          fontSize: labelSize,
                          padding: isMobile ? "1px 3px" : undefined,
                        }}
                      >
                        {daeunStemTenGod}
                      </span>
                    </div>
                  </div>
                  <div className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}>
                    <span
                      className="font-black leading-none"
                      style={{ color: daeunBc.text, fontSize: charSize, textShadow: `0 0 10px ${daeunBc.text}88` }}
                    >
                      {selectedDaeun.ganji[1]}
                    </span>
                    {daeunBranchTenGod && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="font-bold border leading-none"
                          style={{
                            color: daeunBc.text,
                            borderColor: daeunBc.border,
                            background: daeunBc.bg,
                            fontSize: labelSize,
                            padding: isMobile ? "1px 3px" : undefined,
                          }}
                        >
                          {daeunBranchTenGod}
                        </span>
                      </div>
                    )}
                  </div>
                  {daeunBranchHiddenStems.length > 0 && (
                    <HiddenStemPanel
                      pillarStems={daeunBranchHiddenStems}
                      highlightSelection={null}
                      touchoElements={touchoElements}
                      pillarKey="year"
                      isMobile={isMobile}
                    />
                  )}
                </div>
              )}

              {/* 기본 모드: 선택한 년운을 대운 오른쪽에 표시 (만세력과 동일 글자 크기) */}
              {sideYearly && selectedSewoon && yearlySc && yearlyBc && (
                <div
                  className={`flex flex-col items-center gap-0 w-full min-w-0 ${isMobile ? "p-1" : "p-2"}`}
                  style={{
                    background: "color-mix(in srgb, #7dd3fc 10%, var(--px-bg2))",
                    border: "2px solid #7dd3fc",
                    boxShadow: "3px 3px 0 #0a3a4a",
                  }}
                >
                  <div className="text-center pb-1 w-full" style={{ borderBottom: "1px solid var(--px-border)" }}>
                    <p className="font-black leading-tight whitespace-nowrap" style={{ color: "#7dd3fc", fontSize: labelSize }}>
                      년운
                    </p>
                    {!isMobile && (
                      <p style={{ color: "var(--px-text2)", fontSize: "12px" }}>年運</p>
                    )}
                  </div>
                  <div
                    className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}
                    style={{ borderBottom: "1px dashed var(--px-border)" }}
                  >
                    <span
                      className="font-black leading-none"
                      style={{ color: yearlySc.text, fontSize: charSize, textShadow: `0 0 10px ${yearlySc.text}88` }}
                    >
                      {selectedSewoon.ganji[0]}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="font-bold border leading-none"
                        style={{
                          color: yearlySc.text,
                          borderColor: yearlySc.border,
                          background: yearlySc.bg,
                          fontSize: labelSize,
                          padding: isMobile ? "1px 3px" : undefined,
                        }}
                      >
                        {yearlyStemTenGod}
                      </span>
                    </div>
                  </div>
                  <div className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}>
                    <span
                      className="font-black leading-none"
                      style={{ color: yearlyBc.text, fontSize: charSize, textShadow: `0 0 10px ${yearlyBc.text}88` }}
                    >
                      {selectedSewoon.ganji[1]}
                    </span>
                    {yearlyBranchTenGod && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="font-bold border leading-none"
                          style={{
                            color: yearlyBc.text,
                            borderColor: yearlyBc.border,
                            background: yearlyBc.bg,
                            fontSize: labelSize,
                            padding: isMobile ? "1px 3px" : undefined,
                          }}
                        >
                          {yearlyBranchTenGod}
                        </span>
                      </div>
                    )}
                  </div>
                  {yearlyBranchHiddenStems.length > 0 && (
                    <HiddenStemPanel
                      pillarStems={yearlyBranchHiddenStems}
                      highlightSelection={null}
                      touchoElements={touchoElements}
                      pillarKey="year"
                      isMobile={isMobile}
                    />
                  )}
                </div>
              )}
            </div>

            {/* 연구 모드: 각 주 아래 — 대운·년운을 그 주 중앙에 바짝 묶음 */}
            {overlayDaeun && selectedDaeun && daeunBc && (
              <div
                className={`grid grid-cols-4 ${luckOverlayGap} mt-1.5 px-0.5 py-0.5`}
                style={daeunGroupHighlightStyle(daeunBranchGroupTone)}
              >
                {DISPLAY_ORDER.map((key, i) => {
                  const branchArrived =
                    !selectedDaeun || arrivedSlots.has(`branch-${i}`) || (isMobile && !!selectedDaeun);
                  const branchPumping = pumpingSlots.has(`branch-${i}`);
                  return (
                    <div
                      key={`daeun-branch-${key}`}
                      ref={(el) => {
                        daeunBranchSlotRefs.current[i] = el;
                      }}
                      className="flex items-start justify-center min-w-0 w-full"
                    >
                      <div
                        key={`branch-${pumpGeneration}`}
                        className="inline-flex items-start justify-center"
                        style={{
                          visibility: branchArrived ? "visible" : "hidden",
                          gap: 0,
                          columnGap: 0,
                        }}
                      >
                        <DaeunCharBox
                          char={selectedDaeun.ganji[1]}
                          tenGod={daeunBranchTenGod ?? ""}
                          style={daeunBc}
                          showBorder={false}
                          charSize={luckCharSize}
                          labelSize={luckLabelSize}
                          tone={null}
                          pumping={branchPumping}
                          compact
                          onClick={() =>
                            toggleHighlight({
                              kind: "branch-stem-match",
                              scope: "daeun",
                              pillar: key,
                              label: BRANCH_META[selectedDaeun.ganji[1]]?.ko ?? selectedDaeun.ganji[1],
                              element: BRANCH_META[selectedDaeun.ganji[1]]?.element ?? "earth",
                            })
                          }
                        />
                        {overlayYearly && selectedSewoon && yearlyBc && (
                          <DaeunCharBox
                            char={selectedSewoon.ganji[1]}
                            tenGod={yearlyBranchTenGod ?? ""}
                            style={yearlyBc}
                            showBorder={false}
                            charSize={luckCharSize}
                            labelSize={luckLabelSize}
                            tone={null}
                            pumping={false}
                            compact
                            onClick={() =>
                              toggleHighlight({
                                kind: "branch-stem-match",
                                scope: "daeun",
                                pillar: key,
                                label:
                                  BRANCH_META[selectedSewoon.ganji[1]]?.ko ??
                                  selectedSewoon.ganji[1],
                                element:
                                  BRANCH_META[selectedSewoon.ganji[1]]?.element ?? "earth",
                              })
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 연구 모드: 대운 지장간 (+ 년운 지장간은 오른쪽) */}
            {overlayDaeun && daeunBranchHiddenStems.length > 0 && (
              <div
                className={`flex justify-center items-stretch ${isMobile ? "mt-1 gap-1.5" : "mt-1.5 gap-2"}`}
              >
                <div
                  className={`w-full ${isMobile ? "max-w-[46%]" : "max-w-[28%]"}`}
                  style={{
                    background: "color-mix(in srgb, #fbbf24 10%, var(--px-bg2))",
                    border: "2px solid #fbbf24",
                    boxShadow: "3px 3px 0 #4a3a00",
                    padding: isMobile ? "1px 2px" : "2px 3px",
                  }}
                >
                  <HiddenStemPanel
                    pillarStems={daeunBranchHiddenStems}
                    highlightSelection={highlightSelection}
                    touchoElements={touchoElements}
                    pillarKey="day"
                    context="daeun"
                    isMobile={isMobile}
                    showTitle={false}
                    largeChips
                  />
                </div>
                {overlayYearly && yearlyBranchHiddenStems.length > 0 && (
                  <div
                    className={`w-full ${isMobile ? "max-w-[46%]" : "max-w-[28%]"}`}
                    style={{
                      background: "color-mix(in srgb, #7dd3fc 10%, var(--px-bg2))",
                      border: "2px solid #7dd3fc",
                      boxShadow: "3px 3px 0 #0a3a4a",
                      padding: isMobile ? "1px 2px" : "2px 3px",
                    }}
                  >
                    <HiddenStemPanel
                      pillarStems={yearlyBranchHiddenStems}
                      highlightSelection={highlightSelection}
                      touchoElements={touchoElements}
                      pillarKey="year"
                      context="daeun"
                      isMobile={isMobile}
                      showTitle={false}
                      largeChips
                    />
                  </div>
                )}
              </div>
            )}
          </>
          );
        })()}

        {/* ── 대운(大運) + 오행 분포 ── */}
        <div
          ref={daeunSectionRef}
          id="saju-daeun-section"
          style={{ background: "var(--px-bg3)", border: "2px solid var(--px-border)", boxShadow: "3px 3px 0 #000", overflowAnchor: "none" }}
        >
          <div className={isMobile ? "p-2 space-y-1" : "p-2 space-y-1"}>
            {(() => {
              const colsPerRow = isMobile ? 5 : 10;
              const rows: typeof daeun.cycles[] = [];
              for (let i = 0; i < daeun.cycles.length; i += colsPerRow) {
                rows.push(daeun.cycles.slice(i, i + colsPerRow));
              }
              const sewoonYears = selectedDaeun
                ? getSewoonYearsForDaeunCycle(selectedDaeun)
                : [];
              // 오른쪽→왼쪽으로 년도 증가: 최근 해를 왼쪽, 시작 해를 오른쪽에
              const sewoonDisplay = [...sewoonYears].reverse();

              return rows.map((rowCycles, rowIndex) => {
                const rowHasSelection =
                  selectedDaeun != null &&
                  rowCycles.some((c) => c.order === selectedDaeun.order);

                return (
                  <div key={`daeun-row-${rowIndex}`} className="space-y-1">
                    <div
                      className={`grid gap-1 ${
                        isMobile ? "grid-cols-5" : "grid-cols-10"
                      }`}
                    >
                      {rowCycles.map((cycle) => {
                        const isSelected = selectedDaeunOrder === cycle.order;
                        const daeunCharSize = isMobile ? "16px" : "22px";
                        const daeunLabelSize = isMobile ? "11px" : "12px";
                        const daeunAgeSize = isMobile ? "11px" : "12px";
                        const stemEl = STEM_META[cycle.ganji[0]]?.element;
                        const branchEl = BRANCH_META[cycle.ganji[1]]?.element;
                        const sc = stemEl ? ELEM[stemEl] : ELEM.water;
                        const bc = branchEl ? ELEM[branchEl] : ELEM.water;
                        let stemTenGod: string = "";
                        let branchTenGod: string = "";
                        try {
                          stemTenGod = getTenGod(dayStem, cycle.ganji[0] as StemHanja);
                          const branchHiddenStems = getBranchHiddenStemsWithTenGod(
                            cycle.ganji[1],
                            dayStem
                          );
                          branchTenGod =
                            branchHiddenStems.find((s) => s.role === "main")?.tenGod ??
                            branchHiddenStems[branchHiddenStems.length - 1]?.tenGod ??
                            "";
                        } catch {
                          stemTenGod = "";
                          branchTenGod = "";
                        }
                        const startAge = formatCycleAge(
                          cycle.estimatedStartDate,
                          input.normalizedSolarDateTime,
                          daeunAgeMode
                        );
                        const endAge = formatCycleAge(
                          cycle.estimatedEndDate,
                          input.normalizedSolarDateTime,
                          daeunAgeMode
                        );
                        return (
                          <div
                            key={cycle.order}
                            role="button"
                            tabIndex={0}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              handleDaeunClick(
                                cycle.order,
                                isSelected,
                                isMobile ? null : e.currentTarget,
                                cycle.ganji[0],
                                sc.text,
                                stemEl ?? "water",
                                cycle.ganji[1],
                                bc.text,
                                branchEl ?? "water"
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleDaeunClick(
                                  cycle.order,
                                  isSelected,
                                  isMobile ? null : e.currentTarget,
                                  cycle.ganji[0],
                                  sc.text,
                                  stemEl ?? "water",
                                  cycle.ganji[1],
                                  bc.text,
                                  branchEl ?? "water"
                                );
                              }
                            }}
                            className={`daeun-card flex flex-col items-center w-full ${
                              isSelected ? "daeun-card-selected" : ""
                            } ${isMobile ? "gap-0.5 px-1 py-1" : "gap-0.5 px-1 py-1"}`}
                            style={{
                              background: "var(--px-bg2)",
                              border: isSelected
                                ? "2px solid #fbbf24"
                                : "1px solid var(--px-border)",
                              boxShadow: isSelected
                                ? "2px 2px 0 #4a3a00, 0 0 10px #fbbf2444"
                                : "1px 1px 0 #000",
                              cursor: "pointer",
                            }}
                          >
                            {stemTenGod ? (
                              <span
                                className="font-bold border leading-none"
                                style={{
                                  fontSize: daeunLabelSize,
                                  padding: "1px 3px",
                                  color: sc.text,
                                  borderColor: sc.border,
                                  background: sc.bg,
                                }}
                              >
                                {stemTenGod}
                              </span>
                            ) : (
                              <span
                                className="font-bold leading-none"
                                style={{ color: "var(--px-text2)", fontSize: daeunLabelSize }}
                              >
                                {cycle.order}운
                              </span>
                            )}
                            <ColoredGanji
                              ganji={cycle.ganji}
                              compact={isMobile}
                              charSize={daeunCharSize}
                            />
                            {branchTenGod ? (
                              <span
                                className="font-bold border leading-none"
                                style={{
                                  fontSize: daeunLabelSize,
                                  padding: "1px 3px",
                                  color: bc.text,
                                  borderColor: bc.border,
                                  background: bc.bg,
                                }}
                              >
                                {branchTenGod}
                              </span>
                            ) : null}
                            <p
                              className="font-bold leading-tight text-center w-full"
                              style={{ color: "var(--px-accent)", fontSize: daeunAgeSize }}
                            >
                              {startAge}~{endAge}세
                            </p>
                            {!isMobile && (
                              <div className="text-[11px] text-center leading-tight w-full">
                                <p style={{ color: "var(--px-text2)" }}>
                                  {cycle.estimatedStartDate
                                    ? formatIsoDate(cycle.estimatedStartDate)
                                    : "-"}
                                </p>
                                <p style={{ color: "var(--px-border2)" }}>
                                  ~
                                  {cycle.estimatedEndDate
                                    ? formatIsoDate(cycle.estimatedEndDate)
                                    : "-"}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {rowHasSelection && sewoonDisplay.length > 0 && (
                      <div
                        className="grid grid-cols-10 gap-0.5 px-0.5 py-1"
                        style={{
                          background: "color-mix(in srgb, #fbbf24 8%, var(--px-bg2))",
                          border: "1px solid #fbbf2466",
                          boxShadow: "1px 1px 0 #4a3a00",
                        }}
                        aria-label="년운"
                      >
                        {sewoonDisplay.map((item) => {
                          let stemTenGod = "";
                          let branchTenGod = "";
                          try {
                            stemTenGod = getTenGod(dayStem, item.ganji[0] as StemHanja);
                            const branchHidden = getBranchHiddenStemsWithTenGod(
                              item.ganji[1],
                              dayStem
                            );
                            branchTenGod =
                              branchHidden.find((s) => s.role === "main")?.tenGod ??
                              branchHidden[branchHidden.length - 1]?.tenGod ??
                              "";
                          } catch {
                            stemTenGod = "";
                            branchTenGod = "";
                          }
                          return (
                            <SewoonYearCell
                              key={item.year}
                              ganji={item.ganji}
                              year={item.year}
                              isMobile={isMobile}
                              isSelected={selectedSewoonYear === item.year}
                              stemTenGod={stemTenGod}
                              branchTenGod={branchTenGod}
                              onClick={() => {
                                setSelectedSewoonYear((prev) =>
                                  prev === item.year ? null : item.year
                                );
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* ── 오행 분포 ── */}
          <div
            className={isMobile ? "px-2 pt-1" : "px-3 pt-1"}
            style={{ borderTop: "1px solid var(--px-border)" }}
          >
            <div className="space-y-1.5">
              {(Object.entries(elemPct) as [Element, number][]).map(([elem, pct]) => {
                const c = ELEM[elem];
                return (
                  <div key={elem} className="flex items-center gap-2">
                    <span
                      className="text-xs font-black w-6 text-center"
                      style={{ color: c.text }}
                    >
                      {ELEMENT_LABELS[elem]}
                    </span>
                    <span className="text-xs w-8" style={{ color: "var(--px-text2)" }}>
                      {ELEM_KO[elem]}
                    </span>
                    <div className="flex-1 h-4 border" style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: c.text,
                          boxShadow: `0 0 6px ${c.text}88`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold w-12 text-right" style={{ color: c.text }}>
                      {pct.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center justify-end gap-2 ${isMobile ? "px-2 py-1.5 pb-2" : "px-3 py-2 pb-3"}`}
            style={{ borderTop: "1px solid var(--px-border)" }}
          >
            <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>나이 표시</span>
            {([
              ["international", "만나이"],
              ["korean", "한국 나이"],
            ] as [AgeMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDaeunAgeMode(mode)}
                className="px-3 py-1 text-xs font-bold border-2"
                style={{
                  color: daeunAgeMode === mode ? "var(--px-bg)" : "var(--px-text2)",
                  background: daeunAgeMode === mode ? "var(--px-accent)" : "var(--px-bg2)",
                  borderColor: daeunAgeMode === mode ? "var(--px-accent)" : "var(--px-border)",
                  boxShadow: daeunAgeMode === mode ? "2px 2px 0 #4a3a00" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        </div>

        <Link
          href="/diary"
          className="block text-center px-4 py-3 text-xs font-bold border-2"
          style={{
            background: "var(--px-accent)",
            borderColor: "#000",
            color: "#000",
            boxShadow: "4px 4px 0 #000",
          }}
        >
          이 사주로 오늘 기분 기록하기 →
        </Link>

        {/* ── 기존 만세력 보존 + 별도 해석 레이어 ── */}
        <ExpertInsightsForSaju result={result} />

        {/* ── 경고 ── */}
        {debug.warnings.length > 0 && (
          <div
            className="p-3 border-2 text-xs space-y-1"
            style={{ borderColor: "#fbbf24", background: "#1a150088", color: "#fbbf24" }}
          >
            {debug.warnings.map((w, i) => (
              <p key={i}>⚠ {w}</p>
            ))}
          </div>
        )}

        {/* ── 계산 근거 (통합 · 접힘) ── */}
        <div className="ui-calc-debug">
          <button
            type="button"
            onClick={() => setShowCalcDebug(!showCalcDebug)}
            className="ui-calc-debug-toggle"
          >
            <span>계산 근거 (고급)</span>
            <span>{showCalcDebug ? "▲" : "▼"}</span>
          </button>

          {showCalcDebug && (
            <div className="ui-calc-debug-body space-y-2">
              <p className="leading-relaxed">
                절기·옵션·대운 등 계산 세부값입니다. 일반 사용 시 펼칠 필요 없습니다.
              </p>
              <p className="ui-calc-debug-subtitle">사주팔자</p>
              <DebugTable
                compact
                rows={[
                  ["기준 시간대",             result.options.timezone],
                  ["계산 기준 양력 날짜",       input.normalizedSolarDate],
                  ["계산 기준 KST 일시",        input.normalizedSolarDateTime],
                  ["사용한 입춘 시각 (KST)",     debug.usedLichun],
                  ["월주 시작 절기",             debug.usedMonthSolarTermName],
                  ["월주 절기 시작 KST",         debug.usedMonthSolarTermStart],
                  ["월주 절기 종료 KST",         debug.usedMonthSolarTermEnd],
                  ["일주 계산 기준 날짜",         debug.effectiveDateForDayPillar],
                  ["Julian Day Number",         String(debug.jdnForDayPillar)],
                  ["60갑자 인덱스 (일주)",        String(debug.dayGanjiIndex)],
                  ...(debug.hourBranchOrder !== undefined
                    ? [["시지 순서 (子=0)", String(debug.hourBranchOrder)] as [string, string]]
                    : []),
                  ...(debug.timeCorrectionMinutes !== undefined
                    ? [["시간 보정 (분)", debug.timeCorrectionMinutes.toFixed(2)] as [string, string]]
                    : []),
                  ["일주 변경 기준", result.options.dayChangeRule === "midnight" ? "자정(midnight)" : "야자시(ziHour)"],
                  ["시간 보정 방식",
                    result.options.timeCorrection === "none" ? "없음" :
                    result.options.timeCorrection === "localMeanSolarTime" ? "평균태양시(LMT)" : "진태양시(TST)"],
                  ...(result.options.location?.name
                    ? [["출생 지역", result.options.location.name] as [string, string]]
                    : []),
                  ...(result.options.location?.longitude !== undefined
                    ? [["출생지 경도", `동경 ${result.options.location.longitude}°`] as [string, string]]
                    : []),
                  ...(result.options.location?.latitude !== undefined
                    ? [["출생지 위도", `북위 ${result.options.location.latitude}°`] as [string, string]]
                    : []),
                ]}
              />

              {exploreMode && (
                <>
                  <p className="ui-calc-debug-subtitle" style={{ borderTop: "1px solid var(--px-border)", paddingTop: 10 }}>
                    대운
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <DaeunSummaryItem label="대운 방향" value={daeun.directionText} compact />
                    <DaeunSummaryItem label="대운수" value={`${daeun.startAge.years}년 ${daeun.startAge.months}개월 ${daeun.startAge.days}일`} compact />
                    <DaeunSummaryItem
                      label="기준 절기"
                      value={`${daeun.targetSolarTerm.nameKo} ${daeun.targetSolarTerm.nameHanja}, ${daeun.targetSolarTerm.datetime}`}
                      compact
                    />
                    <DaeunSummaryItem
                      label="첫 대운 예상 시작일"
                      value={daeun.firstStartDate ? formatIsoDate(daeun.firstStartDate) : "계산 불가"}
                      compact
                    />
                  </div>
                  <DebugTable
                    compact
                    rows={[
                      ["성별", daeun.debug.gender === "male" ? "남자" : "여자"],
                      ["년간", daeun.debug.yearStem],
                      ["년간 음양", daeun.debug.yearStemYinYang === "yang" ? "양" : "음"],
                      ["판정 결과", daeun.direction === "forward" ? "양남음녀" : "음남양녀"],
                      ["순행/역행", daeun.directionText],
                      ["방향 기준", daeun.debug.directionBasis],
                      ["기준 절기", `${daeun.targetSolarTerm.nameKo}(${daeun.targetSolarTerm.nameHanja}) ${daeun.targetSolarTerm.datetime}`],
                      ["출생 시각", daeun.debug.birthDateTime],
                      ["기준 절기 시각", daeun.debug.targetTermDateTime],
                      ["시간 차이", `${daeun.debug.diffDays.toFixed(6)}일 (${daeun.debug.diffSeconds.toFixed(0)}초)`],
                      ["3일=1년 환산", `${daeun.startAge.decimalYears.toFixed(6)}년 = ${daeun.startAge.years}년 ${daeun.startAge.months}개월 ${daeun.startAge.days}일`],
                      ["월주 기준 간지 배열", `${daeun.debug.monthPillarGanji}에서 ${daeun.directionText}으로 다음/이전 간지를 10년 단위 배열`],
                      ["절기 모드", daeun.debug.termMode],
                      ["나이 계산 모드", daeun.debug.ageCalculationMode],
                      ["표시 반올림", daeun.debug.roundingMode],
                      ["계산 규칙", daeun.debug.ruleSummary],
                    ]}
                  />
                  {daeun.debug.warnings.map((warning) => (
                    <p key={warning} className="leading-relaxed">
                      ※ {warning}
                    </p>
                  ))}
                </>
              )}

              <p className="leading-relaxed pt-1">
                ※ 절기 시각은 Jean Meeus 천문 계산 기반(±15~45분). 경계 근처 출생자는 KASI 공식 데이터 교차 검증 권장.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

    {showExploreGuide && (
      <CoachmarkOverlay
        steps={[
          {
            title: "대운 선택",
            body: "대운을 누르면 사주에 겹쳐집니다.",
          },
          {
            title: "글자 클릭",
            body: "천간·지지를 누르면 지장간이 강조됩니다.",
          },
          {
            title: "오행 막대",
            body: "대운에 맞춰 오행 비중이 바뀝니다.",
          },
        ]}
        onComplete={completeExploreGuide}
        onSkip={completeExploreGuide}
      />
    )}

    {isMounted && !isMobile && flyers.length > 0 && createPortal(
      <>
        {flyers.map((f) => (
          <DaeunFlyer key={f.id} flyer={f} onArrive={handleFlyerArrive} />
        ))}
      </>,
      document.body,
    )}

    </>
  );
}

type FlyerData = {
  id: string;
  slotId: string;
  char: string;
  color: string;
  element: Element;
  sx: number;
  sy: number;
  getTarget: () => { x: number; y: number };
  delay: number;
};

type StarParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  rotation: number;
};

const STAR_CLIP =
  "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";

function getBranchHiddenStemsWithTenGod(
  branch: string,
  dayStem: StemHanja,
): HiddenStemWithTenGod[] {
  try {
    return getHiddenStemsByBranch(branch).map((hs) => ({
      ...hs,
      tenGod: getTenGod(dayStem, hs.stem),
    }));
  } catch {
    return [];
  }
}

function DaeunCharBox({
  char,
  tenGod,
  style,
  showBorder,
  charSize,
  labelSize,
  tone = null,
  pumping = false,
  compact = false,
  onClick,
}: {
  char: string;
  tenGod: string;
  style: { text: string; bg: string; border: string };
  showBorder: boolean;
  charSize: string;
  labelSize: string;
  tone?: HighlightTone;
  pumping?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex flex-col items-center ganji-clickable bg-transparent border-0 ${highlightToneClass(tone)} ${pumping ? "daeun-slot-pump" : ""} ${
        compact ? "px-0 py-0" : charSize === "28px" ? "px-1 py-0.5" : "px-1.5 py-0.5"
      }`}
      onClick={onClick}
      style={{
        border: tone
          ? "2px solid transparent"
          : showBorder
            ? `2px solid ${style.border}`
            : "2px solid transparent",
        background: tone ? undefined : showBorder ? style.bg : "transparent",
        boxShadow: tone
          ? undefined
          : showBorder
            ? `0 0 12px ${style.text}44, inset 0 0 6px ${style.text}11`
            : "none",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease",
      }}
    >
      <span
        data-flyer-char
        className="font-black leading-none block text-center"
        style={{
          color: style.text,
          fontSize: charSize,
          textShadow: `0 0 14px ${style.text}, 0 0 6px ${style.text}88`,
        }}
      >
        {char}
      </span>
      {tenGod && (
        <span
          className={`font-bold border mt-0.5 ${compact ? "px-0.5 py-0" : "px-1.5 py-0.5"}`}
          style={{
            color: style.text,
            borderColor: style.border,
            background: style.bg,
            fontSize: labelSize,
          }}
        >
          {tenGod}
        </span>
      )}
    </button>
  );
}

function DaeunFlyer({
  flyer,
  onArrive,
}: {
  flyer: FlyerData;
  onArrive: (slotId: string, flyerId: string) => void;
}) {
  const [pos, setPos] = useState({ x: flyer.sx, y: flyer.sy });
  const [particles, setParticles] = useState<StarParticle[]>([]);
  const [visible, setVisible] = useState(false);
  const particleIdRef = useRef(0);

  useEffect(() => {
    const delayTimer = setTimeout(() => setVisible(true), flyer.delay);
    return () => clearTimeout(delayTimer);
  }, [flyer.delay]);

  useEffect(() => {
    if (!visible) return;

    const duration = 720;
    const startTime = performance.now();
    let raf = 0;
    let lastSpawn = 0;

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2.8);
      const target = flyer.getTarget();
      const x = flyer.sx + (target.x - flyer.sx) * eased;
      const y = flyer.sy + (target.y - flyer.sy) * eased;

      setPos({ x, y });

      const dx = target.x - x;
      const dy = target.y - y;
      const motionAngle = Math.atan2(dy, dx);
      const oppAngle = motionAngle + Math.PI;

      setParticles((prev) => {
        let next = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.96,
            vy: p.vy * 0.96,
            life: p.life - 0.035,
            rotation: p.rotation + 2.5,
          }))
          .filter((p) => p.life > 0);

        if (now - lastSpawn > 28 && t < 0.95) {
          lastSpawn = now;
          for (let n = 0; n < 3; n++) {
            const spread = (Math.random() - 0.5) * 0.7;
            const speed = 1.2 + Math.random() * 2.2;
            next.push({
              id: particleIdRef.current++,
              x: (Math.random() - 0.5) * 8,
              y: (Math.random() - 0.5) * 8,
              vx: Math.cos(oppAngle + spread) * speed,
              vy: Math.sin(oppAngle + spread) * speed,
              life: 1,
              size: 5 + Math.random() * 7,
              rotation: Math.random() * 360,
            });
          }
        }

        return next.slice(-45);
      });

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onArrive(flyer.slotId, flyer.id);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, flyer, onArrive]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -100%)",
        zIndex: 10000,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
            background: flyer.color,
            opacity: p.life * 0.85,
            clipPath: STAR_CLIP,
            boxShadow: `0 0 ${p.size}px ${flyer.color}, 0 0 ${p.size * 2}px ${flyer.color}66`,
            pointerEvents: "none",
          }}
        />
      ))}
      <span
        style={{
          position: "relative",
          display: "block",
          fontSize: "36px",
          fontWeight: 900,
          lineHeight: 1,
          color: flyer.color,
          textShadow: `0 0 10px ${flyer.color}88`,
        }}
      >
        {flyer.char}
      </span>
    </div>
  );
}

type DaeunCycle = {
  order: number;
  ganji: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
};

function DaeunSummaryItem({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div
      className={compact ? "p-1.5" : "p-2"}
      style={{ background: "var(--px-bg2)", border: "1px solid var(--px-border)" }}
    >
      <p className={`font-bold mb-1 ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--px-text2)" }}>{label}</p>
      <p className={`font-bold leading-relaxed ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--px-text)" }}>{value}</p>
    </div>
  );
}

function HiddenStemLine({
  hiddenStem,
  showTenGod,
}: {
  hiddenStem: HiddenStemWithTenGod;
  showTenGod: boolean;
}) {
  const color = ELEM[hiddenStem.element].text;
  const yinYangKo = hiddenStem.yinYang === "yang" ? "양" : "음";

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className="px-1.5 py-0.5 font-bold border"
        style={{ color, borderColor: ELEM[hiddenStem.element].border, background: ELEM[hiddenStem.element].bg }}
      >
        {hiddenStem.roleKo}
      </span>
      <span className="font-black text-base leading-none" style={{ color, textShadow: `0 0 8px ${color}66` }}>
        {hiddenStem.stem}
      </span>
      <span className="font-bold" style={{ color }}>
        {hiddenStem.stemKo}
      </span>
      {showTenGod && hiddenStem.tenGod ? (
        <span style={{ color: "var(--px-text)" }}>/ {hiddenStem.tenGod}</span>
      ) : (
        <>
          <span style={{ color: "var(--px-text2)" }}>/ {ELEMENT_LABELS[hiddenStem.element]}</span>
          <span style={{ color: "var(--px-text2)" }}>/ {yinYangKo}</span>
        </>
      )}
    </div>
  );
}

function HiddenStemPanel({
  pillarStems,
  highlightSelection,
  touchoElements,
  pillarKey,
  context = "pillar",
  isMobile,
  title = "지장간",
  showTitle = false,
  largeChips = false,
}: {
  pillarStems: HiddenStemWithTenGod[];
  highlightSelection: HighlightSelection;
  touchoElements: Set<Element>;
  pillarKey: PillarKey;
  context?: "pillar" | "daeun";
  isMobile: boolean;
  title?: string;
  showTitle?: boolean;
  largeChips?: boolean;
}) {
  const chipSize = largeChips
    ? isMobile
      ? "14px"
      : "16px"
    : isMobile
      ? "11px"
      : "12px";

  return (
    <div
      className={`flex flex-col w-full ${showTitle ? "gap-0.5 pt-0.5" : ""}`}
      style={{
        borderTop: showTitle ? "1px solid var(--px-border)" : "none",
      }}
    >
      {showTitle && (
        <p
          className="text-center font-bold"
          style={{ fontSize: isMobile ? "11px" : "12px", color: "var(--px-text2)" }}
        >
          {title}
        </p>
      )}
      <div
        className={`flex flex-wrap justify-center items-center w-full ${isMobile ? "gap-0.5 px-0 py-0" : "gap-0.5 px-0 py-0"}`}
      >
        {pillarStems.map((hs) => (
          <HiddenStemChip
            key={`${context}-${hs.role}-${hs.stem}`}
            hiddenStem={hs}
            highlighted={isHiddenStemHighlighted(highlightSelection, context, pillarKey, hs, touchoElements)}
            fontSize={chipSize}
          />
        ))}
      </div>
    </div>
  );
}

function HiddenStemChip({
  hiddenStem,
  highlighted,
  fontSize = "11px",
}: {
  hiddenStem: HiddenStemWithTenGod;
  highlighted: boolean;
  fontSize?: string;
}) {
  const color = ELEM[hiddenStem.element].text;
  const isMatch = highlighted;
  const purple = "#c084fc";

  return (
    <span
      className="font-bold leading-none inline-flex items-center justify-center box-border"
      title={`${hiddenStem.roleKo}: ${hiddenStem.stem} (${ELEM_KO[hiddenStem.element]})`}
      style={{
        fontSize,
        minWidth: "1.4em",
        minHeight: "1.4em",
        padding: "1px 2px",
        color,
        border: `2px solid ${isMatch ? purple : ELEM[hiddenStem.element].border}`,
        background: isMatch ? `${purple}33` : ELEM[hiddenStem.element].bg,
        boxShadow: isMatch ? `0 0 8px ${purple}88, inset 0 0 4px ${purple}22` : "none",
      }}
    >
      {hiddenStem.stem}
    </span>
  );
}

function ColoredGanji({
  ganji,
  compact = false,
  charSize,
}: {
  ganji: string;
  compact?: boolean;
  charSize?: string;
}) {
  const stem = ganji[0];
  const branch = ganji[1];
  const stemElement = STEM_META[stem]?.element;
  const branchElement = BRANCH_META[branch]?.element;
  const stemColor = stemElement ? ELEM[stemElement].text : "var(--px-accent)";
  const branchColor = branchElement ? ELEM[branchElement].text : "var(--px-accent)";

  return (
    <span className="font-black leading-none" style={{ fontSize: charSize ?? (compact ? "13px" : undefined) }}>
      <span style={{ color: stemColor, textShadow: `0 0 8px ${stemColor}66` }}>{stem}</span>
      <span style={{ color: branchColor, textShadow: `0 0 8px ${branchColor}66` }}>{branch}</span>
    </span>
  );
}

/** 년운 한 칸: 십신 + 세로 간지, 클릭 시 오행 분포에 반영 */
function SewoonYearCell({
  ganji,
  year,
  isMobile,
  isSelected,
  stemTenGod,
  branchTenGod,
  onClick,
}: {
  ganji: string;
  year: number;
  isMobile: boolean;
  isSelected: boolean;
  stemTenGod: string;
  branchTenGod: string;
  onClick: () => void;
}) {
  const stem = ganji[0];
  const branch = ganji[1];
  const stemElement = STEM_META[stem]?.element;
  const branchElement = BRANCH_META[branch]?.element;
  const stemColor = stemElement ? ELEM[stemElement].text : "var(--px-accent)";
  const branchColor = branchElement ? ELEM[branchElement].text : "var(--px-accent)";
  const sc = stemElement ? ELEM[stemElement] : ELEM.water;
  const bc = branchElement ? ELEM[branchElement] : ELEM.water;
  const charSize = isMobile ? "13px" : "14px";
  const yearSize = isMobile ? "11px" : "12px";
  const tenGodSize = isMobile ? "11px" : "12px";

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="daeun-card flex flex-col items-center justify-center gap-0 py-0.5 min-w-0 w-full"
      title={`${year} · ${ganji}`}
      style={{
        background: isSelected
          ? "color-mix(in srgb, #fbbf24 18%, var(--px-bg2))"
          : "transparent",
        border: isSelected ? "1px solid #fbbf24" : "1px solid transparent",
        boxShadow: isSelected ? "0 0 8px #fbbf2444" : "none",
        cursor: "pointer",
      }}
    >
      {stemTenGod ? (
        <span
          className="font-bold border leading-none mb-0.5"
          style={{
            fontSize: tenGodSize,
            padding: "0 2px",
            color: sc.text,
            borderColor: sc.border,
            background: sc.bg,
          }}
        >
          {stemTenGod}
        </span>
      ) : (
        <span style={{ fontSize: tenGodSize, lineHeight: 1, opacity: 0 }}>·</span>
      )}
      <span
        className="font-black leading-none"
        style={{ fontSize: charSize, color: stemColor, textShadow: `0 0 6px ${stemColor}55` }}
      >
        {stem}
      </span>
      <span
        className="font-black leading-none"
        style={{ fontSize: charSize, color: branchColor, textShadow: `0 0 6px ${branchColor}55` }}
      >
        {branch}
      </span>
      {branchTenGod ? (
        <span
          className="font-bold border leading-none mt-0.5"
          style={{
            fontSize: tenGodSize,
            padding: "0 2px",
            color: bc.text,
            borderColor: bc.border,
            background: bc.bg,
          }}
        >
          {branchTenGod}
        </span>
      ) : null}
      <span
        className="font-bold leading-none mt-0.5"
        style={{ color: "var(--px-text2)", fontSize: yearSize }}
      >
        {String(year).slice(-2)}
      </span>
    </button>
  );
}

function formatCycleAge(iso: string | null, birthIso: string, ageMode: AgeMode): string {
  if (!iso) return "-";
  const age = ageMode === "international"
    ? calculateInternationalAge(birthIso, iso)
    : calculateKoreanAge(birthIso, iso);
  return String(age);
}

function formatIsoDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatDateWithAge(iso: string | null, birthIso: string, ageMode: AgeMode): string {
  if (!iso) return "-";

  const age = ageMode === "international"
    ? calculateInternationalAge(birthIso, iso)
    : calculateKoreanAge(birthIso, iso);

  return `${formatIsoDate(iso)} (${ageMode === "international" ? "만" : "한국"} ${age}세)`;
}

function calculateInternationalAge(birthIso: string, targetIso: string): number {
  const birth = new Date(birthIso);
  const target = new Date(targetIso);
  let age = target.getFullYear() - birth.getFullYear();

  const targetMonthDayTime =
    target.getMonth() * 100000000 +
    target.getDate() * 1000000 +
    target.getHours() * 10000 +
    target.getMinutes() * 100 +
    target.getSeconds();
  const birthMonthDayTime =
    birth.getMonth() * 100000000 +
    birth.getDate() * 1000000 +
    birth.getHours() * 10000 +
    birth.getMinutes() * 100 +
    birth.getSeconds();

  if (targetMonthDayTime < birthMonthDayTime) age -= 1;
  return Math.max(age, 0);
}

function calculateKoreanAge(birthIso: string, targetIso: string): number {
  const birth = new Date(birthIso);
  const target = new Date(targetIso);
  return Math.max(target.getFullYear() - birth.getFullYear() + 1, 1);
}

function DebugTable({ rows, compact = false }: { rows: [string, string][]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${compact ? "text-[11px]" : "text-xs"}`} style={{ borderCollapse: "collapse" }}>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? "var(--px-bg3)" : "var(--px-bg2)",
                borderBottom: "1px solid var(--px-border)",
              }}
            >
              <td
                className="py-1.5 px-3 font-bold whitespace-nowrap"
                style={{ color: "var(--px-text2)", width: "45%" }}
              >
                {label}
              </td>
              <td
                className="py-1.5 px-3"
                style={{ color: "var(--px-text)", fontFamily: "monospace" }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
