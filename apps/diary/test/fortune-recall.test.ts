// 2026-11-15 (앱 주인 "추천대로" 6번): 내 기록으로 본 오늘 — 원장 물음 10 답대로 "한 번이면 사실만, 두 번 이상일 때만 경향, 없으면 넣지 않는다"
import { describe, expect, test } from "vitest";
import { recallOf, RECALL_MIN, type RecallEntry } from "@/lib/fortune/recall";
import { dayGanji } from "@/lib/ganji";

const TODAY = "2026-12-04";   // 임자일
const g = dayGanji(TODAY);
const sameDay = (date: string, extra: Partial<RecallEntry> = {}): RecallEntry => ({ entry_date: date, day_ganji_index: g.index, day_stem: g.stemKo, day_branch: g.branchKo, happiness: 7, moods: ["설렘"], states: { pace: 3, money: 3 }, ...extra });
// 기토 일간에게 임(정재)·계(편재)·해·자 = 재성 갈래
const wealthDay = (date: string, money: 1 | 2 | 3): RecallEntry => ({ entry_date: date, day_ganji_index: 0, day_stem: "계", day_branch: "해", happiness: 5, states: { money } });

describe("내 기록으로 본 오늘", () => {
  test("기록이 없으면 null", () => {
    expect(recallOf([], TODAY, ["재성"], "己")).toBeNull();
  });
  test("같은 일진이던 날은 한 번이어도 사실로 — 최근 것부터 둘까지, 오늘 기록은 빼고", () => {
    const r = recallOf([sameDay("2026-10-05"), sameDay("2026-08-06", { happiness: 4 }), sameDay("2026-06-07"), sameDay(TODAY)], TODAY, [], "己")!;
    expect(r.same.map((x) => x.date)).toEqual(["2026-10-05", "2026-08-06"]);
    expect(r.same[0]!.states).toContain("바쁨");
    expect(r.same[0]!.ganjiKo).toBe(g.ko);
  });
  test("갈래 경향은 같은 단계를 두 번 이상 골랐을 때만, '보통'은 말하지 않는다", () => {
    expect(recallOf([wealthDay("2026-11-01", 3)], TODAY, ["재성"], "己")).toBeNull();
    const r = recallOf([wealthDay("2026-11-01", 3), wealthDay("2026-10-20", 3), wealthDay("2026-10-08", 1)], TODAY, ["재성"], "己")!;
    expect(r.tendency).toEqual([expect.objectContaining({ family: "재성", word: "많이 나감", count: 2, n: 3 })]);
    expect(RECALL_MIN).toBe(2);
    expect(recallOf([wealthDay("2026-11-01", 2), wealthDay("2026-10-20", 2)], TODAY, ["재성"], "己")).toBeNull();
    // 오늘 오지 않은 갈래는 말하지 않는다
    expect(recallOf([wealthDay("2026-11-01", 3), wealthDay("2026-10-20", 3)], TODAY, ["관성"], "己")).toBeNull();
  });
});

// 2026-11-17 기록 반영 설계(Q3·Q5~Q8): 글에 넣는 기록 한 줄 — 코드가 고르고, 같은 줄은 7일에 한 번
import { countWord, recordLineOf } from "@/lib/fortune/recall";
describe("글에 넣는 기록 한 줄", () => {
  test("고유어 횟수 — 글에 아라비아 숫자를 쓰지 않는다", () => {
    expect([1, 2, 3, 10, 12, 20, 21, 35].map(countWord)).toEqual(["한", "두", "세", "열", "열두", "스무", "스물한", "서른다섯"]);
  });
  test("같은 일진이던 지난번(기분·있었던 일만, 행복도 숫자·날짜 없음) → 갈래 경향 순", () => {
    const r = recallOf([sameDay("2026-10-05"), wealthDay("2026-11-01", 3), wealthDay("2026-10-20", 3), wealthDay("2026-10-08", 1)], TODAY, ["재성"], "己")!;
    const a = recordLineOf(r)!;
    expect(a.key).toBe("same:2026-10-05");
    expect(a.text).toMatch(/^오늘과 같은 기운이 돌던 지난번에는 '.+'(을|를) 고르셨어요\.$/);
    expect(a.text).not.toMatch(/\d|행복도/);
    // 최근 7일에 쓴 줄은 건너뛰고 다음 사실로 (임자일 기록도 재성 갈래 날이라 네 번으로 센다)
    const b = recordLineOf(r, [a.key])!;
    expect(b.text).toBe("돈·실속의 기운이 온 날 네 번 중 세 번은 '돈 많이 나감'을 고르셨어요.");
    expect(recordLineOf(r, [a.key, b.key])).toBeNull();
    // 횟수가 바뀌면 새 사실 — 같은 경향이어도 바로 다시 쓴다
    const r2 = recallOf([sameDay("2026-10-05"), wealthDay("2026-11-10", 3), wealthDay("2026-11-01", 3), wealthDay("2026-10-20", 3), wealthDay("2026-10-08", 1)], TODAY, ["재성"], "己")!;
    expect(recordLineOf(r2, [a.key, b.key])!.text).toContain("다섯 번 중 네 번");
  });
  test("기록이 없으면 null", () => {
    expect(recordLineOf(null)).toBeNull();
  });
});

import { placeRecordLine } from "@/lib/fortune/recall";
describe("빠진 기록 한 줄은 코드가 넣는다", () => {
  const line = "오늘과 같은 기운이 돌던 지난번에는 '우울·슬픔', '후회·부끄러움'을 고르셨어요.";
  const s = ["첫 문단 하나.", "첫 문단 둘.", "둘째 문단 하나.", "둘째 문단 둘.", "마무리예요."];
  test("둘째 문단 마무리 바로 앞에, 문장 그대로", () => {
    expect(placeRecordLine(s, 2, line)).toEqual([...s.slice(0, 4), line, "마무리예요."]);
  });
  test("이미 녹였으면(따옴표 속 말이 본문에 있음) 그대로", () => {
    const woven = [...s.slice(0, 4), "지난번엔 우울하고 후회도 남았던 날이었죠.", "마무리예요."];
    expect(placeRecordLine(woven, 2, line)).toEqual(woven);
  });
  test("기록 한 줄이 없으면 그대로", () => {
    expect(placeRecordLine(s, 2, null)).toEqual(s);
  });
});
