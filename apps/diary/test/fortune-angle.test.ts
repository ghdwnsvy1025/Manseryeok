// v4.26 오늘의 각도: 그날 실제로 있는 근거 하나를 코드가 고른다
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { angleInputFor } from "@/lib/fortune/angle";
import { buildBrief, renderBrief } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";
import { addDays } from "@/lib/time";

const PROFILE: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const pr = computeProfile({ ...PROFILE, name: "x" });
if (!pr.ok) throw new Error(pr.error);
const pillars = pr.value.pillars;

function dayOf(date: string) {
  const today = dayGanji(date);
  const core = computeCoreFortune({ pillars, profile: PROFILE, date, todayHanja: today.hanja });
  const personal = adjustWithEntries(core.parts.score01, [], { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
  const band = bandOf(toTenPoint(personal.score));
  return { today, core, personal, band, ...angleInputFor({ date, pillars, profile: PROFILE, entries: [] }, core, band) };
}

describe("오늘의 각도", () => {
  const days = Array.from({ length: 60 }, (_, i) => addDays("2026-12-01", i)).map(dayOf);

  test("같은 날이면 늘 같은 각도다", () => {
    expect(dayOf("2026-12-10").angle).toEqual(dayOf("2026-12-10").angle);
  });
  test("대부분의 날에 각도가 있고 한 종류로 쏠리지 않는다", () => {
    const kinds = days.map((d) => d.angle?.kind ?? null);
    expect(kinds.filter(Boolean).length).toBeGreaterThan(45);
    expect(new Set(kinds.filter(Boolean)).size).toBeGreaterThanOrEqual(4);
    const top = Math.max(...[...new Set(kinds)].map((k) => kinds.filter((x) => x === k).length));
    expect(top).toBeLessThan(30);
  });
  test("재료에 사주 말과 날수를 쓰지 않는다", () => {
    for (const d of days) if (d.angle) {
      expect(d.angle.story).not.toMatch(/육합|삼합|반합|[0-9]+일 전/);
      if (d.angle.kind === "되돌아옴") expect(d.angle.story).toContain("며칠 전");
    }
  });
  test("작가에게 보내는 계획에 실리고, 각도가 충이면 같은 충을 보조로 또 주지 않는다", () => {
    for (const d of days) {
      const b = buildBrief({ core: d.core, personal: d.personal, today: { ko: d.today.ko, hanja: d.today.hanja, stemKo: d.today.stemKo, branchKo: d.today.branchKo }, date: "2026-12-01", weekday: "월요일", score10: toTenPoint(d.personal.score), band: d.band, recent: [], angle: d.angle, quietNotes: d.quietNotes });
      const j = JSON.parse(renderBrief(b)) as { 오늘의각도?: { 종류: string; 이야기: string }; 보조?: { 사실?: string } };
      expect(j.오늘의각도?.종류).toBe(d.angle?.kind);
      if (d.angle?.kind === "충") expect(j.보조?.사실 ?? "").not.toBe(d.core.relations.hits.find((h) => h.kind === "충")?.fact);
    }
  });
});

describe("틀이 굳지 않게", () => {
  const days = Array.from({ length: 60 }, (_, i) => addDays("2026-12-01", i)).map(dayOf);
  test("같은 종류가 이틀 이어지는 날이 드물고, 되돌아옴은 7일에 한 번까지", () => {
    const kinds = days.map((d) => d.angle?.kind ?? null);
    const pairs = kinds.slice(1).filter((k, i) => k && k === kinds[i]).length;
    expect(pairs).toBeLessThan(8);
    const returns = kinds.flatMap((k, i) => (k === "되돌아옴" ? [i] : []));
    expect(returns.length).toBeGreaterThan(3);
    expect(returns.length).toBeLessThanOrEqual(10);
  });
  test("재료에 작가용 안내 말이 없다", () => {
    for (const d of days) if (d.angle) expect(d.angle.story).not.toMatch(/좋고 나쁨|별개|앞세움/);
  });
  test("같은 14일 묶음에서 장면과 설명 문구를 다시 보내지 않는다", () => {
    const seen = new Map<number, Set<string>>();
    for (const [i, d] of days.entries()) {
      const date = addDays("2026-12-01", i);
      const b = buildBrief({ core: d.core, personal: d.personal, today: { ko: d.today.ko, hanja: d.today.hanja, stemKo: d.today.stemKo, branchKo: d.today.branchKo }, date, weekday: "월요일", score10: toTenPoint(d.personal.score), band: d.band, recent: [], angle: d.angle, quietNotes: d.quietNotes });
      const block = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000 / 14);
      const set = seen.get(block) ?? new Set<string>();
      // 직업과 학업은 장면 표가 같아 한 날에 같은 문장이 둘일 수 있다. 다른 날과만 비교한다
      const todayScenes = new Set(b.plan.areas.flatMap((a) => (a.period === "오늘" && a.scene ? ["좋은" in a.scene ? a.scene.좋은 : a.scene.조심] : [])));
      for (const key of todayScenes) { expect(set.has(key)).toBe(false); set.add(key); }
      seen.set(block, set);
    }
  });
});
