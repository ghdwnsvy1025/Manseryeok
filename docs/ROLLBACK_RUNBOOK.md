# Rollback Runbook — Phase 6 — 최종 QA·출시 준비

> 마스터 Phase 8 대응 (서두만).  
> **파괴적 rollback SQL을 자동 실행하지 말 것. 인간 승인 후 수동.**

## 즉시 완화 (코드 롤백 전)

1. **Feature flag 전체 OFF** (권장 1순위)

```bash
NEXT_PUBLIC_FF_NEW_DIARY=false
NEXT_PUBLIC_FF_SAJU_SNAPSHOT=false
NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN=false
NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY=false
NEXT_PUBLIC_FF_NEW_ANALYSIS=false
NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM=false
FF_ANALYSIS_NARRATIVE_LLM=false
NEXT_PUBLIC_FF_ANALYSIS_CACHE=false
```

→ 신규 라우트는 게이트/내비에서 비활성. Legacy `/saju`·`/diary` 유지.

2. **LLM만 장애** → `FF_ANALYSIS_NARRATIVE_LLM=false` (결정론 fallback)
3. **잘못된 모델** → `personalization_models.deprecated_at = now()` (해당 id만)
4. **잘못된 snapshot 버전** → 새 calculation/feature_schema 버전으로 재계산 후 구버전 무시 (삭제 신중)

## 앱 코드 롤백

- 이전 배포 아티팩트/Git 태그로 되돌림
- 환경변수 플래그는 OFF 유지한 채 검증

## DB 롤백 (최후 · 수동)

원칙: **001–007·diary_entries 불변.** 008–010은 additive.

| 마이그레이션 | 롤백 개념 | 위험 |
|--------------|-----------|------|
| 010 | `personalization_*` 테이블 DROP (데이터 손실) | 높음 |
| 009 | `astrology_*` DROP | 높음 |
| 008 | journal 계열 DROP (catalog seed 포함) | 높음 |

순서(필요 시): predictions/metrics → models → vectors → snapshots → profiles → tags/scores/journals → prefs.  
**운영 사용자 데이터 복구는 백업/PITR 책임. 테스트 MARKER 행만 스크립트 cleanup.**

## 복구 책임 범위

| 범위 | 담당 |
|------|------|
| 플래그 OFF·코드 롤백 | 앱 운영 |
| DB 백업 복원 | 인프라/Supabase 관리자 |
| 테스트 ephemeral 계정 | verify 스크립트만 |

## 금지

- 자동 `DROP TABLE`
- 실제 사용자 diary/journal 일괄 삭제
- service_role 키를 클라이언트에 노출한 채 롤백
