import { describe, expect, test } from "vitest";
import { shareCardText, shareMessage } from "@/lib/share";
import { highlights } from "@/lib/stats/ganji";

const e = (i: number, s: string, b: string, h: number) => ({ day_ganji_index: i, day_stem: s, day_branch: b, happiness: h });

describe("공유 카드 문구", () => {
  test("같은 간지 2번 이상이어야 카드가 생긴다", () => {
    expect(shareCardText(highlights([e(47, "신", "해", 8)]), "준표")).toBeNull();
    const t = shareCardText(highlights([e(47, "신", "해", 8), e(47, "신", "해", 9), e(0, "갑", "자", 5)]), "준표");
    expect(t).toMatchObject({ ganjiKo: "신해", hanja: "辛亥", title: "신해일", eyebrow: "준표의 가장 행복한 날" });
    expect(t!.detail).toBe("이 날 2번 기록했고 평균 행복도는 8.5이었어요.");
    expect(t!.footer).toBe("기록 3일 · 60가지 날 중 2가지를 겪었어요");
  });

  test("이름이 없으면 '내'", () => {
    const t = shareCardText(highlights([e(47, "신", "해", 8), e(47, "신", "해", 9)]), null)!;
    expect(t.eyebrow).toBe("내 가장 행복한 날");
    const m = shareMessage(t);
    expect(m.text).toContain("신해일(辛亥)");
    expect(m.text).not.toMatch(/기운|흐름|두근/);
  });
});
