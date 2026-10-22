/**
 * 이용 통계(PostHog) — 순수 함수 모음. 브라우저도 posthog도 없이 테스트한다 (test/analytics.test.ts).
 * 보내는 쪽은 ./index.ts, 화면에 붙이는 건 components/Analytics.tsx·components/track/*. 이벤트 목록과 보는 법은 docs/측정.md.
 *
 * 원칙 (바이럴 analytics.js와 같다, 2026-09-29 합의):
 * - 이름 붙인 이벤트만 보낸다. 자동 수집·히트맵·세션 녹화·서베이는 끈다.
 * - 생년월일·태어난 시각·이름·일기 본문은 절대 보내지 않는다. BLOCK에 걸리는 이름의 값은 보내기 직전에 지운다.
 * - 사용자 ID는 그대로 쓰지 않고 SHA-256 앞 16자로 식별한다 (로그인한 Google 사용자만).
 * - 쿠키 대신 localStorage. localhost에서는 보내지 않고 console.debug만 (주소에 ?ph=1이면 env=dev로 보냄).
 */

/** 이 이름에 걸리는 속성은 지운다 — 실수로 넣어도 안 나가게. "today"도 day에 걸리므로 날짜 종류는 `when`으로 적는다 */
export const BLOCK = /year|month|day|hour|minute|birth|lunar_date|생년|생일|출생/i;

/** 주소 쿼리 중 이 이름은 지운다 — 운영 숫자 화면 `/stats?key=…`의 비밀이 $current_url로 새지 않게 */
const SECRET_PARAM = /^key$/i;

export type Props = Record<string, unknown>;

/** 온보딩 폼이 제출 때 남기고 /welcome이 읽어 onboarding_done을 보내는 sessionStorage 열쇠 (값 "first" | "edit") */
export const ONBOARDING_FLAG = "ph_onboarding";

/** track()에 넘긴 속성 정리: 막힌 이름·undefined 제거 */
export function cleanProps(props?: Props | null): Props {
  const out: Props = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (BLOCK.test(k) || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/** 주소 문자열에서 비밀 쿼리(key=)만 뺀다. 쿼리가 없으면 그대로 */
export function scrubUrl(s: string): string {
  const q = s.indexOf("?");
  if (q < 0) return s;
  const hashAt = s.indexOf("#", q);
  const query = s.slice(q + 1, hashAt < 0 ? undefined : hashAt);
  const rest = hashAt < 0 ? "" : s.slice(hashAt);
  const kept = query.split("&").filter((pair) => pair && !SECRET_PARAM.test(pair.split("=")[0]));
  return s.slice(0, q) + (kept.length ? `?${kept.join("&")}` : "") + rest;
}

/**
 * PostHog `sanitize_properties`용 — 모든 이벤트($pageview·$identify 포함)의 속성을 보내기 직전에 한 번 더 거른다.
 * 막힌 이름은 지우고(중첩된 $set·$set_once 안까지), 문자열 값에 key= 쿼리가 있으면 뺀다.
 */
export function sanitize(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (BLOCK.test(k)) continue;
    if (typeof v === "string") out[k] = v.includes("key=") ? scrubUrl(v) : v;
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = sanitize(v as Props);
    else out[k] = v;
  }
  return out;
}

/** 개발 호스트 — 여기서는 보내지 않는다 */
export function isDevHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
}

/** Supabase user id → SHA-256 hex 앞 16자. crypto.subtle이 없으면(http 비보안 문맥) null — 식별하지 않는다 */
export async function hashUserId(id: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** 한 줄 길이 구간 — 본문 대신 길이만 보낸다 */
export function lengthBucket(n: number): "0" | "1-20" | "21-60" | "61+" {
  if (n <= 0) return "0";
  if (n <= 20) return "1-20";
  if (n <= 60) return "21-60";
  return "61+";
}

/** 이 기기가 마지막으로 본 세션 (id는 해시). localStorage에 남겨 다음 확인 때 "무엇이 바뀌었나"를 안다 */
export interface AuthSnapshot {
  id: string;
  anon: boolean;
}

export interface AuthStep {
  /** posthog.identify(해시) */
  identify?: string;
  /** posthog.reset() — 로그아웃(Google → 없음/익명) 또는 다른 사람으로 바뀜 */
  reset?: boolean;
  /** login_success 이벤트. link = 익명 기록에 Google을 붙임(같은 id), fresh = 새 세션으로 로그인 */
  loginSuccess?: { mode: "link" | "fresh" };
}

/**
 * 이전 스냅샷 → 지금 세션에서 할 일. 익명 세션은 식별하지 않는다 (사람 프로필을 만들지 않는다 — identified_only).
 * prev가 null(이 기기에서 처음 확인)인데 이미 로그인돼 있으면 식별만 하고 login_success는 보내지 않는다 —
 * 추적을 처음 켠 날 기존 사용자가 전부 "로그인 성공"으로 잡히지 않게.
 */
export function authTransition(prev: AuthSnapshot | null, cur: AuthSnapshot | null): AuthStep {
  const out: AuthStep = {};
  const prevLogged = Boolean(prev && !prev.anon);
  const curLogged = Boolean(cur && !cur.anon);
  if (curLogged) {
    if (prevLogged && prev!.id !== cur!.id) out.reset = true;
    out.identify = cur!.id;
    if (prev && (!prevLogged || prev.id !== cur!.id)) out.loginSuccess = { mode: prev.anon && prev.id === cur!.id ? "link" : "fresh" };
  } else if (prevLogged) {
    out.reset = true;
  }
  return out;
}
