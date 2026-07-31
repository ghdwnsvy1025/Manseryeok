"use client";

import {
  formatOpenAiStatus,
  formatOpenAiUserHint,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Props = {
  status: OpenAiCallStatus | null | undefined;
  className?: string;
  surface?: "content" | "scores";
  /** 관리자일 때 기술 상태도 한 줄 더 */
  showAdminDetail?: boolean;
};

/** 모든 사용자에게 AI 출처를 살짝 안내. 관리자는 디버그 줄 추가. */
export default function OpenAiOriginHint({
  status,
  className = "text-[10px] leading-relaxed",
  surface = "content",
  showAdminDetail = true,
}: Props) {
  const isAdmin = useIsAdmin();
  if (!status) return null;

  return (
    <div className={className} style={{ color: "var(--px-text2)", opacity: 0.9 }}>
      <p>{formatOpenAiUserHint(status, surface)}</p>
      {showAdminDetail && isAdmin && (
        <p className="mt-0.5 opacity-80">{formatOpenAiStatus(status)}</p>
      )}
    </div>
  );
}
