"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ModeSwitcher from "@/components/product/ModeSwitcher";
import {
  loadLocalSajuProfile,
  loadPrimarySajuProfile,
  profileDisplayName,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import {
  loadExperienceModeLocal,
  saveExperienceMode,
} from "@/lib/app/experienceMode";
import {
  DEFAULT_EXPERIENCE_MODE,
  type UserExperienceMode,
} from "@/lib/product/modes";
import type { SajuProfile } from "@/lib/diary/types";

function birthDateLabel(profile: SajuProfile): string {
  return profile.birthDate.replaceAll("-", ".");
}

type MenuPanel = "main" | "modes";

const menuLinkStyle = {
  borderColor: "var(--px-border)",
  color: "var(--px-text2)",
} as const;

export default function ProfileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<MenuPanel>("main");
  const [profile, setProfile] = useState<SajuProfile | null>(null);
  const [mode, setMode] = useState<UserExperienceMode>(DEFAULT_EXPERIENCE_MODE);

  const showBack = pathname !== "/";

  const refresh = useCallback(async () => {
    setProfile(loadLocalSajuProfile());
    setMode(loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE);
    try {
      setProfile(await loadPrimarySajuProfile());
    } catch {
      /* keep local */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const handleChange = () => void refresh();
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === "manseryeok_saju_profile_v2" ||
        event.key === "manseryeok_saju_profiles_v2" ||
        event.key === "manseryeok_experience_mode"
      ) {
        void refresh();
      }
    };
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) {
      setPanel("main");
      return;
    }
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (panel === "modes") setPanel("main");
        else setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, panel]);

  const changeMode = async (next: UserExperienceMode) => {
    setMode(next);
    await saveExperienceMode(next);
  };

  const closeMenu = () => {
    setOpen(false);
    setPanel("main");
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  const name = profile ? profileDisplayName(profile) : null;

  return (
    <header
      className="relative z-[60] shrink-0 flex items-center gap-2 px-2 py-2 border-b-2"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border2)",
        boxShadow: "0 3px 0 #000",
      }}
    >
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
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
            className="absolute left-0 top-[calc(100%+8px)] w-72 p-3 border-2 space-y-3"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-border2)",
              boxShadow: "4px 4px 0 #000",
            }}
            role="menu"
          >
            {panel === "modes" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-black" style={{ color: "var(--px-accent)" }}>
                    모드 관리
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanel("main")}
                    className="text-sm font-bold"
                    style={{ color: "var(--px-text2)" }}
                  >
                    ←
                  </button>
                </div>
                <ModeSwitcher
                  value={mode}
                  onChange={(m) => void changeMode(m)}
                  compact
                />
              </div>
            ) : (
              <div className="grid gap-2.5">
                <Link
                  href="/saju/profiles"
                  onClick={closeMenu}
                  className="ui-primary-btn block w-full px-3 py-3.5 text-center text-base font-black"
                  role="menuitem"
                >
                  프로필 관리
                </Link>
                <button
                  type="button"
                  onClick={() => setPanel("modes")}
                  className="block w-full px-3 py-3 text-center text-sm font-bold border"
                  style={menuLinkStyle}
                  role="menuitem"
                >
                  모드 관리
                </button>
                <Link
                  href="/diary"
                  onClick={closeMenu}
                  className="block px-3 py-3 text-center text-sm font-bold border"
                  style={menuLinkStyle}
                  role="menuitem"
                >
                  기록(구)
                </Link>
                <Link
                  href="/diary/login"
                  onClick={closeMenu}
                  className="block px-3 py-3 text-center text-sm font-bold border"
                  style={menuLinkStyle}
                  role="menuitem"
                >
                  계정 및 설정
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black" style={{ color: "var(--px-accent)" }}>
          {profile ? `${name} · ${birthDateLabel(profile)}` : "사주 프로필 없음"}
        </p>
      </div>

      {!profile && (
        <Link href="/saju" className="text-xs font-bold underline shrink-0" style={{ color: "var(--px-accent)" }}>
          등록
        </Link>
      )}

      {showBack && (
        <button
          type="button"
          onClick={goBack}
          className="w-9 h-9 flex items-center justify-center border-2 text-base font-black shrink-0"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg3)",
            color: "var(--px-accent)",
          }}
          aria-label="뒤로가기"
        >
          ←
        </button>
      )}
    </header>
  );
}
