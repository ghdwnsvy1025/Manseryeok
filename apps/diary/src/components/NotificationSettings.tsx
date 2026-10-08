"use client";

import { useEffect, useState, useTransition } from "react";
import { disablePushAction, enablePushAction, setRemindHourAction } from "@/app/actions";
import { REMIND_HOURS } from "@/lib/remind";

interface Props {
  enabled: boolean;
  remindHour: number;
  kakaoChannelUrl: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Support = "checking" | "ok" | "no-sw" | "no-push" | "ios-not-installed";

/** 저녁 알림 켜기/끄기, 시각 고르기, 카카오 채널 안내 */
export function NotificationSettings({ enabled, remindHour, kakaoChannelUrl }: Props) {
  const [support, setSupport] = useState<Support>("checking");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = window as Window & { PushManager?: unknown; Notification?: unknown };
    const hasSw = "serviceWorker" in navigator;
    const hasPush = typeof w.PushManager !== "undefined" && typeof w.Notification !== "undefined";
    if (!hasSw) return setSupport("no-sw");
    if (!hasPush) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      return setSupport(ios && !standalone ? "ios-not-installed" : "no-push");
    }
    setSupport("ok");
  }, []);

  function enable() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("알림 권한을 허용해야 보내 드릴 수 있어요. 브라우저 설정에서 바꿀 수 있어요.");
          return;
        }
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) {
          setError("서버에 알림 키가 없어요.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource }));
        const r = await enablePushAction(JSON.stringify(sub.toJSON()), remindHour);
        if (!r.ok) setError(r.error ?? "저장하지 못했어요.");
      } catch (e) {
        console.error(e);
        setError("알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();
      } catch {
        // 구독 해제 실패해도 서버 쪽은 끈다
      }
      await disablePushAction();
    });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line/40 pt-4">
      {/* 중첩 제목 없음 — 바깥 줄 제목 "알림"이 이미 있다. 설명 한 줄 + 켜기/끄기 */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[15px] leading-relaxed text-ink">
          {enabled ? `매일 밤 ${remindHour}시, 아직 안 썼을 때만 한 번 보내요` : "기록 안 한 날 밤 9시에 한 번만 알려 드려요"}
        </p>
        {support === "ok" ? (
          enabled ? (
            <button type="button" onClick={disable} disabled={busy} className="h-11 shrink-0 rounded-full border border-line px-4 text-sm text-muted">
              끄기
            </button>
          ) : (
            <button type="button" onClick={enable} disabled={busy} className="h-11 shrink-0 rounded-full border border-frame bg-transparent px-4 text-sm font-bold text-ink disabled:opacity-60">
              {busy ? "켜는 중…" : "켜기"}
            </button>
          )
        ) : null}
      </div>
      {/* 시각 고르기가 아직 없을 때의 안내 (REMIND_HOURS가 하나) */}
      {REMIND_HOURS.length <= 1 && <p className="-mt-2 text-sm text-muted">지금은 밤 9시에만 보내요.</p>}

      {support === "ios-not-installed" && (
        <p className="text-sm text-muted">아이폰은 홈 화면에 앱으로 추가한 뒤에 알림을 켤 수 있어요. 아래 "앱으로 두기"를 먼저 해 주세요.</p>
      )}
      {(support === "no-sw" || support === "no-push") && (
        <p className="text-sm text-muted">이 브라우저는 알림을 지원하지 않아요. Chrome이나 Safari로 열어 주세요.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {enabled && REMIND_HOURS.length > 1 && (
        <form action={setRemindHourAction} className="flex items-center gap-2 text-sm">
          <label htmlFor="remind-hour" className="text-muted">
            알림 시각
          </label>
          <select id="remind-hour" name="hour" defaultValue={remindHour} className="h-11 rounded-lg border border-line bg-paper-3 px-2">
            {REMIND_HOURS.map((h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-lg border border-line px-3 text-muted">
            바꾸기
          </button>
        </form>
      )}

      <div className="border-t border-line pt-3">
        <p className="text-[15px] font-bold">카카오 채널</p>
        <p className="mt-0.5 text-sm text-muted">앱 알림이 어려우면 채널 추가로 소식을 받을 수 있어요.</p>
        <a href={kakaoChannelUrl} target="_blank" rel="noreferrer" className="tap mt-1 text-sm text-muted underline underline-offset-4">
          사주읽는밤 채널 추가
        </a>
      </div>
    </div>
  );
}
