/**
 * 질문·명언 문장화용 사주 힌트 — 원국×오늘을 짧게 잠근다.
 * 운세 본문을 복사하지 않고, 사람·날짜가 갈라지게만 쓴다.
 */
import type { SajuProfile } from "@/lib/diary/types";
import { buildNatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { buildNatalSignatures } from "@/lib/journal/fortune/natalSignatures";
import { buildFortuneLuckMaterials } from "@/lib/journal/fortune/luckMaterials";
import { buildDayStructureBrief } from "@/lib/journal/fortune/dayStructureBrief";

export type SajuWordingHints = {
  dayMasterKo: string | null;
  ganjiKo: string | null;
  todayStemGodPlain: string | null;
  natalSignatures: Array<{ title: string; body: string }>;
  dayContrast: string | null;
  moodLine: string | null;
  domainHookOverall: string | null;
};

export function buildSajuWordingHints(
  eventDate: string,
  sajuProfile: SajuProfile | null | undefined
): SajuWordingHints | null {
  if (!sajuProfile?.pillars?.day?.stemHanja) return null;

  const natalDay = buildNatalDayInsight(eventDate, sajuProfile);
  const luck = buildFortuneLuckMaterials(eventDate, sajuProfile);
  const brief = buildDayStructureBrief(
    eventDate,
    sajuProfile,
    natalDay,
    luck
  );
  const signatures = buildNatalSignatures(sajuProfile, natalDay);

  return {
    dayMasterKo: sajuProfile.pillars.day.stemKo ?? null,
    ganjiKo: natalDay?.ganjiKo ?? brief?.today.ganjiKo ?? null,
    todayStemGodPlain: brief?.today.stemGodPlain ?? null,
    natalSignatures: signatures.slice(0, 3).map((s) => ({
      title: s.title,
      body: s.body,
    })),
    dayContrast: brief?.dayContrast ?? null,
    moodLine: brief?.today.moodLine ?? null,
    domainHookOverall: brief?.domainHooks.overall ?? null,
  };
}
