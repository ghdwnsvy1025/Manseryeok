/**
 * AUDIT ARTIFACT - runtime harness (leakage / engine / quote / personas)
 */
import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { scoreFortuneDomains } from "@/lib/journal/fortune/score";
import { generateTodayFortuneV2 } from "@/lib/journal/todayFortune";
import { generateTodayQuote } from "@/lib/journal/todayQuote";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import { filterSafeQuotes } from "@/lib/journal/quote/safetyFilter";
import { selectBestQuote } from "@/lib/journal/quote/select";
import type { QuoteLibraryItem } from "@/lib/journal/quote/types";
import type { SajuProfile } from "@/lib/diary/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { BRANCHES, STEMS } from "@/lib/saju/constants";

const DATE = "2026-07-25";
type Score10 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

function entry(opts: {
  date: string;
  scores: Partial<Record<CategoryCode, number>>;
  moods?: string[];
  tags?: string[];
  happiness?: number;
  content?: string;
}): JournalEntry {
  const scoreRows = Object.entries(opts.scores).map(([code, v]) => ({
    id: `s-${opts.date}-${code}`,
    entryId: `e-${opts.date}`,
    userId: "audit-user",
    categoryCode: code as CategoryCode,
    userScore: v as Score10,
    aiScore: null,
    finalScore: v as number,
    rawScore: v as Score10,
    isNotApplicable: false,
    normalizedZ: null,
    normalizationVersion: null,
    createdAt: "",
    updatedAt: "",
  }));
  return {
    id: `e-${opts.date}`,
    userId: "audit-user",
    entryDate: opts.date,
    userTimezone: "Asia/Seoul",
    content: opts.content ?? "",
    overallSatisfaction: (opts.happiness ?? 5) as JournalEntry["overallSatisfaction"],
    happinessScore: opts.happiness ?? 5,
    moodLabel: opts.moods?.[0] ?? null,
    moodLabels: opts.moods ?? [],
    mainEventText: null,
    source: "new_diary",
    scores: scoreRows,
    tags: (opts.tags ?? []).map((tagCode) => ({
      tagCode,
      source: "user" as const,
      confirmedByUser: true,
    })),
    coreStates: null,
    domainScores: null,
    checkinVersion: null,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    createdAt: "",
    updatedAt: "",
  };
}

/** stemIdx/branchIdx into STEMS/BRANCHES ? avoids embedding CJK literals in this file */
function profile(stemIdx: number, branchIdx: number): SajuProfile {
  const stemHanja = STEMS[stemIdx]!;
  const branchHanja = BRANCHES[branchIdx]!;
  const detail = {
    stemHanja,
    branchHanja,
    stemKo: stemHanja,
    branchKo: branchHanja,
    ganjiKo: `${stemHanja}${branchHanja}`,
  };
  return {
    id: `p-${stemHanja}${branchHanja}`,
    isPrimary: true,
    birthDate: "1990-01-01",
    birthTimeUnknown: true,
    calendarType: "solar",
    timezone: "Asia/Seoul",
    dayChangeRule: "midnight",
    timeCorrection: "none",
    pillars: {
      year: { ...detail, stemHanja: STEMS[6]!, branchHanja: BRANCHES[6]! },
      month: { ...detail, stemHanja: STEMS[4]!, branchHanja: BRANCHES[0]! },
      day: detail,
    },
    calculationVersion: "audit",
  } as unknown as SajuProfile;
}

const ENABLED: CategoryCode[] = [
  "emotional_balance",
  "energy",
  "recovery_sleep",
  "focus_execution",
  "work_study",
  "relationship",
];

const PRIOR_7D = [
  entry({ date: "2026-07-18", scores: { energy: 4, recovery_sleep: 4, focus_execution: 6 } }),
  entry({ date: "2026-07-19", scores: { energy: 4, recovery_sleep: 3, focus_execution: 6 } }),
  entry({ date: "2026-07-20", scores: { energy: 3, recovery_sleep: 3, focus_execution: 7 } }),
  entry({ date: "2026-07-21", scores: { energy: 3, recovery_sleep: 2, focus_execution: 7 } }),
  entry({ date: "2026-07-22", scores: { energy: 3, recovery_sleep: 2, focus_execution: 8 } }),
  entry({ date: "2026-07-23", scores: { energy: 2, recovery_sleep: 2, focus_execution: 8 } }),
  entry({ date: "2026-07-24", scores: { energy: 2, recovery_sleep: 2, focus_execution: 8 } }),
];

const TODAY_EXTREME = entry({
  date: DATE,
  scores: {
    energy: 10,
    recovery_sleep: 10,
    focus_execution: 10,
    emotional_balance: 10,
    relationship: 10,
    work_study: 10,
  },
  moods: ["joy", "excited"],
  tags: ["promotion"],
  happiness: 10,
  content: "today extreme",
});

describe("AUDIT leakage", () => {
  test("A. today extreme input does not change insight context", () => {
    const before = buildDailyInsightContext({
      eventDate: DATE,
      entries: PRIOR_7D,
      enabledCodes: ENABLED,
      sajuProfile: profile(0, 0),
    });
    const after = buildDailyInsightContext({
      eventDate: DATE,
      entries: [...PRIOR_7D, TODAY_EXTREME],
      enabledCodes: ENABLED,
      sajuProfile: profile(0, 0),
    });
    expect(after).toEqual(before);
  });

  test("B. today extreme input does not change fortune scores", () => {
    const mk = (entries: JournalEntry[]) =>
      scoreFortuneDomains(
        buildDailyInsightContext({
          eventDate: DATE,
          entries,
          enabledCodes: ENABLED,
          sajuProfile: profile(0, 0),
        })
      ).map((d) => ({ domain: d.domain, score: d.score, tone: d.tone }));
    expect(mk([...PRIOR_7D, TODAY_EXTREME])).toEqual(mk(PRIOR_7D));
  });

  test("C. dataCutoffAt is eventDate 00:00 KST", () => {
    const ctx = buildDailyInsightContext({
      eventDate: DATE,
      entries: [...PRIOR_7D, TODAY_EXTREME],
      enabledCodes: ENABLED,
    });
    expect(ctx.dataCutoffAt).toBe(`${DATE}T00:00:00.000+09:00`);
    expect(ctx.priorUniqueDays).toBe(PRIOR_7D.length);
  });

  test("D. identical inputs are deterministic", () => {
    const run = () =>
      buildDailyInsightContext({
        eventDate: DATE,
        entries: PRIOR_7D,
        enabledCodes: ENABLED,
        sajuProfile: profile(0, 0),
      });
    expect(run()).toEqual(run());
    expect(scoreFortuneDomains(run())).toEqual(scoreFortuneDomains(run()));
  });
});

describe("AUDIT fortune engine", () => {
  test("different inputs produce different domain scores", () => {
    const low = scoreFortuneDomains(
      buildDailyInsightContext({
        eventDate: DATE,
        entries: PRIOR_7D,
        enabledCodes: ENABLED,
        sajuProfile: profile(0, 0),
      })
    );
    const high = scoreFortuneDomains(
      buildDailyInsightContext({
        eventDate: DATE,
        entries: PRIOR_7D.map((e, i) =>
          entry({
            date: e.entryDate,
            scores: { energy: 9, recovery_sleep: 9, focus_execution: 8 - (i % 2) },
          })
        ),
        enabledCodes: ENABLED,
        sajuProfile: profile(0, 0),
      })
    );
    expect(low.filter((d, i) => d.score !== high[i]!.score).length).toBeGreaterThan(0);
  });

  test("skipLlm still fills all 5 domains", async () => {
    const ctx = buildDailyInsightContext({
      eventDate: DATE,
      entries: PRIOR_7D,
      enabledCodes: ENABLED,
      sajuProfile: profile(0, 0),
    });
    const res = await generateTodayFortuneV2(ctx, { skipLlm: true });
    const all = [res.overall, ...res.domains];
    expect(all).toHaveLength(5);
    for (const d of all) {
      expect(d.headline.length).toBeGreaterThan(0);
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(1);
    }
  });

  test("overall score varies with state level (no saturation)", () => {
    const level = (v: number) =>
      [1, 2, 3].map((i) =>
        entry({
          date: `2026-07-2${i}`,
          scores: { energy: v, recovery_sleep: v, emotional_balance: v },
        })
      );
    const scoreAt = (entries: JournalEntry[]) =>
      scoreFortuneDomains(
        buildDailyInsightContext({
          eventDate: DATE,
          entries,
          enabledCodes: ENABLED,
          sajuProfile: profile(0, 0),
        })
      ).find((d) => d.domain === "overall")!.score;

    const s1 = scoreAt(level(1));
    const s5 = scoreAt(level(5));
    const s10 = scoreAt(level(10));
    expect(s1).toBeLessThan(s5);
    expect(s5).toBeLessThan(s10);
    expect(s5).not.toBe(1);
  });

  test("domain headlines are not identical", async () => {
    const ctx = buildDailyInsightContext({
      eventDate: DATE,
      entries: PRIOR_7D,
      enabledCodes: ENABLED,
      sajuProfile: profile(0, 0),
    });
    const res = await generateTodayFortuneV2(ctx, { skipLlm: true });
    const headlines = [res.overall, ...res.domains].map((d) => d.headline);
    expect(new Set(headlines).size).toBe(headlines.length);
  });
});

describe("AUDIT personas", () => {
  const personas = [
    { name: "A new", entries: [] as JournalEntry[], saju: profile(6, 8) },
    { name: "B recovery", entries: PRIOR_7D, saju: profile(0, 0) },
    {
      name: "C change",
      entries: [
        entry({ date: "2026-07-22", scores: { energy: 7, work_study: 8 }, tags: ["job_change"] }),
        entry({ date: "2026-07-23", scores: { energy: 7, work_study: 8 } }),
        entry({ date: "2026-07-24", scores: { energy: 6, work_study: 7 } }),
      ],
      saju: profile(2, 6),
    },
    {
      name: "D conflict",
      entries: [
        entry({ date: "2026-07-22", scores: { relationship: 3, emotional_balance: 3 }, tags: ["conflict"] }),
        entry({ date: "2026-07-23", scores: { relationship: 2, emotional_balance: 3 } }),
        entry({ date: "2026-07-24", scores: { relationship: 2, emotional_balance: 2 } }),
      ],
      saju: profile(8, 10),
    },
    {
      name: "E long",
      entries: Array.from({ length: 120 }, (_, i) => {
        const d = new Date(Date.UTC(2026, 2, 27 + i));
        return entry({
          date: d.toISOString().slice(0, 10),
          scores: {
            energy: 5 + ((i % 7) - 3),
            focus_execution: 6 + ((i % 5) - 2),
            relationship: 6,
          },
        });
      }).filter((e) => e.entryDate < DATE),
      saju: profile(7, 3),
    },
  ];

  test("personas produce distinct keyword/score signatures", () => {
    const rows = personas.map((p) => {
      const ctx = buildDailyInsightContext({
        eventDate: DATE,
        entries: p.entries,
        enabledCodes: ENABLED,
        sajuProfile: p.saju,
      });
      const f = scoreFortuneDomains(ctx);
      return {
        name: p.name,
        primary: ctx.primaryKeyword,
        scores: f.map((d) => `${d.domain}:${d.score}`).join(","),
        tenGod: ctx.natalPrior.tenGod,
      };
    });
    expect(new Set(rows.map((r) => `${r.primary}|${r.scores}`)).size).toBeGreaterThan(1);
    expect(rows[0]!.tenGod).not.toBeNull();
  });

  test("cold-start users diverge by natal only", () => {
    const a = buildDailyInsightContext({
      eventDate: DATE,
      entries: [],
      enabledCodes: ENABLED,
      sajuProfile: profile(6, 8),
    });
    const b = buildDailyInsightContext({
      eventDate: DATE,
      entries: [],
      enabledCodes: ENABLED,
      sajuProfile: profile(1, 11),
    });
    expect(a.natalPrior.tenGod).not.toBeNull();
    expect(b.natalPrior.tenGod).not.toBeNull();
    expect(a.natalPrior.tenGod).not.toBe(b.natalPrior.tenGod);
  });

  test("saju weight decreases as records grow", () => {
    const w = (n: number) => {
      const entries = Array.from({ length: n }, (_, i) => {
        const d = new Date(Date.UTC(2026, 6, 24 - i));
        return entry({ date: d.toISOString().slice(0, 10), scores: { energy: 5 } });
      });
      return buildDailyInsightContext({
        eventDate: DATE,
        entries,
        enabledCodes: ENABLED,
        sajuProfile: profile(0, 0),
      }).natalPrior.sajuWeight;
    };
    expect(w(0)).toBeGreaterThan(w(100));
  });
});

function quote(over: Partial<QuoteLibraryItem>): QuoteLibraryItem {
  return {
    id: "q1",
    quoteTextKo: "Pace yourself; the path remains.",
    originalText: null,
    authorName: "Verified Author",
    workTitle: "Verified Work",
    publicationInfo: null,
    sourceUrl: "https://example.org/verified",
    sourceType: "book",
    translator: null,
    language: "ko",
    themes: ["recovery"],
    emotionalTone: ["calm"],
    suitableStates: ["hard_day"],
    unsuitableStates: [],
    rightsStatus: "public_domain",
    verificationStatus: "primary_source_verified",
    attributionConfidence: 0.9,
    active: true,
    ...over,
  };
}

describe("AUDIT quotes", () => {
  test("unverified/prohibited/inactive quotes are excluded", () => {
    const safe = filterSafeQuotes(
      [
        quote({ id: "ok" }),
        quote({ id: "unverified", verificationStatus: "unverified" }),
        quote({ id: "review", rightsStatus: "review_required" }),
        quote({ id: "inactive", active: false }),
        quote({ id: "lowattr", attributionConfidence: 0.3 }),
      ],
      { hardDay: true, moods: ["tired"], tags: [] }
    );
    expect(safe.map((q) => q.id)).toEqual(["ok"]);
  });

  test("hard_day unsuitableStates excludes quotes when hardDay=true", () => {
    const safe = filterSafeQuotes(
      [
        quote({
          id: "toopositive",
          quoteTextKo: "You can do anything! Cheer up!",
          unsuitableStates: ["hard_day"],
        }),
        quote({
          id: "ok",
          quoteTextKo: "It is okay to rest today.",
          unsuitableStates: [],
          emotionalTone: ["??"],
        }),
      ],
      { hardDay: true, moods: ["sad"], tags: [] }
    );
    expect(safe.map((q) => q.id)).toEqual(["ok"]);
  });

  test("recent quote within 180d is blocked by date policy", () => {
    const best = selectBestQuote(
      [
        quote({ id: "recent", authorName: "ReuseAuthor" }),
        quote({
          id: "fresh",
          authorName: "FreshAuthor",
          quoteTextKo: "It is okay to leave today as it is.",
        }),
      ],
      {
        primaryKeyword: "recovery",
        tensionKeyword: null,
        fortuneTheme: null,
        moods: ["tired"],
        tags: [],
        hardDay: true,
        asOfDate: "2026-07-25",
        recentDeliveries: [
          {
            quoteId: "recent",
            authorName: "ReuseAuthor",
            sourceKey: null,
            deliveredAt: "2026-07-20T00:00:00Z",
            eventDate: "2026-07-20",
          },
        ],
      }
    );
    expect(best?.quote.id).toBe("fresh");
  });

  test("empty library falls back to sentence without author", async () => {
    const prevKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const b = buildBTheme(buildDailySajuContext(DATE, profile(0, 0)));
      const res = await generateTodayQuote({
        b,
        entry: entry({
          date: DATE,
          scores: { energy: 2, recovery_sleep: 2 },
          moods: ["tired"],
          happiness: 3,
        }),
        recentAOverall: 3,
        trend: { delta: -1, direction: "down" },
        quoteCandidates: [],
        recentSentences: [],
        recentQuoteIds: [],
        recentAuthors: [],
      });
      expect(res.contentType).not.toBe("verified_quote");
      expect(res.authorName).toBeNull();
      expect(res.sentence.length).toBeGreaterThan(0);
      expect(res.sentence.length).toBeLessThanOrEqual(100);
    } finally {
      if (prevKey) process.env.OPENAI_API_KEY = prevKey;
    }
  });

  test("verified quote text is returned verbatim", async () => {
    const prevKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const q = quote({ id: "verified-1" });
      const b = buildBTheme(buildDailySajuContext(DATE, profile(0, 0)));
      const res = await generateTodayQuote({
        b,
        entry: entry({ date: DATE, scores: { energy: 2 }, moods: ["tired"], happiness: 3 }),
        recentAOverall: 3,
        trend: { delta: 0, direction: "flat" },
        primaryKeyword: "recovery",
        quoteCandidates: [q],
        recentSentences: [],
        recentQuoteIds: [],
        recentAuthors: [],
      });
      expect(res.contentType).toBe("verified_quote");
      expect(res.sentence).toBe(q.quoteTextKo);
      expect(res.authorName).toBe(q.authorName);
    } finally {
      if (prevKey) process.env.OPENAI_API_KEY = prevKey;
    }
  });
});
