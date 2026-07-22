# Phase 6 — 최종 QA·출시 준비 (+ Phase 6.1)

> **마스터 대응 (서두만):** 마스터 프롬프트 §14 Phase **8**.  
> 이후 명칭: **Phase 6 — 최종 QA·출시 준비**.  
> **Phase 6.1 — 출시 게이트 마무리** (2026-07-21): lint · Playwright · a11y/viewport · 보수적 플래그.

일자: 2026-07-21  
범위: 신규 제품 기능 없음. Phase 1–5 통합 검증 · 출시 품질 게이트.  
**실제 운영 배포는 자동 실행하지 않음.**

## 최종 판정 (요약)

| 항목 | 값 |
|------|-----|
| 출시 판정 | **READY_PENDING_HUMAN_SMOKE** |
| (세 등급만 쓸 때) | **READY** — 보수적 플래그 · 실기기 수동만 잔여 |
| App-wide production readiness | **pending_human_smoke** |
| Blocker (데이터·인증·RLS·빌드·lint·핵심 E2E) | **0** |

판정 근거·체크리스트·런북:  
`docs/RELEASE_REPORT.md` · `docs/RELEASE_CHECKLIST.md` · `docs/DEPLOYMENT_RUNBOOK.md` · `docs/ROLLBACK_RUNBOOK.md`

## Phase 6.1에서 한 일

1. ESLint (`eslint@8` + `eslint-config-next@14`) · `npm run lint` **0 error / 0 warning**
2. Playwright 최소 E2E · Chromium · **18 passed**
3. Viewport overflow + form/heading a11y 자동 스모크
4. `featureFlags.ts` — Next.js 정적 `NEXT_PUBLIC_*` 인라인 수정 + E2E 전용 override
5. 보수적 플래그 단위 테스트 + 브라우저 nav/분석 검증
6. `npm test` (313) · `npm run build` · `verify-phase6-release-gate.mjs`

## 남은 수동 (실기기) — blocker 아님

- 실제 폰 Safari/Chrome 터치·키보드
- OAuth Google 실계정 플로우
- 네트워크 불안정·만료 세션 UX 재현
- → `docs/RELEASE_CHECKLIST.md` §D·실기기

## Release gate 명령 (필수)

```bash
node scripts/verify-phase6-release-gate.mjs
npm run lint
npm test
npm run test:e2e
npm run build
```

선택(무거움 — Phase 6에서 이미 통과한 항목 재실행):

```bash
node scripts/verify-rls-cross-user.mjs
node scripts/verify-rls-personalization-010.mjs
node scripts/verify-personalization-training-e2e.mjs
node scripts/verify-analysis-remote-e2e.mjs
```
