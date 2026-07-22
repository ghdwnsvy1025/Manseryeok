# Phase 4 — 개인화 Ridge MVP · Remote Verification

> 로컬 구현은 complete. 이 문서는 **원격 010 적용·검증만** 다룬다.  
> 상담 AI / 다음 Phase는 원격 검증 완료 전까지 시작하지 않는다.

## 상태 축

| 축 | 상태 |
|----|------|
| Local implementation | **complete** |
| Local verification | **complete** |
| Remote migration | **complete** |
| Schema verification | **complete** |
| Existing data preservation | **complete** |
| Cross-user RLS verification | **complete** |
| Remote training pipeline | **complete** (`verify-personalization-training-e2e.mjs`) |
| Phase 4 production readiness | **complete** (개인화·DB 범위만) |
| 앱 전체 production readiness | **pending** |

`Phase 4 production readiness: complete` = 개인화 모델·DB 범위만. 앱 출시 ≠ complete.  
상담 AI / 다음 Phase는 자동 진행하지 않는다.

---

## 적용 전 (필수)

SQL Editor에서 기준 행 수를 기록하고 `.env.local`에 넣는다 (커밋 금지).

```sql
select count(*) as diary_entries_count from public.diary_entries;
select count(*) as journal_entries_count from public.journal_entries;
select count(*) as astrology_snapshots_count from public.astrology_snapshots;
```

```bash
# .env.local
BASELINE_DIARY_ENTRIES=2
BASELINE_JOURNAL_ENTRIES=<기록값>
BASELINE_ASTROLOGY_SNAPSHOTS=<기록값>

# 교차 RLS (Phase 3 A/B 계정 재사용)
TEST_USER_A_EMAIL=...
TEST_USER_A_PASSWORD=...
TEST_USER_B_EMAIL=...
TEST_USER_B_PASSWORD=...
```

---

## 010 적용

1. 파일: `supabase/migrations/010_personalization_models.sql`
2. Supabase Dashboard → SQL Editor → 전체 붙여넣기 → Run  
3. 파괴적 DROP/DELETE 금지

### 적용 직후 카탈로그 SQL (RLS enable + policy)

```sql
select
  to_regclass('public.personalization_models') as personalization_models,
  to_regclass('public.personalization_model_metrics') as personalization_model_metrics,
  to_regclass('public.personalization_predictions') as personalization_predictions;

select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'personalization_models',
    'personalization_model_metrics',
    'personalization_predictions'
  );
-- 기대: relrowsecurity = true

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename like 'personalization_%';
-- 기대: 각 테이블 Users manage own … 정책

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'personalization_models_run_key_uidx';

-- 원본 불변
select count(*) from public.diary_entries;
select count(*) from public.journal_entries;
select count(*) from public.astrology_snapshots;
```

---

## 검증 명령 (순서)

```bash
# 1) 스키마 · 컬럼 · 008/009 유지 · 행 수 보존 · training_run_key · feature_keys · service vs anon
node scripts/verify-personalization-010.mjs

# 2) 교차 사용자 RLS (빈 테이블 0건 ≠ 통과 — 실제 insert 후 격리 확인)
node scripts/verify-rls-personalization-010.mjs
```

### `verify-personalization-010.mjs` 확인 항목

1. `personalization_models` 존재  
2. `personalization_model_metrics` 존재  
3. `personalization_predictions` 존재  
4. 필수 컬럼  
5. RLS: PostgREST로 `relrowsecurity` 직접 조회 불가 → **위 SQL + anon insert 차단 프로브**; 소유 정책은 RLS 스크립트  
6. 사용자별 정책 → RLS 스크립트에서 증명  
7. `training_run_key` 유일성 (중복 insert 거부)  
8. 모델 버전 병존 (다른 run key 2행)  
9. 동일 학습 조건 중복 방지 (=7)  
10–12. `diary_entries` / `journal_entries` / `astrology_snapshots` vs `BASELINE_*`  
13. 008·009 테이블 유지  
14. 저장 `feature_keys` ⊆ 허용 후보 · 원국 단독 키 금지  
15. **serviceRole** vs **anon** 카운트·insert 결과를 분리 출력  

빈 테이블 `count=0`만으로 RLS complete 판정하지 않음.  
`modelsScanned: 0` / `complete_vacuous_no_models` 만으로 원격 allowlist 준수를 완료로 보지 않음.

### `verify-personalization-training-e2e.mjs` (원격 학습 스모크)

빈 모델 테이블 감사의 공백을 메운다. **실제** `trainCategoryModel` → `runPersonalizationTrainingPipeline` → DB 저장.

```bash
# .env.local: TEST_USER_A/B EMAIL+PASSWORD (Phase 3 계정)
node scripts/verify-personalization-training-e2e.mjs
```

확인 항목: Ridge 호출 · models/metrics/(조건부) predictions 저장 · feature_keys allowlist · approximate 주입 거부 · 버전 필드 · MAE · duplicate run · 병존 · B→A 차단 · marker cleanup · diary/journal/astrology 행 수 불변.

출력의 `remoteTrainingPipelineVerification` 과 `phase4ProductionReadiness` 가 둘 다 `"complete"` 일 때만 Phase 4 production readiness 완료.  
`appWideProductionReadiness` 는 항상 `"pending"`.

---

## 최종 판정 규칙

| 축 | complete 조건 |
|----|----------------|
| Remote migration | 010 테이블 존재 |
| Schema verification | 컬럼·unique·병존·008/009 OK |
| Existing data preservation | BASELINE_* 일치 |
| Cross-user RLS verification | `verify-rls-personalization-010` ok |
| Approximate feature exclusion (local) | 학습 게이트 거부/제외 |
| Approximate feature exclusion (remote stored-model audit) | **e2e 스모크** 저장 `feature_keys` 감사 |
| Remote training pipeline | **`verify-personalization-training-e2e.mjs` complete** |
| **Phase 4 production readiness** | migration·schema·preservation·RLS·e2e(allowlist 포함) 모두 complete |
| 앱 전체 production readiness | 항상 별도 — Phase 4만으로 complete 금지 |

통과 시 `docs/QA_STATUS.md` 의 Phase 4 원격 축만 갱신하고, 상담 AI는 시작하지 않는다.
