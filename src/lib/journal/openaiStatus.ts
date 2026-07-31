/**
 * OpenAI 호출 상태
 * - formatOpenAiStatus: 관리자 디버그용 (기술 용어)
 * - formatOpenAiUserHint: 일반 사용자용 짧은 안내
 */

export type OpenAiStatusKind =
  | "used"
  | "skipped"
  | "failed";

export type OpenAiFailureReason =
  | "no_api_key"
  | "request_failed"
  | "timeout"
  | "json_parse"
  | "missing_required"
  | "format_mismatch"
  | "safety_filter"
  | "quality_rejected"
  | "network"
  | "unknown";

export type OpenAiCallStatus = {
  kind: OpenAiStatusKind;
  reason?: OpenAiFailureReason;
  detail?: string;
};

/**
 * @deprecated 동기 게이트는 개발 환경에서도 일반 사용자에게 보일 수 있음.
 * UI에서는 useIsAdmin()을 사용하세요. 항상 false (하위 호환).
 */
export function shouldShowOpenAiStatus(): boolean {
  return false;
}

export function formatOpenAiStatus(status: OpenAiCallStatus): string {
  if (status.kind === "used") return "OpenAI 사용됨";
  if (status.kind === "skipped") {
    return status.detail
      ? `OpenAI 미사용 · ${status.detail}`
      : "OpenAI 미사용";
  }
  const reason = status.reason ? ` · ${status.reason}` : "";
  return `OpenAI 사용 실패 · 기본 알고리즘 적용${reason}`;
}

/** 일반 사용자에게 살짝 남기는 출처 안내 (브랜드·에러 코드 없음) */
export function formatOpenAiUserHint(
  status: OpenAiCallStatus,
  surface: "content" | "scores" = "content"
): string {
  if (surface === "scores") {
    if (status.kind === "used") return "점수 읽기에 AI 보조를 썼어요";
    if (status.kind === "skipped") {
      const d = status.detail ?? "";
      if (d.includes("수정")) return "수정 저장이라 기존 점수 분석을 유지했어요";
      return "점수는 입력값 기준으로 정리했어요";
    }
    return "점수는 입력값 기준으로 정리했어요";
  }

  if (status.kind === "used") return "AI로 오늘에 맞춰 다듬었어요";
  if (status.kind === "skipped") {
    const d = (status.detail ?? "").toLowerCase();
    if (d.includes("cache") || d.includes("cached")) {
      return "오늘 맞춰 둔 문장을 다시 보여 드려요";
    }
    if (d.includes("수정")) {
      return "수정 저장이라 기존 분석을 유지했어요";
    }
    return "기본 문장으로 보여 드려요";
  }
  return "기본 문장으로 보여 드려요";
}
