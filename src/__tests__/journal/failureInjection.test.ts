/**
 * Gate C 14단계 — 장애 주입 시 폴백이 실제로 동작하는지 검증.
 * 사용자 화면에 raw stack / 내부 오류가 새면 실패.
 */
import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateTodayQuote } from "@/lib/journal/todayQuote";
import { generateTodayFortuneV2 } from "@/lib/journal/todayFortune";
import { generateTodayQuestion } from "@/lib/journal/todayQuestion";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import { decideTodayQuestion } from "@/lib/journal/questionDecision";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import { fuseTextAndUserScore } from "@/lib/journal/textAlphaFusion";
import {
  classifyAndSanitizeError,
  containsStackTraceLeak,
  publicErrorDetail,
} from "@/lib/app/publicErrors";
import type { JournalEntry } from "@/lib/journal/types";

const ROOT = process.cwd();

function entry(date: string): JournalEntry {
  return {
    id: `e-${date}`,
    userId: "u-fail",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: "오늘은 조금 지침이 남았다.",
    overallSatisfaction: 3,
    happinessScore: 3,
    moodLabel: "지침",
    moodLabels: ["지침"],
    mainEventText: null,
    source: "new_diary",
    scores: [
      {
        id: "s1",
        entryId: `e-${date}`,
        userId: "u-fail",
        categoryCode: "energy",
        userScore: 3,
        aiScore: null,
        finalScore: 3,
        rawScore: 3,
        isNotApplicable: false,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    tags: [{ tagCode: "rest", source: "user", confirmedByUser: true }],
    coreStates: null,
    domainScores: null,
    checkinVersion: 2,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    createdAt: "",
    updatedAt: "",
  };
}

describe("public error sanitization", () => {
  test("never echoes internal stack traces", () => {
    const err = new Error(
      "OpenAI 500 at Object.<anonymous> (src/app/api/home/today-sentence/route.ts:240)"
    );
    const out = classifyAndSanitizeError(err);
    expect(containsStackTraceLeak(out.detail)).toBe(false);
    expect(out.detail).not.toContain("route.ts");
    expect(out.detail).not.toContain("OpenAI 500");
  });

  test("every kind has a safe Korean detail", () => {
    for (const kind of [
      "llm",
      "rag",
      "rpc",
      "network",
      "db",
      "timeout",
      "unknown",
    ] as const) {
      const d = publicErrorDetail(kind);
      expect(d.length).toBeGreaterThan(5);
      expect(containsStackTraceLeak(d)).toBe(false);
    }
  });
});

describe("failure injection fallbacks", () => {
  test("LLM missing → fortune template", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const insight = buildDailyInsightContext({
        eventDate: "2026-07-25",
        entries: [entry("2026-07-24")],
        enabledCodes: ["energy", "emotional_balance"],
      });
      const res = await generateTodayFortuneV2(insight, { skipLlm: true });
      expect(res.domains.length).toBeGreaterThan(0);
      expect(res.openAi.kind).toBe("skipped");
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });

  test("LLM missing → question template", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const today = "2026-07-25";
      const prior = [entry("2026-07-24")];
      const b = buildBTheme(buildDailySajuContext(today, null));
      const bundle = buildContentScoreBundle({
        entries: prior,
        todayDate: today,
        enabledCodes: ["energy"],
        excludeToday: true,
      });
      const ranking = rankKeywordsForQuestion({
        bundle,
        priorEntries: prior,
        b,
        topN: 3,
      });
      const decision = decideTodayQuestion({
        b,
        bundle,
        enabledCodes: ["energy"],
        keywordRanking: ranking,
      });
      const res = await generateTodayQuestion({ b, decision, ganjiKo: null });
      expect(res.question.length).toBeGreaterThan(0);
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });

  test("empty quote DB → deterministic sentence; journal save path stays ok", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const e = entry("2026-07-25");
      const b = buildBTheme(buildDailySajuContext(e.entryDate, null));
      const a = await generateTodayQuote({
        b,
        entry: e,
        recentAOverall: 3,
        trend: { delta: null, direction: "unknown" },
        quoteCandidates: [],
        recentDeliveries: [],
      });
      expect(a.contentType).not.toBe("verified_quote");
      expect(a.sentence.length).toBeGreaterThan(0);
      // 명언 전체가 실패해도 일기 점수는 그대로
      expect(e.scores[0]!.finalScore).toBe(3);
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });

  test("text analysis failure → user score only (alpha fusion)", () => {
    const fused = fuseTextAndUserScore({
      userScore: 7,
      aiScore: null,
      content: "충분히 긴 일기 텍스트이지만 AI가 실패한 경우",
      aiConfidence: null,
    });
    expect(fused.finalScore).toBe(7);
    expect(fused.alpha).toBe(0);
  });

  test("today-sentence route never returns raw stack on LLM failure path", () => {
    const src = readFileSync(
      join(ROOT, "src/app/api/home/today-sentence/route.ts"),
      "utf8"
    );
    // 과거 버그: detail: err.message
    expect(src).not.toMatch(/detail:\s*err\.message/);
    expect(src).not.toMatch(/detail:\s*err instanceof Error \? err\.message/);
    expect(src).toContain("classifyAndSanitizeError");
    expect(src).toContain("template_llm_failed");
    expect(src).toContain('fallback: "rag_failed"');
    // 502로 화면을 깨지 않음
    expect(src).not.toMatch(/status:\s*502/);
  });

  test("quote RAG path falls through to verified list on RPC failure", () => {
    const src = readFileSync(
      join(ROOT, "src/lib/journal/quote/repository.ts"),
      "utf8"
    );
    expect(src).toContain("match_quote_library");
    expect(src).toContain("fall through");
    expect(src).toContain('.eq("active", true)');
  });
});
