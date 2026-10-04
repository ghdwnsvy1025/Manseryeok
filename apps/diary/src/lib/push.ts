import "server-only";
import webpush, { type PushSubscription } from "web-push";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:ghdwnsvy1025@naver.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushResult = "sent" | "gone" | "failed" | "unconfigured";

/** 구독이 만료됐으면 "gone"을 돌려주므로 부르는 쪽이 설정을 끈다 */
export async function sendPush(subscription: unknown, payload: object): Promise<PushResult> {
  if (!configure()) return "unconfigured";
  try {
    await webpush.sendNotification(subscription as PushSubscription, JSON.stringify(payload), { TTL: 60 * 60 });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("push 실패", status, e instanceof Error ? e.message : e);
    return "failed";
  }
}
