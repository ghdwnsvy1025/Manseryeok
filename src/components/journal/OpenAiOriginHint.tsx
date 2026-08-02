"use client";

import {
  formatOpenAiStatus,
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

/** 일반 사용자에게는 AI 출처 문구를 숨김. 관리자만 디버그. */
export default function OpenAiOriginHint({
  status,
  className = "text-[10px] leading-relaxed",
  showAdminDetail = true,
}: Props) {
  const isAdmin = useIsAdmin();
  if (!status) return null;
  if (!(showAdminDetail && isAdmin)) return null;

  return (
    <div className={className} style={{ color: "var(--px-text2)", opacity: 0.9 }}>
      <p className="opacity-80">{formatOpenAiStatus(status)}</p>
    </div>
  );
}
