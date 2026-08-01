"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_EVENTS,
  captureAppOpenedOnce,
  captureEvent,
  identifyUser,
  initPostHog,
  registerAnalyticsContext,
  resetAnalyticsUser,
} from "@/lib/analytics/posthog";
import { resolveLandingSurface } from "@/lib/analytics/context";
import { isGuestMode } from "@/lib/auth/guestMode";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isAnonymousUser } from "@/lib/auth/anonymousSession";

/**
 * PostHog init + auth identify.
 * ClientShell 안에서 한 번만 마운트.
 */
export default function PostHogInit() {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();

    const supabase = getSupabaseBrowserClient();
    let hasSession = false;

    const finishOpen = (sessionPresent: boolean) => {
      if (isGuestMode()) {
        registerAnalyticsContext({ authProvider: "guest" });
      }
      captureAppOpenedOnce({
        landingSurface: resolveLandingSurface(pathname),
        hasAuthSession: sessionPresent || isGuestMode(),
      });
    };

    if (!supabase) {
      finishOpen(false);
      return;
    }

    let lastId: string | null = null;

    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      hasSession = Boolean(user?.id);
      if (user?.id && !isAnonymousUser(user)) {
        lastId = user.id;
        identifyUser(user.id, {
          authProvider: "google",
        });
      } else if (isGuestMode()) {
        registerAnalyticsContext({ authProvider: "guest" });
      }
      finishOpen(hasSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      if (event === "SIGNED_OUT") {
        if (lastId) captureEvent(ANALYTICS_EVENTS.signedOut);
        lastId = null;
        resetAnalyticsUser();
        return;
      }
      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        user?.id &&
        !isAnonymousUser(user)
      ) {
        const isNewSession = user.id !== lastId;
        lastId = user.id;
        identifyUser(user.id, {
          authProvider: "google",
        });
        if (event === "SIGNED_IN" && isNewSession) {
          captureEvent(ANALYTICS_EVENTS.signedIn, {
            auth_provider: "google",
            auth_transition: "google_login",
          });
        }
      }
    });

    return () => subscription.unsubscribe();
    // pathname은 최초 진입 표면만 쓰므로 deps에 넣지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
