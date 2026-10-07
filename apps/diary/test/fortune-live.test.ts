// B5: 오늘 저장한 기록이 운세 캐시의 "내 기록으로 본 오늘"에 바로 반영되는지
import { describe, expect, test } from "vitest";
import { withLivePersonal } from "@/lib/fortune/live";
import { adjustWithEntries, fitPercent, type EntryLike } from "@/lib/fortune/personal";
import type { FortuneContent } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";

const TODAY = "2026-10-08";
const t = dayGanji(TODAY);

function entry(over: Partial<EntryLike> = {}): EntryLike {
  return { day_ganji_index: t.index, day_stem: t.stemKo, day_branch: t.branchKo, happiness: 8, ...over };
}

/** 캐시 행 흉내: 저장 전(기록 0건)에 만들어진 v4 운세 */
function cached(over: Partial<FortuneContent> = {}): FortuneContent {
  const personal = adjustWithEntries(0.62, [], { index: t.index, stemKo: t.stemKo, branchKo: t.branchKo });
  return {
    version: "v4",
    date: TODAY,
    dayGanjiKo: t.ko,
    dayGanjiHanja: t.hanja,
    score: 6.2,
    band: "무난",
    headline: "제목",
    body: "본문",
    do: "하면",
    dont: "피해요",
    source: "template",
    core: { parts: { raw: 0, rel: 0, ctx: 0, score01: 0.62 } } as unknown as FortuneContent["core"],
    personal,
    fitPercent: fitPercent(0),
    generatedAt: "2026-10-08T00:00:00.000Z",
    ...over,
  };
}

describe("withLivePersonal", () => {
  test("오늘 같은 간지 기록 1건이 personal·fitPercent에 반영되고 점수·밴드·글은 그대로", () => {
    const before = cached();
    const after = withLivePersonal(before, [entry()], TODAY);
    expect(after.personal.sameGanjiCount).toBe(1);
    expect(after.personal.sameGanjiMean).toBe(8);
    expect(after.personal.n).toBe(1);
    expect(after.fitPercent).toBe(fitPercent(1));
    expect(after.score).toBe(6.2);
    expect(after.band).toBe("무난");
    expect(after.headline).toBe("제목");
    expect(after.body).toBe("본문");
  });

  test("입력 객체는 바꾸지 않는다", () => {
    const before = cached();
    withLivePersonal(before, [entry()], TODAY);
    expect(before.personal.sameGanjiCount).toBe(0);
    expect(before.fitPercent).toBe(0);
  });

  test("같은 성분(일간 또는 일지) 기록은 n·mean에, 다른 날은 제외", () => {
    const es = [entry({ day_ganji_index: (t.index + 10) % 60, day_branch: "없음", happiness: 4 }), entry({ day_ganji_index: (t.index + 12) % 60, day_stem: "없음", happiness: 6 }), entry({ day_ganji_index: (t.index + 1) % 60, day_stem: "없음", day_branch: "없음", happiness: 10 })];
    const after = withLivePersonal(cached(), es, TODAY);
    expect(after.personal.sameGanjiCount).toBe(0);
    expect(after.personal.n).toBe(2);
    expect(after.personal.mean).toBe(5);
    expect(after.fitPercent).toBe(fitPercent(3));
  });

  test("기록이 없어지면 다시 '사주만으로' (n 0, mean null)", () => {
    const withOne = withLivePersonal(cached(), [entry()], TODAY);
    const after = withLivePersonal(withOne, [], TODAY);
    expect(after.personal.n).toBe(0);
    expect(after.personal.mean).toBeNull();
    expect(after.personal.sameGanjiCount).toBe(0);
    expect(after.fitPercent).toBe(0);
  });

  test("사주 점수는 core.parts.score01, 없으면 base.score에서 가져온다", () => {
    const v4 = withLivePersonal(cached(), [], TODAY);
    expect(v4.personal.score).toBeCloseTo(0.62, 5);
    const v3 = withLivePersonal(cached({ core: undefined, base: { score: 0.4 } as unknown as FortuneContent["base"] }), [], TODAY);
    expect(v3.personal.score).toBeCloseTo(0.4, 5);
  });

  test("운세 날짜가 오늘이 아니면(지난 캐시) 손대지 않는다", () => {
    const old = cached({ date: "2026-10-07" });
    expect(withLivePersonal(old, [entry()], TODAY)).toBe(old);
  });
});
