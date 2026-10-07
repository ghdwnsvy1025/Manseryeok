import { PageSkeleton } from "@/components/PageSkeleton";

/** 로그인 화면 뼈대 — 루트 loading.tsx("오늘")가 대신 뜨지 않게 */
export default function Loading() {
  return <PageSkeleton title="이미 Google로 쓰던 분은" cards={1} />;
}
