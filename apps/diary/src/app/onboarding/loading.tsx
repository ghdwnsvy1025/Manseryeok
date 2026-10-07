import { PageSkeleton } from "@/components/PageSkeleton";

/** 온보딩 뼈대 — 루트 loading.tsx("오늘")가 대신 뜨지 않게 자기 제목을 둔다. Booting과 같은 제목·카드 수 */
export default function Loading() {
  return <PageSkeleton title="태어난 날을 적어요" cards={1} />;
}
