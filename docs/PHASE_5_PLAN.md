# Phase 5 Plan — 분석 UI·서술 (구현 전)

> **코드 변경 없음.** 승인 전 자동 구현하지 않음.  
> 일자: 2026-07-21  
> 전제: **Phase 4 — 개인화 Ridge MVP overall complete** · App-wide production readiness **pending**

---

## 1. 명칭과 마스터 대응

| 저장소 명칭 (사용) | 마스터 프롬프트 §14 | 관련 절 |
|--------------------|---------------------|---------|
| **Phase 5 — 분석 UI·서술** | **Phase 7: 분석 화면과 문장 생성** | §10 패턴 해석 · §11 분석 화면 · §0.7 수치/LLM 분리 |
| (참고) 마스터 “Phase 4: 일기 UI” | 이미 User Phase 2에서 대부분 완료 | — |
| (참고) 마스터 “Phase 5: 스냅샷” | User Phase 3 complete | — |
| (참고) 마스터 “Phase 6: 개인화” | User **Phase 4** complete | §9 |

이후 문서·보고서에는 숫자만 쓰지 말고 **`Phase 5 — 분석 UI·서술`** 을 함께 표기한다.

---

## 2. 목표

사용자에게 **일간·주간·월간 분석**을 제공하고,  
명리 이론 / 개인 기록 패턴 / 실천 제안을 **분리 표시**하며,  
상담·서술 LLM은 **이미 계산된 구조화 입력만** 받아 문장을 생성한다.  
LLM은 점수·계수·신뢰도 숫자를 만들지 않는다.

---

## 3. 사용자에게 보여줄 분석 UI 범위

### 포함

- 일간: 오늘 사주 흐름 요약(이론) · 선택 카테고리 오늘 기록 · 개인 기준 대비 높음/보통/낮음 · 유사 특징 과거일 3–5 · 당시 평균·대표 태그 · 신뢰도·표본 수 · 실천 제안 1–2
- 주간: 카테고리 7일 추세 · 기준선 편차 · 사건 태그 · 동반 패턴 상위 3 · 누락일
- 월간: 카테고리 평균·변동성 · 좋아진/흔들린 영역 · 특징별 평균 차이 · (허용 시) 기준선 대비 모델 성능 요약 · 신뢰도 변화
- 근거 패널: 사용 특징(키·버전) · 데이터 기간 · 표본 수 · 신뢰도 밴드 · 모델 상태

### 제외 (Phase 5)

- 원시 회귀계수 전체 · 디버그 JSON (개발자/관리자만)
- 확정 운세 점수 카드 · 의료/재정/사고 단정
- `predictionVisible: false` / degraded / insufficient 모델의 수치 예측 노출
- approximate 특징 기반 해석을 “검증됨”으로 표시

---

## 4. 명리 이론상 vs 개인 기록상 분리

마스터 §10 세 층 고정:

| 층 | 데이터 출처 | UI 라벨 예 |
|----|-------------|------------|
| 명리 이론상 | Phase 3 snapshot · verified 특징 · 이론 문구 템플릿/RAG | “이론상” |
| 내 기록상 | journal 점수 · 태그 · Phase 4 모델 요약(허용 시만) | “내 기록상” |
| 실천 제안 | 위 두 층의 **구조화 요약**만 입력으로 LLM 또는 템플릿 | “실천 제안” |

동일 화면에 섞어 한 문단으로 합치지 않는다. 각 층 카드/섹션 분리.

---

## 5. 상담·서술 AI 입력 데이터 계약 (초안)

LLM 입력은 일기 원문·생년월일 원본을 기본 금지(기존 앱 정책 유지). 허용 예:

```ts
type AnalysisNarrativeInput = {
  locale: "ko";
  horizon: "daily" | "weekly" | "monthly";
  localDateRange: { from: string; to: string };
  theoryLayer: {
    calculationVersion: string;
    theoryVersion: string;
    featureSchemaVersion: string;
    verifiedFeatureSummary: Array<{ key: string; label: string; note?: string }>;
    // approximate 는 eligibleForUserInterpretation=false 이면 제외 또는 "미검증" 플래그
  };
  recordLayer: {
    categoryKey: string;
    categoryLabel: string;
    validSampleCount: number;
    baseline: { weightedMean: number; coverage30d: number };
    recentScores?: Array<{ date: string; rawScore: number }>; // 필요 최소
    topTags?: string[];
    patternSummary?: string; // 서버가 만든 통계 문장(이미 안전 문구)
  };
  modelLayer: null | {
    modelStatus: "active";
    predictionVisible: true;
    confidenceScore: number;
    confidenceBand: string;
    dataStage: string;
    maeImprovement?: number;
    // coefficients 금지
  };
  safety: {
    forbidMedicalDiagnosis: true;
    forbidFinancialGuarantee: true;
    forbidDeterministicFate: true;
  };
};
```

`modelLayer`는 `modelStatus === "active" && predictionVisible === true` 일 때만 non-null.

---

## 6. 수치 계산 vs LLM 문장 분리

```
astrology snapshot + journal scores + (optional) personalization model
        → 서버 deterministic assembler (숫자·상태·허용 문구 슬롯)
                → NarrativeInput (위 계약)
                        → LLM (문장만) OR 템플릿 fallback
                                → UI 세 층 렌더
```

- Ridge·신뢰도·MAE·z-score: 기존 Phase 4 코드만  
- LLM: 숫자 필드 생성 금지 · 출력 스키마 검증(층별 문자열)  
- 실패 시: 이론/기록 층은 템플릿으로 표시, 상담 문장만 숨김

---

## 7. degraded / insufficient 노출 금지

| 상태 | UI |
|------|-----|
| `insufficient_data` | 기록 축적 안내만 |
| `insufficient_signal` / `degraded` | 예측·“내 기록상 모델 패턴” 숨김 · 기술통계(평균·개수)만 |
| `predictionVisible: false` | 예측 숫자·방향 문구 금지 |
| approximate-only 이론 | “검증된 학습 결과”로 표시 금지 |

상담 LLM `modelLayer`에 넣지 않음.

---

## 8. 근거·신뢰도·데이터 기간 표시

모든 분석 화면에 공통 푸터/사이드:

- 신뢰도 점수·밴드 (0–100, very_high도 확정 아님 고지)
- 유효 표본 수 · 최근 30일 coverage  
- 데이터 기간 (`trainingStartDate`–`trainingEndDate` 또는 조회 구간)  
- `calculationVersion` / `theoryVersion` / `featureSchemaVersion` / (있으면) `modelVersion`  
- “상관·동반 경향이며 원인·운명 단정 아님” 고정 고지

---

## 9. 일간·주간·월간 화면

| 화면 | 라우트(안) | 플래그 |
|------|------------|--------|
| 일간 | `/analysis` 또는 `/analysis/daily` | `NEXT_PUBLIC_FF_NEW_ANALYSIS` |
| 주간 | `/analysis/weekly` | 동일 |
| 월간 | `/analysis/monthly` | 동일 |

차트: 원점수와 개인기준 편차 **라벨 분리** (마스터 §11).

---

## 10. 결정론적 예언·의료·재정 단정 방지

금지 필터(서버+클라이언트):

- 반드시/무조건/운명 · 사고·사망·파산·진단·수익 보장  
- “이 사주라서 원인이다”  
- 건강: 생활 관리 수준만, 진단 금지  

출력 JSON schema + 금칙 정규식. 위반 시 재생성 1회 또는 템플릿 fallback.

---

## 11. 필요한 DB·API (초안, additive)

| 항목 | 내용 |
|------|------|
| Migration | 선택: `011_analysis_narrative_cache.sql` — 사용자×horizon×date 문장 캐시·입력 해시·모델 id 참조 (원본 journal 불변) |
| API | `POST /api/analysis/assemble` (수치 조립) · `POST /api/analysis/narrative` (LLM, 서버 전용 키) |
| 읽기 | 기존 journal / astrology / personalization 테이블 SELECT only |

필수 마이그레이션이 아니면 캐시 없이 시작 가능. 캐시 도입 시에도 diary_entries/journal 원문 미변경.

---

## 12. Feature flags

| 플래그 | 용도 |
|--------|------|
| `NEXT_PUBLIC_FF_NEW_ANALYSIS` | 분석 UI 노출 (기본 OFF) |
| (신설 권장) `FF_ANALYSIS_NARRATIVE_LLM` 서버 전용 | LLM 호출 ON/OFF — 꺼도 조립+템플릿 가능 |
| 기존 `PERSONALIZATION_DISPLAY` | “내 기록상” 모델 요약 연동 시 함께 고려 |

학습 플래그와 분석 표시는 계속 분리.

---

## 13. 테스트·QA 완료 조건

1. 세 층 UI 분리 스냅샷/컴포넌트 테스트  
2. degraded/insufficient 시 예측·modelLayer 미포함  
3. LLM mock: 숫자 필드 없음 · 금지키 필터  
4. 일/주/월 assembler 단위 테스트 (버전·표본·신뢰도 포함)  
5. approximate 특징이 “검증 패턴”으로 안 나옴  
6. 플래그 OFF 시 라우트 게이트  
7. journal/astrology/personalization 원본 불변  
8. Legacy·Phase 2–4 회귀 `npm test` · `npm run build`  
9. (캐시 마이그레이션 시) RLS·행 수 보존 스크립트  

Phase 5 production readiness는 위 + 원격 검증 후에만. App-wide는 Phase 8까지 pending 가능.

---

## 14. 생성·수정 예정 파일 (구현 시)

### 신규 (예상)

| 경로 | 역할 |
|------|------|
| `docs/PHASE_5_IMPLEMENTATION.md` | 구현 후 보고 |
| `src/lib/analysis/assemble*.ts` | 일/주/월 구조화 조립 |
| `src/lib/analysis/narrativeContract.ts` | 입력·출력 스키마 |
| `src/lib/analysis/safetyFilter.ts` | 금지키 |
| `src/app/analysis/**` | 일·주·월 페이지 |
| `src/components/analysis/**` | 세 층·근거·차트 |
| `src/app/api/analysis/**` | assemble / narrative |
| `src/__tests__/analysis/**` | 단위·계약 테스트 |
| (선택) `supabase/migrations/011_*.sql` | 서술 캐시 |

### 수정 (예상)

| 경로 | 역할 |
|------|------|
| `src/lib/app/featureFlags.ts` | analysis 게이트 연결 |
| `src/components/AppNav.tsx` | 분석 내비 |
| `docs/FEATURE_FLAGS.md` · `DATA_MODEL.md` · `QA_STATUS.md` | 갱신 |

### 비변경

- `diary_entries` / journal 원문·rawScore · astrology snapshot 파괴 변경  
- Phase 4 Ridge 공식의 LLM 대체  

---

## 15. 앱 전체 출시까지 남은 Phase

| 순서 | 저장소 명칭 | 마스터 | 상태 |
|------|-------------|--------|------|
| — | Phase 1–3 | 1–5 대응 | complete (기존) |
| — | Phase 4 — 개인화 Ridge MVP | Phase 6 | **complete** |
| **다음** | **Phase 5 — 분석 UI·서술** | Phase 7 | **계획만** |
| 이후 | Phase 6 — QA·출시 문서 (가칭) | Phase 8 | 미착수 |
| — | App-wide production readiness | — | **pending** |

마스터 Phase 8: 전체 체크리스트 · `RELEASE_REPORT.md` · 기술 부채.  
그 전까지 App-wide production readiness를 complete로 올리지 않는다.

---

## 구현 상태 (2026-07-21)

승인 후 구현됨 — 상세 `docs/PHASE_5_IMPLEMENTATION.md`.  
011 미추가 · Live LLM pending · Phase 5 production readiness pending.
