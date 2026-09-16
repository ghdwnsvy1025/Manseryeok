/**
 * 앱의 기록(JournalEntry) → 가설 검증용 기록(DayRecord)
 *
 * 이 파일이 없으면 가설 카드는 영원히 "검증 중"에 머문다.
 * 엔진과 앱을 잇는 유일한 연결 고리다.
 *
 * 척도 주의
 * - 핵심 4·조건부 영역은 **서열 1~5**를 쓴다. `entry.scores`의 1~10 환산값이 아니다.
 *   `evaluate.ts`의 임계값(ordinal5 = 0.4)이 서열 기준이라, 1~10을 넣으면 판정이 무너진다.
 * - 행복도만 0~10이다.
 * - 레거시 기록(체크인 v1)은 서열 원본이 없으므로 1~10을 서열로 역변환해 채운다.
 */
import { journalScoreToOrdinal } from "@/lib/journal/checkin/catalog";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { METRICS, type DayRecord, type MetricCode } from "./types";

/**
 * 지표 코드는 journal 의 CategoryCode 와 이름이 같다(happiness 제외).
 * 이름이 어긋나면 조용히 빈 기록이 되므로 여기서 한 번 걸러낸다.
 */
function toMetricCode(categoryCode: string): MetricCode | null {
  return categoryCode in METRICS && categoryCode !== "happiness"
    ? (categoryCode as MetricCode)
    : null;
}

function validOrdinal(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 1 || value > 5) return null;
  return value;
}

function validHappiness(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0 || value > 10) return null;
  return value;
}

/** 기록 한 건 → 지표 묶음 */
export function toDayRecord(entry: JournalEntry): DayRecord {
  const metrics: Partial<Record<MetricCode, number>> = {};

  // ── 행복도 (0~10) ──
  const happiness =
    validHappiness(entry.happinessScore) ??
    // 레거시: overallSatisfaction 은 1~10
    validHappiness(typeof entry.overallSatisfaction === "number" ? entry.overallSatisfaction : null);
  if (happiness != null) metrics.happiness = happiness;

  // ── 핵심 4 (서열 1~5) ──
  if (entry.coreStates) {
    for (const [code, payload] of Object.entries(entry.coreStates)) {
      if (payload?.isNotApplicable) continue;
      const metric = toMetricCode(code);
      const ordinal = validOrdinal(payload?.ordinal);
      if (metric && ordinal != null) metrics[metric] = ordinal;
    }
  }

  // ── 조건부 영역 (서열 1~5) ──
  if (entry.domainScores) {
    for (const domain of entry.domainScores) {
      if (domain?.isNotApplicable) continue;
      const metric = toMetricCode(domain.code);
      const ordinal = validOrdinal(domain.ordinal);
      if (metric && ordinal != null) metrics[metric] = ordinal;
    }
  }

  // ── 레거시 보완 ──
  // 체크인 v1 기록에는 서열 원본이 없다. 1~10 점수를 서열로 되돌려 채운다.
  // 이미 서열이 있는 지표는 건드리지 않는다.
  for (const score of entry.scores ?? []) {
    if (score.isNotApplicable) continue;
    const metric = toMetricCode(score.categoryCode as CategoryCode);
    if (!metric || metrics[metric] != null) continue;

    const raw = score.userScore ?? score.rawScore ?? score.finalScore;
    if (raw == null) continue;

    const ordinal = journalScoreToOrdinal(raw);
    if (ordinal != null) metrics[metric] = ordinal;
  }

  return { date: entry.entryDate, metrics };
}

/**
 * 기록 목록 → DayRecord 목록.
 * 같은 날짜가 여러 건이면 나중 것(updatedAt 기준)만 남긴다.
 */
export function toDayRecords(entries: JournalEntry[]): DayRecord[] {
  const byDate = new Map<string, JournalEntry>();

  for (const entry of entries) {
    if (!entry?.entryDate) continue;
    const prev = byDate.get(entry.entryDate);
    if (!prev || (entry.updatedAt ?? "") >= (prev.updatedAt ?? "")) {
      byDate.set(entry.entryDate, entry);
    }
  }

  return Array.from(byDate.values())
    .map(toDayRecord)
    .filter((record) => Object.keys(record.metrics).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
