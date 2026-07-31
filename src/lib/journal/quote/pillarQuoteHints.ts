/**
 * 명언 선정용 — 오늘 천간·지지·간지 일기 통계를 일상어 테마로만 변환
 * (사주 글자 자체는 노출·매칭에 쓰지 않음)
 */
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import {
  recomputeD1Aggregates,
  resolveD1ForToday,
} from "@/lib/journal/d1Aggregates";
import { pillarInfluenceFromDays } from "@/lib/journal/insight/recordReflectGate";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

export type PillarQuoteHint = {
  mode: "off" | "hint" | "apply";
  /** 명언 테마·본문 매칭용 쉬운 말 */
  themes: string[];
  /** RAG 쿼리 보조 */
  queryBits: string[];
};

/** 카테고리 → 명언에 쓰기 좋은 짧은 말 */
const CATEGORY_QUOTE_WORDS: Partial<Record<CategoryCode, string[]>> = {
  emotional_balance: ["마음", "여유", "감정", "안정"],
  energy: ["활력", "기운", "힘", "회복"],
  recovery_sleep: ["휴식", "회복", "수면", "쉼"],
  physical_condition: ["몸", "건강", "컨디션"],
  focus_execution: ["집중", "실행", "마무리", "선택"],
  work_study: ["일", "공부", "성장", "배움"],
  relationship: ["관계", "사람", "연결", "대화"],
  finance_resource: ["돈", "자원", "여유"],
  change_opportunity: ["변화", "기회", "시작"],
};

export function buildPillarQuoteHints(opts: {
  entries: JournalEntry[];
  todayDate: string;
  enabledCodes: CategoryCode[];
  priorUniqueDays: number;
}): PillarQuoteHint {
  const influence = pillarInfluenceFromDays(opts.priorUniqueDays);
  const stemOff = influence.stem === "off";
  const branchOff = influence.branch === "off";
  const ganjiOff = influence.ganji === "off";
  if (stemOff && branchOff && ganjiOff) {
    return { mode: "off", themes: [], queryBits: [] };
  }

  const mode: "hint" | "apply" =
    influence.stem === "apply" ||
    influence.branch === "apply" ||
    influence.ganji === "apply"
      ? "apply"
      : "hint";

  const aggregates = recomputeD1Aggregates(opts.entries);
  const scored: Array<{ code: CategoryCode; value: number }> = [];
  for (const code of opts.enabledCodes) {
    const v = resolveD1ForToday(aggregates, opts.todayDate, code);
    if (v == null) continue;
    scored.push({ code, value: v });
  }
  if (scored.length === 0) {
    return { mode, themes: [], queryBits: [] };
  }

  const sorted = [...scored].sort((a, b) => a.value - b.value);
  const lows = sorted.slice(0, 2);
  const high = sorted[sorted.length - 1]!;

  const themes: string[] = [];
  const queryBits: string[] = [];

  for (const row of lows) {
    const words = CATEGORY_QUOTE_WORDS[row.code] ?? [
      getCategoryByCode(row.code)?.name ?? row.code,
    ];
    themes.push(...words.slice(0, 2));
    if (row.value <= 5) {
      queryBits.push(`${words[0]} 위로`);
    } else {
      queryBits.push(words[0]!);
    }
  }
  if (high.value >= 6.5 && !lows.some((l) => l.code === high.code)) {
    const words = CATEGORY_QUOTE_WORDS[high.code] ?? [
      getCategoryByCode(high.code)?.name ?? high.code,
    ];
    themes.push(words[0]!);
    queryBits.push(`${words[0]} 격려`);
  }

  return {
    mode,
    themes: [...new Set(themes)].slice(0, 6),
    queryBits: [...new Set(queryBits)].slice(0, 4),
  };
}
