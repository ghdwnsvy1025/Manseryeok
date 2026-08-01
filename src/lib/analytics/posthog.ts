/**
 * PostHog 클라이언트 헬퍼 (지인 베타 P0)
 * — 일기 본문·생년월일·이메일·질문/운세 문장·raw error 금지
 * — 키가 없으면 no-op
 */
import posthog from "posthog-js";
import {
  buildCommonAnalyticsProps,
  detectInAppBrowser,
  getAppVersion,
  getBetaCohort,
  getOrCreateGuestAnalyticsId,
  type AuthProviderAnalytics,
} from "@/lib/analytics/context";
import { networkState } from "@/lib/analytics/buckets";
import { isStandaloneDisplay } from "@/lib/pwa/installState";

export const ANALYTICS_EVENTS = {
  appOpened: "app_opened",
  authGuestClicked: "auth_guest_clicked",
  authGoogleClicked: "auth_google_clicked",
  authEmailSubmitted: "auth_email_submitted",
  signedIn: "signed_in",
  signedOut: "signed_out",
  profileStarted: "profile_started",
  profileCreated: "profile_created",
  journalStarted: "journal_started",
  journalSaved: "journal_saved",
  fortuneOpened: "fortune_opened",
  fortuneCollapsed: "fortune_collapsed",
  questionShown: "question_shown",
  questionTeaseClicked: "question_tease_clicked",
  quoteShown: "quote_shown",
  feedbackSubmitted: "feedback_submitted",
  feedbackOpened: "feedback_opened",
  flowError: "flow_error",
  /** 기능 인기 / 탐색 */
  navTabClicked: "nav_tab_clicked",
  statsOpened: "stats_opened",
  pastEntryOpened: "past_entry_opened",
  sajuOpened: "saju_opened",
  natalReadingOpened: "natal_reading_opened",
  diarySheetOpened: "diary_sheet_opened",
  checkinStep: "checkin_step",
  homeTodayEntryClicked: "home_today_entry_clicked",
  homeStatsTrendClicked: "home_stats_trend_clicked",
  eventTagsExpanded: "event_tags_expanded",
  contentFeedbackClicked: "content_feedback_clicked",
  statsPeriodSelected: "stats_period_selected",
  statsCategoriesMenuClicked: "stats_categories_menu_clicked",
  statsMonthChanged: "stats_month_changed",
  calendarDaySelected: "calendar_day_selected",
  entryListSelected: "entry_list_selected",
  entryListEditClicked: "entry_list_edit_clicked",
  patternTabSelected: "pattern_tab_selected",
  ganjiCollectionOpened: "ganji_collection_opened",
  menuOpened: "menu_opened",
  menuItemClicked: "menu_item_clicked",
  profileEditClicked: "profile_edit_clicked",
  profileAddClicked: "profile_add_clicked",
  profileOpenManseryeokClicked: "profile_open_manseryeok_clicked",
  sajuModeSelected: "saju_mode_selected",
  sajuResearchHintClicked: "saju_research_hint_clicked",
  sajuDaewoonClicked: "saju_daewoon_clicked",
  sajuSewoonClicked: "saju_sewoon_clicked",
  installPromptShown: "install_prompt_shown",
  installClicked: "install_clicked",
  installAccepted: "install_accepted",
  installDismissed: "install_dismissed",
  installCompleted: "install_completed",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type FlowErrorStep =
  | "auth_guest"
  | "auth_google"
  | "profile_create"
  | "fortune_load"
  | "question_load"
  | "journal_save"
  | "quote_load"
  | "install";

const ALLOWED_ERROR_CODES = new Set([
  "AUTH_REQUIRED",
  "OAUTH_FAILED",
  "NETWORK",
  "REQUEST_FAILED",
  "TIMEOUT",
  "VALIDATION",
  "UNKNOWN",
  "RATE_LIMITED",
  "EMPTY_RESPONSE",
  "PARSE_ERROR",
]);

const PROPERTY_DENYLIST = [
  "email",
  "password",
  "name",
  "birth_date",
  "birth_time",
  "journal_body",
  "journal_text",
  "feedback_text",
  "question_text",
  "fortune_text",
  "quote_text",
  "raw_error_message",
  "error_stack",
  "content",
  "body",
  "diary",
];

let initialized = false;
const APP_OPENED_SESSION_KEY = "manseryeok:ph_app_opened_session";
const JOURNAL_STARTED_KEY_PREFIX = "manseryeok:ph_journal_started:";

export function isPostHogConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  );
}

function projectKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
    null
  );
}

function scrubProperties(
  properties?: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  if (!properties) return clean;
  for (const [k, v] of Object.entries(properties)) {
    if (v === undefined || v === null) continue;
    if (PROPERTY_DENYLIST.some((d) => k.toLowerCase().includes(d))) continue;
    if (/content|body|email|birth|password|diary|stack|message/i.test(k)) {
      continue;
    }
    if (typeof v === "string" && v.length > 120) continue;
    clean[k] = v;
  }
  return clean;
}

export function registerAnalyticsContext(overrides?: {
  authProvider?: AuthProviderAnalytics;
}): void {
  if (!initialized) return;
  const common = buildCommonAnalyticsProps(overrides);
  posthog.register(common);
  posthog.register_once({
    beta_cohort: getBetaCohort(),
    first_in_app_browser: detectInAppBrowser(),
  });
}

export function initPostHog(): void {
  if (typeof window === "undefined" || initialized) return;
  const key = projectKey();
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    mask_all_text: false,
    mask_all_element_attributes: false,
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });
  initialized = true;
  registerAnalyticsContext();
}

export function identifyUser(
  userId: string,
  props?: {
    authProvider?: AuthProviderAnalytics | string | null;
    setOnce?: Record<string, string | boolean | number>;
    set?: Record<string, string | boolean | number>;
  }
): void {
  if (!initialized && isPostHogConfigured()) initPostHog();
  if (!initialized) return;

  const providerRaw = props?.authProvider;
  const provider: AuthProviderAnalytics =
    providerRaw === "guest" || providerRaw === "google"
      ? providerRaw
      : providerRaw === "anonymous"
        ? "guest"
        : typeof providerRaw === "string" && /google/i.test(providerRaw)
          ? "google"
          : "unknown";

  registerAnalyticsContext({
    authProvider: provider === "unknown" ? undefined : provider,
  });

  const setOnce: Record<string, string | boolean | number> = {
    beta_cohort: getBetaCohort(),
    first_in_app_browser: detectInAppBrowser(),
    ...(props?.setOnce ?? {}),
  };
  if (provider === "guest") {
    setOnce.started_as_guest = true;
  }

  posthog.identify(userId, {
    auth_provider: provider,
    is_pwa_standalone: isStandaloneDisplay(),
    app_version_last_seen: getAppVersion(),
    ...(props?.set ?? {}),
  });
  try {
    posthog.setPersonProperties({}, setOnce);
  } catch {
    /* older SDK */
  }
}

export function identifyGuestUser(): string {
  const id = getOrCreateGuestAnalyticsId();
  identifyUser(id, {
    authProvider: "guest",
    setOnce: { started_as_guest: true },
  });
  return id;
}

export function resetAnalyticsUser(): void {
  if (!initialized) return;
  posthog.reset();
  registerAnalyticsContext();
}

export function captureEvent(
  event: AnalyticsEvent | string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!initialized && isPostHogConfigured()) initPostHog();
  if (!initialized) return;
  posthog.capture(event, scrubProperties(properties));
}

/**
 * 같은 세션에서 두 번째부터 is_repeat=true.
 * Unique users 퍼널은 그대로, Total count로 재클릭(re)을 볼 수 있음.
 */
export function captureUiClick(
  event: AnalyticsEvent | string,
  repeatKey: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  let is_repeat = false;
  if (typeof window !== "undefined") {
    try {
      const key = `manseryeok:ph_ui:${repeatKey}`;
      is_repeat = window.sessionStorage.getItem(key) === "1";
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }
  captureEvent(event, { ...properties, is_repeat });
}

export function captureAppOpenedOnce(props?: {
  landingSurface?: string;
  hasAuthSession?: boolean;
}): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(APP_OPENED_SESSION_KEY) === "1") return;
    window.sessionStorage.setItem(APP_OPENED_SESSION_KEY, "1");
  } catch {
    /* still fire once this call */
  }
  captureEvent(ANALYTICS_EVENTS.appOpened, {
    landing_surface: props?.landingSurface ?? "home",
    has_auth_session: props?.hasAuthSession ?? false,
  });
}

export function captureFlowError(opts: {
  step: FlowErrorStep;
  errorCode?: string;
  recoverable?: boolean;
}): void {
  const code = (opts.errorCode ?? "UNKNOWN").toUpperCase();
  const error_code = ALLOWED_ERROR_CODES.has(code) ? code : "UNKNOWN";
  captureEvent(ANALYTICS_EVENTS.flowError, {
    step: opts.step,
    error_code,
    recoverable: opts.recoverable ?? true,
    network_state: networkState(),
  });
}

/** 초안당 1회 journal_started — 세션+날짜 키 */
export function captureJournalStartedOnce(opts: {
  entryDate: string;
  entryType: "journal" | "checkin";
  source: "question" | "home" | "fortune";
  questionId?: string | null;
  startAction: "text_focus" | "checkin_select";
}): boolean {
  if (typeof window === "undefined") return false;
  const key = `${JOURNAL_STARTED_KEY_PREFIX}${opts.entryDate}:${opts.entryType}`;
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* fire anyway */
  }
  try {
    window.sessionStorage.setItem(
      `${key}:at`,
      String(Date.now())
    );
  } catch {
    /* ignore */
  }
  captureEvent(ANALYTICS_EVENTS.journalStarted, {
    entry_type: opts.entryType,
    source: opts.source,
    question_id: opts.questionId ?? undefined,
    start_action: opts.startAction,
  });
  return true;
}

export function peekJournalStartedAt(entryDate: string, entryType: "journal" | "checkin"): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      `${JOURNAL_STARTED_KEY_PREFIX}${entryDate}:${entryType}:at`
    );
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markPersonActivated(): void {
  if (!initialized) return;
  try {
    posthog.setPersonProperties({ activated: true });
  } catch {
    /* ignore */
  }
}

export function markPersonProfileCreated(): void {
  if (!initialized) return;
  try {
    posthog.setPersonProperties({ profile_created: true });
  } catch {
    /* ignore */
  }
}
