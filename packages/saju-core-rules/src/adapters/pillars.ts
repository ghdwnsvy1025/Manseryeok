// 원본 아님 — 일기 앱(apps/diary) ↔ 코어 사이의 변환 어댑터. 판정 로직은 들어 있지 않다.
import type { Pillars } from "../base";

/** apps/diary/src/lib/profile.ts 의 PillarsSnapshot 과 같은 모양 (의존을 피하려고 구조만 따른다. `ko`는 쓰지 않음) */
export type PillarsSnapshotLike = {
  year: { stem: string; branch: string };
  month: { stem: string; branch: string };
  day: { stem: string; branch: string };
  hour: { stem: string; branch: string } | null | undefined;
};

/** 일기 앱의 사주 스냅샷(한자 stem/branch) → 코어의 Pillars(간지 문자열 4개 튜플, 시주 모르면 null) */
export function toCorePillars(s: PillarsSnapshotLike): Pillars {
  const g = (p: { stem: string; branch: string }) => p.stem + p.branch;
  return [g(s.year), g(s.month), g(s.day), s.hour ? g(s.hour) : null];
}
