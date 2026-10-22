/**
 * 이용 통계(PostHog) — 브라우저에서만. 쓰는 법: track("diary_save", { length_bucket: "1-20" })
 * 설정값은 바이럴 analytics.js와 같다. 키는 NEXT_PUBLIC_POSTHOG_KEY, 호스트는 NEXT_PUBLIC_POSTHOG_HOST(기본 us).
 * 키가 없거나 localhost면 보내지 않고 console.debug("[track]", …)만 찍는다. 원칙·이벤트 목록은 ./core.ts 머리와 docs/측정.md.
 */
import posthog from "posthog-js";
import { authTransition, cleanProps, hashUserId, isDevHost, sanitize, type AuthSnapshot, type Props } from "./core";

const DEFAULT_HOST = "https://us.i.posthog.com";
const AUTH_KEY = "ph_auth";

let state: "idle" | "on" | "off" = "idle";
let dev = false;
let identifiedAs: string | null = null;
let authQueue: Promise<void> = Promise.resolve();

/** 한 번만. 이후 호출은 결과만 돌려준다 */
export function initAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  if (state !== "idle") return state === "on";
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST;
  dev = isDevHost(window.location.hostname);
  const forced = new URLSearchParams(window.location.search).get("ph") === "1";
  if (!key || (dev && !forced)) {
    state = "off";
    if (dev) console.debug(`[track] 보내지 않음 — ${key ? "localhost (주소에 ?ph=1을 붙이면 env=dev로 보냄)" : "NEXT_PUBLIC_POSTHOG_KEY 없음"}`);
    return false;
  }
  posthog.init(key, {
    api_host: host,
    autocapture: false,
    // 프로젝트 설정으로 켜지는 자동 수집도 코드에서 끈다 (바이럴 2026-09-29 확인: 설정만 믿으면 켜져서 들어옴)
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_surveys: true,
    disable_session_recording: true,
    // App Router는 라우트가 바뀌어도 문서가 다시 열리지 않아 자동 pageview가 첫 화면 한 번뿐이다 → 끄고 components/Analytics.tsx가 경로마다 보낸다
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage",
    person_profiles: "identified_only",
    // 바이럴 공유 링크의 꼬리표(?src=, ?from=)가 첫 유입 속성으로 남는다
    custom_campaign_params: ["src", "from"],
    sanitize_properties: (props) => sanitize(props),
  });
  posthog.register({ app: "diary", env: dev ? "dev" : "prod" });
  state = "on";
  return true;
}

/** 이름 붙인 이벤트. 속성 이름이 BLOCK(생년월일 등)에 걸리면 지우고 보낸다 */
export function track(event: string, props?: Props): void {
  if (state === "idle") initAnalytics();
  const p = cleanProps(props);
  if (state !== "on") {
    if (dev) console.debug("[track]", event, p);
    return;
  }
  posthog.capture(event, p);
}

/** 경로가 바뀔 때마다 (components/Analytics.tsx) */
export function trackPageview(url: string): void {
  track("$pageview", { $current_url: url });
}

export interface AuthUser {
  id: string;
  isAnonymous: boolean;
  /** app_metadata.provider ("google") */
  provider?: string;
}

function readSnapshot(): AuthSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<AuthSnapshot>;
    return typeof v.id === "string" && typeof v.anon === "boolean" ? { id: v.id, anon: v.anon } : null;
  } catch {
    return null;
  }
}

function writeSnapshot(s: AuthSnapshot | null): void {
  try {
    if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* 저장소를 못 쓰면 다음 확인에서 다시 판단한다 */
  }
}

/**
 * 지금 세션을 알려 준다 (세션이 바뀔 때·경로가 바뀔 때). 로그인한(익명 아닌) 사용자는 id 해시로 identify,
 * 로그아웃이면 reset, 익명→Google 연결·새 로그인이면 login_success 한 번. 연달아 불려도 순서대로 처리한다.
 */
export function syncAuth(user: AuthUser | null): Promise<void> {
  authQueue = authQueue.then(() => applyAuth(user)).catch((e) => console.error("[track] auth", e));
  return authQueue;
}

async function applyAuth(user: AuthUser | null): Promise<void> {
  if (state === "idle") initAnalytics();
  const hash = user ? await hashUserId(user.id) : null;
  if (user && !hash) return; // crypto.subtle 없음 — 식별하지 않는다
  const cur: AuthSnapshot | null = user && hash ? { id: hash, anon: user.isAnonymous } : null;
  const step = authTransition(readSnapshot(), cur);
  if (step.reset) {
    identifiedAs = null;
    if (state === "on") posthog.reset();
    else if (dev) console.debug("[track] reset");
  }
  if (step.identify && identifiedAs !== step.identify) {
    identifiedAs = step.identify;
    if (state === "on") posthog.identify(step.identify);
    else if (dev) console.debug("[track] identify", step.identify);
  }
  if (step.loginSuccess) track("login_success", { provider: user?.provider ?? "google", mode: step.loginSuccess.mode });
  writeSnapshot(cur);
}
