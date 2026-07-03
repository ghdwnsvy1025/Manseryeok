"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { SajuResult } from "@/lib/saju/types";
import type { Element } from "@/lib/saju/constants";
import { BRANCH_META, ELEMENT_LABELS, STEM_META } from "@/lib/saju/constants";
import { getTenGod, getHiddenStemsByBranch, type HiddenStemByPillar, type HiddenStemWithTenGod, type StemHanja } from "@/lib/saju/hiddenStems";
import AiAnalysis from "@/components/AiAnalysis";

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
  const [showDebug, setShowDebug] = useState(false);
  const [showDaeunDebug, setShowDaeunDebug] = useState(false);
  const [daeunAgeMode, setDaeunAgeMode] = useState<AgeMode>("international");
  const [showHiddenStemTenGod, setShowHiddenStemTenGod] = useState(false);
  const [selectedDaeunOrder, setSelectedDaeunOrder] = useState<number | null>(null);
  const [comets, setComets] = useState<CometData[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const pillarRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const { pillars, debug, input } = result;
  const daeun = result.daeun;
  const hiddenStems = result.hiddenStems;
  const dayStem = pillars.day.stem.hanja as StemHanja;
  const selectedDaeun = daeun.cycles.find((c) => c.order === selectedDaeunOrder) ?? null;
  const hiddenStemItemsByPillar = Object.fromEntries(
    hiddenStems.items.map((item) => [item.pillar, item])
  ) as Partial<Record<PillarKey, HiddenStemByPillar>>;

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

  useEffect(() => { setIsMounted(true); }, []);

  const launchComets = useCallback((
    sourceEl: HTMLElement,
    stemChar: string, stemColor: string,
    branchChar: string, branchColor: string,
  ) => {
    const src = sourceEl.getBoundingClientRect();
    const ox = src.left + src.width / 2;
    const oy = src.top + src.height / 2;
    const now = Date.now();
    const list: CometData[] = [];

    pillarRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const idx = i; // closure capture

      // 천간 → 각 기둥 카드 바로 위
      list.push({
        id: `st${idx}${now}`, char: stemChar, color: stemColor,
        sx: ox, sy: oy, ex: cx, ey: r.top - 22,
        getArrivalPos: () => {
          const ref = pillarRefs.current[idx];
          if (!ref) return { x: cx, y: r.top - 22 };
          const rr = ref.getBoundingClientRect();
          return { x: rr.left + rr.width / 2, y: rr.top - 22 };
        },
        delay: idx * 110,
      });

      // 지지 → 각 기둥 카드 바로 아래
      list.push({
        id: `br${idx}${now}`, char: branchChar, color: branchColor,
        sx: ox, sy: oy, ex: cx, ey: r.bottom + 6,
        getArrivalPos: () => {
          const ref = pillarRefs.current[idx];
          if (!ref) return { x: cx, y: r.bottom + 6 };
          const rr = ref.getBoundingClientRect();
          return { x: rr.left + rr.width / 2, y: rr.bottom + 6 };
        },
        delay: idx * 110 + 55,
      });
    });

    setComets(list);
    // 사라지지 않음 - setComets([]) 호출 없음
  }, []);

  return (
    <>
    <div className="space-y-4" style={{ border: "2px solid var(--px-accent)", boxShadow: "6px 6px 0 #4a3a00" }}>
      <style>{`
        @keyframes daeun-pulse {
          0%, 100% { box-shadow: 3px 3px 0 #4a3a00, 0 0 10px #fbbf2444; }
          50%       { box-shadow: 4px 4px 0 #4a3a00, 0 0 22px #fbbf24bb; }
        }
        @keyframes comet-arrive {
          0%   { opacity: 0; transform: scale(0.4); }
          40%  { opacity: 1; transform: scale(1.6); }
          70%  { opacity: 0.9; transform: scale(0.9); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        .daeun-card {
          transition: transform 0.13s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.13s, background 0.1s, border-color 0.1s;
          cursor: pointer;
        }
        .daeun-card:hover  { transform: translateY(-4px); }
        .daeun-card:active { transform: translateY(1px) scale(0.95) !important; transition: transform 0.05s !important; }
        .daeun-selected    { transform: translateY(-4px); animation: daeun-pulse 1.8s ease-in-out infinite; }
        .daeun-selected:hover { transform: translateY(-6px); }
      `}</style>
      {/* ── 입력 요약 바 ── */}
      <div
        className="px-4 py-2 text-xs font-bold flex flex-wrap gap-x-4 gap-y-1"
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

      <div className="px-4 pb-4 space-y-5">
        {/* ── 4주 카드 (왼쪽: 시주 → 오른쪽: 년주) ── */}
        <div className={`grid gap-2 ${selectedDaeun ? "grid-cols-5" : "grid-cols-4"}`}>
          {DISPLAY_ORDER.map((key, i) => {
            const pillar = pillars[key];
            const meta = PILLAR_META[key];

            if (!pillar) {
              return (
                <div
                  key={key}
                  ref={(el) => { pillarRefs.current[i] = el; }}
                  className="flex flex-col items-center justify-center min-h-[200px] p-2"
                  style={{
                    background: "var(--px-bg2)",
                    border: "2px solid var(--px-border)",
                    boxShadow: "3px 3px 0 #000",
                  }}
                >
                  <p className="text-xs font-bold text-center" style={{ color: "var(--px-text2)" }}>
                    {meta.ko}
                    <br />
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

            return (
              <div
                key={key}
                ref={(el) => { pillarRefs.current[i] = el; }}
                className="flex flex-col items-center p-2 gap-1"
                style={{
                  background: "var(--px-bg2)",
                  border: "2px solid var(--px-border)",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                {/* 주 라벨 */}
                <div className="text-center pb-1 w-full" style={{ borderBottom: "1px solid var(--px-border)" }}>
                  <p className="text-xs font-black" style={{ color: "var(--px-accent)" }}>
                    {meta.ko}
                  </p>
                  <p className="text-xs" style={{ color: "var(--px-text2)", fontSize: "10px" }}>
                    {meta.hanja}
                  </p>
                </div>

                {/* ── 천간(天干) ── */}
                <div className="flex flex-col items-center gap-0.5 py-1.5 w-full"
                  style={{ borderBottom: "1px dashed var(--px-border)" }}>
                  {/* 한자 — 오행 색상 */}
                  <span
                    className="font-black leading-none"
                    style={{
                      color: sc.text,
                      fontSize: "36px",
                      textShadow: `0 0 10px ${sc.text}88`,
                    }}
                  >
                    {pillar.stem.hanja}
                  </span>
                  {/* 한글 */}
                  <span className="text-xs font-bold" style={{ color: sc.text }}>
                    {pillar.stem.ko}
                  </span>
                  {/* 일간 기준 십신 */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 font-bold border"
                      style={{ color: sc.text, borderColor: sc.border, background: sc.bg }}
                    >
                      {stemTenGod}
                    </span>
                  </div>
                </div>

                {/* ── 지지(地支) ── */}
                <div className="flex flex-col items-center gap-0.5 py-1.5 w-full">
                  {/* 한자 — 오행 색상 */}
                  <span
                    className="font-black leading-none"
                    style={{
                      color: bc.text,
                      fontSize: "36px",
                      textShadow: `0 0 10px ${bc.text}88`,
                    }}
                  >
                    {pillar.branch.hanja}
                  </span>
                  {/* 한글 */}
                  <span className="text-xs font-bold" style={{ color: bc.text }}>
                    {pillar.branch.ko}
                  </span>
                  {/* 지지 십신 (정기 기준) */}
                  {branchTenGod && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="text-xs px-1.5 py-0.5 font-bold border"
                        style={{ color: bc.text, borderColor: bc.border, background: bc.bg }}
                      >
                        {branchTenGod}
                      </span>
                    </div>
                  )}
                  {/* 지장간 */}
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {hiddenStemItem?.hiddenStems.map((hiddenStem) => (
                      <HiddenStemChip key={`${key}-${hiddenStem.role}-${hiddenStem.stem}`} hiddenStem={hiddenStem} />
                    ))}
                  </div>
                </div>

                {/* 간지 표기 */}
                <div
                  className="w-full pt-1 text-center"
                  style={{ borderTop: "1px solid var(--px-border)" }}
                >
                  <span className="text-sm font-black">
                    <span style={{ color: sc.text }}>{pillar.stem.hanja}</span>
                    <span style={{ color: bc.text }}>{pillar.branch.hanja}</span>
                  </span>
                  <span className="text-xs ml-1" style={{ color: "var(--px-text2)" }}>
                    {pillar.ganjiKo}
                  </span>
                </div>
              </div>
            );
          })}
          {/* 선택된 대운 카드 (5번째 열) */}
          {selectedDaeun && (
            <SelectedDaeunCard
              cycle={selectedDaeun}
              birthIso={input.normalizedSolarDateTime}
              ageMode={daeunAgeMode}
              dayStem={dayStem}
              onClose={() => setSelectedDaeunOrder(null)}
            />
          )}
        </div>

        {/* ── 대운(大運) ── */}
        <div
          className="p-3 space-y-4"
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

          <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
            ※ 클릭하면 사주 결과 옆에 나란히 표시됩니다.
          </p>

          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
              {daeun.cycles.map((cycle, index) => {
                const isSelected = selectedDaeunOrder === cycle.order;
                const stemEl = STEM_META[cycle.ganji[0]]?.element;
                const branchEl = BRANCH_META[cycle.ganji[1]]?.element;
                const sc = stemEl ? ELEM[stemEl] : ELEM.water;
                const bc = branchEl ? ELEM[branchEl] : ELEM.water;
                let stemTenGod: string = "";
                try {
                  stemTenGod = getTenGod(dayStem, cycle.ganji[0] as StemHanja);
                } catch {
                  stemTenGod = "";
                }
                return (
                  <button
                    key={cycle.order}
                    type="button"
                    onClick={(e) => {
                      const nowSelected = !isSelected;
                      setSelectedDaeunOrder(nowSelected ? cycle.order : null);
                      if (nowSelected) {
                        launchComets(
                          e.currentTarget,
                          cycle.ganji[0], sc.text,
                          cycle.ganji[1], bc.text,
                        );
                      } else {
                        setComets([]);
                      }
                    }}
                    className={`daeun-card flex flex-col items-center gap-1 px-3 py-2 ${isSelected ? "daeun-selected" : ""}`}
                    style={{
                      minWidth: "120px",
                      background: isSelected ? "var(--px-bg2)" : (index % 2 === 0 ? "var(--px-bg2)" : "var(--px-bg3)"),
                      border: isSelected ? "2px solid #fbbf24" : "1px solid var(--px-border)",
                      boxShadow: isSelected ? "3px 3px 0 #4a3a00" : "2px 2px 0 #000",
                    }}
                  >
                    {/* 십신 */}
                    {stemTenGod ? (
                      <span
                        className="text-xs px-1.5 py-0.5 font-bold border"
                        style={{
                          color: sc.text,
                          borderColor: isSelected ? "#fbbf2488" : sc.border,
                          background: isSelected ? "#fbbf2411" : sc.bg,
                        }}
                      >
                        {stemTenGod}
                      </span>
                    ) : (
                      <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                        {cycle.order}운
                      </span>
                    )}
                    <ColoredGanji ganji={cycle.ganji} />
                    <div className="text-[10px] text-center space-y-0.5 w-full">
                      <p style={{ color: "var(--px-text2)" }}>
                        {formatDateWithAge(cycle.estimatedStartDate, input.normalizedSolarDateTime, daeunAgeMode)}
                      </p>
                      <p style={{ color: "var(--px-border2)" }}>
                        ~ {formatDateWithAge(cycle.estimatedEndDate, input.normalizedSolarDateTime, daeunAgeMode)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

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

    {/* ── 혜성 오버레이 포털 ── */}
    {isMounted && comets.length > 0 && createPortal(
      <>
        {comets.map((c) => <CometSprite key={c.id} comet={c} />)}
      </>,
      document.body
    )}
    </>
  );
}

type CometData = {
  id: string;
  char: string;
  color: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  getArrivalPos: () => { x: number; y: number };
  delay: number;
};

function CometSprite({ comet }: { comet: CometData }) {
  // 0=hidden 1=ready 2=fly 3=arrived
  const [phase, setPhase] = useState(0);
  const arrivedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), comet.delay);
    const t2 = setTimeout(() => setPhase(2), comet.delay + 20);
    const t3 = setTimeout(() => setPhase(3), comet.delay + 760);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [comet.delay]);

  // 도착 후 스크롤 추적 - DOM 직접 조작 (리렌더링 없이)
  useEffect(() => {
    if (phase < 3) return;
    const update = () => {
      if (!arrivedRef.current) return;
      const pos = comet.getArrivalPos();
      arrivedRef.current.style.left = `${pos.x - 18}px`;
      arrivedRef.current.style.top  = `${pos.y - 18}px`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [phase, comet]);

  if (phase === 0) return null;

  const dx = comet.ex - comet.sx;
  const dy = comet.ey - comet.sy;
  const motionAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const tailAngle   = motionAngle + 180; // 꼬리는 진행 반대 방향

  // ── 도착 후: 기둥 위/아래에 고정 표시 ──
  if (phase === 3) {
    const initPos = comet.getArrivalPos();
    return (
      <div
        ref={arrivedRef}
        style={{
          position: "fixed",
          left: initPos.x - 18,
          top:  initPos.y - 18,
          zIndex: 1500,
          pointerEvents: "none",
          fontSize: "36px",
          fontWeight: 900,
          color: comet.color,
          lineHeight: "1",
          userSelect: "none",
          textShadow: `0 0 10px ${comet.color}88`,
          animation: "comet-arrive 280ms ease-out",
        }}
      >
        {comet.char}
      </div>
    );
  }

  // ── 비행 중 ──
  const isFlying = phase === 2;
  return (
    <div
      style={{
        position: "fixed",
        left: comet.sx - 18,
        top:  comet.sy - 18,
        zIndex: 10000,
        pointerEvents: "none",
        userSelect: "none",
        willChange: "transform",
        transform: isFlying ? `translate(${dx}px, ${dy}px)` : "translate(0,0)",
        transition: isFlying
          ? "transform 700ms cubic-bezier(0.15, 0.85, 0.35, 1)"
          : "none",
      }}
    >
      {/* 본 글자: 기둥 카드와 동일한 스타일(36px) */}
      <span
        style={{
          display: "block",
          fontSize: "36px",
          fontWeight: 900,
          color: comet.color,
          lineHeight: "1",
          textShadow: `0 0 10px ${comet.color}88`,
        }}
      >
        {comet.char}
      </span>
      {/* 별 꼬리: 비행 방향 반대로 뻗는 그라데이션 선 */}
      {isFlying && (
        <div
          style={{
            position: "absolute",
            left: "18px",
            top: "18px",
            transform: `translateY(-50%) rotate(${tailAngle}deg)`,
            transformOrigin: "0% 50%",
            width: "50px",
            height: "4px",
            background: `linear-gradient(to right, ${comet.color}cc, transparent)`,
            borderRadius: "2px",
            filter: "blur(1.5px)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

type DaeunCycle = {
  order: number;
  ganji: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
};

function SelectedDaeunCard({
  cycle,
  birthIso,
  ageMode,
  dayStem,
  onClose,
}: {
  cycle: DaeunCycle;
  birthIso: string;
  ageMode: AgeMode;
  dayStem: StemHanja;
  onClose: () => void;
}) {
  const stem = cycle.ganji[0];
  const branch = cycle.ganji[1];
  const stemElement = STEM_META[stem]?.element;
  const branchElement = BRANCH_META[branch]?.element;
  const sc = stemElement ? ELEM[stemElement] : ELEM.water;
  const bc = branchElement ? ELEM[branchElement] : ELEM.water;

  let stemTenGod: string = "";
  let branchTenGod: string | null = null;
  let branchHiddenStems: HiddenStemWithTenGod[] = [];
  try {
    stemTenGod = getTenGod(dayStem, stem as StemHanja);
    const rawHS = getHiddenStemsByBranch(branch);
    branchHiddenStems = rawHS.map((hs) => ({
      ...hs,
      tenGod: getTenGod(dayStem, hs.stem),
    }));
    branchTenGod =
      branchHiddenStems.find((s) => s.role === "main")?.tenGod ??
      branchHiddenStems[branchHiddenStems.length - 1]?.tenGod ??
      null;
  } catch {
    /* 계산 불가 시 무시 */
  }

  const ganjiKo = (STEM_META[stem]?.ko ?? "") + (BRANCH_META[branch]?.ko ?? "");

  return (
    <div
      className="flex flex-col items-center p-2 gap-1 relative"
      style={{
        background: "var(--px-bg2)",
        border: "2px solid #fbbf24",
        boxShadow: "4px 4px 0 #4a3a00, 0 0 16px #fbbf2433",
        animation: "daeun-pulse 1.8s ease-in-out infinite",
      }}
    >
      {/* 닫기 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-1 right-1 text-[10px] font-bold px-1 leading-none"
        style={{ color: "var(--px-text2)" }}
        title="닫기"
      >
        ✕
      </button>

      {/* 주 라벨 */}
      <div className="text-center pb-1 w-full" style={{ borderBottom: "1px solid var(--px-border)" }}>
        <p className="text-xs font-black" style={{ color: "#fbbf24" }}>
          {cycle.order}운
        </p>
        <p style={{ color: "var(--px-text2)", fontSize: "10px" }}>大運</p>
      </div>

      {/* ── 천간(天干) ── */}
      <div
        className="flex flex-col items-center gap-0.5 py-1.5 w-full"
        style={{ borderBottom: "1px dashed var(--px-border)" }}
      >
        <span
          className="font-black leading-none"
          style={{ color: sc.text, fontSize: "36px", textShadow: `0 0 10px ${sc.text}88` }}
        >
          {stem}
        </span>
        <span className="text-xs font-bold" style={{ color: sc.text }}>
          {STEM_META[stem]?.ko ?? ""}
        </span>
        {stemTenGod && (
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="text-xs px-1.5 py-0.5 font-bold border"
              style={{ color: sc.text, borderColor: sc.border, background: sc.bg }}
            >
              {stemTenGod}
            </span>
          </div>
        )}
      </div>

      {/* ── 지지(地支) ── */}
      <div className="flex flex-col items-center gap-0.5 py-1.5 w-full">
        <span
          className="font-black leading-none"
          style={{ color: bc.text, fontSize: "36px", textShadow: `0 0 10px ${bc.text}88` }}
        >
          {branch}
        </span>
        <span className="text-xs font-bold" style={{ color: bc.text }}>
          {BRANCH_META[branch]?.ko ?? ""}
        </span>
        {branchTenGod && (
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="text-xs px-1.5 py-0.5 font-bold border"
              style={{ color: bc.text, borderColor: bc.border, background: bc.bg }}
            >
              {branchTenGod}
            </span>
          </div>
        )}
        {branchHiddenStems.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-1">
            {branchHiddenStems.map((hs) => (
              <HiddenStemChip key={`daeun-${hs.role}-${hs.stem}`} hiddenStem={hs} />
            ))}
          </div>
        )}
      </div>

      {/* 간지 표기 + 기간 */}
      <div className="w-full pt-1 text-center" style={{ borderTop: "1px solid #fbbf2455" }}>
        <span className="text-sm font-black">
          <span style={{ color: sc.text }}>{stem}</span>
          <span style={{ color: bc.text }}>{branch}</span>
        </span>
        <span className="text-xs ml-1" style={{ color: "var(--px-text2)" }}>{ganjiKo}</span>
        <div className="text-[10px] mt-0.5 space-y-0.5" style={{ color: "var(--px-text2)" }}>
          <p>{formatDateWithAge(cycle.estimatedStartDate, birthIso, ageMode)}</p>
          <p>~ {formatDateWithAge(cycle.estimatedEndDate, birthIso, ageMode)}</p>
        </div>
      </div>
    </div>
  );
}

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

function HiddenStemChip({ hiddenStem }: { hiddenStem: HiddenStemWithTenGod }) {
  const color = ELEM[hiddenStem.element].text;

  return (
    <span
      className="text-[10px] px-1 py-0.5 font-bold border"
      title={`${hiddenStem.roleKo}: ${hiddenStem.stem}${hiddenStem.stemKo}`}
      style={{
        color,
        borderColor: ELEM[hiddenStem.element].border,
        background: ELEM[hiddenStem.element].bg,
      }}
    >
      {hiddenStem.stemKo} {hiddenStem.stem}
    </span>
  );
}

function ColoredGanji({ ganji }: { ganji: string }) {
  const stem = ganji[0];
  const branch = ganji[1];
  const stemElement = STEM_META[stem]?.element;
  const branchElement = BRANCH_META[branch]?.element;
  const stemColor = stemElement ? ELEM[stemElement].text : "var(--px-accent)";
  const branchColor = branchElement ? ELEM[branchElement].text : "var(--px-accent)";

  return (
    <span className="font-black text-base">
      <span style={{ color: stemColor, textShadow: `0 0 8px ${stemColor}66` }}>{stem}</span>
      <span style={{ color: branchColor, textShadow: `0 0 8px ${branchColor}66` }}>{branch}</span>
    </span>
  );
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
