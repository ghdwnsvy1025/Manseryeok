import { describe, expect, test } from "@jest/globals";
import { MemoryJournalStorage } from "@/lib/journal/indexedDbStorage";
import { pickActiveSajuProfileId } from "@/lib/diary/activeSajuProfile";

describe("per-profile journal isolation", () => {
  test("pickActiveSajuProfileId prefers primary then preferred", () => {
    const profiles = [
      { id: "a", isPrimary: false },
      { id: "b", isPrimary: true },
    ];
    expect(pickActiveSajuProfileId(profiles)).toBe("b");
    expect(pickActiveSajuProfileId(profiles, "a")).toBe("a");
  });

  test("MemoryJournalStorage keeps same-date entries per profile", async () => {
    const shared = new Map();
    const a = new MemoryJournalStorage("profile-a", shared);
    const b = new MemoryJournalStorage("profile-b", shared);

    await a.save({
      entryDate: "2026-07-25",
      sajuProfileId: "profile-a",
      content: "A day",
      overallSatisfaction: 7,
      moodLabel: null,
      mainEventText: null,
      scores: [
        {
          categoryCode: "energy",
          userScore: 7,
          isNotApplicable: false,
        },
      ],
      tagCodes: [],
      enabledCodes: ["energy"],
      relaxEnabledCount: true,
    });

    await b.save({
      entryDate: "2026-07-25",
      sajuProfileId: "profile-b",
      content: "B day",
      overallSatisfaction: 4,
      moodLabel: null,
      mainEventText: null,
      scores: [
        {
          categoryCode: "energy",
          userScore: 4,
          isNotApplicable: false,
        },
      ],
      tagCodes: [],
      enabledCodes: ["energy"],
      relaxEnabledCount: true,
    });

    const aEntry = await a.getByDate("2026-07-25");
    const bEntry = await b.getByDate("2026-07-25");
    expect(aEntry?.content).toBe("A day");
    expect(bEntry?.content).toBe("B day");
    expect(aEntry?.sajuProfileId).toBe("profile-a");
    expect(bEntry?.sajuProfileId).toBe("profile-b");
    expect((await a.list()).length).toBe(1);
    expect((await b.list()).length).toBe(1);
  });
});
