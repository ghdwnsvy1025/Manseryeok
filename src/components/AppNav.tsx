"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isNewDiaryEnabled,
  isPersonalizationEnabled,
  isNewAnalysisEnabled,
} from "@/lib/app/featureFlags";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  main: boolean;
  isActive: (path: string) => boolean;
};

const BASE_NAV: NavItem[] = [
  {
    href: "/",
    label: "예보",
    icon: "預",
    main: false,
    isActive: (path) => path === "/",
  },
  {
    href: "/diary",
    label: "기록",
    icon: "記",
    main: true,
    isActive: (path) => path === "/diary" || path === "/diary/history",
  },
  {
    href: "/diary/stats",
    label: "패턴",
    icon: "見",
    main: false,
    isActive: (path) =>
      path.startsWith("/diary/stats") || path.startsWith("/diary/collection"),
  },
  {
    href: "/saju",
    label: "내 사주",
    icon: "命",
    main: false,
    isActive: (path) => path === "/saju",
  },
];

const JOURNAL_NAV: NavItem = {
  href: "/journal",
  label: "새일기",
  icon: "新",
  main: false,
  isActive: (path) =>
    path.startsWith("/journal") && !path.startsWith("/journal/stats"),
};

/** Phase 4 — 개인화 Ridge MVP 표시 플래그 ON 시 */
const PERSONALIZATION_STATS_NAV: NavItem = {
  href: "/journal/stats",
  label: "개인화",
  icon: "統",
  main: false,
  isActive: (path) => path.startsWith("/journal/stats"),
};

/** Phase 5 — 분석 UI·서술 */
const ANALYSIS_NAV: NavItem = {
  href: "/analysis",
  label: "분석",
  icon: "析",
  main: false,
  isActive: (path) => path.startsWith("/analysis"),
};

export default function AppNav() {
  const pathname = usePathname();
  const journalItems = isNewDiaryEnabled()
    ? [
        BASE_NAV[0],
        ...(isNewAnalysisEnabled() ? [ANALYSIS_NAV] : []),
        JOURNAL_NAV,
        ...(isPersonalizationEnabled() ? [PERSONALIZATION_STATS_NAV] : []),
        BASE_NAV[2],
        BASE_NAV[3],
      ]
    : isNewAnalysisEnabled()
      ? [BASE_NAV[0], ANALYSIS_NAV, ...BASE_NAV.slice(1)]
      : BASE_NAV;
  const items = journalItems;

  return (
    <nav
      className="app-bottom-nav shrink-0 border-t-2 z-50"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg2)",
        boxShadow: "0 -4px 0 #000",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="메인 메뉴"
    >
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 border-r last:border-r-0 transition-colors ${
                item.main ? "py-3 -mt-1" : "py-2.5"
              }`}
              style={{
                borderColor: "var(--px-border)",
                background: active
                  ? "var(--px-bg3)"
                  : item.main
                    ? "var(--px-bg3)"
                    : "transparent",
                color:
                  active || item.main ? "var(--px-accent)" : "var(--px-text2)",
                boxShadow: active
                  ? "inset 0 3px 0 var(--px-accent)"
                  : item.main
                    ? "inset 0 2px 0 var(--px-border2)"
                    : "none",
              }}
              aria-current={active ? "page" : undefined}
            >
              <span
                className="font-black leading-none pixel-font"
                style={{ fontSize: item.main ? "13px" : "11px" }}
                aria-hidden
              >
                {item.icon}
              </span>
              <span
                className={`font-bold leading-tight ${
                  item.main ? "text-[15px]" : "text-[11px]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
