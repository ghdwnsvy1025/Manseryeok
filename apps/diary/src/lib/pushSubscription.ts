// 브라우저가 준 푸시 구독(PushSubscription.toJSON())을 저장하기 전 검사. 순수 함수 — 서버 액션과 테스트가 같이 쓴다.
// 전에는 endpoint가 문자열인지만 봤다 → 임의 URL을 넣으면 매일 밤 크론이 그 주소로 POST를 보냈다 (전체검토 B-M4, SSRF성).
// 알려진 푸시 서비스 호스트, https, 암호화 키 두 개, 크기 상한만 허용한다.

export interface PushSubscriptionJson {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/** 브라우저별 Web Push 서비스. 새 브라우저가 나오면 여기에 더한다 */
const ALLOWED_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/, // Chrome·Edge(Chromium)·Brave·Opera·삼성 인터넷(최근)
  /^([a-z0-9-]+\.)*push\.apple\.com$/, // Safari (web.push.apple.com 등)
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // 옛 Edge (wns2-*.notify.windows.com)
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^([a-z0-9-]+\.)*push\.samsungosp\.com$/, // 삼성 인터넷(옛 버전)
];

export const MAX_SUBSCRIPTION_BYTES = 2048;

/** 쓸 만한 구독이면 정리된 객체(endpoint·keys만), 아니면 사람이 읽을 사유 */
export function validatePushSubscription(input: unknown): { ok: true; value: PushSubscriptionJson } | { ok: false; reason: string } {
  if (!input || typeof input !== "object") return { ok: false, reason: "구독 정보가 올바르지 않아요." };
  const sub = input as { endpoint?: unknown; keys?: unknown; expirationTime?: unknown };
  if (typeof sub.endpoint !== "string") return { ok: false, reason: "구독 정보가 올바르지 않아요." };
  if (JSON.stringify(input).length > MAX_SUBSCRIPTION_BYTES) return { ok: false, reason: "구독 정보가 너무 커요." };

  let url: URL;
  try {
    url = new URL(sub.endpoint);
  } catch {
    return { ok: false, reason: "구독 주소를 읽지 못했어요." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "구독 주소가 https가 아니에요." };
  if (!ALLOWED_HOSTS.some((re) => re.test(url.hostname))) return { ok: false, reason: "이 브라우저의 알림 서비스는 아직 지원하지 않아요." };

  const keys = sub.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!keys || typeof keys !== "object" || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || !keys.p256dh || !keys.auth) {
    return { ok: false, reason: "구독 정보에 암호 키가 없어요." };
  }
  const value: PushSubscriptionJson = { endpoint: url.toString(), keys: { p256dh: keys.p256dh, auth: keys.auth } };
  if (typeof sub.expirationTime === "number" || sub.expirationTime === null) value.expirationTime = sub.expirationTime;
  return { ok: true, value };
}
