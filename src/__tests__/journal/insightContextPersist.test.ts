/**
 * In-memory store mirroring DailyInsightContext insert-once semantics.
 * Used to prove concurrent getOrCreate and question↔fortune shared context_id
 * without requiring a live Supabase project in unit tests.
 */
import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { scoreFortuneDomains } from "@/lib/journal/fortune/score";
import type { DailyInsightContext } from "@/lib/journal/insight/types";
import type { JournalEntry } from "@/lib/journal/types";

type CtxRow = { id: string; userId: string; eventDate: string; ctx: DailyInsightContext };
type FortuneRow = {
  id: string;
  userId: string;
  eventDate: string;
  contextId: string;
  scores: ReturnType<typeof scoreFortuneDomains>;
};
type QuestionRow = {
  id: string;
  userId: string;
  eventDate: string;
  contextId: string;
  questionText: string;
};

class MemoryInsightDb {
  contexts = new Map<string, CtxRow>();
  fortunes = new Map<string, FortuneRow>();
  questions = new Map<string, QuestionRow>();
  private seq = 0;

  private key(userId: string, eventDate: string) {
    return `${userId}::${eventDate}`;
  }

  async loadOrBuild(
    userId: string,
    eventDate: string,
    build: () => DailyInsightContext
  ): Promise<{ id: string; ctx: DailyInsightContext; created: boolean }> {
    const k = this.key(userId, eventDate);
    const existing = this.contexts.get(k);
    if (existing) return { id: existing.id, ctx: existing.ctx, created: false };

    const ctx = build();
    // Simulate concurrent race: another insert may win between check and write
    if (this.contexts.has(k)) {
      const won = this.contexts.get(k)!;
      return { id: won.id, ctx: won.ctx, created: false };
    }
    const id = `ctx-${++this.seq}`;
    this.contexts.set(k, { id, userId, eventDate, ctx });
    return { id, ctx, created: true };
  }

  async persistFortune(
    userId: string,
    eventDate: string,
    contextId: string,
    scores: ReturnType<typeof scoreFortuneDomains>
  ): Promise<string> {
    const k = this.key(userId, eventDate);
    const existing = this.fortunes.get(k);
    if (existing) return existing.id;
    const id = `ft-${++this.seq}`;
    this.fortunes.set(k, { id, userId, eventDate, contextId, scores });
    return id;
  }

  async persistQuestion(
    userId: string,
    eventDate: string,
    contextId: string,
    questionText: string
  ): Promise<string> {
    const k = this.key(userId, eventDate);
    const existing = this.questions.get(k);
    if (existing) {
      if (!existing.contextId) existing.contextId = contextId;
      return existing.id;
    }
    const id = `q-${++this.seq}`;
    this.questions.set(k, { id, userId, eventDate, contextId, questionText });
    return id;
  }
}

function entry(date: string, energy: number): JournalEntry {
  return {
    id: `e-${date}`,
    userId: "u1",
    sajuProfileId: null,
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: "",
    overallSatisfaction: energy as JournalEntry["overallSatisfaction"],
    happinessScore: energy,
    moodLabel: null,
    moodLabels: [],
    mainEventText: null,
    source: "new_diary",
    scores: [
      {
        id: `s-${date}`,
        entryId: `e-${date}`,
        userId: "u1",
        categoryCode: "energy",
        userScore: energy as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
        aiScore: null,
        finalScore: energy,
        rawScore: energy as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
        isNotApplicable: false,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    tags: [],
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

const ENABLED = [
  "emotional_balance",
  "energy",
  "focus_execution",
  "work_study",
  "relationship",
  "recovery_sleep",
  "finance_resource",
  "physical_condition",
] as const;

describe("DailyInsightContext shared snapshot (step 2)", () => {
  test("question then fortune share the same context id", async () => {
    const db = new MemoryInsightDb();
    const userId = "user-a";
    const today = "2026-07-25";
    const prior = [entry("2026-07-24", 7)];

    const q = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        entries: prior,
        enabledCodes: [...ENABLED],
      })
    );
    await db.persistQuestion(userId, today, q.id, "오늘 무엇이 부담이었나요?");

    const f = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        // today check-in would be included in client payload but must not rebuild
        entries: [...prior, entry(today, 2)],
        enabledCodes: [...ENABLED],
      })
    );
    const scores = scoreFortuneDomains(f.ctx);
    await db.persistFortune(userId, today, f.id, scores);

    expect(q.id).toBe(f.id);
    expect(f.created).toBe(false);
    expect(db.contexts.size).toBe(1);
    expect(db.questions.get(`${userId}::${today}`)?.contextId).toBe(q.id);
    expect(db.fortunes.get(`${userId}::${today}`)?.contextId).toBe(q.id);
    // Snapshot frozen: priorUniqueDays from first build (today excluded)
    expect(f.ctx.priorUniqueDays).toBe(q.ctx.priorUniqueDays);
    expect(f.ctx.dataCutoffAt).toBe(q.ctx.dataCutoffAt);
  });

  test("fortune then question share the same context id", async () => {
    const db = new MemoryInsightDb();
    const userId = "user-b";
    const today = "2026-07-25";
    const prior = [entry("2026-07-23", 5), entry("2026-07-24", 6)];

    const f = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        entries: prior,
        enabledCodes: [...ENABLED],
      })
    );
    await db.persistFortune(
      userId,
      today,
      f.id,
      scoreFortuneDomains(f.ctx)
    );

    const q = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        entries: [...prior, entry(today, 9)],
        enabledCodes: [...ENABLED],
      })
    );
    await db.persistQuestion(userId, today, q.id, "무엇이 도움이 되었나요?");

    expect(q.id).toBe(f.id);
    expect(db.contexts.size).toBe(1);
    expect(db.fortunes.get(`${userId}::${today}`)?.contextId).toBe(
      db.questions.get(`${userId}::${today}`)?.contextId
    );
  });

  test("same-day check-in after context create does not overwrite snapshot", async () => {
    const db = new MemoryInsightDb();
    const userId = "user-c";
    const today = "2026-07-25";
    const prior = [entry("2026-07-24", 4)];

    const first = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        entries: prior,
        enabledCodes: [...ENABLED],
      })
    );
    const cutoff = first.ctx.dataCutoffAt;
    const conf = first.ctx.overallConfidence;

    const second = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        entries: [...prior, entry(today, 10)],
        enabledCodes: [...ENABLED],
      })
    );

    expect(second.id).toBe(first.id);
    expect(second.ctx.dataCutoffAt).toBe(cutoff);
    expect(second.ctx.overallConfidence).toBe(conf);
    expect(db.contexts.size).toBe(1);
  });

  test("concurrent loadOrBuild creates only one context row", async () => {
    const db = new MemoryInsightDb();
    const userId = "user-d";
    const today = "2026-07-25";
    let builds = 0;

    const build = () => {
      builds += 1;
      return buildDailyInsightContext({
        eventDate: today,
        entries: [entry("2026-07-24", 5)],
        enabledCodes: [...ENABLED],
      });
    };

    // Simulate race: pre-insert between two callers' find misses
    const p1 = (async () => {
      await new Promise((r) => setTimeout(r, 5));
      return db.loadOrBuild(userId, today, build);
    })();
    const p2 = (async () => {
      await new Promise((r) => setTimeout(r, 5));
      return db.loadOrBuild(userId, today, build);
    })();

    const [a, b] = await Promise.all([p1, p2]);
    expect(a.id).toBe(b.id);
    expect(db.contexts.size).toBe(1);
    // At most one create wins; second may also call build before seeing winner
    expect(builds).toBeGreaterThanOrEqual(1);
    expect(builds).toBeLessThanOrEqual(2);
  });

  test("fortune persist is insert-once (skipLlm path still stores scores)", async () => {
    const db = new MemoryInsightDb();
    const userId = "user-e";
    const today = "2026-07-25";
    const resolved = await db.loadOrBuild(userId, today, () =>
      buildDailyInsightContext({
        eventDate: today,
        entries: [entry("2026-07-24", 3)],
        enabledCodes: [...ENABLED],
      })
    );
    const scores1 = scoreFortuneDomains(resolved.ctx);
    const id1 = await db.persistFortune(userId, today, resolved.id, scores1);

    // Mutate scores object and try again — must keep original
    const scores2 = scores1.map((s) => ({ ...s, score: 0.99 }));
    const id2 = await db.persistFortune(userId, today, resolved.id, scores2);

    expect(id1).toBe(id2);
    const stored = db.fortunes.get(`${userId}::${today}`)!;
    expect(stored.scores.find((s) => s.domain === "overall")?.score).toBe(
      scores1.find((s) => s.domain === "overall")?.score
    );
    expect(stored.scores.length).toBeGreaterThan(0);
  });
});
