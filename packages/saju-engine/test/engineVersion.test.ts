/**
 * ENGINE_VERSION 스냅숏 — 계산 결과가 바뀌었는데 버전을 안 올리면 여기서 깨진다.
 * 앱은 ENGINE_VERSION을 사주 프로필 스냅숏과 운세 캐시 지문에 넣으므로, 버전이 그대로면 옛 계산이 캐시에 남는다.
 *
 * 깨졌을 때: 의도한 변경이면 src/index.ts의 ENGINE_VERSION을 올리고 아래 FINGERPRINTS에 새 버전 줄을 더한다
 * (옛 줄은 기록으로 남긴다). 의도하지 않았으면 계산을 바꾼 커밋을 찾는다.
 */
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { ENGINE_VERSION, calculateSaju, lunarToSolar, solarTermsOfYear } from "../src/index";

const FINGERPRINTS: Record<string, string> = {
  "1.0.0": "2eebe4324076036f",
  // 2026-10-15: 음력을 한국천문연구원 음력(korean-lunar-calendar, 2050년까지)으로, 절입 시각을 寿星 고정밀 황경으로, 초 반올림 수정
  "1.1.0": "8ab0eba99426d3ae",
};

function fingerprint(): string {
  const h = createHash("sha256");
  // 1901-2099를 11일 간격으로 (1.0.0 때 1900년 초·2100년 끝이 대운 절기 범위 밖이라 뺐다. 옛 지문과 맞추려고 범위는 그대로 둔다), 하루 세 시각 (자정 직후·정오·자시) + 시간 모름
  for (let t = Date.UTC(1901, 0, 10); t < Date.UTC(2099, 11, 1); t += 11 * 86400000) {
    const d = new Date(t);
    const year = d.getUTCFullYear(), month = d.getUTCMonth() + 1, day = d.getUTCDate();
    for (const hm of [[0, 5], [12, 0], [23, 40], null] as const) {
      const r = calculateSaju({
        year, month, day,
        ...(hm ? { hour: hm[0], minute: hm[1] } : {}),
        gender: day % 2 ? "male" : "female",
        options: { calendarType: "solar", timezone: "Asia/Seoul", dayChangeRule: "midnight", timeCorrection: "none" },
      });
      const p = r.pillars;
      h.update(`${p.year.ganji}${p.month.ganji}${p.day.ganji}${p.hour?.ganji ?? "-"}${r.daeun?.startAge.years ?? ""}.${r.daeun?.startAge.months ?? ""}|`);
    }
  }
  for (let y = 1901; y < 2100; y += 3) {
    for (const m of [1, 4, 8, 11]) {
      try { h.update(lunarToSolar(y, m, 15, false).outputSolarString); } catch { h.update("x"); }
    }
    h.update(JSON.stringify(solarTermsOfYear(y)));
  }
  return h.digest("hex").slice(0, 16);
}

test("ENGINE_VERSION은 계산 결과 지문과 짝이 맞는다", () => {
  const fp = fingerprint();
  expect({ version: ENGINE_VERSION, fingerprint: fp }).toEqual({ version: ENGINE_VERSION, fingerprint: FINGERPRINTS[ENGINE_VERSION] });
}, 60_000);
