# E. 아키텍처·구조·의존성·문서·운영 검토 — 사주 일기 (apps/diary)

- 검토일: 2026-10-14 · 저장소: `사주 일기/Manseryeok` 브랜치 `rebuild` · HEAD `9c1c375` (검토 도중 `ce9294b`에서 올라감)
- 방식: 읽기 전용. 개발 서버 없이 `git`, `grep`, `npm audit --omit=dev`, `vitest run`(세 패키지), `tsc --noEmit`만 실행.
- 실행 결과 요약: apps/diary vitest **24 파일 224개 통과**(17s) · saju-engine **146개 통과** · saju-core-rules **47개 통과** · apps/diary `tsc --noEmit` **오류 0**.

---

## 1. 구조 — 루트 레거시와 apps/diary의 공존

| # | 심각도 | 위치 | 증거 | 영향 | 제안 |
|---|---|---|---|---|---|
| 1-1 | **높음** | 저장소 루트 전체 | 루트에 레거시 Next 14 앱이 통째로 남아 있음: `src/` 604개 추적 파일, `supabase/` 마이그레이션 30개 + `config.toml`(project_id "Manseryeok"), `e2e/`, `scripts/` 34개 .mjs, `jest.config.js`, `playwright.config.ts`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `data/quotes`, `knowledge/saju`, `public/sw.js`. REBUILD_PLAN 9-7 "안정되면 src/를 지운다"는 미이행. 레거시 쪽 변경은 `legacy-final` 이후 1커밋(버그 수정 2건)뿐 | 저장소 1,155 추적 파일 중 새 앱 관련은 ~380개. 새로 오는 세션·도구가 루트 `package.json`(`npm test`=jest, `npm run dev`=레거시 3000포트)을 먹고 엉뚱한 앱을 돌림. `.next` 두 벌(179MB+346MB) | 배포 전환 확인 즉시 루트의 `src/ supabase/ e2e/ scripts/ data/ knowledge/ public/ jest.config.js playwright.config.ts next.config.mjs tailwind.config.ts postcss.config.mjs .eslintrc.json next-env.d.ts tsconfig.tsbuildinfo vibelearning.code-workspace .vscode/`를 한 커밋으로 삭제(태그 `legacy-final`로 복구 가능). 그 전까지는 루트에 README 한 장("레거시 동결, 새 앱은 apps/diary") |
| 1-2 | 중간 | `package.json`(루트) | `workspaces` 없음. 루트·apps/diary·packages/saju-engine·packages/saju-core-rules가 각자 `package-lock.json`을 가짐(4개). apps/diary → `file:../../packages/*` 심볼릭 링크 | npm이 링크된 패키지의 의존성을 깔지 않아 앱이 `lunar-javascript`를 다시 선언해야 하고(REBUILD_PLAN 5절), 세 곳의 `node_modules`가 따로 놀음. `npm ci`를 어디서 돌려야 하는지 문서 없음 | 레거시 삭제 뒤 루트 `package.json`을 `{"private":true,"workspaces":["apps/*","packages/*"]}`로 바꾸고 lockfile 하나로. 그 전엔 "apps/diary에서만 npm 명령" 한 줄을 README에 |
| 1-3 | 중간 | `apps/diary/next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.scripts.config.ts` | `file:` 링크를 살리기 위한 설정이 4곳에 흩어짐: webpack `resolve.symlinks=false`, tsconfig `preserveSymlinks:true`, vitest 두 설정의 `preserveSymlinks:true`, `outputFileTracingRoot: ../..`, `transpilePackages`. core-rules의 `@saju/engine` import는 `packages/saju-core-rules/node_modules`에 엔진이 없는데도 심볼릭 링크를 풀지 않아 `apps/diary/node_modules/@saju/engine`으로 올라가 해결되는 구조 | 하나라도 어긋나면 로컬은 되고 Vercel만 깨짐(커밋 `1ce767b`, `1be4b44` 두 번 겪음). Next 16 기본 Turbopack은 `webpack()` 훅을 무시하므로 업그레이드 때 재발 | workspaces 전환(1-2)으로 근본 해결. 당장은 `next.config.ts` 머리에 "이 네 설정은 한 세트" 주석과 `docs/DEV.md`에 Vercel 설정(Root Directory `apps/diary`, "Include source files outside of the Root Directory" 켜짐) 기록 |
| 1-4 | 중간 | `apps/diary/vercel.json`, Vercel 대시보드 | 루트 `vercel.json` 없음. Root Directory=`apps/diary`는 대시보드 설정이라 저장소만 보고는 재현 불가. `vercel.json`은 `regions: icn1` + 크론 1개만 | 프로젝트를 다시 만들거나 다른 사람이 배포하면 설정을 기억에 의존 | REBUILD_PLAN 9절의 Vercel 설정을 `apps/diary/README.md`로 옮기고, 가능하면 `vercel.json`에 `"framework":"nextjs"` 명시 |
| 1-5 | 중간 | `supabase/`(루트) vs `apps/diary/supabase/migrations/` | 같은 Supabase 프로젝트에 마이그레이션 세트가 두 벌(30개 + 4개). 루트 `config.toml`은 CLI 로컬용. 새 앱은 "SQL Editor에 수동 적용"(REBUILD_PLAN 2절)이라 적용 여부 기록이 없음. `db.ts`에 "컬럼 적용 전이면 undefined" 식 방어 코드가 있음 | 어느 마이그레이션이 운영 DB에 들어갔는지 코드로 알 수 없음. 새 환경(스테이징) 재현 불가 | `apps/diary/supabase/APPLIED.md`(파일명·적용일·적용자) 한 장, 또는 Supabase CLI `supabase db push` 체계로 전환. 루트 `supabase/`는 레거시 삭제와 함께 제거 |
| 1-6 | 낮음 | `.gitignore`(루트) | `.env*` 패턴이 `.env.example`까지 무시(이미 추적 중인 파일은 유지되지만 새 예시 파일은 조용히 빠짐). apps/diary 쪽은 `!.env.example`로 올바름. 루트 `tsconfig.tsbuildinfo`(249KB) 빌드 산출물이 추적됨 | 새 `.env.example`을 만들어도 커밋 안 됨. 산출물 diff 노이즈 | 루트 `.gitignore`에 `!.env.example`, `*.tsbuildinfo` 추가, `git rm --cached tsconfig.tsbuildinfo` |
| 1-7 | 낮음 | `vibelearning.code-workspace`, `.vscode/launch.json` | 무관한 다른 프로젝트(`../vibelearning`)를 가리키는 워크스페이스 파일이 추적됨 | 혼동 | 삭제 |

**삭제 후보(죽은 코드·스크립트) 목록**
- 루트: `src/`(레거시 앱 전체, `src/lib/saju/`는 엔진의 옛 복사본), `supabase/`, `e2e/`, `scripts/`(verify-*·seed-*·backfill-*·shoot-flow 등 34개, 모두 레거시 DB/화면 대상), `data/quotes`, `knowledge/saju`, `public/`, `jest.config.js`, `playwright.config.ts`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `vibelearning.code-workspace`, `.vscode/`
- `docs/` 52개 중 새 앱 관련은 7개(REBUILD_PLAN, FORTUNE_V4, ANON_START, 전수조사-2026-10-07, 작동지도-2026-10-07.json, 운세글-검토-2026-10-10, 시장비교-2026-10) + 엔진 문서 3개(ELEMENT_DISTRIBUTION*, MANSERYEOK_CALCULATION_GUIDE, SAJU_CALCULATION_SPEC). 나머지 ~40개(PHASE_*, PERSONALIZATION_*, ANALYSIS_*, RLS_*, RELEASE_*, FEATURE_FLAGS, POSTHOG, FRIEND_BETA …)는 레거시
- apps/diary: `src/lib/fortune/base.ts`는 v3 점수 계산(머리 주석 "더 쓰지 않는다")이지만 `TEN_GOD_THEME`·`FAMILY_OF` 상수 때문에 `brief.ts`·`core.ts`가 import → 상수만 별 파일로 빼고 v3 계산 함수는 `scripts/fortune-backtest.ts` 쪽으로

## 2. 경계 — apps/diary/src/lib ↔ packages/saju-engine ↔ 다른 프로젝트

| # | 심각도 | 위치 | 증거 | 영향 | 제안 |
|---|---|---|---|---|---|
| 2-1 | **높음** | `사주 코어/core/vendor/manseryeok/` vs `packages/saju-engine/src/` | 코어의 복사본은 `ORIGIN.txt` 기준 레거시 커밋 `e57449c`(2026-09-16) — 재구축 0단계 버그 수정 2건(음력 30일, 월 절기 끝 시각) **이전**. `diff` 줄 수: calculator.ts 436, monthPillar.ts 19, dayPillar.ts 6. 반대로 코어는 `lunarConverter.ts`의 `isLeap()` 버그를 고쳤는데(ORIGIN.txt 2항) 엔진에는 반영 안 됨. 바이럴은 별도 구현(`saju.js` + `korean-lunar-calendar`) | 엔진 README가 "이 폴더가 원본"이라 하지만 실제로는 **만세력 구현이 세 벌**이고 서로 다른 버그를 가짐. 같은 생년월일에 세 서비스가 다른 네 기둥을 낼 수 있음 | 엔진에 코어의 isLeap 수정을 역반영 → 코어 vendor를 엔진 최신으로 재복사(ORIGIN.txt 갱신) → 바이럴은 최소한 회귀 테스트 케이스(1990-01-01 12:00 서울 = 己巳 丙子 丙寅 甲午 등)를 세 곳이 공유 |
| 2-2 | 중간 | `apps/diary/src/lib/fortune/solarTerms.ts` | 엔진은 12절입만 계산해서 앱이 12중기를 `sunApparentLongitude`로 **뉴턴 반복을 다시 구현**(`midTermKstIso`). 24절기 표(`TERMS_24`)도 앱에 있음 | 천문 계산이 엔진 밖으로 새어 나옴. 코어가 24절기를 쓰게 되면 또 복사됨 | `solarTermsOfYear`/`solarTermOf`와 `TERMS_24`를 `packages/saju-engine/src/solarTerms.ts`로 올리고 앱은 import만 |
| 2-3 | 중간 | `me/page.tsx:77`, `fortune/base.ts:83`, `fortune/gaewoon.ts:9`, `stats/ganji.ts:31-32` | 오행 영↔한 매핑(`wood→목`)과 우리말(`목→나무`)이 4곳에 각자 선언 | 표기 바꾸면 네 곳을 찾아야 함 | 엔진 `constants.ts`에 `ELEMENT_KO`, `ELEMENT_WORD` 한 번 export |
| 2-4 | 중간 | `packages/saju-engine/src/index.ts:19` `ENGINE_VERSION = "1.0.0"` | 캐시 지문(`fortune/index.ts fingerprint`)에 들어가는데 올리는 규칙이 없음. 엔진이 바뀌어도 "1.0.0" | 엔진 계산이 바뀌면 사용자별 캐시가 옛 값으로 남음(FORTUNE_VERSION만 올리고 있음) | 엔진 README에 "계산 결과가 바뀌는 커밋은 ENGINE_VERSION을 올린다" 한 줄 + 테스트에서 버전 문자열 스냅숏 |
| 2-5 | 낮음 | `packages/saju-core-rules` | 코어 커밋 `240c91d` 복사본. README가 코어 작업 트리의 미커밋 변경(Y-13·Y-14·J-05, "가설 009")을 안 가져왔다고 명시 | 코어가 커밋하면 또 수동 복사. 복사 절차는 문서화돼 있어 양호 | 복사 스크립트(`scripts/sync-core-rules.sh`: cp + 커밋 해시를 version.ts에 기록) 하나로 사람 손 줄이기 |
| 2-6 | 양호 | `apps/diary/src` 전체 | `lunar-javascript` 직접 import **0건**. 사주 계산은 모두 `@saju/engine`(21 import 지점)·`@saju/core-rules`를 거침. `lib/ganji.ts`는 `getDayPillar` 얇은 포장 | — | 유지 |
| 2-7 | 양호 | lunar-javascript 버전 | 루트 `^1.3.22`(해결 1.7.7), 엔진 `1.7.7`(고정), apps/diary `1.7.7`(고정), 코어 `1.7.7`. **실제 설치는 전부 1.7.7** — 두 버전 공존 문제 없음 | — | 루트 범위는 레거시 삭제와 함께 사라짐 |

## 3. 의존성

| # | 심각도 | 위치 | 증거 | 영향 | 제안 |
|---|---|---|---|---|---|
| 3-1 | 중간 | `apps/diary` (`npm audit --omit=dev`) | **2건(high 1, moderate 1)**: `next@15.5.27`이 묶어 쓰는 `node_modules/next/node_modules/postcss@8.4.31` ≤8.5.22 — GHSA-qx2v-qp2m-jg93(XSS via `</style>`), GHSA-6g55-p6wh-862q·fxqj-rqcc-2cmp·r28c-9q8g-f849(sourceMappingURL 파일 읽기). audit의 fix는 `next@16.4.0`(breaking) | postcss는 빌드 시간에만 쓰이고 사용자 CSS를 받지 않으므로 런타임 노출은 낮음. 다만 audit가 계속 빨감 | Next 15.5.x 패치 릴리스를 기다리며 주 1회 `npm audit` 확인. `overrides`로 next 내부 postcss를 강제 올리는 건 Next가 보증하지 않으므로 비권장 |
| 3-2 | 낮음 | `apps/diary/package.json` | 버전 정책이 섞임: `lunar-javascript`만 `1.7.7` 고정, 나머지는 `^`. lockfile로 재현성은 확보(next 15.5.27, react 19.3.0, @anthropic-ai/sdk 0.131.0, @supabase/ssr 0.7.0, supabase-js 2.117.2, tailwind 4.3.3, vitest 3.2.7, ts 5.9.3) | 의도(천문 계산 라이브러리만 고정)는 타당하나 문서 없음 | `package.json`에 주석 못 쓰니 README 한 줄: "lunar-javascript는 계산 결과가 바뀔 수 있어 고정, 나머지는 lockfile" |
| 3-3 | 낮음 | `apps/diary/src/lib/fortune/llm.ts`, `review.ts` | `@anthropic-ai/sdk`를 import하는 두 파일에 `import "server-only"`가 **없음**(0건). 지금은 `server-only`가 붙은 `fortune/index.ts`를 통해서만 불려 안전 | 누군가 클라이언트 컴포넌트에서 `llm.ts`의 상수(`SYSTEM`, `MAX_ATTEMPTS`)를 import하면 SDK가 번들에 끌려가고 빌드 에러가 아니라 런타임에서 터짐 | 두 파일 첫 줄에 `import "server-only"`. `web-push`(`push.ts`)·`admin.ts`·`guest.ts`는 이미 붙어 있어 양호 |
| 3-4 | 낮음 | 루트 `package.json` | `openai`(레거시 14곳), `posthog-js`(1곳), jest·playwright·ts-jest 등은 전부 레거시 전용. apps/diary에는 미사용 의존성 없음(`server-only`·`web-push`·`@anthropic-ai/sdk`·`@supabase/ssr`·`supabase-js` 모두 사용, `lunar-javascript`는 1-2의 이유로 필요) | — | 레거시 삭제 시 함께 제거 |
| 3-5 | 낮음 | `apps/diary/.env.local` | `OPENAI_API_KEY`가 있지만 apps/diary·packages 코드에 `process.env.OPENAI_API_KEY` 참조 **0건** (레거시 .env에서 복사된 흔적) | 쓰지 않는 유료 키가 로컬 파일에 남음 | 줄 삭제. Vercel 환경변수에도 들어갔으면 제거 |

## 4. 운영

| # | 심각도 | 위치 | 증거 | 영향 | 제안 |
|---|---|---|---|---|---|
| 4-1 | **높음** | `apps/diary/.env.example` vs 코드 | 코드가 읽는 키 14개 중 예시 파일에 **없는 것**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `STATS_KEY`. 스크립트 전용 `MIGRATE_APPLY`, `LEGACY_BACKUP_DIR`, `WEEK`도 미기재. `docs/ENVIRONMENT_VARIABLES.md`는 레거시 변수(OPENAI, FF_*)만 다룸. REBUILD_PLAN 9-3의 Vercel 목록에도 `STATS_KEY`·`FORTUNE_MODEL`·`FORTUNE_REVIEW_MODEL` 없음 | 새 환경에서 알림·크론·운영 숫자 화면이 조용히 꺼짐(`push.ts`는 키 없으면 `unconfigured`만 반환) | `.env.example`에 5개 추가(값 없이), `ENVIRONMENT_VARIABLES.md`를 새 앱 표로 교체(이름·서버/클라·필수·용도) |
| 4-2 | **높음** | `fortune/llm.ts`, `fortune/index.ts`, `actions.ts`·`AnonBoot.tsx`(`signInAnonymously`) | Anthropic 호출에 **일·월 상한이 없음**. 사용자×날짜 캐시, `inFlight` 중복 제거, `max_tokens 2048`, 프롬프트 캐시는 있으나 호출 수는 사용자당 하루 최대 3회(+검수 켜면 1~2회). 익명 시작은 캡차·레이트리밋 없이 누구나 새 계정을 만들고 생년월일만 넣으면 새 운세(=새 모델 호출)를 받음. usage는 `console.info`로만 찍고 저장하지 않음. `new Anthropic()` 기본값(재시도 2회, 타임아웃 10분)에 `maxDuration` 설정 없음 | 악의가 없어도 봇 트래픽·크롤러가 비용을 만들 수 있고, 월 20만 원 예산(REBUILD_PLAN)을 넘는지 알 길이 없음. 3회 시도가 Vercel 함수 기본 시간(10초/60초)을 넘으면 템플릿도 못 주고 끊김 | ① `night_fortunes`에서 "오늘 `model is not null`인 행 수"를 세어 일일 상한(예: 2,000) 넘으면 `useModel=false`로 템플릿만. ② 페이지 `export const maxDuration = 30`과 SDK `timeout: 20_000, maxRetries: 1`. ③ Supabase Auth 익명 가입 레이트리밋 값을 대시보드에서 확인·기록. ④ usage 합계를 `night_fortunes.content`에 이미 있는 값으로 `/stats`에 토큰 합계 한 줄 추가 |
| 4-3 | 중간 | `src/app/api/cron/remind/route.ts`, `vercel.json` | 크론은 결과 JSON(`sent/gone/failed`)만 돌려주고 끝. `failed>0`이나 500(Supabase 오류)일 때 알려 주는 곳이 없음. Vercel 크론 로그를 사람이 들어가 봐야 함 | 알림이 며칠 안 가도 모름 | 가장 싼 방법: `failed>0 || error`면 `console.error`가 아니라 Vercel Log Drain → 메일, 또는 `night_cron_runs` 테이블에 한 줄 적고 `/stats`에 마지막 실행 시각 표시 |
| 4-4 | 중간 | 전체 | 로깅은 `console.*`만(error 32, warn 9, info 1). Sentry류 오류 추적 없음. REBUILD_PLAN 스택에 PostHog가 있지만 새 앱 코드에 PostHog **0건** | 운영 중 예외를 Vercel 함수 로그에서 수작업으로 찾아야 함(보존 기간 짧음) | Sentry 무료 티어(`@sentry/nextjs`) 또는 최소한 `console.error`를 한 함수(`lib/log.ts`)로 모아 나중에 교체 가능하게 |
| 4-5 | 중간 | 백업·마이그레이션 절차 | 백업은 2026-10-04 한 번(로컬 폴더). 반복 백업 정책·복구 리허설 없음. 마이그레이션은 SQL Editor 수동 적용, 적용 기록 없음(1-5) | 사용자 일기·생년월일이 단일 Supabase 프로젝트에만 존재. 무료 플랜은 PITR 없음 | 월 1회 `pg_dump`(또는 Supabase 대시보드 백업) 절차를 `apps/diary/docs/RUNBOOK.md`에, 마이그레이션 적용 기록 파일(1-5) |
| 4-6 | 낮음 | `src/app/stats/page.tsx` | 운영 숫자 화면 인증이 `?key=STATS_KEY` 쿼리스트링 | 비밀값이 Vercel 요청 로그·브라우저 기록·리퍼러에 남음 | 쿠키(한 번 넣으면 유지) 또는 `Authorization` 헤더/Basic Auth. 키 유출 시 교체 절차 한 줄 |
| 4-7 | 낮음 | `src/lib/push.ts:10` | `VAPID_SUBJECT` 기본값으로 개인 이메일이 소스에 하드코딩 | 공개 저장소면 노출 | 기본값 제거하고 환경변수 필수로 |

## 5. 문서·테스트 체계

| # | 심각도 | 위치 | 증거 | 영향 | 제안 |
|---|---|---|---|---|---|
| 5-1 | **높음** | `docs/REBUILD_PLAN.md` | "결정을 바꾸면 이 문서부터 고친다"고 했지만 2026-10-04 이후 코드와 어긋남: ① 2절 "비로그인은 보기만, 기록은 Google 로그인" → 실제는 익명 시작(ANON_START.md) ② 6절 "llm.ts(gpt-4o-mini)" → 실제 Claude Sonnet 5 + 재작성 2회 + 검수(v4.10) ③ 2절 "테이블 6개·API 5개" → 테이블 7개(0004 `night_share_events`), 라우트는 크론 1개 + auth callback + 서버 액션 ④ 8절 "크론 매시 UTC 10~14" vs 9-6 "하루 1회 밤 9시"(문서 안에서 모순) ⑤ 스택 "PostHog" 미사용 ⑥ 2절 공유 "가장 행복한 날 카드" → 운세 한 장 공유 → `ce9294b`에서 공유 버튼 삭제 ⑦ 단계표 1·2·5의 "확인 대기"가 그대로, 배포 전환 완료 여부 불명 ⑧ 9-7 레거시 삭제 미이행 | 기준 문서가 기준이 아님. 새 세션이 이 문서를 믿고 잘못된 전제로 작업 | 단계표를 "2026-10-14 현재 상태"로 다시 쓰고, 2절 결정표에 바뀐 항목은 취소선+새 결정+날짜. 운세 세부는 FORTUNE_V4.md로 위임 |
| 5-2 | 중간 | `docs/` 배치 | 새 앱 문서 7개가 레거시 문서 ~45개와 같은 폴더. `apps/diary/docs`에는 디자인 명세만(00~23 + shots). `apps/diary/README.md` 없음 | 어떤 문서가 살아 있는지 폴더만 봐선 모름 | 새 앱 문서를 `apps/diary/docs/`로 이동, 레거시 문서는 `docs/legacy/`로. `apps/diary/README.md`에 실행·테스트·배포·환경변수 10줄 |
| 5-3 | 중간 | `apps/diary/vitest.scripts.config.ts` | 일회성 스크립트를 vitest로 돌리는 두 번째 설정. include에 `fortune-sample.ts`·`fortune-review.ts`(**실제 모델 호출**)와 `migrate-legacy.migrate.ts`(`MIGRATE_APPLY`로 DB 쓰기)가 함께 있어 파일 인자 없이 `vitest run --config vitest.scripts.config.ts`를 치면 전부 실행됨 | 실수 한 번에 모델 비용·DB 쓰기 | 스크립트 실행기를 `tsx`로 바꾸거나, 비용·쓰기 스크립트는 include에서 빼고 파일을 직접 지정해야만 돌게 |
| 5-4 | 중간 | 저장소 전체 | **CI 없음**(`.github/` 부재). apps/diary에 ESLint 미설치(`eslint.ignoreDuringBuilds: true`), 빌드에 typecheck·vitest 연결 없음. pre-commit 없음 | 테스트가 깨진 채 push·배포될 수 있음. 지금은 224개가 통과하지만 보증 장치는 사람 | GitHub Actions 하나: `apps/diary`·두 패키지에서 `npm ci && npx tsc --noEmit && npx vitest run`, 주 1회 `npm audit --omit=dev` |
| 5-5 | 낮음 | 테스트 설정 중복 | 루트 jest(레거시 864개 기준선) + apps/diary vitest + 패키지 vitest 2개. 엔진 vitest는 `@jest/globals→vitest` alias로 옛 테스트를 그대로 돌림 | 레거시 삭제 전까지는 불가피. 세 vitest 설정은 패키지마다 하나라 중복이라기보다 분리 | 레거시 삭제 시 jest 제거. workspaces 전환 후 루트 `vitest.workspace.ts` 하나로 |
| 5-6 | 낮음 | 커밋 규칙 | 저장소 안에 커밋 규칙 문서 없음(`docs/DEV.md`는 Cursor UI 조작법). `사주 앱/CLAUDE.md`: "디자인 작업은 커밋하지 않고 기능 쪽에서 검토 뒤 커밋". 실제 커밋은 한 커밋에 운세 v4.9 + 나 탭 UI + 문구 변경이 섞인 긴 한 문장 제목(최근 10개 모두) | 되돌리기·bisect가 어려움. 메시지는 내용이 풍부해 읽기는 좋음 | "한 커밋 = 한 주제(운세/화면/문서)" + 제목 72자 이내, 상세는 본문으로. 문서 한 줄이면 됨 |

## 6. git

- 브랜치 `rebuild`, `legacy-final`(=`2fa5ff0`, main) 이후 **42커밋**(10-03 ~ 10-14 00:30). `main`은 레거시 운영본으로 rebuild보다 41커밋 뒤. 머지·Production Branch 전환 여부는 저장소에서 확인 불가(REBUILD_PLAN 9-4 미기록).
- `git status`: **작업 트리 깨끗함(0건)**, stash 없음. 단, 검토 시작 시 HEAD `ce9294b`였고 도중 `9c1c375`(운세 v4.10, `review.ts`·`fortune-v410.test.ts`·`.env.example` 수정)가 올라와 **origin/rebuild보다 1커밋 앞섬(미푸시)** — 다른 세션이 같은 작업 트리에서 동시에 커밋 중. 이 리뷰 묶음(A~E)의 다른 파트가 본 코드와 버전이 다를 수 있음.
- 원격에 정리 안 된 가지: `backup/before-fortune-topics-stats-ux-20260803`, `backup/fortune-topics-stats-ux-20260803`, `fix/daily-insight-audit-remediation`, `posthog/instrumentation-a8ec31`, `v0`, `v0_pad`(모두 레거시 시대).
- 무시 산출물: `.next` 179MB(루트, 레거시) + 346MB(apps/diary). 레거시 `.next`는 지워도 됨.
- 추적된 산출물: `tsconfig.tsbuildinfo`(루트), `next-env.d.ts`(루트). apps/diary 쪽은 `.gitignore`가 둘 다 막음(양호).

---

## 잘 된 점

1. **엔진 분리가 실제로 지켜짐** — apps/diary에 `lunar-javascript` 직접 import 0건, 사주 계산은 전부 `@saju/engine`·`@saju/core-rules`를 통함. core-rules는 파일마다 원본 커밋 해시를 적어 출처 추적 가능.
2. **운세 파이프라인의 비용·장애 설계** — 사용자×날짜 캐시 + 지문(버전·엔진·원국·출생), 동시 요청 `inFlight` 공유, 부분 유니크 인덱스 중복 키 처리(`cache.ts`), 모델 실패·금지어 탈락 시 템플릿 폴백, system 프롬프트 `cache_control`. 모델이 죽어도 화면은 뜬다.
3. **DB 경계** — `night_*` 6+1 테이블 전부 RLS, 사용자 데이터는 세션 클라이언트(RLS), 서비스 역할은 캐시 전용 `admin.ts`에 격리(`server-only`), `getClaims()`로 요청마다 Auth 왕복 제거.
4. **테스트가 살아 있음** — 세 패키지 합계 417개가 17~20초 안에 전부 통과, 타입 오류 0. `remind.ts pickDue`처럼 순수 함수로 잘라 테스트하고, DB는 인터페이스(`FortuneCacheDb`)로 가짜를 끼우는 패턴.
5. **운영 디테일** — Vercel 리전 `icn1`(Supabase와 동일), 크론 `CRON_SECRET` 검증, 미들웨어 matcher에서 정적 경로 제외, 정적 에셋 1년 immutable 캐시, 디자인 명세 00~23이 스크린샷과 함께 번호로 쌓임.

## 지금 당장 정리하면 좋은 것 — 상위 5

1. **REBUILD_PLAN.md 현행화 + `apps/diary/README.md` 신설** (5-1, 5-2, 1-4): 익명 시작·Claude·테이블 7개·크론 하루 1회·배포 전환 상태·Vercel 설정을 오늘 기준으로. 30분짜리 문서 작업인데 다음 세션들의 전제가 바뀜.
2. **환경변수 정리** (4-1, 3-5): `.env.example`에 VAPID 3개·`CRON_SECRET`·`STATS_KEY`·`FORTUNE_MODEL` 추가, `.env.local`과 Vercel에서 `OPENAI_API_KEY` 제거, `ENVIRONMENT_VARIABLES.md`를 새 앱 표로 교체.
3. **LLM 비용 가드 + 함수 시간 제한** (4-2): 일일 모델 호출 상한(캐시 테이블 count 한 번), `maxDuration`, SDK `timeout/maxRetries`, `/stats`에 오늘 모델 호출 수·토큰 합계 한 줄. 익명 가입 레이트리밋 값 확인.
4. **레거시 삭제 결정** (1-1, 1-2, 1-5, 1-6): 배포 전환이 끝났다면 REBUILD_PLAN 9-7대로 루트 레거시(src/·supabase/·e2e/·scripts/·jest/playwright/next 설정·tsbuildinfo·code-workspace)를 한 커밋으로 지우고 루트를 workspaces로. 아직이면 루트 README에 "레거시 동결" 표지와 "npm은 apps/diary에서만" 한 줄.
5. **만세력 단일화 + CI** (2-1, 2-2, 5-4): 코어의 `lunarConverter` 수정을 엔진에 역반영하고 코어 vendor를 엔진 최신으로 재복사, 24절기 중기 계산·오행 매핑을 엔진으로 이동, `ENGINE_VERSION` 올리기 규칙. GitHub Actions로 typecheck+vitest 3곳+audit.
