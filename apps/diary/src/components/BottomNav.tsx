"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "오늘", match: (p: string) => p === "/" },
  { href: "/write", label: "쓰기", match: (p: string) => p.startsWith("/write") },
  { href: "/me", label: "나", match: (p: string) => p.startsWith("/me") },
];

/** 오늘 · 쓰기 · 나. 로그인·프로필 입력 화면에서는 숨긴다. */
export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login") || path.startsWith("/onboarding")) return null;

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-night/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map((t) => {
          const active = t.match(path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[15px] ${
                  active ? "font-bold text-lamp" : "text-muted"
                }`}
              >
                <span aria-hidden className={`h-1 w-1 rounded-full ${active ? "bg-lamp" : "bg-transparent"}`} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
