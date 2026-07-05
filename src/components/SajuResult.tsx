"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { SajuResult } from "@/lib/saju/types";
import type { Element } from "@/lib/saju/constants";
import { BRANCH_META, ELEMENT_LABELS, STEM_META } from "@/lib/saju/constants";
import { getTenGod, getHiddenStemsByBranch, type HiddenStemByPillar, type HiddenStemWithTenGod, type StemHanja } from "@/lib/saju/hiddenStems";
import AiAnalysis from "@/components/AiAnalysis";
import { useViewMode } from "@/contexts/ViewModeContext";

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
  | { kind: "stem"; source: "pillar" | "daeun-slot" | "daeun-table"; pillar: PillarKey | "all"; element: Element }
  | { kind: "branch-stem-match"; scope: "pillar" | "daeun"; pillar: PillarKey }
  | null;

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

function isHiddenStemHighlighted(
  selection: HighlightSelection,
  context: "pillar" | "daeun",
  pillarKey: PillarKey,
  hiddenStem: HiddenStemWithTenGod,
  stemElements: Set<Element>,
): boolean {
  if (!selection) return false;
  if (selection.kind === "stem") {
    if (hiddenStem.element !== selection.element) return false;
    if (context === "pillar") return true;
    return selection.pillar === "all" || selection.pillar === pillarKey;
  }
  if (selection.kind === "branch-stem-match") {
    if (context !== selection.scope) return false;
    if (selection.scope === "daeun" && pillarKey !== selection.pillar) return false;
    return stemElements.has(hiddenStem.element);
  }
  return false;
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
  const charSize = isMobile ? "24px" : "36px";
  const labelSize = isMobile ? "9px" : "10px";
  const [showDebug, setShowDebug] = useState(false);
  const [showDaeunDebug, setShowDaeunDebug] = useState(false);
  const [daeunAgeMode, setDaeunAgeMode] = useState<AgeMode>("international");
  const [showHiddenStemTenGod, setShowHiddenStemTenGod] = useState(false);
  const [highlightSelection, setHighlightSelection] = useState<HighlightSelection>(null);
  const [selectedDaeunOrder, setSelectedDaeunOrder] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<FlyerData[]>([]);
  const [arrivedSlots, setArrivedSlots] = useState<Set<string>>(new Set());
  const [pumpingSlots, setPumpingSlots] = useState<Set<string>>(new Set());
  const [pumpGeneration, setPumpGeneration] = useState(0);
  const pumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const daeunStemSlotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const daeunBranchSlotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const { pillars, debug, input } = result;
  const daeun = result.daeun;
  const hiddenStems = result.hiddenStems;
  const dayStem = pillars.day.stem.hanja as StemHanja;
  const selectedDaeun = daeun.cycles.find((c) => c.order === selectedDaeunOrder) ?? null;
  const hiddenStemItemsByPillar = Object.fromEntries(
    hiddenStems.items.map((item) => [item.pillar, item])
  ) as Partial<Record<PillarKey, HiddenStemByPillar>>;

  const toggleHighlight = useCallback((next: Exclude<HighlightSelection, null>) => {
    setHighlightSelection((prev) => (isSameHighlightSelection(prev, next) ? null : next));
  }, []);

  const stemElements = new Set<Element>();
  for (const k of DISPLAY_ORDER) {
    const p = pillars[k];
    if (p) stemElements.add(p.stem.element);
  }

  // 오행 분포 집계
  const elemCount: Record<Element, number> = {
    wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
  };
  for (const key of (["year", "month", "day", "hour"] as PillarKey[])) {
    const p = pillars[key];
    if (!p) continue;
    elemCount[p.stem.element]++;
    elemCount[p.branch.element]++;
  }
  const totalElem = Object.values(elemCount).reduce((a, b) => a + b, 0);

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
    if (isSelected) {
      setSelectedDaeunOrder(null);
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
    setHighlightSelection((prev) => {
      if (!prev) return prev;
      if (prev.kind === "stem" && (prev.source === "daeun-slot" || prev.source === "daeun-table")) return null;
      if (prev.kind === "branch-stem-match") return null;
      return prev;
    });

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
  }, [launchFlyers, isMobile, triggerMobilePump]);

  return (
    <>
    <div className="space-y-4" style={{ border: "2px solid var(--px-accent)", boxShadow: isMobile ? "4px 4px 0 #4a3a00" : "6px 6px 0 #4a3a00" }}>
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
          transition: background 0.1s, box-shadow 0.1s;
        }
        .ganji-clickable:hover { background: #ffffff11; }
        .ganji-clickable-selected {
          box-shadow: 0 0 0 2px #fbbf24, 0 0 12px #fbbf2488;
          background: #fbbf2418;
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

      <div className={`pb-4 space-y-6 ${isMobile ? "px-2" : "px-4"}`}>
        {/* ── 4주 카드 (왼쪽: 시주 → 오른쪽: 년주) ── */}
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

          return (
            <div className={`grid grid-cols-4 ${isMobile ? "gap-1.5" : "gap-2"}`}>
              {DISPLAY_ORDER.map((key, i) => {
                const pillar = pillars[key];
                const meta   = PILLAR_META[key];
                const stemSlotId = `stem-${i}`;
                const branchSlotId = `branch-${i}`;
                const stemArrived = !selectedDaeun || arrivedSlots.has(stemSlotId) || (isMobile && !!selectedDaeun);
                const branchArrived = !selectedDaeun || arrivedSlots.has(branchSlotId) || (isMobile && !!selectedDaeun);
                const stemPumping = pumpingSlots.has(stemSlotId);
                const branchPumping = pumpingSlots.has(branchSlotId);

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
                        <span style={{ fontSize: "10px" }}>{meta.hanja}</span>
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
                const stemSelected =
                  highlightSelection?.kind === "stem" &&
                  highlightSelection.source === "pillar" &&
                  highlightSelection.pillar === key;
                const branchSelected =
                  highlightSelection?.kind === "branch-stem-match" &&
                  highlightSelection.scope === "pillar" &&
                  highlightSelection.pillar === key;
                const daeunStemSelected =
                  highlightSelection?.kind === "stem" &&
                  highlightSelection.source === "daeun-slot" &&
                  highlightSelection.pillar === key;
                const daeunBranchSelected =
                  highlightSelection?.kind === "branch-stem-match" &&
                  highlightSelection.scope === "daeun" &&
                  highlightSelection.pillar === key;

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
                    {/* 주 라벨 */}
                    <div className="text-center pb-1 w-full" style={{ borderBottom: "1px solid var(--px-border)" }}>
                      <p className="font-black leading-tight" style={{ color: "var(--px-accent)", fontSize: labelSize }}>{meta.ko}</p>
                      {!isMobile && (
                        <p style={{ color: "var(--px-text2)", fontSize: "10px" }}>{meta.hanja}</p>
                      )}
                    </div>

                    {/* ── 선택된 대운 천간 ── */}
                    {selectedDaeun && daeunSc && (
                      <div
                        ref={(el) => { daeunStemSlotRefs.current[i] = el; }}
                        className={`flex flex-col items-center w-full ${isMobile ? "pt-1 pb-0.5 min-h-0" : "pt-1 pb-0.5 min-h-[52px]"}`}
                        style={{ borderBottom: "1px dotted var(--px-border)" }}
                      >
                        <div key={`stem-${pumpGeneration}`} style={{ visibility: stemArrived ? "visible" : "hidden" }}>
                          <DaeunCharBox
                            char={selectedDaeun.ganji[0]}
                            tenGod={daeunStemTenGod}
                            style={daeunSc}
                            showBorder={stemArrived}
                            charSize={charSize}
                            labelSize={labelSize}
                            selected={daeunStemSelected}
                            pumping={stemPumping}
                            onClick={() => {
                              const el = STEM_META[selectedDaeun.ganji[0]]?.element;
                              if (el) toggleHighlight({ kind: "stem", source: "daeun-slot", pillar: key, element: el });
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── 천간(天干) ── */}
                    <div className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}
                      style={{ borderBottom: "1px dashed var(--px-border)" }}>
                      <button
                        type="button"
                        className={`ganji-clickable font-black leading-none bg-transparent border-0 p-0 ${stemSelected ? "ganji-clickable-selected" : ""}`}
                        style={{ color: sc.text, fontSize: charSize, textShadow: `0 0 10px ${sc.text}88` }}
                        onClick={() => toggleHighlight({ kind: "stem", source: "pillar", pillar: key, element: pillar.stem.element })}
                        title="천간 클릭: 같은 오행 지장간 강조"
                      >
                        {pillar.stem.hanja}
                      </button>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-bold border leading-none"
                          style={{ color: sc.text, borderColor: sc.border, background: sc.bg, fontSize: labelSize, padding: isMobile ? "1px 3px" : undefined }}>
                          {stemTenGod}
                        </span>
                      </div>
                    </div>

                    {/* ── 지지(地支) ── */}
                    <div className={`flex flex-col items-center w-full ${isMobile ? "py-1 gap-0.5" : "gap-0.5 py-1.5"}`}>
                      <button
                        type="button"
                        className={`ganji-clickable font-black leading-none bg-transparent border-0 p-0 ${branchSelected ? "ganji-clickable-selected" : ""}`}
                        style={{ color: bc.text, fontSize: charSize, textShadow: `0 0 10px ${bc.text}88` }}
                        onClick={() => toggleHighlight({ kind: "branch-stem-match", scope: "pillar", pillar: key })}
                        title="지지 클릭: 천간 오행과 같은 지장간 강조"
                      >
                        {pillar.branch.hanja}
                      </button>
                      {branchTenGod && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-bold border leading-none"
                            style={{ color: bc.text, borderColor: bc.border, background: bc.bg, fontSize: labelSize, padding: isMobile ? "1px 3px" : undefined }}>
                            {branchTenGod}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── 선택된 대운 지지 ── */}
                    {selectedDaeun && daeunBc && (
                      <div
                        ref={(el) => { daeunBranchSlotRefs.current[i] = el; }}
                        className={`flex flex-col items-center w-full ${isMobile ? "pt-1 pb-0.5 min-h-0" : "pt-0.5 pb-1 min-h-[52px]"}`}
                        style={{ borderTop: "1px dotted var(--px-border)" }}
                      >
                        <div key={`branch-${pumpGeneration}`} style={{ visibility: branchArrived ? "visible" : "hidden" }}>
                          <DaeunCharBox
                            char={selectedDaeun.ganji[1]}
                            tenGod={daeunBranchTenGod ?? ""}
                            style={daeunBc}
                            showBorder={branchArrived}
                            charSize={charSize}
                            labelSize={labelSize}
                            selected={daeunBranchSelected}
                            pumping={branchPumping}
                            onClick={() => toggleHighlight({ kind: "branch-stem-match", scope: "daeun", pillar: key })}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── 지장간 ── */}
                    {(hiddenStemItem?.hiddenStems?.length || (selectedDaeun && daeunBranchHiddenStems.length)) ? (
                      <HiddenStemPanel
                        pillarStems={hiddenStemItem?.hiddenStems ?? []}
                        daeunStems={selectedDaeun ? daeunBranchHiddenStems : undefined}
                        highlightSelection={highlightSelection}
                        stemElements={stemElements}
                        pillarKey={key}
                        split={!!selectedDaeun}
                        isMobile={isMobile}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── 대운(大運) ── */}
        <div
          className={`space-y-4 ${isMobile ? "p-2.5" : "p-3"}`}
          style={{ background: "var(--px-bg3)", border: "2px solid var(--px-border)", boxShadow: "3px 3px 0 #000" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
              ■ 대운(大運)
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold" style={{ color: "var(--px-text2)" }}>나이 표시</span>
              {([
                ["international", "만나이"],
                ["korean", "한국 나이"],
              ] as [AgeMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDaeunAgeMode(mode)}
                  className="px-3 py-1 font-bold border-2"
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

          {!isMobile && (
            <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
              ※ 대운 클릭 시 사주에 표시 · 천간/지지 클릭 시 지장간 강조
            </p>
          )}

          <div className={`grid ${isMobile ? "grid-cols-5 gap-1" : "grid-cols-10 gap-1"}`}>
              {daeun.cycles.map((cycle, index) => {
                const isSelected = selectedDaeunOrder === cycle.order;
                const daeunCharSize = isMobile ? "16px" : "22px";
                const daeunLabelSize = isMobile ? "9px" : "11px";
                const daeunAgeSize = isMobile ? "9px" : "10px";
                const stemEl = STEM_META[cycle.ganji[0]]?.element;
                const branchEl = BRANCH_META[cycle.ganji[1]]?.element;
                const sc = stemEl ? ELEM[stemEl] : ELEM.water;
                const bc = branchEl ? ELEM[branchEl] : ELEM.water;
                let stemTenGod: string = "";
                let branchTenGod: string = "";
                try {
                  stemTenGod = getTenGod(dayStem, cycle.ganji[0] as StemHanja);
                  const branchHiddenStems = getBranchHiddenStemsWithTenGod(cycle.ganji[1], dayStem);
                  branchTenGod =
                    branchHiddenStems.find((s) => s.role === "main")?.tenGod ??
                    branchHiddenStems[branchHiddenStems.length - 1]?.tenGod ??
                    "";
                } catch {
                  stemTenGod = "";
                  branchTenGod = "";
                }
                const startAge = formatCycleAge(cycle.estimatedStartDate, input.normalizedSolarDateTime, daeunAgeMode);
                const endAge = formatCycleAge(cycle.estimatedEndDate, input.normalizedSolarDateTime, daeunAgeMode);
                return (
                  <div
                    key={cycle.order}
                    role="button"
                    tabIndex={0}
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
                        branchEl ?? "water",
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
                          branchEl ?? "water",
                        );
                      }
                    }}
                    className={`daeun-card flex flex-col items-center w-full ${isSelected ? "daeun-card-selected" : ""} ${isMobile ? "gap-1 px-1 py-1.5" : "gap-1 px-1 py-1.5"}`}
                    style={{
                      background: "var(--px-bg2)",
                      border: isSelected ? "2px solid #fbbf24" : "1px solid var(--px-border)",
                      boxShadow: isSelected ? "2px 2px 0 #4a3a00, 0 0 10px #fbbf2444" : "1px 1px 0 #000",
                    }}
                  >
                    <p
                      className="font-bold leading-tight text-center w-full"
                      style={{ color: "var(--px-accent)", fontSize: daeunAgeSize }}
                    >
                      {startAge}~{endAge}세
                    </p>
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
                      <span className="font-bold leading-none" style={{ color: "var(--px-text2)", fontSize: daeunLabelSize }}>
                        {cycle.order}운
                      </span>
                    )}
                    <ColoredGanji ganji={cycle.ganji} compact={isMobile} charSize={daeunCharSize} />
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
                    {!isMobile && (
                      <div className="text-[9px] text-center leading-tight w-full">
                        <p style={{ color: "var(--px-text2)" }}>
                          {cycle.estimatedStartDate ? formatIsoDate(cycle.estimatedStartDate) : "-"}
                        </p>
                        <p style={{ color: "var(--px-border2)" }}>
                          ~{cycle.estimatedEndDate ? formatIsoDate(cycle.estimatedEndDate) : "-"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div style={{ border: "2px solid var(--px-border)", boxShadow: "3px 3px 0 #000" }}>
            <button
              type="button"
              onClick={() => setShowDaeunDebug(!showDaeunDebug)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-colors"
              style={{ background: "var(--px-bg2)", color: "var(--px-text2)" }}
            >
              <span>■ 대운 계산 근거 보기</span>
              <span style={{ color: "var(--px-accent)" }}>{showDaeunDebug ? "▲ 닫기" : "▼ 펼치기"}</span>
            </button>
            {showDaeunDebug && (
              <div
                className="px-4 pb-4 pt-3 space-y-3"
                style={{ borderTop: "2px solid var(--px-border)", background: "var(--px-bg2)" }}
              >
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <DaeunSummaryItem label="대운 방향" value={daeun.directionText} />
                  <DaeunSummaryItem label="대운수" value={`${daeun.startAge.years}년 ${daeun.startAge.months}개월 ${daeun.startAge.days}일`} />
                  <DaeunSummaryItem
                    label="기준 절기"
                    value={`${daeun.targetSolarTerm.nameKo} ${daeun.targetSolarTerm.nameHanja}, ${daeun.targetSolarTerm.datetime}`}
                  />
                  <DaeunSummaryItem
                    label="첫 대운 예상 시작일"
                    value={daeun.firstStartDate ? formatIsoDate(daeun.firstStartDate) : "계산 불가"}
                  />
                </div>
                <DebugTable
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
                <div className="text-xs leading-relaxed space-y-1" style={{ color: "var(--px-border2)" }}>
                  {daeun.debug.warnings.map((warning) => (
                    <p key={warning}>※ {warning}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 오행 분포 ── */}
        <div
          className="p-3"
          style={{ background: "var(--px-bg3)", border: "2px solid var(--px-border)", boxShadow: "3px 3px 0 #000" }}
        >
          <p className="text-xs font-bold mb-3" style={{ color: "var(--px-accent)" }}>
            ■ 오행(五行) 분포
          </p>
          <div className="space-y-2">
            {(Object.entries(elemCount) as [Element, number][]).map(([elem, count]) => {
              const c = ELEM[elem];
              const pct = totalElem > 0 ? (count / totalElem) * 100 : 0;
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
                  {/* 픽셀 바 */}
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
                  <span className="text-xs font-bold w-4" style={{ color: c.text }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI 분석 ── */}
        <AiAnalysis result={result} />

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

        {/* ── 계산 근거 ── */}
        <div style={{ border: "2px solid var(--px-border)", boxShadow: "3px 3px 0 #000" }}>
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-colors"
            style={{
              background: "var(--px-bg3)",
              color: "var(--px-text2)",
            }}
          >
            <span>■ 계산 근거 (절기 시각 · 적용 옵션)</span>
            <span style={{ color: "var(--px-accent)" }}>{showDebug ? "▲ 닫기" : "▼ 펼치기"}</span>
          </button>

          {showDebug && (
            <div
              className="px-4 pb-4 pt-3 space-y-3"
              style={{ borderTop: "2px solid var(--px-border)", background: "var(--px-bg2)" }}
            >
              <DebugTable
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
              <p className="text-xs leading-relaxed" style={{ color: "var(--px-border2)" }}>
                ※ 절기 시각은 Jean Meeus 천문 계산 기반(±15~45분). 경계 근처 출생자는 KASI 공식 데이터 교차 검증 권장.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

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
  selected = false,
  pumping = false,
  onClick,
}: {
  char: string;
  tenGod: string;
  style: { text: string; bg: string; border: string };
  showBorder: boolean;
  charSize: string;
  labelSize: string;
  selected?: boolean;
  pumping?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex flex-col items-center ganji-clickable bg-transparent border-0 ${selected ? "ganji-clickable-selected" : ""} ${pumping ? "daeun-slot-pump" : ""} ${charSize === "24px" ? "px-1 py-0.5" : "px-1.5 py-0.5"}`}
      onClick={onClick}
      style={{
        border: showBorder ? `2px solid ${style.border}` : "2px solid transparent",
        background: showBorder ? style.bg : "transparent",
        boxShadow: showBorder ? `0 0 12px ${style.text}44, inset 0 0 6px ${style.text}11` : "none",
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
          className="font-bold border px-1.5 py-0.5 mt-0.5"
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

function DaeunSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-2"
      style={{ background: "var(--px-bg2)", border: "1px solid var(--px-border)" }}
    >
      <p className="font-bold mb-1" style={{ color: "var(--px-text2)" }}>{label}</p>
      <p className="font-bold leading-relaxed" style={{ color: "var(--px-text)" }}>{value}</p>
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
  daeunStems,
  highlightSelection,
  stemElements,
  pillarKey,
  split,
  isMobile,
}: {
  pillarStems: HiddenStemWithTenGod[];
  daeunStems?: HiddenStemWithTenGod[];
  highlightSelection: HighlightSelection;
  stemElements: Set<Element>;
  pillarKey: PillarKey;
  split: boolean;
  isMobile: boolean;
}) {
  const chipSize = isMobile ? "10px" : "11px";

  if (split && daeunStems) {
    return (
      <div
        className="grid grid-cols-2 w-full pt-0.5"
        style={{ borderTop: "1px solid var(--px-border)" }}
      >
        <div className={`flex flex-col items-center min-w-0 ${isMobile ? "gap-0.5 px-0 py-1" : "gap-0.5 px-0.5 py-1"}`}>
          {pillarStems.map((hs) => (
            <HiddenStemChip
              key={`p-${hs.role}-${hs.stem}`}
              hiddenStem={hs}
              highlighted={isHiddenStemHighlighted(highlightSelection, "pillar", pillarKey, hs, stemElements)}
              fontSize={chipSize}
            />
          ))}
        </div>
        <div
          className={`flex flex-col items-center min-w-0 ${isMobile ? "gap-0.5 px-0 py-1" : "gap-0.5 px-0.5 py-1"}`}
          style={{ borderLeft: "1px solid var(--px-border)" }}
        >
          {daeunStems.map((hs) => (
            <HiddenStemChip
              key={`d-${hs.role}-${hs.stem}`}
              hiddenStem={hs}
              highlighted={isHiddenStemHighlighted(highlightSelection, "daeun", pillarKey, hs, stemElements)}
              fontSize={chipSize}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap justify-center w-full pt-1 ${isMobile ? "gap-0.5" : "gap-0.5"}`}
      style={{ borderTop: "1px solid var(--px-border)" }}
    >
      {pillarStems.map((hs) => (
        <HiddenStemChip
          key={`p-${hs.role}-${hs.stem}`}
          hiddenStem={hs}
          highlighted={isHiddenStemHighlighted(highlightSelection, "pillar", pillarKey, hs, stemElements)}
          fontSize={chipSize}
        />
      ))}
    </div>
  );
}

function HiddenStemChip({
  hiddenStem,
  highlighted,
  fontSize = "10px",
}: {
  hiddenStem: HiddenStemWithTenGod;
  highlighted: boolean;
  fontSize?: string;
}) {
  const color = ELEM[hiddenStem.element].text;
  const isMatch = highlighted;

  return (
    <span
      className="font-bold leading-none inline-flex items-center justify-center box-border"
      title={`${hiddenStem.roleKo}: ${hiddenStem.stem} (${ELEM_KO[hiddenStem.element]})`}
      style={{
        fontSize,
        minWidth: "1.6em",
        minHeight: "1.6em",
        padding: "2px 3px",
        color,
        border: `2px solid ${isMatch ? color : ELEM[hiddenStem.element].border}`,
        background: isMatch ? `${color}33` : ELEM[hiddenStem.element].bg,
        boxShadow: isMatch ? `0 0 8px ${color}88, inset 0 0 4px ${color}22` : "none",
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

function DebugTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
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
