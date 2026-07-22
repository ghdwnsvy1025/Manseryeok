import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { computeAstrologyFeatures, toFeatureVector } from "@/lib/astrology/compute";
import {
  resolveLuckOnlyRates,
  resolveNativeWithLuckRates,
  LUCK_BASE_WEIGHTS,
} from "@/lib/astrology/luckRates";
import {
  assertValidPillarChars,
  dayMasterFromStems,
  koToStemHanja,
  pillarsToStemBranchStrings,
} from "@/lib/astrology/pillars";
import { getTenGod } from "@/lib/saju/hiddenStems";
import { getBranchBaseDistribution } from "@/lib/saju/elementDistribution";
import { STEM_META } from "@/lib/saju/constants";
import {
  CALCULATION_VERSION,
  FEATURE_SCHEMA_VERSION,
  THEORY_VERSION,
} from "@/lib/astrology/versions";
import { MemoryAstrologyStorage } from "@/lib/astrology/memoryStorage";
import {
  buildAstrologyProfileFromSajuProfile,
  ensureAstrologySnapshot,
} from "@/lib/astrology/snapshot";
import { getFeatureFlags } from "@/lib/app/featureFlags";
import type { SajuProfile } from "@/lib/diary/types";
import golden from "./fixtures/golden.json";

function sampleProfile(userId: string | null = "user-a"): SajuProfile {
  return {
    id: "saju-1",
    userId,
    isPrimary: true,
    birthDate: "1990-05-15",
    birthTimeUnknown: false,
    birthHour: 14,
    birthMinute: 30,
    calendarType: "solar",
    timezone: "Asia/Seoul",
    dayChangeRule: "midnight",
    timeCorrection: "none",
    pillars: {
      hour: {
        stemHanja: "辛",
        branchHanja: "未",
        stemKo: "신",
        branchKo: "미",
        ganjiKo: "신미",
      },
      day: {
        stemHanja: "己",
        branchHanja: "丑",
        stemKo: "기",
        branchKo: "축",
        ganjiKo: "기축",
      },
      month: {
        stemHanja: "丙",
        branchHanja: "戌",
        stemKo: "병",
        branchKo: "술",
        ganjiKo: "병술",
      },
      year: {
        stemHanja: "乙",
        branchHanja: "亥",
        stemKo: "을",
        branchKo: "해",
        ganjiKo: "을해",
      },
    },
    calculationVersion: "0.1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: 5,
  };
}

describe("astrology versions sync with knowledge manifest", () => {
  test("versions.json 과 모듈 일치", () => {
    const p = path.join(
      process.cwd(),
      "knowledge/saju/manifests/versions.json"
    );
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(raw.calculationVersion).toBe(CALCULATION_VERSION);
    expect(raw.theoryVersion).toBe(THEORY_VERSION);
    expect(raw.featureSchemaVersion).toBe(FEATURE_SCHEMA_VERSION);
  });
});

describe("계산 단위 — 매핑·십신·분포", () => {
  test("천간 오행·음양", () => {
    expect(STEM_META[koToStemHanja("갑")!].element).toBe("wood");
    expect(STEM_META[koToStemHanja("갑")!].yinYang).toBe("yang");
    expect(STEM_META[koToStemHanja("을")!].yinYang).toBe("yin");
  });

  test("지지·지장간 기본 분포 합=1", () => {
    for (const b of ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"]) {
      const d = getBranchBaseDistribution(b);
      expect(d.목 + d.화 + d.토 + d.금 + d.수).toBeCloseTo(1, 10);
    }
  });

  test("십신 계산", () => {
    expect(getTenGod("己", "辛")).toBe("식신");
    expect(getTenGod("己", "丙")).toBe("정인");
  });

  test("오행 분포율 합계 ~100", () => {
    const r = computeAstrologyFeatures({
      stems: "신기병을",
      branches: "미축술해",
      calculationMode: "native_with_luck",
    });
    const sum =
      r.percentage.목 +
      r.percentage.화 +
      r.percentage.토 +
      r.percentage.금 +
      r.percentage.수;
    expect(sum).toBeCloseTo(100, 0);
  });

  test("잘못된 원국 거부", () => {
    expect(() => assertValidPillarChars("갑", "자")).toThrow();
    expect(() => assertValidPillarChars("신기병을", "미축술")).toThrow();
  });

  test("운 누락 시 native only rates", () => {
    const rates = resolveNativeWithLuckRates([]);
    expect(rates.original).toBe(1);
  });
});

describe("모드 재현성·분리", () => {
  const base = {
    stems: "신기병을",
    branches: "미축술해",
    daewoon: { stem: "신", branch: "오" },
    yearly: { stem: "갑", branch: "진" },
  } as const;

  test("native_with_luck 동일 입력 재현", () => {
    const a = computeAstrologyFeatures({
      ...base,
      calculationMode: "native_with_luck",
    });
    const b = computeAstrologyFeatures({
      ...base,
      calculationMode: "native_with_luck",
    });
    expect(a.percentage).toEqual(b.percentage);
    expect(a.luckMixRates).toEqual(b.luckMixRates);
  });

  test("luck_only 동일 입력 재현", () => {
    const a = computeAstrologyFeatures({
      ...base,
      calculationMode: "luck_only",
    });
    const b = computeAstrologyFeatures({
      ...base,
      calculationMode: "luck_only",
    });
    expect(a.percentage).toEqual(b.percentage);
  });

  test("두 모드 결과 분리", () => {
    const n = computeAstrologyFeatures({
      ...base,
      calculationMode: "native_with_luck",
    });
    const l = computeAstrologyFeatures({
      ...base,
      calculationMode: "luck_only",
    });
    expect(n.luckMixRates.original).toBeGreaterThan(0);
    expect(l.luckMixRates.original).toBe(0);
    expect(n.percentage).not.toEqual(l.percentage);
  });
});

describe("Golden fixtures (자료 B)", () => {
  test("GF rates and native percentage", () => {
    for (const fx of golden) {
      const result = computeAstrologyFeatures(fx.input as never);
      const exp = fx.expect.luckMixRates;
      expect(result.luckMixRates.original).toBeCloseTo(exp.original, 10);
      expect(result.luckMixRates.daewoon).toBeCloseTo(exp.daewoon, 10);
      expect(result.luckMixRates.yearly).toBeCloseTo(exp.yearly, 10);
      expect(result.luckMixRates.monthly).toBeCloseTo(exp.monthly, 10);
      expect(result.luckMixRates.daily).toBeCloseTo(exp.daily, 10);

      if (fx.expect.percentageEqualsOriginal) {
        expect(result.percentage).toEqual(result.originalPercentage);
      }
      if (fx.expect.originalPercentage) {
        const o = fx.expect.originalPercentage;
        expect(result.originalPercentage.목).toBeCloseTo(o.목, 2);
        expect(result.originalPercentage.화).toBeCloseTo(o.화, 2);
        expect(result.originalPercentage.토).toBeCloseTo(o.토, 2);
        expect(result.originalPercentage.금).toBeCloseTo(o.금, 2);
        expect(result.originalPercentage.수).toBeCloseTo(o.수, 2);
      }
    }
  });

  test("§13 예: 대운+세운만 원국40/대운40/세운20", () => {
    const r = resolveNativeWithLuckRates(["daewoon", "yearly"]);
    expect(r.original).toBeCloseTo(0.4, 10);
    expect(r.daewoon).toBeCloseTo(0.4, 10);
    expect(r.yearly).toBeCloseTo(0.2, 10);
    expect(LUCK_BASE_WEIGHTS.daewoon).toBe(50);
  });

  test("§14 예: luck_only 월+일", () => {
    const r = resolveLuckOnlyRates(["monthly", "daily"]);
    expect(r.original).toBe(0);
    expect(r.monthly).toBeCloseTo(12 / 18, 10);
    expect(r.daily).toBeCloseTo(6 / 18, 10);
  });
});

describe("스냅샷·프로필 통합", () => {
  test("프로필 생성·재조회", async () => {
    const storage = new MemoryAstrologyStorage();
    const profile = buildAstrologyProfileFromSajuProfile(sampleProfile());
    await storage.upsertProfile(profile);
    const again = await storage.getProfileByUser("user-a");
    expect(again?.dayMaster).toBe("기");
    expect(again?.sajuProfileId).toBe("saju-1");
  });

  test("동일 날짜 스냅샷 멱등", async () => {
    const storage = new MemoryAstrologyStorage();
    const saju = sampleProfile();
    const a = await ensureAstrologySnapshot({
      storage,
      userId: "user-a",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      sajuProfile: saju,
      luck: { daily: { stem: "임", branch: "자" } },
    });
    const b = await ensureAstrologySnapshot({
      storage,
      userId: "user-a",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      sajuProfile: saju,
      luck: { daily: { stem: "임", branch: "자" } },
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.snapshot.id).toBe(b.snapshot.id);
      expect(b.reused).toBe(true);
    }
  });

  test("버전 변경 시 새 스냅샷", async () => {
    const storage = new MemoryAstrologyStorage();
    const saju = sampleProfile();
    const a = await ensureAstrologySnapshot({
      storage,
      userId: "user-a",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      sajuProfile: saju,
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    // 다른 feature schema로 직접 insert
    await storage.insertSnapshot({
      ...a.snapshot,
      id: "other-ver",
      featureSchemaVersion: "saju-feature-mvp-9.9.9",
    });
    const found = await storage.findSnapshot({
      userId: "user-a",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      calculationVersion: CALCULATION_VERSION,
      featureSchemaVersion: "saju-feature-mvp-9.9.9",
    });
    expect(found?.id).toBe("other-ver");
  });

  test("사용자 격리", async () => {
    const storage = new MemoryAstrologyStorage();
    await ensureAstrologySnapshot({
      storage,
      userId: "user-a",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      sajuProfile: sampleProfile("user-a"),
    });
    await ensureAstrologySnapshot({
      storage,
      userId: "user-b",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      sajuProfile: sampleProfile("user-b"),
    });
    const aList = await storage.listSnapshotsByUser("user-a");
    const bList = await storage.listSnapshotsByUser("user-b");
    expect(aList).toHaveLength(1);
    expect(bList).toHaveLength(1);
    expect(aList[0]!.userId).toBe("user-a");
    expect(bList[0]!.userId).toBe("user-b");
  });

  test("일기 저장 성공 후 스냅샷 실패 허용(프로필 없음)", async () => {
    const storage = new MemoryAstrologyStorage();
    const result = await ensureAstrologySnapshot({
      storage,
      userId: "user-a",
      localDate: "2026-07-20",
      calculationMode: "native_with_luck",
      sajuProfile: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });

  test("숫자형 특징 벡터 분리", async () => {
    const r = computeAstrologyFeatures({
      stems: "신기병을",
      branches: "미축술해",
      calculationMode: "native_with_luck",
      daily: { stem: "임", branch: "자" },
    });
    const v = toFeatureVector(r);
    expect(v.wood).toBe(r.percentage.목);
    expect(v.axisPeer + v.axisOutput + v.axisWealth + v.axisAuthority + v.axisResource).toBeGreaterThanOrEqual(0);
    expect(Object.keys(v).length).toBeGreaterThan(10);
  });

  test("pillars 변환 시일월년", () => {
    const { stems, branches } = pillarsToStemBranchStrings(
      sampleProfile().pillars
    );
    expect(stems).toBe("신기병을");
    expect(branches).toBe("미축술해");
    expect(dayMasterFromStems(stems)).toBe("기");
  });
});

describe("feature flag OFF", () => {
  test("sajuFeatureSnapshotEnabled 기본 OFF", () => {
    expect(getFeatureFlags().sajuFeatureSnapshotEnabled).toBe(false);
  });
});
