/**
 * RAG(학습된 sajubase 청크)가 있을 때만 성향 3줄 요약.
 * 청크가 없으면 LLM을 호출하지 않는다.
 */
import OpenAI from "openai";
import { matchKnowledgeChunks } from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export type TendencyHints = {
  ganjiKo?: string;
  heavenlyStem?: string;
  earthlyBranch?: string;
  tenGod?: string | null;
  elementHints?: string[];
};

export type TendencySummaryResult =
  | {
      ok: true;
      usedRag: true;
      chunkCount: number;
      lines: [string, string, string];
    }
  | {
      ok: false;
      usedRag: false;
      chunkCount: number;
      reason:
        | "no_service_role"
        | "no_api_key"
        | "no_chunks"
        | "generation_failed"
        | "parse_failed";
      message: string;
    };

const RETRIEVAL_QUERY =
  "사주 성향 기질 일간 오행 성격 장점 주의할 점 쉬운 설명";

export function buildTendencyRetrievalQuery(hints?: TendencyHints): string {
  const parts = [RETRIEVAL_QUERY];
  if (hints?.ganjiKo) parts.push(`간지 ${hints.ganjiKo}`);
  if (hints?.heavenlyStem) parts.push(`천간 ${hints.heavenlyStem}`);
  if (hints?.earthlyBranch) parts.push(`지지 ${hints.earthlyBranch}`);
  if (hints?.tenGod) parts.push(`십신 ${hints.tenGod}`);
  if (hints?.elementHints?.length) {
    parts.push(`오행 ${hints.elementHints.join(" ")}`);
  }
  return parts.join(" ");
}

/** 모델 출력에서 비어 있지 않은 줄 3개만 고른다. */
export function parseThreeLines(raw: string): [string, string, string] | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*[-*•\d.）)]+\s*/, "")
        .replace(/^["「『]|["」』]$/g, "")
        .trim()
    )
    .filter((l) => l.length > 0 && !l.startsWith("{") && !l.startsWith("```"));
  if (lines.length < 3) return null;
  return [lines[0], lines[1], lines[2]];
}

export async function generateTendencyThreeLines(
  hints?: TendencyHints
): Promise<TendencySummaryResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      usedRag: false,
      chunkCount: 0,
      reason: "no_service_role",
      message: "이론 검색(service role)이 설정되지 않았습니다.",
    };
  }
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      usedRag: false,
      chunkCount: 0,
      reason: "no_api_key",
      message: "OPENAI_API_KEY가 없습니다.",
    };
  }

  let chunks: string[] = [];
  try {
    const matched = await matchKnowledgeChunks(
      buildTendencyRetrievalQuery(hints),
      6
    );
    chunks = matched.map((m) => m.content);
  } catch {
    return {
      ok: false,
      usedRag: false,
      chunkCount: 0,
      reason: "no_chunks",
      message: "이론 청크 검색에 실패했습니다. admin 인덱싱을 확인하세요.",
    };
  }

  if (chunks.length === 0) {
    return {
      ok: false,
      usedRag: false,
      chunkCount: 0,
      reason: "no_chunks",
      message:
        "학습된 이론 청크를 찾지 못했습니다. /admin에서 문서가 ready인지 확인하세요.",
    };
  }

  const hintBlock = hints
    ? JSON.stringify({
        ganjiKo: hints.ganjiKo ?? null,
        heavenlyStem: hints.heavenlyStem ?? null,
        earthlyBranch: hints.earthlyBranch ?? null,
        tenGod: hints.tenGod ?? null,
        elementHints: hints.elementHints ?? [],
      })
    : "{}";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let raw = "";
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_NARRATIVE_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `당신은 사주 이론을 쉬운 말로 풀어 주는 도우미입니다.
규칙:
- 아래 theoryChunks에 있는 내용만 사용하세요. 청크에 없는 주장은 쓰지 마세요.
- 확정적 미래·의료·심리 진단·정확도 숫자는 금지입니다.
- 반드시 한국어로, 초등학생도 이해할 쉬운 문장 3줄만 출력하세요.
- 줄마다 한 가지 성향만. 번호·따옴표·JSON·제목 없이 본문만.`,
        },
        {
          role: "user",
          content: `참고 힌트(있을 때만, 계산 결과가 아님):
${hintBlock}

theoryChunks:
${JSON.stringify(chunks)}

위 이론만 보고 성향을 쉬운 말 3줄로 적어 주세요.`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return {
      ok: false,
      usedRag: false,
      chunkCount: chunks.length,
      reason: "generation_failed",
      message: "LLM 호출에 실패했습니다.",
    };
  }

  const lines = parseThreeLines(raw);
  if (!lines) {
    return {
      ok: false,
      usedRag: false,
      chunkCount: chunks.length,
      reason: "parse_failed",
      message: "성향 3줄을 파싱하지 못했습니다.",
    };
  }

  return {
    ok: true,
    usedRag: true,
    chunkCount: chunks.length,
    lines,
  };
}
