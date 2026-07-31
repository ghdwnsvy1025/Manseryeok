"use client";

import { useEffect } from "react";
import {
  ANALYTICS_EVENTS,
  captureEvent,
  identifyUser,
  initPostHog,
  resetAnalyticsUser,
} from "@/lib/analytics/posthog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * PostHog init + auth identify.
 * ClientShell 안에서 한 번만 마운트.
 */
export default function PostHogInit() {
  useEffect(() => {
    initPostHog();
    captureEvent(ANALYTICS_EVENTS.appOpened);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let lastId: string | null = null;

    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user?.id) {
        lastId = user.id;
        identifyUser(user.id, {
          authProvider: String(user.app_metadata?.provider ?? "email"),
        });
      }
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
        user?.id
      ) {
        const isNewSession = user.id !== lastId;
        lastId = user.id;
        identifyUser(user.id, {
          authProvider: String(user.app_metadata?.provider ?? "email"),
        });
        if (event === "SIGNED_IN" && isNewSession) {
          captureEvent(ANALYTICS_EVENTS.signedIn, {
            auth_provider: String(user.app_metadata?.provider ?? "email"),
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
