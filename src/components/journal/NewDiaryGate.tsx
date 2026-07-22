"use client";

import Link from "next/link";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";

/** Feature flag OFF면 신규 일기 화면 대신 안내 */
export default function NewDiaryGate({ children }: { children: React.ReactNode }) {
  if (!isNewDiaryEnabled()) {
    return (
      <div
        className="p-4 border-2 space-y-3 max-w-md mx-auto"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          새 일기 기능이 꺼져 있어요
        </p>
        <p className="ui-hint">
          개발 환경에서 <code className="text-[11px]">NEXT_PUBLIC_FF_NEW_DIARY=true</code> 로
          켤 수 있습니다. 기존 기록은{" "}
          <Link href="/diary" className="underline font-bold">
            /diary
          </Link>
          에서 계속 사용할 수 있어요.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
