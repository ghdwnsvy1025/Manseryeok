import { PageSkeleton } from "@/components/PageSkeleton";

/** 내 카드 공개 화면 뼈대 — 루트 loading.tsx("오늘")가 대신 뜨지 않게 */
export default function Loading() {
  return <PageSkeleton title="당신의 카드는" cards={1} />;
}
