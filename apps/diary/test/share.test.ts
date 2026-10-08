import { describe, expect, test } from "vitest";
import { shareCardText, shareMessage } from "@/lib/share";
import { highlights } from "@/lib/stats/ganji";

const e = (i: number, s: string, b: string, h: number, d?: string) => ({ day_ganji_index: i, day_stem: s, day_branch: b, happiness: h, entry_date: d });

describe("공유 카드 문구", () => {
  test("같은 간지 2번 이상이면 '가장 행복한 날' 카드", () => {
    const t = shareCardText(highlights([e(47, "신", "해", 8), e(47, "신", "해", 9), e(0, "갑", "자", 5)]), "준표");
    expect(t).toMatchObject({ ganjiKo: "신해", hanja: "辛亥", title: "신해일", eyebrow: "준표의 가장 행복한 날" });
    expect(t!.detail).toBe("이 날 2번 기록했고 평균 행복도는 8.5이었어요.");
    expect(t!.footer).toBe("기록 3일 · 60가지 날 중 2가지를 겪었어요");
  });

  test("기록이 1건이면 '첫 기록' 한 줄 카드 — null이 아니다", () => {
    const t = shareCardText(highlights([e(51, "을", "묘", 8)]), "준표");
    expect(t).toMatchObject({ ganjiKo: "을묘", hanja: "乙卯", title: "을묘일", eyebrow: "준표의 첫 기록" });
    expect(t!.detail).toBe("을묘일 · 행복도 8 · 첫 기록");
    expect(t!.footer).toBe("기록 1일 · 60가지 날 중 1가지를 겪었어요");
    expect(shareMessage(t!).text).toContain("을묘일(乙卯)");
  });

  test("겹치는 간지가 없으면 가장 최근(entry_date 최대) 기록으로", () => {
    const t = shareCardText(
      highlights([e(0, "갑", "자", 5, "2026-10-01"), e(51, "을", "묘", 7, "2026-10-08"), e(1, "을", "축", 9, "2026-10-03")]),
      null,
    );
    expect(t).toMatchObject({ ganjiKo: "을묘", eyebrow: "내 가장 최근 하루", detail: "을묘일 · 행복도 7 · 가장 최근 기록" });
  });

  test("기록 0이면 null", () => {
    expect(shareCardText(highlights([]), "준표")).toBeNull();
  });

  test("이름이 없으면 '내'", () => {
    const t = shareCardText(highlights([e(47, "신", "해", 8), e(47, "신", "해", 9)]), null)!;
    expect(t.eyebrow).toBe("내 가장 행복한 날");
    const m = shareMessage(t);
    expect(m.text).toContain("신해일(辛亥)");
    expect(m.text).not.toMatch(/기운|흐름|두근/);
  });
});
