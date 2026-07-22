"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  main: boolean;
  isActive: (path: string) => boolean;
};

export default function AppNav() {
  const pathname = usePathname();
  const diaryHref = isNewDiaryEnabled() ? "/journal" : "/diary";

  const items: NavItem[] = [
    {
      href: diaryHref,
      label: "일기",
      icon: "記",
      main: false,
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
      icon: "家",
      main: true,
      isActive: (path) => path === "/",
    },
    {
      href: "/analysis",
      label: "분석",
      icon: "析",
      main: false,
      isActive: (path) => path.startsWith("/analysis"),
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
