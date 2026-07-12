const DIARY_VALUE_PROP_KEY = "manseryeok_diary_value_seen";
const DIARY_MODE_SELECTED_KEY = "manseryeok_diary_mode_selected";
const EXPLORE_GUIDE_KEY = "manseryeok_explore_guide_seen";
const SAJU_VIEW_MODE_KEY = "manseryeok_saju_view_mode";
const BOARD_EXPANDED_KEY = "manseryeok_board_expanded";
const SAJU_VIEW_MODE_HINT_KEY = "manseryeok_saju_view_mode_hint_seen";
const BOARD_EXPAND_HINT_KEY = "manseryeok_board_expand_hint_seen";
const STATS_GUIDE_KEY = "manseryeok_stats_guide_seen";
const DAY7_MILESTONE_KEY = "manseryeok_day7_milestone_seen";
const JOURNEY_HINT_KEY = "manseryeok_journey_hint_seen";

export type SajuViewMode = "simple" | "explore";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key) === "1";
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, "1");
}

export function hasSeenDiaryValueProp(): boolean {
  return readFlag(DIARY_VALUE_PROP_KEY);
}

export function markDiaryValuePropSeen(): void {
  writeFlag(DIARY_VALUE_PROP_KEY);
}

export function hasSelectedDiaryMode(): boolean {
  return readFlag(DIARY_MODE_SELECTED_KEY);
}

export function markDiaryModeSelected(): void {
  writeFlag(DIARY_MODE_SELECTED_KEY);
}

export function hasSeenExploreGuide(): boolean {
  return readFlag(EXPLORE_GUIDE_KEY);
}

export function markExploreGuideSeen(): void {
  writeFlag(EXPLORE_GUIDE_KEY);
}

export function loadSajuViewMode(): SajuViewMode {
  if (typeof window === "undefined") return "simple";
  const raw = localStorage.getItem(SAJU_VIEW_MODE_KEY);
  return raw === "explore" ? "explore" : "simple";
}

export function saveSajuViewMode(mode: SajuViewMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAJU_VIEW_MODE_KEY, mode);
}

export function isBoardExpanded(): boolean {
  return readFlag(BOARD_EXPANDED_KEY);
}

export function setBoardExpanded(expanded: boolean): void {
  if (typeof window === "undefined") return;
  if (expanded) {
    localStorage.setItem(BOARD_EXPANDED_KEY, "1");
  } else {
    localStorage.removeItem(BOARD_EXPANDED_KEY);
  }
}

export function hasSeenSajuViewModeHint(): boolean {
  return readFlag(SAJU_VIEW_MODE_HINT_KEY);
}

export function markSajuViewModeHintSeen(): void {
  writeFlag(SAJU_VIEW_MODE_HINT_KEY);
}

export function hasSeenBoardExpandHint(): boolean {
  return readFlag(BOARD_EXPAND_HINT_KEY);
}

export function markBoardExpandHintSeen(): void {
  writeFlag(BOARD_EXPAND_HINT_KEY);
}

export function hasSeenStatsGuide(): boolean {
  return readFlag(STATS_GUIDE_KEY);
}

export function markStatsGuideSeen(): void {
  writeFlag(STATS_GUIDE_KEY);
}

export function hasSeenDay7Milestone(): boolean {
  return readFlag(DAY7_MILESTONE_KEY);
}

export function markDay7MilestoneSeen(): void {
  writeFlag(DAY7_MILESTONE_KEY);
}

export function hasSeenJourneyHint(): boolean {
  return readFlag(JOURNEY_HINT_KEY);
}

export function markJourneyHintSeen(): void {
  writeFlag(JOURNEY_HINT_KEY);
}

/** 패턴 인사이트를 보기 위한 최소 기록 일수 */
export const STATS_INSIGHT_MIN_ENTRIES = 7;
