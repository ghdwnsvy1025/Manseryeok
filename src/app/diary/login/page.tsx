"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { unlockEntry } from "@/lib/auth/entryGate";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";
import { disableGuestMode } from "@/lib/auth/guestMode";
import { syncLocalSajuProfileToAccount } from "@/lib/diary/profileStorage";

/**
 * 예전 계정 설정 경로 — 홈 로그인/온보딩으로 보냄.
 * OAuth 레거시 쿼리도 홈으로 넘긴다.
 */
export default function DiaryLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "success") {
      unlockEntry();
      disableGuestMode();
      void (async () => {
        try {
          await syncLocalSajuProfileToAccount();
          await autoMigrateLocalJournalToAccount();
        } finally {
          window.location.replace("/?oauth=success");
        }
      })();
      return;
    }
    if (params.get("authError")) {
      router.replace(`/?authError=${encodeURIComponent(params.get("authError")!)}`);
      return;
    }
    router.replace("/");
  }, [router]);

  return <p className="ui-hint p-4">이동 중…</p>;
}
