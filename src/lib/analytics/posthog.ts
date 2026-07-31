/**
 * PostHog 클라이언트 헬퍼
 * — 일기 본문·생년월일·이메일 전문은 절대 넣지 않음
 * — 키가 없으면 no-op (로컬/미설정에서도 앱이 깨지지 않음)
 */
import posthog from "posthog-js";

export const ANALYTICS_EVENTS = {
  appOpened: "app_opened",
  authGoogleClicked: "auth_google_clicked",
  authEmailSubmitted: "auth_email_submitted",
  signedIn: "signed_in",
  signedOut: "signed_out",
  profileCreated: "profile_created",
  journalSaved: "journal_saved",
  fortuneOpened: "fortune_opened",
  questionShown: "question_shown",
  quoteShown: "quote_shown",
  feedbackSubmitted: "feedback_submitted",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

let initialized = false;

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
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });
  initialized = true;
}

export function identifyUser(
  userId: string,
  props?: { authProvider?: string | null }
): void {
  if (!initialized && isPostHogConfigured()) initPostHog();
  if (!initialized) return;
  posthog.identify(userId, {
    auth_provider: props?.authProvider ?? undefined,
  });
}

export function resetAnalyticsUser(): void {
  if (!initialized) return;
  posthog.reset();
}

export function captureEvent(
  event: AnalyticsEvent | string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!initialized && isPostHogConfigured()) initPostHog();
  if (!initialized) return;
  const clean: Record<string, string | number | boolean> = {};
  if (properties) {
    for (const [k, v] of Object.entries(properties)) {
      if (v === undefined || v === null) continue;
      // 실수 방지: 긴 문자열·본문성 키 차단
      if (typeof v === "string" && v.length > 120) continue;
      if (/content|body|email|birth|password|diary/i.test(k)) continue;
      clean[k] = v;
    }
  }
  posthog.capture(event, clean);
}
