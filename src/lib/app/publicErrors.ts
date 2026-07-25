/**
 * 사용자에게 보이는 오류 문구 — 내부 스택/원문을 절대 노출하지 않는다.
 */
const SAFE_DETAIL: Record<string, string> = {
  llm: "문장 생성에 잠시 문제가 있어 준비된 문장으로 보여 드려요.",
  rag: "학습 내용 검색에 실패했습니다.",
  rpc: "검색 서버에 잠시 문제가 있습니다.",
  network: "네트워크가 불안정합니다. 잠시 후 다시 시도해 주세요.",
  db: "저장소에 잠시 문제가 있습니다.",
  timeout: "응답이 지연되어 기본 문장으로 보여 드려요.",
  unknown: "잠시 문제가 발생했습니다.",
};

export type PublicErrorKind = keyof typeof SAFE_DETAIL;

export function publicErrorDetail(kind: PublicErrorKind): string {
  return SAFE_DETAIL[kind] ?? SAFE_DETAIL.unknown;
}

/** 내부 예외 메시지를 절대 그대로 반환하지 않는다. */
export function classifyAndSanitizeError(err: unknown): {
  kind: PublicErrorKind;
  detail: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout|ETIMEDOUT|AbortError/i.test(msg)) {
    return { kind: "timeout", detail: publicErrorDetail("timeout") };
  }
  if (/network|fetch|ECONN|ENOTFOUND/i.test(msg)) {
    return { kind: "network", detail: publicErrorDetail("network") };
  }
  if (/rpc|match_quote|match_knowledge|22P02|PGRST/i.test(msg)) {
    return { kind: "rpc", detail: publicErrorDetail("rpc") };
  }
  if (/openai|chat\.completions|rate.?limit|429|5\d\d/i.test(msg)) {
    return { kind: "llm", detail: publicErrorDetail("llm") };
  }
  if (/supabase|postgres|database|JWT/i.test(msg)) {
    return { kind: "db", detail: publicErrorDetail("db") };
  }
  return { kind: "unknown", detail: publicErrorDetail("unknown") };
}

export function containsStackTraceLeak(text: string): boolean {
  return (
    /at\s+\S+\s+\(/.test(text) ||
    /Error:\s/.test(text) ||
    /node_modules/.test(text) ||
    /\\src\\/.test(text) ||
    /\/src\//.test(text)
  );
}
