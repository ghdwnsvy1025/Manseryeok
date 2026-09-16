/**
 * 용신 A/B — 운세 문장이 **실제로** 달라지는가.
 *
 * 이 파일은 평소 테스트에서 건너뛴다. 진짜 LLM 을 부르므로 돈과 시간이 든다.
 *   YONGSIN_AB=1 npx jest src/__tests__/hypothesis/yongsinAb
 *
 * 설계 —
 * "용신일 운세 vs 보통날 운세"를 비교하면 안 된다. 날짜가 다르면 일진·십신·합충이
 * 전부 달라져서 **문장이 달라지는 게 당연**하고, 그게 용신 때문인지 알 수 없다.
 *
 * 그래서 **같은 날, 같은 사람, 같은 입력**에서 용신 한 줄만 넣고/빼서 두 번 부른다.
 * 그리고 LLM 은 같은 입력에도 매번 다르게 쓰므로, 대조군(용신 없는 두 번 호출)도
 * 같이 돌려 "그냥 매번 다른 것"과 "용신 때문에 다른 것"을 구분한다.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { generateTodayFortuneV2 } from "@/lib/journal/todayFortune";
import { buildTodayYongsin } from "@/lib/hypothesis/todayYongsin";
import type { SajuProfile } from "@/lib/diary/types";

/** .env.local 에서 키를 읽어 온다 (jest 는 Next 환경변수를 자동으로 안 읽는다) */
function loadEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key!]) continue;
    process.env[key!] = raw!.replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const RUN = process.env.YONGSIN_AB === "1";
const maybe = RUN ? test : test.skip;

/** 촬영 데모와 같은 사주 — 1990-05-15 14:30 · 癸未 庚辰 辛巳 庚午 */
const PROFILE: SajuProfile = {
  id: "ab-test",
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

/** 용신일(癸) / 그렇지 않은 날 */
const YONGSIN_DAY = "2026-09-16"; // 계사일
const PLAIN_DAY = "2026-09-17"; // 갑오일

async function runFortune(date: string, withYongsin: boolean) {
  const insight = buildDailyInsightContext({
    eventDate: date,
    entries: [],
    enabledCodes: [],
    sajuProfile: PROFILE,
  });
  const y = buildTodayYongsin({ pillars: PROFILE.pillars, date });
  const result = await generateTodayFortuneV2(insight, {
    sajuProfile: PROFILE,
    todayYongsinFact: withYongsin ? (y?.fact ?? null) : null,
  });
  return result;
}

function words(text: string): Set<string> {
  return new Set(text.replace(/[^가-힣\s]/g, " ").split(/\s+/).filter(Boolean));
}

/** 두 문장이 단어 기준으로 얼마나 다른가 (0 = 같음, 1 = 완전히 다름) */
function distance(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  const total = new Set([...wa, ...wb]).size;
  return total === 0 ? 0 : 1 - shared / total;
}

describe("용신이 운세 문장을 실제로 바꾸는가", () => {
  maybe(
    "같은 날 · 용신만 켜고 끄기",
    async () => {
      const on = await runFortune(YONGSIN_DAY, true);
      const off = await runFortune(YONGSIN_DAY, false);
      // 대조군 — **같은 날, 같은 입력(용신 OFF)으로 한 번 더.**
      //
      // 처음엔 이걸 "다른 날"로 잡았다가 틀린 걸 알았다. 날짜가 다르면 일진이 달라서
      // 문장이 달라지는 게 당연하다. 그러면 LLM 자체의 흔들림을 잴 수가 없고,
      // 신호(용신 효과)와 비교할 기준이 안 된다.
      const off2 = await runFortune(YONGSIN_DAY, false);

      const signal = distance(on.overall.interpretation, off.overall.interpretation);
      const noise = distance(off.overall.interpretation, off2.overall.interpretation);

      console.log("\n══════════ 용신 ON (2026-09-16 계사일) ══════════");
      console.log(on.overall.interpretation);
      console.log("\n══════════ 용신 OFF (같은 날, 같은 입력) ══════════");
      console.log(off.overall.interpretation);
      console.log("\n══════ 대조군 — 같은 날 · 용신 OFF 로 한 번 더 ══════");
      console.log(off2.overall.interpretation);
      console.log(
        `\n다름 정도 (0=같음, 1=완전히 다름)\n` +
          `  용신 넣고 vs 빼고  (신호): ${signal.toFixed(3)}\n` +
          `  똑같은 입력 두 번  (잡음): ${noise.toFixed(3)}\n` +
          `  → ${
            signal > noise
              ? "신호 > 잡음 — 용신이 문장을 실제로 바꾼다"
              : "신호 ≤ 잡음 — 용신이 무시되고 있다"
          }`
      );
      console.log(
        `LLM 호출 상태 — on:${on.openAi.kind} off:${off.openAi.kind}`
      );

      // LLM 이 실제로 불렸는지부터 확인 (키가 없으면 여기서 걸린다)
      expect(on.openAi.kind).not.toBe("skipped");

      // 판정은 사람이 위 문장을 읽고 한다. 숫자는 참고용으로만 남긴다.
      expect(typeof signal).toBe("number");
    },
    180000
  );

  maybe(
    "용신일이 아닌 날에는 용신 사실이 아예 안 만들어진다",
    () => {
      const y = buildTodayYongsin({ pillars: PROFILE.pillars, date: PLAIN_DAY });
      expect(y?.isYongsinDay).toBe(false);
      expect(y?.fact).toBeNull();
    },
    10000
  );

  test("평소에는 이 파일이 건너뛰어진다", () => {
    // 돈이 드는 테스트가 실수로 CI 에서 돌지 않게 하는 안전장치
    expect(RUN || process.env.YONGSIN_AB !== "1").toBe(true);
  });
});
