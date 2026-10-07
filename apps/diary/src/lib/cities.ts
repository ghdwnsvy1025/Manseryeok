// 브라우저에서도 쓰므로 엔진을 import하지 않는다.
/**
 * 출생지 = 17개 시·도 + "그 외/해외" (v3.6 온보딩). 이름·경도는 사주 코어(@saju/core-rules birth.ts LONGITUDE)와 같다 — 테스트가 표와 대조한다.
 * id는 DB(night_saju_profiles.city, text)에 저장되는 값이라 바꾸지 않는다. coreName = 코어 LONGITUDE 표의 출생지 이름(toBirthInput이 넘긴다).
 * "other"는 서울 기준(코어 fromBirth의 기본값과 같다).
 */
export const CITIES = [
  { id: "seoul", name: "서울", longitude: 126.98, coreName: "서울" },
  { id: "busan", name: "부산", longitude: 129.08, coreName: "부산" },
  { id: "daegu", name: "대구", longitude: 128.6, coreName: "대구" },
  { id: "incheon", name: "인천", longitude: 126.71, coreName: "인천" },
  { id: "gwangju", name: "광주", longitude: 126.85, coreName: "광주" },
  { id: "daejeon", name: "대전", longitude: 127.38, coreName: "대전" },
  { id: "ulsan", name: "울산", longitude: 129.31, coreName: "울산" },
  { id: "sejong", name: "세종", longitude: 127.29, coreName: "세종" },
  { id: "gyeonggi", name: "경기", longitude: 127.01, coreName: "경기" },
  { id: "gangwon", name: "강원", longitude: 127.73, coreName: "강원" },
  { id: "chungbuk", name: "충북", longitude: 127.49, coreName: "충북" },
  { id: "chungnam", name: "충남", longitude: 126.67, coreName: "충남" },
  { id: "jeonbuk", name: "전북", longitude: 127.15, coreName: "전북" },
  { id: "jeonnam", name: "전남", longitude: 126.46, coreName: "전남" },
  { id: "gyeongbuk", name: "경북", longitude: 128.73, coreName: "경북" },
  { id: "gyeongnam", name: "경남", longitude: 128.68, coreName: "경남" },
  { id: "jeju", name: "제주", longitude: 126.53, coreName: "제주" },
  { id: "other", name: "그 외 / 해외 (서울 기준)", longitude: 126.98, coreName: "서울" },
] as const;
export type CityId = (typeof CITIES)[number]["id"];
