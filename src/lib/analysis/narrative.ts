/**
 * Phase 5 — 분석 UI·서술: LLM 서술 (숫자 미생성)
 * 실패 시 결정론적 fallback.
 */
import type { AnalysisViewModel } from "./types";
import {
  assertNarrativeInputSafe,
  buildNarrativeInput,
  narrativeFromViewModelFallback,
  parseNarrativeOutput,
  type AnalysisNarrativeOutput,
} from "./narrativeContract";
import { validateNarrativeOutput } from "./safetyFilter";

export type NarrativeResult = {
  output: AnalysisNarrativeOutput;
  source: "llm" | "fallback";
  reasons: string[];
};

function isLlmEnabled(): boolean {
  const raw =
    typeof process !== "undefined"
      ? process.env.FF_ANALYSIS_NARRATIVE_LLM
      : undefined;
  if (raw == null || raw === "") return false;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

async function callOpenAiNarrative(
  input: ReturnType<typeof buildNarrativeInput>
): Promise<AnalysisNarrativeOutput | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const system = [
    "당신은 사주·일기 앱의 안전 서술 도우미입니다.",
    "입력 JSON의 숫자·상태를 변경·추가하지 마세요.",
    "theoryText, recordText, suggestionText 세 필드만 JSON으로 반환하세요.",
    "금지: 확정 예언, 의료·재정 단정, 원인 단정, 계수·개인정보.",
    "허용: 가능성·관찰된 경향·생활 리듬 점검 제안.",
  ].join(" ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_NARRATIVE_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseNarrativeOutput(JSON.parse(content));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * LLM OFF·실패·검증 실패 → ViewModel fallback 문장.
 */
export async function generateAnalysisNarrative(
  vm: AnalysisViewModel
): Promise<NarrativeResult> {
  const fallback = narrativeFromViewModelFallback(vm);
  const input = buildNarrativeInput(vm);

  try {
    assertNarrativeInputSafe(input);
  } catch (e) {
    return {
      output: fallback,
      source: "fallback",
      reasons: [e instanceof Error ? e.message : "input_unsafe"],
    };
  }

  if (!isLlmEnabled()) {
    return { output: fallback, source: "fallback", reasons: ["llm_flag_off"] };
  }

  const llmOut = await callOpenAiNarrative(input);
  if (!llmOut) {
    return {
      output: fallback,
      source: "fallback",
      reasons: ["llm_failed_or_timeout"],
    };
  }

  const safety = validateNarrativeOutput(llmOut, input);
  if (!safety.ok) {
    return {
      output: fallback,
      source: "fallback",
      reasons: safety.reasons,
    };
  }

  // 수치 충돌 시 입력(결정론) 우선 — 출력 문장만 사용, 숫자는 UI가 ViewModel에서 표시
  return { output: llmOut, source: "llm", reasons: [] };
}
