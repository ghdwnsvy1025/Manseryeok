import { describe, expect, test } from "@jest/globals";
import {
  assembleAdminDebugSections,
  stripSensitive,
  isSensitiveAdminEmail,
  getSensitiveAdminEmails,
} from "@/lib/admin/insightDebugView";

describe("admin insight debug sections", () => {
  test("strips diary content keys from nested json", () => {
    const cleaned = stripSensitive({
      primaryKeyword: "recovery",
      content: "오늘 힘들었던 일기 원문",
      recentState: {
        contentScoreByCategory: { work: 5 },
        diaryContent: "비밀",
      },
      birthDate: "1990-01-01",
    }) as Record<string, unknown>;

    expect(cleaned.primaryKeyword).toBe("recovery");
    expect(cleaned.content).toBeUndefined();
    expect(cleaned.birthDate).toBeUndefined();
    expect(
      (cleaned.recentState as Record<string, unknown>).contentScoreByCategory
    ).toEqual({ work: 5 });
    expect(
      (cleaned.recentState as Record<string, unknown>).diaryContent
    ).toBeUndefined();
  });

  test("assembles all required sections without diary content by default", () => {
    const sections = assembleAdminDebugSections({
      eventDate: "2026-07-25",
      userId: "u1",
      versions: {
        engine: "insight-v1.0.0",
        fortuneScore: "fortune-v1",
        keywordMapping: "map-v1",
        sajuRules: "saju-rules-v1.0.0",
        ridgeEval: "ridge-eval-v1.0.0",
      },
      flags: { sajuRelationsScoringEnabled: false },
      insightRows: [
        {
          id: "c1",
          timezone: "Asia/Seoul",
          data_cutoff_at: "2026-07-24T15:00:00Z",
          engine_version: "insight-v1.0.0",
          context_json: {
            priorUniqueDays: 12,
            overallConfidence: 0.6,
            topKeywords: [{ code: "recovery", score: 0.8 }],
            content: "원문이 여기 있으면 안 됨",
            natalPrior: {
              tenGod: "비견",
              keywords: ["안정"],
              sajuWeight: 0.3,
              plainSummary: "요약",
            },
            recentState: {
              contentScoreByCategory: { work: 6 },
              recentAOverall: 5.5,
            },
          },
        },
      ],
      fortuneRows: [
        {
          id: "f1",
          overall_headline: "오늘은 차분히",
          overall_summary: "요약",
          overall_confidence: 0.7,
          scoring_version: "fortune-v1",
          daily_fortune_sections: [
            {
              domain_code: "overall",
              score: 6.2,
              confidence: 0.7,
              headline: "헤드",
              opportunity: "기회",
              caution: "주의",
              action: "행동",
            },
          ],
        },
      ],
      deliveryRows: [
        {
          id: "d1",
          content_type: "verified_quote",
          author_name: "키케로",
          quote_text_ko: "삶이 있는 한 희망은 있다",
          verification_status: "primary_source_verified",
          rights_status: "public_domain",
        },
      ],
      exposureRows: [
        {
          content_type: "daily_question",
          event_type: "question_impression",
          occurred_at: "2026-07-25T01:00:00Z",
        },
      ],
      questionRows: [
        {
          id: "q1",
          question_text: "오늘 마음에 남는 순간은?",
          keyword_codes: ["recovery"],
          evidence: { content: "숨겨야 함", score: 1 },
          confidence: 0.5,
          model_version: "q-v1",
        },
      ],
      questionFeedbackRows: [
        {
          event_type: "fit_good",
          rating: 5,
          created_at: "2026-07-25T02:00:00Z",
        },
      ],
      contentFeedbackRows: [
        {
          content_type: "verified_quote",
          rating: "loved",
          saved: true,
          shared: false,
        },
      ],
      sensitiveAccess: false,
      includeContent: false,
    });

    expect(sections.common.contextId).toBe("c1");
    expect(sections.common.engineVersion).toBe("insight-v1.0.0");
    expect(sections.common.ruleVersion).toBe("saju-rules-v1.0.0");
    expect(sections.question?.questionText).toContain("마음에 남는");
    expect(JSON.stringify(sections.question?.evidence)).not.toContain("숨겨야");
    expect(sections.fortune?.sections[0]?.opportunity).toBe("기회");
    expect(sections.quote?.authorName).toBe("키케로");
    expect(sections.saju?.tenGod).toBe("비견");
    expect(sections.model.ridgeEvalVersion).toBe("ridge-eval-v1.0.0");
    expect(sections.feedback.questionEvents).toHaveLength(1);
    expect(sections.privacy.diaryContentIncluded).toBe(false);

    const blob = JSON.stringify(sections);
    expect(blob).not.toContain("원문이 여기");
    expect(blob).not.toContain("숨겨야 함");
  });

  test("includeContent requires sensitive access", () => {
    const sections = assembleAdminDebugSections({
      eventDate: "2026-07-25",
      userId: null,
      versions: {},
      insightRows: [
        {
          id: "c1",
          context_json: { content: "비밀 일기" },
        },
      ],
      fortuneRows: [],
      deliveryRows: [],
      exposureRows: [],
      sensitiveAccess: false,
      includeContent: true,
    });
    expect(sections.privacy.diaryContentIncluded).toBe(false);
    expect(JSON.stringify(sections)).not.toContain("비밀 일기");
  });

  test("sensitive email gate", () => {
    expect(isSensitiveAdminEmail("a@x.com", ["a@x.com"])).toBe(true);
    expect(isSensitiveAdminEmail("b@x.com", ["a@x.com"])).toBe(false);
    expect(getSensitiveAdminEmails("a@x.com, b@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });
});
