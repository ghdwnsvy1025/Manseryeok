import { redirect } from "next/navigation";

/** 잘못된 주소 `/diary/login/admin` → 관리자 로그인 진입점으로 안내 */
export default function DiaryLoginAdminRedirectPage() {
  redirect("/diary/login?next=/admin");
}
