import { createDiaryEntry } from "@/lib/diary/createEntry";
import type { DiaryEntry } from "@/lib/diary/types";
import type { MockPersonaId } from "./users";
import { MOCK_PERSONAS } from "./users";

function shiftDate(base: string, daysBack: number): string {
  const d = new Date(`${base}T12:00:00+09:00`);
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SAMPLE_TAGS = ["성취", "휴식", "부담", "몰입", "걱정"] as const;
const SAMPLE_AREAS = ["일", "관계", "나 자신", "건강·컨디션"] as const;

/** 개발·스토리용 목업 일기. 운영 저장소에 쓰지 마세요. */
export function buildMockDiaryEntries(
  personaId: MockPersonaId,
  todayDate = "2026-07-20"
): DiaryEntry[] {
  const persona = MOCK_PERSONAS.find((p) => p.id === personaId);
  const count = persona?.recordCount ?? 0;
  if (count === 0) return [];

  const entries: DiaryEntry[] = [];
  for (let i = 0; i < count; i++) {
    const date = shiftDate(todayDate, i);
    const happiness = ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    const energy = (((i % 4) + 1) as 1 | 2 | 3 | 4);
    const focus = (((i % 5) + 1) as 1 | 2 | 3 | 4 | 5);
    entries.push(
      createDiaryEntry(date, `목업 기록 ${i + 1}일째. 오늘의 장면 메모.`, {
        happinessRating: happiness,
        happinessSource: "selected",
        energyRating: energy,
        focusRating: focus,
        conditionRating: happiness,
        primaryArea: SAMPLE_AREAS[i % SAMPLE_AREAS.length],
        tags: [SAMPLE_TAGS[i % SAMPLE_TAGS.length]],
        emotions: happiness >= 4 ? ["기쁨"] : happiness <= 2 ? ["불안"] : ["평온"],
        dataOrigin: "user",
        emotionSource: "selected",
        inputMode: "scores",
      })
    );
  }
  return entries;
}

export const MOCK_DIARY_BY_PERSONA: Record<MockPersonaId, DiaryEntry[]> = {
  new_user: buildMockDiaryEntries("new_user"),
  records_5: buildMockDiaryEntries("records_5"),
  records_15: buildMockDiaryEntries("records_15"),
  records_35: buildMockDiaryEntries("records_35"),
  records_60: buildMockDiaryEntries("records_60"),
  no_saju: buildMockDiaryEntries("no_saju"),
  diary_mode: buildMockDiaryEntries("diary_mode"),
  saju_mode: buildMockDiaryEntries("saju_mode"),
  study_mode: buildMockDiaryEntries("study_mode"),
};
