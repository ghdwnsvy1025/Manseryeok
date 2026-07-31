/**
 * OpenAI 호출 상태 (관리자 디버그용)
 * 일반 사용자 UI에는 노출하지 않음 — useIsAdmin()과 함께 사용.
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
