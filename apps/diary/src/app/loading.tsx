import { PageSkeleton } from "@/components/PageSkeleton";

/** 오늘 탭 뼈대 — 탭을 누르는 즉시 보인다 (전수조사 A-3). 제목 "오늘" + 운세·기록 카드 자리 2장 */
export default function Loading() {
  return <PageSkeleton title="오늘" cards={2} />;
}
