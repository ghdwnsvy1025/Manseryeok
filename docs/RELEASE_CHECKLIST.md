# Release Checklist — Phase 6 / 6.1

> 마스터 Phase 8 대응 (서두만).

## A. 자동 release gate (필수)

- [x] `node scripts/verify-phase6-release-gate.mjs` → `releaseGateSchema: complete` (Phase 6.1 재실행)
- [x] `npm run lint` → 0 error / 0 warning
- [x] `npm test` → 313 passed
- [x] `npm run test:e2e` → 18 passed (Playwright)
- [x] `npm run build` → success
- [ ] (배포 직전 재실행) `verify-rls-cross-user.mjs` / `verify-rls-personalization-010.mjs`
- [ ] (배포 직전 재실행) training / analysis remote e2e
- [ ] (선택) live LLM narrative

## B. 데이터 보존

- [x] gate 스냅샷: `diary_entries` = 2 유지 · journal cleanup 후 0
- [ ] 배포 전·후 행 수 재기록
- [ ] 테스트 cleanup 잔여 MARKER 없음

## C. Feature flag (보수적 출시)

- [x] 단위 테스트 + E2E nav/분석으로 보수적 조합 검증
- [ ] 스테이징 `.env`에 보수적 값 반영 (운영 배포 시)
- [ ] 운영에 `TEST_USER_*` / `NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS` 없음

권장 값:

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

## D. 자동화된 브라우저 · a11y (Phase 6.1)

- [x] 로그인 UI · (가능 시) 세션 · 로그아웃
- [x] `/saju` · `/diary` Legacy 렌더
- [x] 보수적 플래그: journal·analysis nav ON · personalization OFF
- [x] journal categories ≥4 · 작성 · 점수 · 태그 · reload · 수정 · 다른 날짜
- [x] `/analysis/daily|weekly|monthly` · LLM OFF 결정론 패널
- [x] viewport 375 / 390 / 768 / 1440 overflow 스모크
- [x] login accessible name · analysis layer labels · keyboard tab

### E2E 불가/불안정 시 대체 browser smoke

```bash
# 보수적 플래그를 .env.local 에 넣고
npm run dev
# 수동: /diary/login → /saju → /diary → /journal → /analysis/daily
```

## E. 실기기 · 인간 전용 (blocker 아님)

- [ ] iPhone Safari · Android Chrome 터치
- [ ] 실제 Google OAuth
- [ ] 가로·세로 회전 · 소프트웨어 키보드
- [ ] 만료 세션 후 재로그인 UX
- [ ] VoiceOver / TalkBack 간단 탐색 (선택)

## F. 배포 직전

- [ ] DB 백업
- [ ] `DEPLOYMENT_RUNBOOK.md` · `ROLLBACK_RUNBOOK.md` 읽음
- [ ] 인간 출시 승인

## G. 배포 후

- [ ] 홈·saju·diary smoke
- [ ] 행 수 재확인
- [ ] 에러 로그에 토큰·일기 원문 없음
