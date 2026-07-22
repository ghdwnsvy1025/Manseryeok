# RLS Cross-User Verification

앱 인증: `@supabase/supabase-js` + `signInWithPassword`.  
사용자 access token만 사용. anon/service_role ≠ 사용자 JWT.  
service_role: baseline·cleanup 보조만.  
빈 테이블 `count=0`만으로 RLS 통과 판정하지 않음.

---

## Phase 4 — 개인화 Ridge MVP · **complete**

| 항목 | 값 |
|------|-----|
| 스키마 | `node scripts/verify-personalization-010.mjs` |
| 교차 RLS | `node scripts/verify-rls-personalization-010.mjs` |
| 학습 e2e (저장 모델 + B→A) | `node scripts/verify-personalization-training-e2e.mjs` |
| 계정 | `TEST_USER_A/B_*` (Phase 3과 동일) |
| diary_entries | **2 → 2** |
| failures (e2e) | **0** |
| cleanup 오류 | 없음 |
| Cross-user RLS | **complete** |
| Remote stored-model allowlist audit | **complete** (실제 저장 모델) |
| Phase 4 production readiness | **complete** (개인화·DB 범위) |
| App-wide production readiness | **pending** |

### 확인 시나리오 (개인화)

1. A/B 자기 model · metrics · prediction CRUD  
2. A↔B 조회·수정·삭제 차단  
3. 익명 조회·생성·수정·삭제 차단  
4. e2e에서 B가 A 모델 조회 불가  
5. cleanup 후 기존 diary/journal/astrology 행 수 유지  

절차: `docs/PHASE_4_REMOTE_VERIFICATION.md`

---

## Phase 3 — journal + astrology · **complete**

| 항목 | 값 |
|------|-----|
| runId | `rls_1784630715103_54e56b` |
| 명령 | `node scripts/verify-rls-cross-user.mjs` |
| diary_entries | **2 → 2** |
| failures | **0** |
| remoteRlsVerification | **complete** |

스크립트 `productionReady: true` = **해당 Phase DB·RLS 게이트**만. 앱 전체 출시와 동일시하지 않음.

### 재실행

```bash
TEST_USER_A_EMAIL=...
TEST_USER_A_PASSWORD=...
TEST_USER_B_EMAIL=...
TEST_USER_B_PASSWORD=...

node scripts/verify-rls-cross-user.mjs
node scripts/verify-rls-personalization-010.mjs
```
