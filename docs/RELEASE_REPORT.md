# Release Report — Phase 6 — 최종 QA·출시 준비

> 마스터 Phase 8 대응 (서두만). 본문 명칭: **Phase 6 — 최종 QA·출시 준비**.

일자: 2026-07-21  
배포: **미실행** (문서·검증만)

---

## 최종 판정

**READY_PENDING_HUMAN_SMOKE**

| 축 | 상태 |
|----|------|
| App-wide production readiness | **pending_human_smoke** |
| 데이터 손실 위험 blocker | 없음 |
| 인증·RLS blocker | 없음 (재검증 통과) |
| 마이그레이션 blocker | 없음 (008·009·010 present) |
| 빌드 · lint · 핵심 브라우저 E2E | **통과** (Phase 6.1) |
| 신규 기능 전체 ON 출시 | **비권장** (보수적 플래그 권장) |

### 판정 이유

- Phase 6.1에서 lint · Playwright 핵심 흐름 · viewport/a11y 자동 스모크 · 보수적 플래그 검증을 마감.
- 실기기 터치·OAuth·만료 세션만 인간 체크리스트로 남음 → **READY_PENDING_HUMAN_SMOKE**.
- 세 등급만 쓸 경우: 기능·보안 blocker 0이므로 **READY** (보수적 플래그)에 가장 가깝다.

---

## 1. 기능 인벤토리 (구현 존재 여부)

| 기능 | 구현 | 비고 |
|------|------|------|
| 회원가입·로그인·로그아웃 | 있음 | `/diary/login`, `WelcomeAuthGate`, Supabase Auth |
| 인증 콜백·세션 | 있음 | `/auth/callback` |
| 기존 만세력 | 있음 | `/saju` |
| 기존 날짜 계산 | 있음 | `src/lib/saju/*` + 단위 테스트 |
| Legacy 행복도·기분·일기 | 있음 | `/diary/*`, `diary_entries` |
| 신규 journal 카테고리 | 있음 | `/journal/categories` + `NewDiaryGate` |
| journal CRUD | 있음 | `/journal` + supabaseStorage |
| 사건 태그 | 있음 | `journal_entry_tags` |
| astrology profile/snapshot/vector | 있음 | 009 + `src/lib/astrology/*` |
| Ridge 학습·평가·신뢰도 | 있음 | 010 + `src/lib/personalization/*` |
| journal stats | 있음 | `/journal/stats` |
| 일·주·월 분석 | 있음 | `/analysis/*` + assemble API |
| 결정론적 fallback | 있음 | `fallback.ts` / narrative OFF |
| LLM 서술 | 있음 | `/api/analysis/narrative` (플래그) |
| 관리자·RAG | 있음 | `/admin`, knowledge APIs |
| feature flag 경로 | 있음 | `featureFlags.ts` + gates |

문서만 있고 코드 없음: **없음** (인벤토리 기준).

---

## 2. 마이그레이션

| 파일 | additive | 재실행 | 원격 |
|------|----------|--------|------|
| 001–007 | 기존 | IF NOT EXISTS / DROP POLICY IF EXISTS | present |
| 008 journal | yes | seed upsert | **present** |
| 009 astrology | yes | yes | **present** |
| 010 personalization | yes | yes | **present** |

- DROP TABLE / 파괴적 ALTER: **없음**
- Schema drift (필수 테이블 부재): **미검출** (`verify-phase6-release-gate.mjs`)
- Rollback: 신규 테이블 DROP만 가능 — **자동 실행 금지**. `ROLLBACK_RUNBOOK.md`

---

## 3. 데이터 보존 (검증 스냅샷)

| 테이블 | 기준·재확인 |
|--------|-------------|
| diary_entries | **2 → 2** |
| journal_entries | 0 → 0 (테스트 cleanup 후) |
| category_scores | 0 |
| astrology_* | 0 (cleanup 후) |
| personalization_* | 0 (cleanup 후) |

실제 사용자 행 수정·삭제 없음. 테스트는 runId/marker + ephemeral user.

---

## 4. RLS·인증

| 검증 | 결과 |
|------|------|
| `verify-rls-cross-user.mjs` | **complete** (ephemeral A/B) |
| `verify-rls-personalization-010.mjs` | **complete** |
| 분석 e2e 교차 격리 | **complete** |
| service role 클라이언트 번들 | **미포함** (서버 `admin.ts`만) |
| anon 개인행 누출 | **미검출** |

---

## 5. 핵심 흐름

| 시나리오 | 검증 수준 | 결과 |
|----------|-----------|------|
| 신규 사용자 journal→snapshot→model→analysis | 스크립트 e2e | pass |
| 데이터 부족·early·degraded 노출 정책 | 단위 + Phase5 e2e | pass |
| Legacy 만세력·diary | 단위 회귀 테스트 | pass |
| 브라우저 회원가입·로그아웃 UX | **미자동화** | pending (수동) |

---

## 6–8. 플래그·LLM·모델

- 플래그 매트릭스·권장안: `FEATURE_FLAGS.md` · 아래 §16 요약
- LLM 안전·privacy: Phase 5 live + `privacyAudit` — **complete**
- 저장 모델 allowlist: training e2e — **complete**
- 운영 기본 LLM: **OFF**

---

## 9. 성능 (측정값)

`npm run build` First Load JS (대표):

| 경로 | Size | First Load |
|------|------|------------|
| shared | — | ~87.3 kB |
| `/` | 9.77 kB | ~317 kB |
| `/saju` | 18.4 kB | ~316 kB |
| `/diary` | 24 kB | ~327 kB |
| `/journal` | 7.36 kB | ~198 kB |
| `/analysis/daily` | 279 B | ~105 kB |

병목 후보: 홈·diary·saju 초기 JS. **심각 성능 결함으로 차단하지 않음.**  
LLM timeout: 12s (`narrative.ts`).

---

## 10. 접근성·사용성

- AnalysisGate / AnalysisViewPanel: `aria-label`, OFF 안내 문구 존재
- 색상만 상태: 부분적 — 텍스트 라벨 병행 권장 (known limitation)
- 키보드·모바일 실기기: **수동 체크리스트** (`RELEASE_CHECKLIST.md`)

---

## 11–12. 오류·백업

- 일기 저장 ≠ 학습/LLM 실패 결합: schedule 경로 fire-and-forget (dev warn만)
- 백업·롤백: `DEPLOYMENT_RUNBOOK.md` · `ROLLBACK_RUNBOOK.md`

---

## 13. 환경변수

`ENVIRONMENT_VARIABLES.md` 참고.  
**운영에 `TEST_USER_*` / 임시 JWT 금지.**

---

## 14. 테스트 결과 (이번 실행)

| 명령 | 결과 |
|------|------|
| `npm test` | **34 suites / 313 passed** (Phase 6.1) |
| `npm run build` | **성공** |
| `npm run lint` | **성공** (0 warning / 0 error) |
| `npm run test:e2e` | **18 passed** (Playwright Chromium) |
| typecheck | build 내장 통과 |
| 008 / 009 / 010 verify | ok / schema present |
| Phase 3 RLS | complete |
| Phase 4 RLS | complete |
| Phase 4 training e2e | complete |
| Phase 5 remote e2e | complete |
| Phase 5 live LLM | complete (별도 실행) |
| Phase 6 gate | complete |

---

## 15. 출시 등급

**READY_PENDING_HUMAN_SMOKE**  
(세 등급 매핑 시 **READY** — 보수적 플래그 · 실기기 수동만 잔여)

---

## 16. 권장 플래그

### 보수적 출시 (권장)

```bash
NEXT_PUBLIC_FF_LEGACY_MENU=false
NEXT_PUBLIC_FF_NEW_DIARY=true
NEXT_PUBLIC_FF_SAJU_SNAPSHOT=true
NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN=false
NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY=false
NEXT_PUBLIC_FF_NEW_ANALYSIS=true
NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM=false
FF_ANALYSIS_NARRATIVE_LLM=false
NEXT_PUBLIC_FF_ANALYSIS_CACHE=false
```

운영에 `NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS` **절대 넣지 말 것** (Playwright 전용).

### 전체 기능 출시 (검증 후 단계적)

```bash
NEXT_PUBLIC_FF_NEW_DIARY=true
NEXT_PUBLIC_FF_SAJU_SNAPSHOT=true
NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN=true
NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY=true
NEXT_PUBLIC_FF_NEW_ANALYSIS=true
NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM=true
FF_ANALYSIS_NARRATIVE_LLM=true
NEXT_PUBLIC_FF_ANALYSIS_CACHE=false
```

---

## Blocker / Known limitations

**Blocker: 0**

Known: `docs/KNOWN_LIMITATIONS.md`

---

## 사용자 수동 작업

1. 실기기 터치·키보드·OAuth (`RELEASE_CHECKLIST.md` §실기기)
2. 배포 전 DB 백업 · 행 수 기록
3. 운영 `.env`에 `TEST_USER_*` / `NEXT_PUBLIC_E2E_*` 넣지 않기
4. **실제 배포 승인**은 이 문서 외 별도 인간 승인

## 배포 전 마지막 명령

```bash
node scripts/verify-phase6-release-gate.mjs
npm run lint
npm test
npm run test:e2e
npm run build
```

## 배포 후 smoke

- `/` 로드 · `/saju` · `/diary` (Legacy)
- 플래그 ON 시 `/journal` · `/analysis/daily`
- 로그인·로그아웃
- `diary_entries` 행 수 불변 확인

## 최종 출시 승인

문서상 권고: **보수적 플래그로 스테이징·출시 가능 (READY_PENDING_HUMAN_SMOKE).**  
실기기 체크리스트만 남은 App-wide = **pending_human_smoke**.
