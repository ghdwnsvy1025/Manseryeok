# Feature Flags

**기본값 전부 OFF.**

## 모듈

`src/lib/app/featureFlags.ts`

## 플래그

| 키 | 환경변수 | 기본 | 단계 |
|----|----------|------|------|
| `legacyMenuEnabled` | `NEXT_PUBLIC_FF_LEGACY_MENU` | false | Phase 1+ (UI 미연결) |
| `newDiaryEnabled` | `NEXT_PUBLIC_FF_NEW_DIARY` | false | Phase 2 |
| `sajuFeatureSnapshotEnabled` | `NEXT_PUBLIC_FF_SAJU_SNAPSHOT` | false | Phase 3 |
| `personalizationTrainEnabled` | `NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN` | false | Phase 4 |
| `personalizationDisplayEnabled` | `NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY` | false | Phase 4 |
| `newAnalysisEnabled` | `NEXT_PUBLIC_FF_NEW_ANALYSIS` | false | Phase 5 |
| `analysisNarrativeLlmEnabled` | `NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM` | false | Phase 5 힌트 |
| (서버) | `FF_ANALYSIS_NARRATIVE_LLM` | false | Phase 5 LLM |
| `analysisCacheEnabled` | `NEXT_PUBLIC_FF_ANALYSIS_CACHE` | false | 예약 |

잘못된/없는 값 → false.

**Next.js 주의:** `NEXT_PUBLIC_*` 는 `process.env.NEXT_PUBLIC_FOO`처럼 **정적 참조**해야 클라 번들에 인라인된다.  
(`process.env[name]` 동적 접근은 클라이언트에서 비어 있을 수 있음.)

## Playwright 전용 (운영 금지)

| 키 | 환경변수 | 효과 |
|----|----------|------|
| (override) | `NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS` | 보수적 매트릭스 강제 (journal+snapshot+analysis ON · 개인화/LLM/cache OFF) |

`npm run test:e2e`가 `.env.development.local`에 기록한다. **운영·스테이징 영구 env에 넣지 말 것.**

## Phase 6 매트릭스 (기대)

| 조합 | 기대 |
|------|------|
| 전부 OFF | Legacy만 · journal/analysis 게이트 |
| journal만 ON | `/journal*` · snapshot/학습 OFF면 부가 작업 스킵 |
| snapshot만 ON | journal 저장 후 스냅샷 스케줄 |
| train ON / display OFF | 학습 가능 · stats 개인화 패널 OFF |
| train OFF / display ON | 저장된 모델 표시만 (학습 스케줄 OFF) |
| 분석 ON / LLM OFF | 결정론 문장 · LLM 미호출 |
| 분석 ON / LLM ON | 서술 API 호출 (서버 FF 필요) |
| 분석 OFF / LLM ON | assemble/narrative API 403 · 화면 게이트 |
| 캐시 OFF | 동작 동일 (캐시 미구현) |

## 출시 권장

### 보수적 (Phase 6 권장)

```bash
NEXT_PUBLIC_FF_NEW_DIARY=true
NEXT_PUBLIC_FF_SAJU_SNAPSHOT=true
NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN=false
NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY=false
NEXT_PUBLIC_FF_NEW_ANALYSIS=true
FF_ANALYSIS_NARRATIVE_LLM=false
NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM=false
NEXT_PUBLIC_FF_ANALYSIS_CACHE=false
```

### 전체 기능

journal+snapshot+train+display+analysis+LLM ON · cache는 필요 시만.

상세: `docs/RELEASE_REPORT.md`
