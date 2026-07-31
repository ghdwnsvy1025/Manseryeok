import {
  buildTemplateRecentStatus,
  describeRecentHappiness,
  normalizeRecentStatus,
} from "@/lib/journal/recentStatus";
import type { HomeEStats } from "@/lib/journal/homeStats";
import { progressFromTotalXp } from "@/lib/product/personalizationLevel";

function emptyStats(over: Partial<HomeEStats> = {}): HomeEStats {
  return {
    avg7: null,
    avg30: null,
    series30: [],
    coreBest: null,
    coreWorst: null,
    domainBest: null,
    domainWorst: null,
    best: null,
    worst: null,
    level: progressFromTotalXp(0),
    uniqueDays: 0,
    ...over,
  };
}

describe("recentStatus structured payload", () => {
  test("행복도 점수를 이해하기 쉬운 5단계로 설명한다", () => {
    expect(describeRecentHappiness(8).label).toBe("아주 좋음");
    expect(describeRecentHappiness(8).emoji).toBe("😄");
    expect(describeRecentHappiness(6.5).label).toBe("좋음");
    expect(describeRecentHappiness(6.5).emoji).toBe("🙂");
    expect(describeRecentHappiness(5).label).toBe("보통");
    expect(describeRecentHappiness(5).emoji).toBe("😐");
    expect(describeRecentHappiness(3.5).label).toBe("살짝 지침");
    expect(describeRecentHappiness(3.5).emoji).toBe("😕");
    expect(describeRecentHappiness(3.4).label).toBe("많이 지침");
    expect(describeRecentHappiness(3.4).emoji).toBe("😣");
  });

  test("템플릿이 핵심/선택 Best·Worst를 분리한다", () => {
    const s = buildTemplateRecentStatus(
      emptyStats({
        avg7: 7.2,
        coreBest: { code: "energy", name: "에너지·활력", average: 8 },
        coreWorst: {
          code: "emotional_balance",
          name: "마음의 여유",
          average: 4,
        },
        domainBest: { code: "relationship", name: "관계·연애", average: 9 },
        domainWorst: {
          code: "recovery_sleep",
          name: "수면·회복",
          average: 3,
        },
        best: { code: "energy", name: "에너지·활력", average: 8 },
        worst: {
          code: "emotional_balance",
          name: "마음의 여유",
          average: 4,
        },
        uniqueDays: 10,
      })
    );
    expect(s.headline).toMatch(/7\.2/);
    expect(s.coreGood?.value).toBe("에너지·활력");
    expect(s.coreWatch?.value).toBe("마음의 여유");
    expect(s.domainGood?.value).toBe("관계·연애");
    expect(s.domainWatch?.value).toBe("수면·회복");
    expect(s.good?.value).toBe("에너지·활력");
    expect(s.watch?.value).toBe("마음의 여유");
    expect(s.advice.length).toBeGreaterThan(0);
    expect(s.advice).toMatch(/마음의 여유|수면·회복/);
    expect(s.message).toContain(s.headline);
  });

  test("약한 영역이 없으면 행복도 구간 조언", () => {
    const s = buildTemplateRecentStatus(
      emptyStats({
        avg7: 7,
        uniqueDays: 10,
      })
    );
    expect(s.advice).toMatch(/습관|루틴|무리/);
  });

  test("선택 데이터가 없으면 domain 필드는 null", () => {
    const s = buildTemplateRecentStatus(
      emptyStats({
        avg7: 6,
        coreBest: { code: "energy", name: "에너지·활력", average: 7 },
        coreWorst: { code: "energy", name: "에너지·활력", average: 7 },
        best: { code: "energy", name: "에너지·활력", average: 7 },
        worst: { code: "energy", name: "에너지·활력", average: 7 },
      })
    );
    expect(s.domainGood).toBeNull();
    expect(s.domainWatch).toBeNull();
  });

  test("LLM JSON을 안전하게 정규화한다", () => {
    const fb = buildTemplateRecentStatus(emptyStats({ avg7: 5 }));
    const n = normalizeRecentStatus(
      {
        headline: "  오늘은 차분해요  ",
        coreGood: { label: "핵심 · 좋아요", value: "집중·실행", score: 7.55 },
        domainWatch: { label: "선택 · 아쉬워요", value: "수면·회복", score: 3 },
        advice: "산책을 짧게라도.",
      },
      fb
    );
    expect(n.headline).toBe("오늘은 차분해요");
    expect(n.coreGood?.score).toBe(7.6);
    expect(n.domainWatch?.value).toBe("수면·회복");
    expect(n.good?.value).toBe("집중·실행");
  });
});
