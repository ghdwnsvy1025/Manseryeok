"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const TABS = [
  { href: "/", label: "오늘", match: (p: string) => p === "/" },
  { href: "/write", label: "쓰기", match: (p: string) => p.startsWith("/write") },
  { href: "/me", label: "나", match: (p: string) => p.startsWith("/me") },
];

/** 오늘 · 쓰기 · 나. 로그인·프로필 입력 화면에서는 숨긴다. */
export function BottomNav() {
  const path = usePathname();
  const router = useRouter();

  // 탭을 옮길 때마다 나머지 두 탭을 미리 받아 둔다 (2026-10-08 진단). 이 nav는 layout에 한 번 마운트돼 머물러서
  // <Link prefetch>는 첫 마운트에 한 번만 받고, 처음 열린 화면(예: /)은 미리 받은 적이 없어 돌아올 때 뼈대가 떴다.
  // router.prefetch는 캐시에 신선한 것이 있으면 다시 받지 않는다 (staleTimes.dynamic 30초).
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    const run = () => {
      for (const t of TABS) if (!t.match(path)) router.prefetch(t.href);
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run);
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 300);
    return () => window.clearTimeout(id);
  }, [path, router]);

  if (path.startsWith("/login") || path.startsWith("/onboarding") || path.startsWith("/welcome")) return null;

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
              {/* prefetch={true}: 동적 라우트의 전체 RSC를 미리 받아 둔다(기본은 loading 경계까지만). staleTimes.dynamic과 짝 */}
              <Link
                href={t.href}
                prefetch={true}
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
