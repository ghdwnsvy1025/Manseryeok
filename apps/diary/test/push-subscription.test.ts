import { describe, expect, it } from "vitest";
import { validatePushSubscription, MAX_SUBSCRIPTION_BYTES } from "@/lib/pushSubscription";

const keys = { p256dh: "BNcRd…", auth: "tBHI…" };

describe("validatePushSubscription (B-M4)", () => {
  it("알려진 푸시 서비스의 https 주소 + 키 두 개면 통과하고 endpoint·keys만 남긴다", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://web.push.apple.com/QGxyz",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
    ]) {
      const r = validatePushSubscription({ endpoint, keys, expirationTime: null, extra: "버림" });
      expect(r.ok, endpoint).toBe(true);
      if (r.ok) expect(r.value).toEqual({ endpoint, keys, expirationTime: null });
    }
  });

  it("임의 주소·http·내부망·키 없음·너무 큼은 거른다", () => {
    const bad = [
      { endpoint: "https://evil.example/collect", keys },
      { endpoint: "http://fcm.googleapis.com/fcm/send/abc", keys },
      { endpoint: "https://10.0.0.1/", keys },
      { endpoint: "https://fcm.googleapis.com.evil.example/x", keys },
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc" },
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "", auth: "x" } },
      { endpoint: "https://fcm.googleapis.com/fcm/send/" + "a".repeat(MAX_SUBSCRIPTION_BYTES), keys },
      "https://fcm.googleapis.com/fcm/send/abc",
      null,
    ];
    for (const b of bad) expect(validatePushSubscription(b).ok, JSON.stringify(b)?.slice(0, 60)).toBe(false);
  });
});
