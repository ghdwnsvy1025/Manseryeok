"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";

type NavItem = {
  href: string;
  label: string;
  tab: "journal" | "home" | "stats";
  isActive: (path: string) => boolean;
};

/**
 * 하단 탭: 일기 → 홈 → 기록 (홈이 가운데)
 * 선택된 탭만 강조
 */
export default function AppNav() {
  const pathname = usePathname();
  const diaryHref = isNewDiaryEnabled() ? "/journal" : "/diary";

  const items: NavItem[] = [
    {
      href: diaryHref,
      label: "일기",
      tab: "journal",
      isActive: (path) =>
        path === "/diary" ||
        path.startsWith("/diary/history") ||
        (path.startsWith("/journal") &&
          !path.startsWith("/journal/stats") &&
          !path.startsWith("/journal/categories")),
    },
    {
      href: "/",
      label: "홈",
      tab: "home",
      isActive: (path) => path === "/",
    },
    {
      href: "/stats",
      label: "기록",
      tab: "stats",
      isActive: (path) =>
        path === "/stats" ||
        path.startsWith("/stats/") ||
        path.startsWith("/journal/stats") ||
        path.startsWith("/diary/collection") ||
        path.startsWith("/diary/stats"),
    },
  ];

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
              onClick={() => {
                captureEvent(ANALYTICS_EVENTS.navTabClicked, {
                  tab: item.tab,
                  from_path:
                    pathname === "/"
                      ? "home"
                      : pathname.startsWith("/journal")
                        ? "journal"
                        : pathname.startsWith("/stats")
                          ? "stats"
                          : "other",
                });
              }}
              className="flex-1 flex items-center justify-center py-3.5 border-r last:border-r-0 transition-colors"
              style={{
                borderColor: "var(--px-border)",
                background: active ? "var(--px-bg3)" : "transparent",
                color: active ? "var(--px-accent)" : "var(--px-text2)",
                boxShadow: active ? "inset 0 3px 0 var(--px-accent)" : "none",
              }}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-[16px] font-black leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
