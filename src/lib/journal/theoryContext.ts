/**
 * 관리자 학습 이론(RAG) → 오늘의 운세/질문/명언용 컨텍스트
 * 질문 경로: 문장 다듬기 전용. 키워드·포커스 결정은 questionDecision에서 끝남.
 */
import {
  matchKnowledgeChunks,
  type MatchedChunk,
} from "@/lib/knowledge/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { BTheme } from "./bTheme";

export type TheoryEvidence = {
  content: string;
  similarity: number;
  chunkIndex: number;
};

export type TheoryContext = {
  used: boolean;
  chunks: string[];
  evidence: TheoryEvidence[];
  detail?: string;
};

function buildQuery(opts: {
  b: BTheme;
  ganjiKo?: string | null;
  purpose: "fortune" | "question" | "quote";
}): string {
  const purposeHint =
    opts.purpose === "fortune"
      ? "오늘의 운세 직장 연애 건강 대인 성격 힘과 균형 용신"
      : opts.purpose === "question"
        ? "오늘의 질문 성찰 상담 문장 하루 주제 말투"
        : "오늘의 명언 위로 조언 상담 전달 따뜻한 문장";

  return [
    opts.ganjiKo,
    opts.b.tenGod,
    ...opts.b.keywords,
    opts.b.plainSummary,
    purposeHint,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * 오늘 사주 주제에 가까운 학습 청크를 가져온다.
 * 실패해도 빈 컨텍스트를 반환 (기능 자체는 템플릿/일반 생성으로 계속).
 */
export async function loadTheoryContext(opts: {
  b: BTheme;
  ganjiKo?: string | null;
  purpose: "fortune" | "question" | "quote";
  matchCount?: number;
}): Promise<TheoryContext> {
  if (!isServiceRoleConfigured()) {
    return {
      used: false,
      chunks: [],
      evidence: [],
      detail: "no_service_role",
    };
  }

  try {
    const matched: MatchedChunk[] = await matchKnowledgeChunks(
      buildQuery(opts),
      opts.matchCount ?? 6
    );
    const evidence = matched.map((m) => ({
      content: m.content.slice(0, 700),
      similarity: Math.round(m.similarity * 1000) / 1000,
      chunkIndex: m.chunkIndex,
    }));
    const chunks = evidence.map((e) => e.content);
    return {
      used: chunks.length > 0,
      chunks,
      evidence,
      detail: chunks.length > 0 ? "matched" : "no_match",
    };
  } catch (err) {
    return {
      used: false,
      chunks: [],
      evidence: [],
      detail: err instanceof Error ? err.message : "match_failed",
    };
  }
}

/** 프롬프트에 넣을 공통 규칙 */
export function theoryUsageRules(
  kind: "fortune" | "question" | "quote"
): string {
  const base = `
학습된 사주 이론(theoryChunks)이 있으면 그것을 교과서처럼 사용하세요.
- 청크에 없는 이론을 지어내지 마세요.
- 어려운 용어(용신·신강·격국 등)는 쓰되, 바로 쉬운 말로 풀어서 말하세요.
- 미래 확정·의료 진단·비난·사고 예고 금지.
- 목표는 "이 관법으로 오늘을 어떻게 살아볼지"를 컨셉 있게 전달하는 것입니다.`;

  if (kind === "fortune") {
    return `${base}
운세 톤:
- 각 영역은 "오늘 기운의 컨셉 한 줄 + 실천/마음가짐 한 줄"
- 교과서 문장 복붙 금지. 오늘의 키워드(십신·간지)에 맞게 재해석.`;
  }
  if (kind === "question") {
    return `${base}
질문 문장화 전용 (주제 결정은 이미 lockedDecision에서 끝남):
- theoryChunks는 말투·비유만 참고합니다. 새 주제를 고르지 마세요.
- lockedDecision.topKeywords / focusCategory를 유지한 채 문장만 다듬습니다.
- 예: 키워드가 「회복·집중」이면 그 범위 안에서만 질문합니다.`;
  }
  return `${base}
명언 톤:
- 이론의 핵심을 따뜻한 1~2문장으로 바꿉니다.
- 유명 명언 인용 금지. 상담하듯 짧게.`;
}
