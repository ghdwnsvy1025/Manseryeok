/**
 * OpenAI 호출 상태 (개발/테스트 표시용)
 * 8A: development 또는 NEXT_PUBLIC_SHOW_OPENAI_STATUS=true 일 때만 UI 노출
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
  | "network"
  | "unknown";

export type OpenAiCallStatus = {
  kind: OpenAiStatusKind;
  reason?: OpenAiFailureReason;
  detail?: string;
};

export function shouldShowOpenAiStatus(): boolean {
  if (process.env.NEXT_PUBLIC_SHOW_OPENAI_STATUS === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function formatOpenAiStatus(status: OpenAiCallStatus): string {
  if (status.kind === "used") return "OpenAI 사용됨";
  if (status.kind === "skipped") return "OpenAI 미사용";
  const reason = status.reason ? ` · ${status.reason}` : "";
  return `OpenAI 사용 실패 · 기본 알고리즘 적용${reason}`;
}
