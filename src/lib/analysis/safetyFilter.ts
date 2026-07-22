/**
 * Phase 5 — 분석 UI·서술: 출력 안전 검증
 */
import type { AnalysisNarrativeInput, AnalysisNarrativeOutput } from "./narrativeContract";

const FORBIDDEN_PHRASES = [
  /반드시/,
  /확실히/,
  /틀림없이/,
  /운명/,
  /사고\s*난다/,
  /죽[는을]/,
  /파산/,
  /이별\s*한다/,
  /진단/,
  /투자하면\s*수익/,
  /대출/,
  /원인입니다/,
  /때문에\s*우울/,
  /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
];

const MAX_SECTION_LEN = 800;

export type SafetyResult = {
  ok: boolean;
  reasons: string[];
};

export function validateNarrativeOutput(
  output: AnalysisNarrativeOutput,
  input: AnalysisNarrativeInput
): SafetyResult {
  const reasons: string[] = [];
  const texts = [output.theoryText, output.recordText, output.suggestionText];

  for (const t of texts) {
    if (t.length > MAX_SECTION_LEN) reasons.push("max_length");
    for (const re of FORBIDDEN_PHRASES) {
      if (re.test(t)) reasons.push(`forbidden:${re}`);
    }
  }

  // 입력에 없는 구체적 신뢰도 숫자(정수 2자리+)를 새로 만들지 않았는지 느슨 검사
  const allowedNums = new Set<string>();
  allowedNums.add(String(input.sampleCount));
  if (input.baselineDeltaRounded != null) {
    allowedNums.add(String(input.baselineDeltaRounded));
  }
  const numMatches = texts.join(" ").match(/\d+(?:\.\d+)?/g) || [];
  for (const n of numMatches) {
    const v = Number(n);
    if (!Number.isFinite(v)) continue;
    // 1–5 점수·연도·날짜 조각은 허용 범위로 완화; 신뢰도 70–100 대역 임의 생성만 경계
    if (v >= 70 && v <= 100 && !allowedNums.has(n)) {
      reasons.push(`suspicious_confidence_number:${n}`);
    }
  }

  if (/coefficient|회귀계수|lambda\s*=/i.test(texts.join(" "))) {
    reasons.push("internal_coeff_leak");
  }
  if (/@|\.com|010-\d{4}/.test(texts.join(" "))) {
    reasons.push("pii_like");
  }

  // prompt injection echo
  if (/ignore\s+previous/i.test(texts.join(" "))) {
    reasons.push("injection_echo");
  }

  return { ok: reasons.length === 0, reasons };
}

export function stripInjectionFromUserText(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous|above)\s+instructions/gi, "[filtered]")
    .replace(/system\s*prompt/gi, "[filtered]")
    .slice(0, 2000);
}
