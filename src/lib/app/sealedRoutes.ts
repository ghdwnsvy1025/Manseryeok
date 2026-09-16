/**
 * 접은 화면 목록.
 *
 * 왜 지우지 않고 접는가 —
 * 이 화면들은 **이미 아무도 못 간다.** 앱 안에서 이리로 오는 링크가 하나도 없거나,
 * 있어도 그 링크가 있는 화면 자체가 못 가는 곳이다(죽은 섬).
 * 그래서 지운다고 사용자가 잃는 건 없지만, 코드에는 쓸 만한 게 남아 있다
 * (간지 도감·주간 집계·내일 예고 계산). 언젠가 새 화면에 옮겨 붙일 것들이다.
 *
 * 접는다 = **주소로 직접 들어와도 들여보내지 않고, 대신 갈 곳을 알려준다.**
 * 파일은 그대로 두고 플래그 하나로 되돌릴 수 있다.
 *
 * 여기 없는 것 —
 *   `/journal/stats`, `/saju/other` 는 링크가 0곳이었지만 **접지 않는다.**
 *   내용이 살아 있어서 새 탭 안으로 흡수하는 게 맞기 때문이다.
 *   (`/saju/other` → 나 탭, `/journal/stats` → 기록 탭)
 */

export type SealedRoute = {
  /** 접은 주소 (이 경로와 그 하위 전부) */
  path: string;
  /** 무엇이던 화면인가 */
  title: string;
  /** 지금은 어디서 볼 수 있는가 — 사용자에게 그대로 보여준다 */
  where: string;
  /** 보낼 곳 */
  href: string;
  /** 보낼 곳 버튼 문구 */
  hrefLabel: string;
};

/**
 * 접힘보다 우선하는 경로.
 * `/diary` 를 접지만 `/diary/login` 은 운영자 로그인 통로라 열어 둬야 한다.
 */
const KEEP_OPEN = ["/diary/login"];

export const SEALED_ROUTES: SealedRoute[] = [
  {
    path: "/diary",
    title: "예전 일기",
    where: "기록은 그대로 있어요. 지금은 '오늘' 탭에서 쓰고, '기록' 탭에서 봅니다.",
    href: "/journal",
    hrefLabel: "오늘 기록하러 가기",
  },
  {
    path: "/analysis",
    title: "분석 (일·주·월)",
    where: "주간 리포트로 합쳤어요. '기록' 탭의 달력 위에 있습니다.",
    href: "/stats",
    hrefLabel: "기록 탭으로 가기",
  },
  {
    path: "/forecast",
    title: "내일 예보",
    where:
      "지금은 매일 아침 '오늘의 운세'가 그 자리를 대신해요. 내일 예고는 준비 중입니다.",
    href: "/",
    hrefLabel: "오늘 화면으로 가기",
  },
];

/**
 * 이 주소가 접힌 곳인가.
 * 정확히 같거나, 그 아래 경로면 접힌 것으로 본다 (`/diary/stats` → `/diary`).
 * 긴 경로부터 확인해 더 구체적인 안내가 이기게 한다.
 */
export function findSealedRoute(pathname: string): SealedRoute | null {
  if (!pathname) return null;

  // 물음표·해시를 떼고, 끝의 슬래시도 정리한다
  const clean = pathname.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";

  for (const open of KEEP_OPEN) {
    if (clean === open || clean.startsWith(`${open}/`)) return null;
  }

  const sorted = [...SEALED_ROUTES].sort((a, b) => b.path.length - a.path.length);
  for (const route of sorted) {
    if (clean === route.path || clean.startsWith(`${route.path}/`)) return route;
  }
  return null;
}
