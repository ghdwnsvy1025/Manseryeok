# Manseryeok — 사주읽는밤 일기 저장소

**새 앱은 [`apps/diary/`](apps/diary/README.md)다.** 여기서 실행·테스트·배포한다.

루트의 `src/`, `supabase/`, `e2e/`, `scripts/`, `data/`, `knowledge/`, `public/`, `jest.config.js`, `playwright.config.ts`, `next.config.mjs`, `tailwind.config.ts`는 **동결된 레거시 앱**이다(태그 `legacy-final` = `2fa5ff0`). 기능을 더하지 않고, 루트에서 `npm run dev`·`npm test`를 돌리지 않는다(레거시 앱이 뜬다). 배포 전환이 끝나면 한 커밋으로 지운다 — `docs/REBUILD_PLAN.md` 0절·9절.

| 폴더 | 무엇 |
|---|---|
| `apps/diary/` | 새 앱 (Next 15, Supabase, Vercel) |
| `packages/saju-engine/` | 만세력 엔진 원본 |
| `packages/saju-core-rules/` | 사주 코어 판정 함수 복사본 |
| `docs/` | 새 앱 문서는 `REBUILD_PLAN.md`·`FORTUNE_V4.md`·`ANON_START.md`·`전수조사-2026-10-07.md`·`운세글-검토-2026-10-10.md`·`시장비교-2026-10.md`, 엔진 문서는 `MANSERYEOK_CALCULATION_GUIDE.md`·`SAJU_CALCULATION_SPEC.md`·`ELEMENT_DISTRIBUTION*.md`. 나머지(PHASE_*, PERSONALIZATION_*, POSTHOG 등)는 레거시 |
