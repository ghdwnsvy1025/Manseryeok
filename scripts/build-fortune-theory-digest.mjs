/**
 * sajubase_final.md → 운세용 고정 이론 요약 생성
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "docs", "sajubase_final.md");
const mdOut = path.join(root, "knowledge", "saju", "fortune", "fortune_theory_digest.md");
const tsOut = path.join(
  root,
  "src",
  "lib",
  "journal",
  "fortune",
  "fortuneTheoryDigest.generated.ts"
);

const lines = fs.readFileSync(source, "utf8").split(/\r?\n/);

/** 1-indexed inclusive line ranges */
const ranges = [
  [17, 55],
  [100, 220],
  [310, 373],
  [379, 400],
  [3210, 3280],
  [3911, 4120],
  // 오행별 신체·물상 핵심 (건강 구체화)
  [1000, 1006],
  [1027, 1034],
  [1056, 1064],
  [1100, 1107],
  [1128, 1133],
  [8424, 8429],
];

/** sajubase 기반 압축 부록 — 운세 문장화용 (노이즈 키워드 제외) */
const APPENDIX = `
---
## 부록: 오늘의 운세 구체화 규칙 (sajubase 압축)

### 분석 계층 (코드 선계산)
- 원국 특징 1~5 · 오늘 운 특징 1~5 · 상호작용 1~5를 코드로 고정한 뒤 문장화한다.
- 일간 기준으로 십신을 다시 계산한다. 사례 결론을 다른 사주에 복사하지 않는다.
- 편관·방합을 무조건 흉·길로 보지 않는다. 긍정 활용과 주의를 함께 제시한다.
- 충·해는 사건 예언이 아니라 예민함·재확인 조언으로만 완화한다.

### 상담 톤
- 가능성과 경향으로만 말한다. "반드시" 금지.
- 건강은 의학적 진단이 아니라 명리적 경향·생활 관리 수준.
- 불안을 키우지 말고, 강점·주의·보완을 함께 제시한다.

### 오행 ↔ 신체 경향 (진단 아님, 예민/신호용)
- 목: 척추·뼈·소근육·간·담·췌장. 무리한 고정 자세·과긴장에 예민.
- 화: 심장·혈관·눈·열감. 과자극·늦은 화면·흥분 뒤 들뜸에 예민.
- 토: 피부·위·소화기관. 불규칙 식사·급하게 먹기·단 음식 과다에 예민.
- 금: 폐·기관지·대장·건조. 말하기 과부하·환기 부족·날카로운 긴장에 예민.
- 수: 뇌·정신 소모·생식기·방광·신장. 수면 붕괴·과로한 밤에 예민.
- 건강용신 힌트: 원국에서 가장 약한(극 당하는) 오행 쪽이 리듬이 깨일 때 먼저 신호 나기 쉽다.
- 표현: "아프다/병이다" 금지 → "예민해질 수 있다", "무리가 쌓이면 ~쪽이 먼저 신호 날 수 있다".

### 영역별 장면화 (핵심에만 1개)
- 종합: 하루를 관통하는 선택·속도·리듬 장면.
- 직장: 회의·마감·피드백·혼자 몰입.
- 대인: 부탁·조율·경계·눈치 대화.
- 연애: 연락 온도·기대 차·솔직한 한 문장.
- 재물: 충동 결제·고정비·불확실한 약속.
- 건강: 수면·식사·움직임이 깨질 때의 부위 신호.

### 근거 넣는 법
- 전문용어(십신·용신·격국)를 사용자 문장에 쓰지 않는다.
- "오늘 글자가 ~ 쪽으로 닿아", "원국에서 ~ 기운이 옅어"처럼 생활어 반 줄만.
- 예시·근거는 문장의 일부일 뿐, 전체를 채우지 않는다.
`.trim();

const parts = [
  "# 오늘의 운세용 고정 이론 요약",
  "출처: docs/sajubase_final.md (자동 추출)",
  "용도: 매 요청 고정 투입. RAG(관리자 문서)는 보조 검색만.",
  "",
];

for (const [a, b] of ranges) {
  parts.push("---");
  parts.push(`## 발췌 L${a}-${b}`);
  parts.push(lines.slice(a - 1, b).join("\n").trim());
  parts.push("");
}

parts.push(APPENDIX);
parts.push("");

let joined = parts.join("\n");
const MAX = 24000;
if (joined.length > MAX) {
  joined = `${joined.slice(0, MAX)}\n\n…(분량 제한으로 이하 생략)`;
}

fs.mkdirSync(path.dirname(mdOut), { recursive: true });
fs.writeFileSync(mdOut, joined, "utf8");

const version = "sajubase-fortune-digest-2026-07-31-analysis-facts";
const ts = [
  "/** Auto-generated fortune theory digest. Do not edit by hand. */",
  `export const FORTUNE_THEORY_DIGEST_VERSION = ${JSON.stringify(version)};`,
  `export const FORTUNE_THEORY_DIGEST: string = ${JSON.stringify(joined)};`,
  "",
].join("\n");

fs.writeFileSync(tsOut, ts, "utf8");
console.log(`digest chars=${joined.length}`);
console.log(`wrote ${mdOut}`);
console.log(`wrote ${tsOut}`);
