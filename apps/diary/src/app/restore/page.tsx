import { safeNext } from "@/lib/safeNext";
import { RestoreChoices } from "./RestoreChoices";

export const dynamic = "force-dynamic";

/**
 * 세션 쿠키를 잃은 기기 (docs/ANON_START.md 8절). AnonBoot가 "이 기기에서 쓰던 계정" 기록을 보고 새 익명 계정을 만들기 전에 보낸다.
 * 세션을 읽지 않는다 — 무엇을 보일지는 브라우저의 기록(Google 계정이었는지)으로 RestoreChoices가 정한다.
 */
export default async function RestorePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-col gap-5">
      <RestoreChoices next={safeNext(next)} />
    </main>
  );
}
