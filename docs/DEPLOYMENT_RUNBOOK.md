# Deployment Runbook — Phase 6 — 최종 QA·출시 준비

> 마스터 Phase 8 대응 (서두만).  
> **이 문서는 배포 절차 안내이며, 에이전트/스크립트가 운영 배포를 자동 실행하지 않는다.**

## 1. 사전 조건

- `RELEASE_REPORT.md` 판정 확인 (`READY_PENDING_HUMAN_SMOKE` / 세 등급 시 `READY` 이상)
- `RELEASE_CHECKLIST.md` A·C 자동 항목 통과 · 실기기(E) 가능한 범위 확인
- 스테이징에서 보수적 플래그 smoke 완료 (`npm run test:e2e` 또는 수동)

## 2. 배포 전 DB

1. Supabase Dashboard → 프로젝트 백업 / PITR 가능 여부 확인
2. 행 수 기록 (SQL 또는 `verify-phase6-release-gate.mjs` 출력 보관):

```text
diary_entries, journal_entries, category_scores,
astrology_profiles, astrology_snapshots, astrology_feature_vectors,
personalization_models, personalization_model_metrics, personalization_predictions
```

3. 미적용 마이그레이션이 있으면 **001→010 순서**로 SQL Editor에서 적용  
   - 이미 적용된 환경은 재실행 안전(IF NOT EXISTS / upsert seed)
   - **파괴적 rollback SQL 자동 실행 금지**

## 3. 앱 배포

1. 운영 환경변수 설정 (`ENVIRONMENT_VARIABLES.md`)
2. **TEST_USER_*** / 임시 JWT **넣지 않음**
3. Feature flag: 보수적 구성부터 (`FEATURE_FLAGS.md`)
4. `npm run build` 산출물 배포 (Vercel/자체 호스팅 등 — 환경별)
5. `npm start` 또는 플랫폼 기본 시작

## 4. 배포 직후 smoke

1. `/` 로드
2. `/saju` · `/diary`
3. 로그인 가능 여부
4. 플래그 ON 기능만 추가 확인 (`/journal` · `/analysis/daily`)
5. 행 수 재확인 · 에러 로그 스캔

### 배포 직전 권장 명령

```bash
node scripts/verify-phase6-release-gate.mjs
npm run lint
npm test
npm run test:e2e
npm run build
```

## 5. 장애 시

즉시 `ROLLBACK_RUNBOOK.md` — 1순위는 **feature flag 전체 OFF**.
