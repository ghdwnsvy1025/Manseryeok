// 브라우저에서도 쓰므로 엔진을 import하지 않는다.
/** 레거시와 같은 출생지 (진태양시 보정에 경도를 쓴다). coreName = 사주 코어(@saju/core-rules birth.ts LONGITUDE)의 출생지 이름 */
export const CITIES = [
  { id: "seoul", name: "서울", longitude: 126.98, coreName: "서울" },
  { id: "busan", name: "부산", longitude: 129.08, coreName: "부산" },
  { id: "daegu", name: "대구", longitude: 128.6, coreName: "대구" },
  { id: "incheon", name: "인천", longitude: 126.71, coreName: "인천" },
  { id: "gwangju", name: "광주", longitude: 126.85, coreName: "광주" },
  { id: "daejeon", name: "대전", longitude: 127.38, coreName: "대전" },
  { id: "ulsan", name: "울산", longitude: 129.31, coreName: "울산" },
  { id: "jeju", name: "제주", longitude: 126.53, coreName: "제주" },
] as const;
export type CityId = (typeof CITIES)[number]["id"];
