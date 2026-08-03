/**
 * beforeinstallprompt는 앱 생애주기에서 한 번만 올 수 있어
 * 전역에서 잡아 두고, 홈 시트·설정 버튼이 공유한다.
 */
import { markPwaInstalled } from "@/lib/pwa/installState";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let capturing = false;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function ensureInstallPromptCapture(): void {
  if (typeof window === "undefined" || capturing) return;
  capturing = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    markPwaInstalled();
    notify();
    // 브라우저「홈 화면에 추가」완료 — Chrome/Android·일부 Safari
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureEvent }) => {
        captureEvent(ANALYTICS_EVENTS.installCompleted, {
          surface: "browser_appinstalled",
          source: "appinstalled",
        });
      }
    );
  });
}

export function getDeferredInstallPrompt(): InstallPromptEvent | null {
  return deferred;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptNativeInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  ensureInstallPromptCapture();
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") markPwaInstalled();
  notify();
  return outcome;
}
