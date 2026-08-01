"use client";

import SoftInstallHint from "@/components/home/SoftInstallHint";

type Props = {
  /** 기록이 1개 이상일 때만 부모가 마운트 — 실제 표시는 2일 이상 */
  hasEntries: boolean;
  uniqueDays: number;
};

/**
 * 홈 — 미설치 사용자에게 앱 추가를 부드럽게 권유 (2일 이상 기록 후).
 */
export default function InstallAppNudge({ hasEntries, uniqueDays }: Props) {
  if (!hasEntries) return null;
  return <SoftInstallHint surface="home_nudge" uniqueDays={uniqueDays} />;
}
