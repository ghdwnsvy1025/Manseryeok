import type { EventTagDefinition } from "./types";

export const EVENT_TAG_CATALOG: EventTagDefinition[] = [
  { tagCode: "new_start", name: "새로운 시작", sortOrder: 1, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "achievement", name: "성과·칭찬", sortOrder: 2, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "conflict", name: "갈등", sortOrder: 3, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "meeting", name: "소개·만남", sortOrder: 4, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "income", name: "수입", sortOrder: 5, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "big_spend", name: "큰 지출", sortOrder: 6, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "exercise", name: "운동", sortOrder: 7, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "illness", name: "질병·통증", sortOrder: 8, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "travel", name: "여행·이동", sortOrder: 9, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "mistake", name: "실수·사고", sortOrder: 10, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "decision", name: "계약·결정", sortOrder: 11, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "rest", name: "휴식", sortOrder: 12, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "learning", name: "학습", sortOrder: 13, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "work_pressure", name: "업무 압박", sortOrder: 14, isActive: true, isSystem: true, schemaVersion: 1 },
  { tagCode: "family", name: "가족", sortOrder: 15, isActive: true, isSystem: true, schemaVersion: 1 },
];

export function getTagName(tagCode: string): string {
  return EVENT_TAG_CATALOG.find((t) => t.tagCode === tagCode)?.name ?? tagCode;
}

export function isKnownTagCode(tagCode: string): boolean {
  return EVENT_TAG_CATALOG.some((t) => t.tagCode === tagCode);
}
