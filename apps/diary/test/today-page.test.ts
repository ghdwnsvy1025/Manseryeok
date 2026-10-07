// 오늘 화면 (B1): 세션은 있는데 생년월일이 없으면 /onboarding으로 보낸다. 세션이 없으면 리디렉트 없이 Booting(뼈대)
import { beforeEach, describe, expect, test, vi } from "vitest";

const fakeUser = { id: "anon-1", is_anonymous: true, email: undefined };
let currentUser: typeof fakeUser | null = fakeUser;
let profile: Record<string, unknown> | null = null;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: {}, user: currentUser }),
  createClient: async () => ({}),
}));
vi.mock("@/lib/db", () => ({
  getSajuProfile: async () => profile,
  getEntry: async () => null,
  listEntriesForStats: async () => [],
  getLinkPromptState: async () => ({ promptedAt: null, promptCount: 0 }),
  countEntries: async () => 0,
  listEntries: async () => [],
  getFortuneVote: async () => null,
  readFortuneCacheRow: async () => null,
  birthProfileOf: () => ({}),
}));
let cachedFortune: Record<string, unknown> | null = null;
vi.mock("@/lib/fortune", () => ({ getTodayFortune: vi.fn(), cachedFortuneContent: () => cachedFortune }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { Suspense } from "react";
import TodayPage from "@/app/page";
import { Booting } from "@/components/Booting";
import { FortuneCard } from "@/components/FortuneCard";

beforeEach(() => {
  currentUser = fakeUser;
  profile = null;
  cachedFortune = null;
});

const PROFILE = {
  name: "손님",
  pillars: { year: { stem: "乙", branch: "亥", ko: "을해" }, month: { stem: "己", branch: "卯", ko: "기묘" }, day: { stem: "庚", branch: "戌", ko: "경술" }, hour: null },
};

/** <main> 자식 가운데 운세 카드 자리의 요소 타입 (Suspense면 아직 기다리는 것, FortuneCard면 캐시 히트) */
function fortuneSlot(main: { props: { children: unknown[] } }) {
  const kids = main.props.children.flat().filter(Boolean) as { type: unknown }[];
  return kids.map((k) => k.type).find((t) => t === Suspense || t === FortuneCard);
}

describe("오늘 화면 첫 흐름", () => {
  test("세션은 있는데 프로필이 없으면 /onboarding?next=/ 로 보낸다 (폼을 안에 그리지 않는다)", async () => {
    await expect(TodayPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/onboarding?next=/");
  });

  test("세션이 없으면 리디렉트하지 않고 Booting(뼈대 두 장)을 돌려준다", async () => {
    currentUser = null;
    const el = await TodayPage({ searchParams: Promise.resolve({}) });
    expect(el.type).toBe(Booting);
    expect(el.props.cards).toBe(2);
  });

  test("프로필이 있으면 화면을 그린다 (캐시 미스: 운세는 Suspense 안이라 여기서 모델을 부르지 않는다)", async () => {
    profile = PROFILE;
    const el = await TodayPage({ searchParams: Promise.resolve({}) });
    expect(el.type).toBe("main");
    expect(fortuneSlot(el)).toBe(Suspense);
  });

  test("운세 캐시가 맞으면 Suspense(FortuneLoading) 없이 바로 FortuneCard를 그린다 (전수조사 A-2·3)", async () => {
    profile = PROFILE;
    cachedFortune = { version: "v4", score: 7, band: "good", headline: "h", body: "b", do: "d", dont: "x", source: "template" };
    const el = await TodayPage({ searchParams: Promise.resolve({}) });
    expect(el.type).toBe("main");
    expect(fortuneSlot(el)).toBe(FortuneCard);
  });
});
