// 브라우저에서도 쓰므로 엔진을 import하지 않는다.
/** 레거시와 같은 출생지 (진태양시 보정에 경도를 쓴다) */
export const CITIES = [
  { id: "seoul", name: "서울", longitude: 126.98 },
  { id: "busan", name: "부산", longitude: 129.08 },
  { id: "daegu", name: "대구", longitude: 128.6 },
  { id: "incheon", name: "인천", longitude: 126.71 },
  { id: "gwangju", name: "광주", longitude: 126.85 },
  { id: "daejeon", name: "대전", longitude: 127.38 },
  { id: "ulsan", name: "울산", longitude: 129.31 },
  { id: "jeju", name: "제주", longitude: 126.53 },
] as const;
export type CityId = (typeof CITIES)[number]["id"];
