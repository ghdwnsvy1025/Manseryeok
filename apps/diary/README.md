# 사주카우 일기 (apps/diary)

이 저장소의 **살아 있는 앱**이다. 루트(`src/` 등)는 동결된 레거시라 루트에서 `npm` 명령을 돌리지 않는다. 결정과 단계는 `../../docs/REBUILD_PLAN.md`, 운세는 `../../docs/FORTUNE_V4.md`, 익명 시작은 `../../docs/ANON_START.md`, 화면 디자인은 `docs/design/00-톤.md`.

## 실행·테스트

```bash
# 엔진 패키지 먼저 (file: 링크라 각자 설치)
cd packages/saju-engine && npm ci
cd ../saju-core-rules && npm ci
cd ../../apps/diary && npm ci
npm run dev        # http://localhost:3001 (Supabase 리디렉트 목록이 3001 기준)
npm run typecheck
npm test           # vitest
```

- `vitest.scripts.config.ts`의 스크립트(이관, 운세 표본 등)는 **실제 모델 호출·운영 DB 쓰기**를 한다. `npm test`에는 들어가지 않는다. 일부러 돌릴 때만.
- Supabase는 레거시와 **같은 운영 프로젝트**다. 로컬 dev에서 온보딩을 끝까지 하면 운영 DB에 익명 계정과 행이 생긴다.

## 구조

- 화면: `/`(오늘) · `/write`(쓰기) · `/me`(나) · `/settings` · `/onboarding` · `/welcome` · `/login`(직접 접근) · `/stats?key=`(운영 숫자)
- 라우트: `/api/cron/remind`(저녁 알림), `/auth/callback`. 저장은 서버 액션 `src/app/actions.ts`
- 엔진: `@saju/engine`(`packages/saju-engine`, 만세력 원본), `@saju/core-rules`(`packages/saju-core-rules`, 사주 코어 판정 복사본). 둘 다 `file:` 링크
- DB: `supabase/migrations/0001~0004`, 테이블 7개 모두 `night_` 접두어. **SQL Editor에서 손으로 적용**한다 — 적용하면 아래 "적용 기록"에 한 줄 적는다

### file: 링크 설정은 한 세트

`next.config.ts`의 webpack `resolve.symlinks = false`, `outputFileTracingRoot: ../..`, `transpilePackages`, `tsconfig.json`의 `preserveSymlinks`, `vitest.config.ts`·`vitest.scripts.config.ts`의 `preserveSymlinks`. 하나만 바꾸면 로컬은 되고 Vercel만 깨진다(이미 두 번). `lunar-javascript`를 앱이 직접 의존하는 것도 같은 이유이고, 계산 결과가 바뀔 수 있어 `1.7.7`로 고정한다. 나머지 의존성은 lockfile이 고정한다.

## 배포 (Vercel)

- Root Directory **`apps/diary`**, Framework Next.js, Node 20 이상. "Include source files outside of the Root Directory" 켬(엔진 패키지 때문).
- 리전 `icn1`, 크론 하루 1회 UTC 12시(`vercel.json`, 무료 플랜 제한).
- 환경변수는 `.env.example`이 전체 목록이다. 필수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, VAPID 3개, `CRON_SECRET`, `STATS_KEY`. 선택: `FORTUNE_MODEL`, `FORTUNE_REVIEW_MODEL`, `FORTUNE_DAILY_CAP`, `NEXT_PUBLIC_POSTHOG_KEY`(이용 통계, `docs/측정.md`). VAPID는 로컬 `.env.local`과 같은 값이어야 기존 알림 구독이 유지된다.
- 배포 전환 절차와 현재 상태: `REBUILD_PLAN.md` 0절·9절.

## 마이그레이션 적용 기록

| 파일 | 적용일 | 비고 |
|---|---|---|
| 0001_night_core.sql | 2026-10-04 | 이관 전 적용 |
| 0002_anon.sql | 2026-10-06 무렵 | 익명 시작 |
| 0003_promise.sql | 확인 필요 | |
| 0004_share_events.sql | 확인 필요 | 공유 삭제 뒤 쓰기 없음 |
