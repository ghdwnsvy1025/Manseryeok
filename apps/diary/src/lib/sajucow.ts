// 바이럴 사이트(사주카우, sajucow.com)로 가는 주소 (2026-10-31, 나 탭 만세력 화면). 서버·클라이언트 공용, 비밀 없음.
// 생년월일은 주소에 싣지 않는다(바이럴과 같은 원칙). 일주 카드 페이지는 일주 이름만으로 정해지는 공개 페이지라 그대로 보낸다.
// 넘어간 수는 바이럴 쪽 첫 유입 속성(?from=)으로 잰다.

export const SAJUCOW_ORIGIN = "https://sajucow.com";

/** 바이럴 card/<slug>/ 페이지의 slug (바이럴 cards.js에서 옮김, 60개) */
const CARD_SLUG: Record<string, string> = {
  갑자: "gapja", 을축: "eulchuk", 병인: "byeongin", 정묘: "jeongmyo", 무진: "mujin", 기사: "gisa", 경오: "gyeongo", 신미: "sinmi", 임신: "imsin", 계유: "gyeyu",
  갑술: "gapsul", 을해: "eulhae", 병자: "byeongja", 정축: "jeongchuk", 무인: "muin", 기묘: "gimyo", 경진: "gyeongjin", 신사: "sinsa", 임오: "imo", 계미: "gyemi",
  갑신: "gapsin", 을유: "eulyu", 병술: "byeongsul", 정해: "jeonghae", 무자: "muja", 기축: "gichuk", 경인: "gyeongin", 신묘: "sinmyo", 임진: "imjin", 계사: "gyesa",
  갑오: "gapo", 을미: "eulmi", 병신: "byeongsin", 정유: "jeongyu", 무술: "musul", 기해: "gihae", 경자: "gyeongja", 신축: "sinchuk", 임인: "imin", 계묘: "gyemyo",
  갑진: "gapjin", 을사: "eulsa", 병오: "byeongo", 정미: "jeongmi", 무신: "musin", 기유: "giyu", 경술: "gyeongsul", 신해: "sinhae", 임자: "imja", 계축: "gyechuk",
  갑인: "gapin", 을묘: "eulmyo", 병진: "byeongjin", 정사: "jeongsa", 무오: "muo", 기미: "gimi", 경신: "gyeongsin", 신유: "sinyu", 임술: "imsul", 계해: "gyehae",
};

const from = (at: string) => `from=diary&at=${at}`;

/** 내 일주의 조선시대 직업 카드 페이지. 모르는 일주면 첫 화면 */
export function sajucowCardUrl(ganjiKo: string, at = "saju"): string {
  const slug = CARD_SLUG[ganjiKo];
  return slug ? `${SAJUCOW_ORIGIN}/card/${slug}/?${from(at)}` : `${SAJUCOW_ORIGIN}/?${from(at)}`;
}

/** 궁합 — 바이럴 첫 화면(입력 → 결과 → 궁합) */
export function sajucowHomeUrl(at = "saju"): string {
  return `${SAJUCOW_ORIGIN}/?${from(at)}`;
}

/** 유료 전체 풀이 (사주 코어). 결제가 닫혀 있으면 초대 코드가 있어야 열린다 */
export function sajucowReadingUrl(at = "saju"): string {
  return `${SAJUCOW_ORIGIN}/saju/?${from(at)}`;
}

/** 카카오톡 채널 친구 추가 — 결제가 열리면 알림 (바이럴 config kakaoChannelUrl과 같은 채널) */
export const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_WJJxiX";

/** 유료 풀이 가격 (바이럴 config paidPrice, 2026-10-12 결정) */
export const PAID_PRICE = 2900;

/**
 * 결제가 열렸는지 — 바이럴 GET /api/saju/pay/ ({ open }). 서버에서 5분 캐시로 묻는다(CORS 없음).
 * 묻지 못하면 닫힘으로 본다 — 닫혀 있는데 결제로 보내는 것보다 알림 받기가 안전하다.
 */
export async function paidReadingOpen(): Promise<boolean> {
  try {
    const r = await fetch(`${SAJUCOW_ORIGIN}/api/saju/pay/`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return false;
    const j = (await r.json()) as { open?: unknown };
    return j.open === true;
  } catch {
    return false;
  }
}
