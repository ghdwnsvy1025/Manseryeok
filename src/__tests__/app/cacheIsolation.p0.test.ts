import { describe, expect, test, beforeEach, afterEach } from "@jest/globals";
import { clearUiSessionCaches } from "@/lib/app/clearUiSessionCaches";
import { localJournalMigrationAllowlist } from "@/lib/diary/profileStorage";
import { peekFortuneEvidenceForDate } from "@/lib/journal/fortune/localPeek";

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  } as Storage;
}

describe("P0 account/cache isolation", () => {
  const local = makeMemoryStorage();
  const session = makeMemoryStorage();

  beforeEach(() => {
    local.clear();
    session.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: local,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: session,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: local,
        sessionStorage: session,
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "sessionStorage");
  });

  test("clearUiSessionCaches removes fortune drafts and home sentence", () => {
    local.setItem(
      "manseryeok:today-fortune-v2.10:2026-08-02:guest:fp",
      JSON.stringify({ version: "v2", overall: { title: "x" } })
    );
    local.setItem(
      "manseryeok:checkin-draft:v1:2026-08-02",
      JSON.stringify({ entryDate: "2026-08-02", content: "secret" })
    );
    local.setItem(
      "manseryeok:home-sentence-cache:v1",
      JSON.stringify({ localDate: "2026-08-02", message: "hi" })
    );
    local.setItem(
      "manseryeok:last-saved-checkin:v2",
      JSON.stringify({ at: Date.now() })
    );
    session.setItem(
      "manseryeok:home-sentence-cache:v1",
      JSON.stringify({ localDate: "2026-08-02", message: "hi" })
    );
    local.setItem("manseryeok_guest_mode", "1");

    clearUiSessionCaches();

    expect(
      local.getItem("manseryeok:today-fortune-v2.10:2026-08-02:guest:fp")
    ).toBeNull();
    expect(local.getItem("manseryeok:checkin-draft:v1:2026-08-02")).toBeNull();
    expect(local.getItem("manseryeok:home-sentence-cache:v1")).toBeNull();
    expect(local.getItem("manseryeok:last-saved-checkin:v2")).toBeNull();
    expect(session.getItem("manseryeok:home-sentence-cache:v1")).toBeNull();
    expect(local.getItem("manseryeok_guest_mode")).toBe("1");
  });

  test("localJournalMigrationAllowlist excludes other-account profiles", () => {
    local.setItem(
      "manseryeok_saju_profiles_v2",
      JSON.stringify([
        { id: "guest-1", userId: null, isPrimary: true },
        { id: "other-acc", userId: "user-a", isPrimary: false },
      ])
    );
    const forB = localJournalMigrationAllowlist("user-b");
    expect(forB.has("guest-1")).toBe(false);
    expect(forB.has("other-acc")).toBe(false);
    expect(forB.has("local")).toBe(true);

    local.setItem(
      "manseryeok_saju_profiles_v2",
      JSON.stringify([{ id: "guest-1", userId: null, isPrimary: true }])
    );
    const guestOnly = localJournalMigrationAllowlist("user-b");
    expect(guestOnly.has("guest-1")).toBe(true);
  });

  test("peekFortuneEvidenceForDate ignores other workspace cache", () => {
    local.setItem("manseryeok_guest_mode", "1");
    local.setItem(
      "manseryeok:today-fortune-v2.10:2026-08-02:account:fp",
      JSON.stringify({
        version: "v2",
        overall: { title: "account" },
        evidence: {
          weights: { recent: 0.2, keyword: 0.1, natal: 0.7 },
        },
      })
    );

    expect(peekFortuneEvidenceForDate("2026-08-02")).toBeNull();

    local.setItem(
      "manseryeok:today-fortune-v2.10:2026-08-02:guest:fp",
      JSON.stringify({
        version: "v2",
        overall: { title: "guest" },
        evidence: {
          weights: { recent: 0.5, keyword: 0.1, natal: 0.4 },
        },
      })
    );
    const hit = peekFortuneEvidenceForDate("2026-08-02");
    expect(hit?.weights.recent).toBe(0.5);
  });
});
