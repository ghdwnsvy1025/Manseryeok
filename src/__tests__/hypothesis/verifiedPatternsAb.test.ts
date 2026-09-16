/**
 * verifiedDayPatterns A/B — 이 앱 컨셉의 심장이 실제로 작동하는가.
 *
 *   YONGSIN_AB=1 npx jest src/__tests__/hypothesis/verifiedPatternsAb
 *
 * 왜 이 검사가 급한가 —
 * 용신을 프롬프트 1.5번에 넣었더니 **입력에는 들어갔는데 문장은 안 바뀌었다.**
 * 13.8KB 짜리 입력 속 한 줄이라 모델이 다른 신호를 따라갔다.
 * `verifiedDayPatterns` 는 그 바로 위 0번 자리에 있고, 이 앱의 약속
 * ("쓸수록 정확해진다")이 통째로 여기 걸려 있다. 같은 병에 걸렸는지 확인해야 한다.
 *
 * 설계 — 켜고/끄기보다 **정반대 주장 두 개**가 훨씬 날카롭다.
 *   A: "집중·실행이 평소보다 1.5 **높았다**"
 *   B: "집중·실행이 평소보다 1.5 **낮았다**"
 * 같은 날, 같은 사람, 나머지 입력 100% 동일. 이 필드가 작동한다면 직장운 문장이
 * 반대로 갈라져야 한다. 안 갈라지면 무시되고 있는 것이다.
 *
 * 그리고 **같은 입력 두 번**을 따로 돌려 LLM 자체의 흔들림(잡음)을 재고 비교한다.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { generateTodayFortuneV2 } from "@/lib/journal/todayFortune";
import type { SajuProfile } from "@/lib/diary/types";

function loadEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]!]) continue;
    process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const RUN = process.env.YONGSIN_AB === "1";
const maybe = RUN ? test : test.skip;

const PROFILE: SajuProfile = {
  id: "ab-verified",
  isPrimary: true,
  birthDate: "1990-05-15",
  birthHour: 14,
  birthMinute: 30,
  birthTimeUnknown: false,
  calendarType: "solar",
  gender: "male",
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight",
  timeCorrection: "none",
  calculationVersion: "test",
  pillars: {
    hour: { stemHanja: "癸", branchHanja: "未", stemKo: "계", branchKo: "미", ganjiKo: "계미" },
    day: { stemHanja: "庚", branchHanja: "辰", stemKo: "경", branchKo: "진", ganjiKo: "경진" },
    month: { stemHanja: "辛", branchHanja: "巳", stemKo: "신", branchKo: "사", ganjiKo: "신사" },
    year: { stemHanja: "庚", branchHanja: "午", stemKo: "경", branchKo: "오", ganjiKo: "경오" },
  },
} as SajuProfile;

const DAY = "2026-09-17";

/** 실제 toFortuneFacts 가 만드는 것과 같은 모양의 문장 */
const HIGH = [
  "역할이 주어지는 날에 이 사람은 집중·실행이(가) 평소보다 1.5 높았다. 근거 14일.",
  "역할이 주어지는 날에 이 사람은 에너지·활력이(가) 평소보다 1.3 높았다. 근거 14일.",
];
const LOW = [
  "역할이 주어지는 날에 이 사람은 집중·실행이(가) 평소보다 1.5 낮았다. 근거 14일.",
  "역할이 주어지는 날에 이 사람은 에너지·활력이(가) 평소보다 1.3 낮았다. 근거 14일.",
];

async function run(verified: string[]) {
  const insight = buildDailyInsightContext({
    eventDate: DAY,
    entries: [],
    enabledCodes: [],
    sajuProfile: PROFILE,
  });
  return generateTodayFortuneV2(insight, {
    sajuProfile: PROFILE,
    verifiedDayFacts: verified,
  });
}

function words(text: string): Set<string> {
  return new Set(text.replace(/[^가-힣\s]/g, " ").split(/\s+/).filter(Boolean));
}

function distance(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  const total = new Set([...wa, ...wb]).size;
  return total === 0 ? 0 : 1 - shared / total;
}

function pick(r: Awaited<ReturnType<typeof run>>, domain: string): string {
  const d = r.domains.find((x) => x.domain === domain);
  return d ? `${d.headline} / ${d.interpretation}` : "(없음)";
}

describe("확인된 패턴이 운세를 실제로 바꾸는가", () => {
  maybe(
    "같은 날 · 정반대 주장 두 개",
    async () => {
      const high = await run(HIGH);
      const low = await run(LOW);
      // 잡음 — 똑같은 입력(HIGH)으로 한 번 더
      const high2 = await run(HIGH);

      const show = (label: string, r: Awaited<ReturnType<typeof run>>) => {
        console.log(`\n────────── ${label} ──────────`);
        console.log("[종합] ", r.overall.interpretation);
        console.log("[직장] ", pick(r, "work"));
      };

      show("A · 집중·에너지가 높았다고 알려줌", high);
      show("B · 집중·에너지가 낮았다고 알려줌", low);
      show("대조군 · A 와 똑같은 입력 한 번 더", high2);

      const signalOverall = distance(
        high.overall.interpretation,
        low.overall.interpretation
      );
      const noiseOverall = distance(
        high.overall.interpretation,
        high2.overall.interpretation
      );
      const signalWork = distance(pick(high, "work"), pick(low, "work"));
      const noiseWork = distance(pick(high, "work"), pick(high2, "work"));

      console.log(
        `\n다름 정도 (0=같음, 1=완전히 다름)\n` +
          `  종합운 — 반대 주장(신호): ${signalOverall.toFixed(3)} · 같은 입력(잡음): ${noiseOverall.toFixed(3)}\n` +
          `  직장운 — 반대 주장(신호): ${signalWork.toFixed(3)} · 같은 입력(잡음): ${noiseWork.toFixed(3)}\n` +
          `  → 종합운: ${signalOverall > noiseOverall ? "작동" : "무시됨"} · 직장운: ${signalWork > noiseWork ? "작동" : "무시됨"}`
      );
      console.log(`LLM 호출 — ${high.openAi.kind} / ${low.openAi.kind}`);

      expect(high.openAi.kind).not.toBe("skipped");
      expect(typeof signalWork).toBe("number");
    },
    240000
  );

  test("평소에는 건너뛴다", () => {
    expect(RUN || process.env.YONGSIN_AB !== "1").toBe(true);
  });
});
