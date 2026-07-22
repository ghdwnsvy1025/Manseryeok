"use client";

import { useEffect, useMemo, useState } from "react";
import ExpertInsightPanel from "@/components/saju/ExpertInsightPanel";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { todayDateString, getPillarsForDate } from "@/lib/diary/dayPillar";
import { loadPrimarySajuProfile } from "@/lib/diary/profileStorage";
import { buildExpertInsights } from "@/lib/saju/interpretation";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import { getTenGod } from "@/lib/saju/hiddenStems";
import { STEMS } from "@/lib/saju/constants";
import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";
import type { SajuResult } from "@/lib/saju/types";

type Props = {
  result: SajuResult;
};

/**
 * 기존 만세력 계산 결과는 변경하지 않고, 하단에 해석 레이어만 추가합니다.
 * 생년월일·일기 원문을 외부로 전송하지 않습니다.
 */
export default function ExpertInsightsForSaju({ result }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [profile, setProfile] = useState<SajuProfile | null>(null);

  useEffect(() => {
    void getDiaryStorage()
      .then((storage) => storage.list())
      .then((list) => setEntries(filterRealEntries(list)))
      .catch(() => setEntries([]));
    void loadPrimarySajuProfile().then(setProfile);
  }, []);

  const today = todayDateString();
  const dayPillar = useMemo(() => getPillarsForDate(today).dayPillar, [today]);

  const sections = useMemo(() => {
    const fromResult: SajuProfile | null = profile ?? {
      id: "from-result",
      isPrimary: true,
      birthDate: result.input.normalizedSolarDate,
      birthTimeUnknown: result.input.original.hour === undefined,
      calendarType: result.options.calendarType,
      timezone: result.options.timezone || "Asia/Seoul",
      dayChangeRule: result.options.dayChangeRule,
      timeCorrection: result.options.timeCorrection,
      pillars: {
        year: {
          stemHanja: result.pillars.year.stem.hanja,
          branchHanja: result.pillars.year.branch.hanja,
          stemKo: result.pillars.year.stem.ko,
          branchKo: result.pillars.year.branch.ko,
          ganjiKo: result.pillars.year.ganjiKo,
        },
        month: {
          stemHanja: result.pillars.month.stem.hanja,
          branchHanja: result.pillars.month.branch.hanja,
          stemKo: result.pillars.month.stem.ko,
          branchKo: result.pillars.month.branch.ko,
          ganjiKo: result.pillars.month.ganjiKo,
        },
        day: {
          stemHanja: result.pillars.day.stem.hanja,
          branchHanja: result.pillars.day.branch.hanja,
          stemKo: result.pillars.day.stem.ko,
          branchKo: result.pillars.day.branch.ko,
          ganjiKo: result.pillars.day.ganjiKo,
        },
        hour: result.pillars.hour
          ? {
              stemHanja: result.pillars.hour.stem.hanja,
              branchHanja: result.pillars.hour.branch.hanja,
              stemKo: result.pillars.hour.stem.ko,
              branchKo: result.pillars.hour.branch.ko,
              ganjiKo: result.pillars.hour.ganjiKo,
            }
          : null,
      },
      calculationVersion: "0.1.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 3,
    };

    return buildExpertInsights({
      dayPillar,
      sajuProfile: fromResult,
      entries,
      todayDate: today,
    });
  }, [dayPillar, profile, entries, today, result]);

  const groundingFacts = useMemo(() => {
    const natal = (profile ?? null)?.pillars.day ?? {
      stemHanja: result.pillars.day.stem.hanja,
      branchHanja: result.pillars.day.branch.hanja,
    };
    let tenGod: string | null = null;
    if (STEMS.includes(natal.stemHanja as (typeof STEMS)[number])) {
      const todayStem = dayPillar.stem.hanja as (typeof STEMS)[number];
      if (STEMS.includes(todayStem)) {
        tenGod = getTenGod(natal.stemHanja as (typeof STEMS)[number], todayStem);
      }
    }
    const relations = detectDayRelations({
      natalStemHanja: natal.stemHanja,
      natalBranchHanja: natal.branchHanja,
      todayStemHanja: dayPillar.stem.hanja,
      todayBranchHanja: dayPillar.branch.hanja,
    });
    return {
      ganjiKo: dayPillar.ganjiKo,
      heavenlyStem: dayPillar.stem.ko,
      earthlyBranch: dayPillar.branch.ko,
      tenGod,
      relationLabels: relations.map((r) => r.label),
      surface: "saju_expert" as const,
    };
  }, [dayPillar, profile, result]);

  return (
    <div className="space-y-3">
      <div className="p-3 border-2" style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}>
        <p className="ui-section-title">기존 만세력</p>
        <p className="ui-hint mt-1">
          위쪽의 원국·대운·세운·절기·십성·지장간·오행 정보는 기존 계산 결과 그대로입니다.
          아래는 별도 해석 레이어입니다. 관리자가 등록한 사주 이론이 있으면 해설 문장에 반영됩니다.
        </p>
      </div>
      <ExpertInsightPanel sections={sections} groundingFacts={groundingFacts} />
    </div>
  );
}
