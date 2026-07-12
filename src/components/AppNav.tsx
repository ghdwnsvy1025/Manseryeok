"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/diary", label: "일기", icon: "記", isActive: (path: string) => path === "/diary" || path.startsWith("/diary/") },
  { href: "/saju", label: "내 사주", icon: "命", isActive: (path: string) => path.startsWith("/saju") },
  { href: "/admin", label: "학습", icon: "學", isActive: (path: string) => path.startsWith("/admin") },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-t-2"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
      aria-label="메인 메뉴"
    >
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 sm:py-2.5 border-r last:border-r-0 transition-colors"
              style={{
                borderColor: "var(--px-border)",
                background: active ? "var(--px-bg2)" : "transparent",
                color: active ? "var(--px-accent)" : "var(--px-text2)",
                boxShadow: active ? "inset 0 -3px 0 var(--px-accent)" : "none",
              }}
            >
              <span
                className="text-sm font-black leading-none pixel-font"
                style={{ fontSize: "11px" }}
              >
                {item.icon}
              </span>
              <span className="text-xs font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
