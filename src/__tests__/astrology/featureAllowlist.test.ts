import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildFeatureCatalog,
  isElementDistributionApproximate,
  listExcludedFromTraining,
  pickTrainingFeatures,
} from "@/lib/astrology/featureAllowlist";
import { computeAstrologyFeatures, toFeatureVector } from "@/lib/astrology/compute";
import {
  buildDateRangeRecomputeCommand,
  buildUserRecomputeCommand,
} from "@/lib/astrology/recompute";

describe("feature allowlist — Phase 4 training gate", () => {
  test("월·일운 포함 시 element % 는 approximate·학습 제외", () => {
    expect(
      isElementDistributionApproximate({
        calculationMode: "native_with_luck",
        daily: { stem: "임", branch: "자" },
      })
    ).toBe(true);

    const excluded = listExcludedFromTraining({
      elementDistributionApproximate: true,
    });
    expect(excluded).toEqual(
      expect.arrayContaining(["wood", "fire", "earth", "metal", "water"])
    );
    expect(excluded).not.toContain("original_rate");
    expect(excluded).not.toContain("tenGod_비견");
  });

  test("원국만이면 element % 학습 허용", () => {
    expect(
      isElementDistributionApproximate({
        calculationMode: "native_with_luck",
      })
    ).toBe(false);
    const catalog = buildFeatureCatalog({
      elementDistributionApproximate: false,
    });
    expect(catalog.find((c) => c.key === "wood")?.eligibleForTraining).toBe(
      true
    );
  });

  test("pickTrainingFeatures 가 wood 를 근사 시 제거", () => {
    const r = computeAstrologyFeatures({
      stems: "신기병을",
      branches: "미축술해",
      calculationMode: "native_with_luck",
      daily: { stem: "임", branch: "자" },
    });
    expect(r.elementDistributionStatus).toBe("approximate");
    expect(r.parity.elementPercentage).toBe("approximate");
    expect(r.parity.luckMixRates).toBe("verified");

    const v = toFeatureVector(r);
    const picked = pickTrainingFeatures(v, {
      elementDistributionApproximate: true,
    });
    expect(picked.wood).toBeUndefined();
    expect(picked.original_rate).toBeDefined();
    expect(picked.yinRatio).toBeDefined();
  });

  test("luck_only 다수 운도 element approximate", () => {
    const r = computeAstrologyFeatures({
      stems: "신기병을",
      branches: "미축술해",
      calculationMode: "luck_only",
      daewoon: { stem: "신", branch: "오" },
      yearly: { stem: "갑", branch: "진" },
    });
    expect(r.elementDistributionStatus).toBe("approximate");
  });
});

describe("theory hash integrity", () => {
  test("manifest sha256 matches docs/sajubase_final.md", () => {
    const file = path.join(process.cwd(), "docs/sajubase_final.md");
    const manifestPath = path.join(
      process.cwd(),
      "knowledge/saju/manifests/versions.json"
    );
    const buf = fs.readFileSync(file);
    const sha = crypto.createHash("sha256").update(buf).digest("hex");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.canonicalSource.sha256).toBe(sha);
    expect(manifest.canonicalSource.canonicalSourcePath).toBe(
      "docs/sajubase_final.md"
    );
    expect(manifest.theoryVersion).toBe("sajubase-final-2026-07-19");
    expect(manifest.sections.calculationApproximate.length).toBeGreaterThan(0);
    expect(manifest.phase3Status.phase3Overall).toBe("complete");
    expect(manifest.phase3Status.remoteMigration).toBe("complete");
    expect(manifest.phase3Status.remoteRlsVerification).toBe("complete");
    expect(manifest.phase3Status.phase4Readiness).toBe("ready");
    expect(manifest.phase3Status.appWideLaunchReadiness).toBe("not_claimed");
    expect(manifest.phase3Status.rlsRunId).toBe("rls_1784630715103_54e56b");
  });
});

describe("recompute commands", () => {
  test("날짜·사용자 명령은 journalImmutable", () => {
    const d = buildDateRangeRecomputeCommand("2026-01-01", "2026-01-31");
    const u = buildUserRecomputeCommand("user-a");
    expect(d.journalImmutable).toBe(true);
    expect(u.journalImmutable).toBe(true);
    expect(d.plan.deprecateOlderVersions).toBe(true);
  });
});
