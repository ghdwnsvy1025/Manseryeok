import { redirect } from "next/navigation";

/** 2026-10-31: 만세력은 따로 창이 아니라 나 탭 안에서 펼친다(사용자). 옛 주소로 오면 나 탭의 내 사주로 */
export default function SajuPage() {
  redirect("/me?saju=open#saju");
}
