"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import HeaderProgressBadge from "@/components/HeaderProgressBadge";
import { openBetaFeedback } from "@/components/feedback/BetaFeedbackHost";
import {
  loadJournalSajuProfile,
  profileDisplayName,
  PROFILES_LIST_EVENT,
  reconcileLocalStateWithAuthUser,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import type { SajuProfile } from "@/lib/diary/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { lockEntry, ENTRY_CHANGED_EVENT } from "@/lib/auth/entryGate";
import { disableGuestMode, isGuestMode } from "@/lib/auth/guestMode";
import { resetDiaryStorageCache } from "@/lib/diary/getStorage";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";
import { isAnonymousUser } from "@/lib/auth/anonymousSession";

function birthDateLabel(profile: SajuProfile): string {
  return profile.birthDate.replaceAll("-", ".");
}

const menuLinkStyle = {
  borderColor: "var(--px-border)",
  color: "var(--px-text2)",
} as const;

export default function ProfileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<SajuProfile | null>(null);
  const [authKind, setAuthKind] = useState<"guest" | "account" | "loading">(
    "loading"
  );

  const refreshAuthKind = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isGuestMode()) {
      setAuthKind("guest");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthKind("guest");
      return;
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        const user = data.session?.user;
        if (user && !isAnonymousUser(user)) setAuthKind("account");
        else setAuthKind(isGuestMode() ? "guest" : "guest");
      })
      .catch(() => setAuthKind(isGuestMode() ? "guest" : "guest"));
  }, []);

  const refresh = useCallback(async () => {
    try {
      setProfile(await loadJournalSajuProfile());
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    refreshAuthKind();
  }, [pathname, refresh, refreshAuthKind]);

  useEffect(() => {
    const handleChange = () => {
      void refresh();
      refreshAuthKind();
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === "manseryeok_saju_profile_v2" ||
        event.key === "manseryeok_saju_profiles_v2" ||
        event.key === "manseryeok_guest_mode"
      ) {
        void refresh();
        refreshAuthKind();
      }
    };
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, handleChange);
    window.addEventListener(PROFILES_LIST_EVENT, handleChange);
    window.addEventListener(ENTRY_CHANGED_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);

    const supabase = getSupabaseBrowserClient();
    const sub = supabase?.auth.onAuthStateChange(() => {
      refreshAuthKind();
    });

    return () => {
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, handleChange);
      window.removeEventListener(PROFILES_LIST_EVENT, handleChange);
      window.removeEventListener(ENTRY_CHANGED_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
      sub?.data.subscription.unsubscribe();
    };
  }, [refresh, refreshAuthKind]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);
  const name = profile ? profileDisplayName(profile) : null;

  return (
    <header
      className="relative z-[60] shrink-0 flex items-center gap-2 px-2.5 py-2.5 border-2 mx-0"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-accent)",
        boxShadow: "0 4px 0 #4a3a00",
      }}
    >
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) {
              void import("@/lib/analytics/posthog").then(
                ({ ANALYTICS_EVENTS, captureUiClick }) => {
                  captureUiClick(ANALYTICS_EVENTS.menuOpened, "menu_open");
                }
              );
            }
          }}
          className="w-9 h-9 flex items-center justify-center border-2 text-base font-black"
          style={{
            borderColor: open ? "var(--px-accent)" : "var(--px-border)",
            background: "var(--px-bg3)",
            color: "var(--px-accent)",
          }}
          aria-label="메뉴"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          ☰
        </button>

        {open && (
          <div
            className="absolute left-0 top-[calc(100%+8px)] w-64 p-3 border-2 space-y-2 overflow-y-auto overscroll-contain"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-border2)",
              boxShadow: "4px 4px 0 #000",
              maxHeight: "min(70vh, calc(100dvh - 5.5rem))",
              zIndex: 60,
            }}
            role="menu"
          >
            <button
              type="button"
              onClick={() => {
                closeMenu();
                window.dispatchEvent(new Event(PROFILES_LIST_EVENT));
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureUiClick }) => {
                    captureUiClick(ANALYTICS_EVENTS.menuItemClicked, "menu_item_profiles", {
                      item: "profiles",
                    });
                  }
                );
                if (pathname !== "/saju/profiles") {
                  router.push("/saju/profiles");
                }
              }}
              className="ui-primary-btn block w-full px-3 py-3 text-center text-sm font-black"
              role="menuitem"
            >
              프로필 관리
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu();
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureEvent, captureUiClick }) => {
                    captureEvent(ANALYTICS_EVENTS.sajuOpened, {
                      surface: "header_menu",
                    });
                    captureUiClick(ANALYTICS_EVENTS.menuItemClicked, "menu_item_saju", {
                      item: "saju",
                    });
                  }
                );
                const meId = profile?.id;
                router.push(
                  meId
                    ? `/saju?profile=${encodeURIComponent(meId)}`
                    : "/saju"
                );
              }}
              className="block w-full px-3 py-2.5 text-center text-sm font-bold border"
              style={menuLinkStyle}
              role="menuitem"
            >
              내 사주
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu();
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureUiClick }) => {
                    captureUiClick(ANALYTICS_EVENTS.menuItemClicked, "menu_item_feedback", {
                      item: "feedback",
                    });
                  }
                );
                openBetaFeedback();
              }}
              className="ui-primary-btn block w-full px-3 py-3 text-center text-sm font-black"
              role="menuitem"
            >
              의견 보내기
            </button>
            <p
              className="text-[10px] font-bold px-1 -mt-1"
              style={{ color: "var(--px-text2)" }}
            >
              버그·어색한 문장·아이디어
            </p>
            <div
              className="h-px w-full"
              style={{ background: "var(--px-border)" }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => {
                closeMenu();
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureUiClick }) => {
                    captureUiClick(ANALYTICS_EVENTS.menuItemClicked, "menu_item_logout", {
                      item: "logout",
                    });
                  }
                );
                void (async () => {
                  const supabase = getSupabaseBrowserClient();
                  if (supabase) {
                    try {
                      await supabase.auth.signOut();
                    } catch {
                      /* ignore */
                    }
                  }
                  // 로컬 프로필·일기는 유지 — 비로그인 재진입 시 그대로 사용
                  disableGuestMode();
                  lockEntry();
                  reconcileLocalStateWithAuthUser(null);
                  resetDiaryStorageCache();
                  resetJournalStorageCache();
                  window.location.href = "/";
                })();
              }}
              className="block w-full px-3 py-2.5 text-center text-sm font-black border"
              style={{
                borderColor: "var(--px-border)",
                color: "var(--px-text-on-panel)",
                background: "var(--px-bg2)",
              }}
              role="menuitem"
            >
              {authKind === "guest" ? "처음으로" : "로그아웃"}
            </button>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p
            className="truncate text-sm font-black"
            style={{ color: "var(--px-accent)" }}
          >
            {profile ? `${name}` : "사주 프로필 없음"}
          </p>
          {authKind !== "loading" && (
            <span
              className="shrink-0 text-[10px] font-black px-1.5 py-0.5 border leading-none"
              style={
                authKind === "account"
                  ? {
                      borderColor: "var(--px-accent)",
                      color: "#111",
                      background: "var(--px-accent)",
                    }
                  : {
                      borderColor: "var(--px-border2)",
                      color: "var(--px-text2)",
                      background: "var(--px-bg3)",
                    }
              }
              title={
                authKind === "account"
                  ? "Google 계정으로 로그인됨"
                  : "비로그인 · 이 기기에만 저장"
              }
            >
              {authKind === "account" ? "계정" : "비로그인"}
            </span>
          )}
        </div>
        {profile && (
          <p
            className="text-[11px] font-bold truncate mt-0.5"
            style={{ color: "var(--px-text2)" }}
          >
            {birthDateLabel(profile)}
            {authKind === "guest" ? " · 이 기기만" : ""}
          </p>
        )}
      </div>

      <HeaderProgressBadge />

      {!profile && (
        <Link
          href="/saju"
          className="text-xs font-bold underline shrink-0"
          style={{ color: "var(--px-accent)" }}
        >
          등록
        </Link>
      )}
    </header>
  );
}
