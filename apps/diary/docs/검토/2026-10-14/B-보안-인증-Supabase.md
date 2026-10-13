# B. 보안·인증·데이터(Supabase) 검토 — 사주 일기 (apps/diary)

- 검토일: 2026-10-14
- 범위: `apps/diary` (Next 15.5.27, @supabase/ssr 0.7.0, supabase-js 2.117.2, web-push 3.6.7) + 루트 `supabase/` 레거시 마이그레이션 (같은 Supabase 프로젝트)
- 방식: 읽기 전용 정적 검토. 원격 Supabase·배포 헤더는 확인하지 않았다 → 그런 항목은 **(추정)** 표시.
- 적용 체크리스트: `supabase` 스킬 보안 체크리스트(RLS·getUser/getClaims·user_metadata·service role·뷰·SECURITY DEFINER·스토리지·의존성 고정) + `best-practices` 스킬(헤더·CSP·SRI·쿠키).
- 경로 표기는 `apps/diary/` 기준. `.env.local` 값은 적지 않았다(키 이름만).

## 0. 요약

| 심각도 | 건수 | 핵심 |
|---|---|---|
| 치명 | 0 | — |
| 높음 | 2 | H1 LLM 비용 상한 없음(프로필 바꾸기로 무한 재생성) · H2 `/auth/callback` `next` 오픈 리다이렉트(`/\evil.com` 우회) |
| 중간 | 6 | M1 보안 헤더(CSP·frame-ancestors) 전무 → 클릭재킹 · M2 "기존 Google로 로그인" 경로의 익명 기록 유실(취소해도 복구 불가) · M3 `recordShareAction` 무인증·무제한 insert(service role) · M4 푸시 endpoint 미검증(SSRF성) · M5 서버 측 `signInAnonymously`가 Vercel IP 레이트리밋 공유(추정) · M6 익명 계정 무한 생성·정리 없음 |
| 낮음 | 8 | 비밀 비교 비상수시간, 쿼리스트링 비밀, 미사용 OPENAI 키, 투표 날짜 범위, 레거시 `auth.role()`, 의존성 범위 지정, 죽은 코드(guest.ts·safeNext), sw.js url 미검증 |

잘 된 점 5가지는 마지막 절.

---

## 1. 마이그레이션 · RLS · DB 권한

### 1-1. `apps/diary/supabase/migrations/0001_night_core.sql` — 양호

- 6개 테이블 모두 `enable row level security` (128~133행).
- 정책이 `for all to authenticated using ((select auth.uid()) = user_id) with check (...)` (143~145행) — 역할 지정 + 소유 조건 + WITH CHECK 모두 갖춤. `user_metadata`·`auth.role()` 미사용. `(select auth.uid())` 서브쿼리 형태라 initPlan 캐시도 됨.
- `night_fortunes`는 본인 select만(151~152행), 쓰기는 service role 전용 → 사용자가 운세를 위조할 수 없음.
- `night_touch_updated_at()`에 `set search_path = ''` (13행) — 트리거 함수 search_path 고정. SECURITY DEFINER 없음.
- `night_fortunes` `check ((user_id is null) <> (guest_key is null))` + 부분 유니크 인덱스 — 소유자 없는 행 불가.

### 1-2. `0004_share_events.sql` — RLS만 켜고 정책 없음 (의도대로 브라우저 접근 차단). 양호. 단 쓰기 경로는 M3 참고.

### 1-3. 루트 레거시 `supabase/migrations/*` (같은 프로젝트)

| # | 심각도 | 위치 | 내용 |
|---|---|---|---|
| L1 | 낮음 | `supabase/migrations/015_daily_insight_fortune_quotes.sql:185` | `auth.role() = 'authenticated'` — 스킬이 명시한 폐기 패턴. 사주 일기가 **익명 로그인을 켠 뒤**로는 익명 사용자도 `authenticated` 역할이라 `quote_library`(검증된 명언)를 읽을 수 있다. 내용이 공개성 콘텐츠라 피해는 없음. 수정: `to authenticated` 절 + `(select auth.jwt()->>'is_anonymous') = 'false'`(필요 시)로 교체. |
| L2 | 낮음 | `008_journal_category_system.sql:121~131` | `to authenticated using (true)` 카탈로그 읽기 — 익명 사용자 포함. 카탈로그라 무해. |
| L3 | 정보 | `003_p0_profiles_and_diary_fields.sql:119` `set_updated_at()` | search_path 미고정. SECURITY DEFINER가 아니고 트리거 전용이라 실질 위험 낮음. |
| L4 | 양호 | `006_rag_knowledge.sql:86~95` | `knowledge_*`는 anon/authenticated **revoke all** + service_role grant. `match_knowledge_chunks`도 revoke. |
| L5 | 양호 | `016`, `025` 함수 | `match_quote_library`, `resolve_primary_saju_profile_id` 모두 `language sql stable`, SECURITY DEFINER 아님 → 호출자 권한·RLS 적용. PUBLIC EXECUTE가 기본이지만 invoker라 안전. |
| L6 | (추정) 중간 | 레거시 `src/app/api/**` 30개 라우트 | 익명 로그인이 **프로젝트 전역** 설정이다. 레거시 앱이 아직 배포돼 있다면, 사주 일기가 만든 익명 세션(30개/시간/IP)으로 레거시의 OpenAI 호출 라우트(`/api/analyze`, `/api/journal/today-fortune` 등)를 "로그인된 사용자"로 호출할 수 있다 → 비용. 레거시가 내려가 있으면 해당 없음. 수정: 레거시 라우트에 `is_anonymous` 거부 또는 레거시 배포 중단 확인. |

- 뷰: 두 프로젝트 모두 `create view` 없음 → 뷰 RLS 우회 이슈 없음.
- 스토리지: 버킷·storage 정책 없음(사용 안 함). 해당 없음.
- Data API 노출(스킬 원칙 4): `config.toml`에 `auto_expose_new_tables` 미설정. 운영 프로젝트는 2026-10-30 이후 새 테이블이 자동 노출되지 않으므로, 이후 추가하는 `night_*` 테이블은 `grant select, insert, update, delete on ... to authenticated`를 마이그레이션에 넣어야 한다 **(추정 — 운영 프로젝트 설정 미확인)**. 기존 테이블은 코드가 동작 중이므로 노출돼 있다고 본다.

---

## 2. 세션 · 인증 흐름

### H2 (높음) — `/auth/callback` `next` 오픈 리다이렉트 (`/\` 우회)

- 파일: `src/app/auth/callback/route.ts:12~13, 47` (같은 검사: `src/app/login/GoogleButton.tsx:13`, `src/components/LinkGoogleButton.tsx:14`, `src/app/onboarding/page.tsx:12`, `src/app/actions.ts:36~39`)
- 증거:
  ```ts
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  ...
  return NextResponse.redirect(new URL(next, origin));
  ```
  WHATWG URL은 특수 스킴에서 `\`를 `/`로 취급한다. 로컬 확인: `new URL("/\\evil.com", "https://app.example").href === "https://evil.com/"` — 검사(`startsWith("/") && !startsWith("//")`)는 통과한다.
- 시나리오: 공격자가 `https://앱/login?next=/\evil.com` 링크를 피싱 메일로 보냄 → 피해자가 Google 로그인/연결을 마치면 세션 쿠키가 심긴 직후 `evil.com`으로 이동(가짜 "세션 만료, 다시 로그인" 페이지 등). `onboarding?next=`도 같은 패턴으로 `취소` 링크가 외부로 간다.
- 수정(한 줄): `const u = new URL(rawNext, origin); const next = u.origin === origin ? u.pathname + u.search : "/";` 를 공통 `safeNext()`로 빼고 4곳에서 쓴다(`/\`, `/%5C`, 절대 URL 모두 차단).

### M2 (중간) — "기존 Google 계정으로 로그인" 경로의 익명 기록 유실

- 파일: `src/app/login/GoogleButton.tsx:46~48`
  ```ts
  if (mode === "fresh") await supabase.auth.signOut();
  result = await supabase.auth.signInWithOAuth({ provider: "google", options });
  ```
- 시나리오: 익명 사용자가 "기존 Google 계정으로 로그인"을 누른 뒤 Google 동의 화면에서 **취소**하거나 네트워크가 끊기면, 이미 `signOut()`이 끝나 익명 세션이 사라진다. 돌아오면 `AnonBoot`가 **새** 익명 사용자를 만들고, 이전 익명 계정(기록·운세·알림 설정)은 자격 증명이 없어 영구히 접근 불가. 화면 문구는 "이 기기의 기록은 남지 않아요"라고 성공 경우만 설명한다.
- 수정: `signOut()`을 빼도 된다 — `exchangeCodeForSession`이 새 세션으로 교체하므로 OAuth 성공 시에만 익명 세션이 밀려난다. (또는 `signOut({ scope: "local" })`을 콜백 성공 후로 옮긴다.)
- 연관(낮음): 성공해도 익명 계정은 `auth.users`에 고아로 남는다(M6).

### 세션 검증 방식 — 양호

- `src/lib/supabase/server.ts:40~53` `getClaims()` 사용. 서명 검증(JWKS) 후 `sub`·`is_anonymous`·`email`만 쓴다. `is_anonymous`는 Auth가 발급하는 최상위 클레임이라 `user_metadata`와 달리 사용자가 조작 못 한다 → `deleteAllAction`의 `if (!user.is_anonymous) return;` 신뢰 가능.
- `src/middleware.ts:25` `getUser()`로 토큰 갱신 — @supabase/ssr 권장 패턴. 보호 경로 없음(의도).
- 쿠키: `setAll` try/catch(서버 컴포넌트), 미들웨어가 request/response 양쪽에 set — 표준.
- 주의(낮음): 삭제·로그아웃된 사용자의 액세스 토큰은 만료(기본 1h)까지 유효. `deleteAllAction`은 삭제 뒤 `signOut({scope:"local"})`+새 익명 세션으로 덮으므로 실사용 경로에서는 문제 없음.

### CSRF — 양호

- 모든 쓰기는 Next 서버 액션(`"use server"`) → Next가 Origin/Host 검사. API 라우트는 cron 하나뿐(Bearer). 폼 토큰 별도 필요 없음.

### 계정 연결(linkIdentity) 탈취 가능성 — 낮음

- `createBrowserClient` 기본 PKCE. 공격자가 만든 `code`는 피해자 브라우저의 code_verifier 쿠키와 맞지 않아 교환 실패 → 로그인 CSRF 불가.
- 이미 다른 계정에 묶인 Google이면 `identity_already_exists` → 콜백이 `/settings?error=link`로 처리(`route.ts:16~26`). 양호.
- 운영 대시보드의 **Manual linking** 토글이 켜져 있어야 함 **(추정, 로컬 `config.toml:180`만 확인)**.

### M5 (중간, 추정) — 서버에서 `signInAnonymously()` 호출

- 파일: `src/app/actions.ts:168, 192` (`deleteAllAction`, `signOutAction`)
- Supabase 익명 로그인 레이트리밋은 **IP당 30회/시간**. 서버 액션에서 부르면 Vercel 함수의 egress IP가 모든 사용자의 요청을 대표한다 → 로그아웃·기록삭제가 시간당 30건을 넘으면 그 뒤 사용자는 "준비하고 있어요"에 걸린다(AnonBoot가 클라이언트에서 재시도하므로 완전 차단은 아님).
- 수정: 서버에서는 `signOut`만 하고, 새 익명 세션은 클라이언트 `AnonBoot`에만 맡긴다(이미 2차 안전망으로 구현돼 있음).

### M6 (중간) — 익명 계정 무한 생성, 정리 없음

- `src/components/AnonBoot.tsx:31` 첫 방문마다 `signInAnonymously()` + `night_profiles` 행. 캡차 없음(`auth.captcha` 미설정, 추정).
- 쿠키를 지우고 새로고침만 반복해도 `auth.users`·`night_profiles` 행이 늘어난다. Supabase 문서는 익명 사용자 주기 삭제(예: 30일 미활동)를 권장하지만 cron이 없다. 무료 플랜 MAU·DB 용량에 영향.
- 수정: (1) 운영 대시보드에서 익명 로그인에 Turnstile/hCaptcha 적용, (2) `pg_cron`으로 `auth.users where is_anonymous and created_at < now()-interval '30 days' and no entries` 삭제.

---

## 3. 서버 액션 · API 라우트

### H1 (높음) — 운세 LLM 호출 비용 상한 없음

- 파일: `src/lib/fortune/index.ts:80~143`, `src/app/actions.ts:101~127` (`saveProfileAction`), `src/lib/fortune/llm.ts:15` (`MAX_ATTEMPTS = 3`)
- 증거: 캐시 지문 `fingerprint(pillars, profile)`에 생년월일시·성별·도시가 들어간다(`index.ts:57~65`). 프로필을 바꾸면 그날 캐시가 무효 → 다음 `/` 요청에서 Claude 호출(최대 3회). `saveProfileAction`에 횟수 제한 없음. `night_fortunes.tokens_in/tokens_out` 열은 있으나 **어디서도 쓰지 않는다**(grep 0건) → 비용 집계도 없다.
- 시나리오: 익명 세션 하나로 스크립트가 "프로필 변경 → GET /" 를 반복. 세션당 초당 수 회, 세션은 IP당 30개/시간 추가. 모델 호출당 시스템 프롬프트 수천 토큰(캐시 읽기라도 과금) → 하루에 수십 달러 이상 소진 가능. 정상 사용자도 생년월일을 몇 번 고치면 그때마다 호출.
- 수정(한 줄씩): ① `saveProfileAction`에 하루 N회(예: 5) 제한 — `night_saju_profiles.updated_at` 또는 카운터 열, ② 사용자×날짜 재생성 횟수 상한(캐시 행에 `regen_count`), ③ `GenerateResult.usage`를 `tokens_in/out`에 저장하고 일일 전역 예산 초과 시 템플릿으로 강등, ④ `inFlight` 맵은 인스턴스 로컬이라 분산 환경에서는 중복 방지가 안 됨 — DB 행 `generating_at` 플래그 고려.

### M3 (중간) — `recordShareAction` 무인증·무제한 service role insert

- 파일: `src/app/actions.ts:290~298`
  ```ts
  export async function recordShareAction(kind, method) {
    ...
    const { error } = await adminClient().from("night_share_events").insert({ kind, method });
  ```
- 세션 검사 없음, 레이트리밋 없음. 서버 액션 ID만 알면(번들에서 추출 가능) 누구나 초당 수백 행 삽입 → 운영 숫자 오염 + DB 용량 소모(무료 500MB).
- 수정: `getUser()`로 세션 요구 + 사용자×날짜×method 1회로 upsert(열 추가) 또는 Vercel KV/Upstash 레이트리밋.

### M4 (중간) — 푸시 구독 endpoint 미검증 (SSRF성·소유권)

- 파일: `src/app/actions.ts:243~245`, `src/lib/push.ts:23`
  ```ts
  if (!sub || typeof sub !== "object" || typeof (sub as { endpoint?: unknown }).endpoint !== "string") { ... }
  ```
- 소유권: 구독은 사용자 클라이언트(RLS)로 본인 행에만 저장되고, 크론이 `user_id`로 끄므로 **타인 구독을 덮어쓸 수는 없다** — 양호.
- 문제: `endpoint`가 `https://` 푸시 서비스인지, `keys.p256dh/auth`가 있는지 검사하지 않는다. 임의 URL(`http://10.0.0.1/…`, 공격자 서버)을 넣으면 매일 밤 Vercel 함수가 그 주소로 POST를 보낸다(페이로드는 암호화돼 내용 유출은 없지만 서버 발신 요청을 조종). jsonb 크기 제한도 없다.
- 수정: endpoint가 `https:`이고 호스트가 알려진 푸시 서비스(`fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`, `updates.push.services.mozilla.com`)인지 + `keys.p256dh`·`keys.auth` 문자열인지 검사, 전체 길이 ≤ 2KB.

### 크론 `src/app/api/cron/remind/route.ts`

- 인증: `auth !== \`Bearer ${secret}\`` (14행). 비상수시간 비교(낮음, L7). `CRON_SECRET` 미설정이면 401 — 양호. Vercel이 자동으로 Authorization 헤더를 붙이는 표준 패턴.
- `?hour=` 파라미터는 인증 뒤에만 영향. 오류 시 `error.message` 반환(26행)은 인증된 호출자에게만.
- 스케줄 `vercel.json` `0 12 * * *` = KST 21:00 = `REMIND_HOURS [21]` 일치. 주석("매시 정각")은 낡음.
- 구독 만료(404/410) 시 `enabled=false, web_push=null` 처리 — 양호.

### 운영 숫자 `src/app/stats/page.tsx:28~31`

- `key !== secret` 비상수시간 + **쿼리스트링 비밀**(`/stats?key=`) → 브라우저 히스토리·Vercel 요청 로그·북마크에 남는다(낮음, L8). 실패 시 `notFound()`로 존재 여부를 숨기는 점은 좋다. 노출 범위는 합계뿐.
- 수정: `crypto.timingSafeEqual(Buffer.from(key), Buffer.from(secret))`(길이 먼저 비교) + 헤더/쿠키 기반 또는 Vercel Password Protection.

### 입력 검증 — 양호

- `src/lib/entry.ts` 날짜 2020-01-01~오늘, 행복도 1~10 정수, 기분 허용 목록·3개, 메모 500자, 약속 enum — DB CHECK와 1:1.
- `src/lib/profile.ts` 연·월·일·시·분 범위 + 실제 달력 존재 확인, 도시 허용 목록, 이름 40자.
- `fortuneVoteAction` 날짜가 정규식만(`actions.ts:222`) → 1900년 같은 임의 날짜 행 누적 가능(낮음, L9). `validateEntryDate` 재사용 권장.
- `markLinkPromptedAction` 1~9 클램프.

### 에러 메시지 — 양호

- 사용자에게는 고정 한국어 문구, 상세는 `console.error`(서버 로그)만. 엔진 오류 문구도 `COMPUTE_ERROR`로 치환(`actions.ts:113~116`).

---

## 4. 푸시(VAPID)

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`만 클라이언트, `VAPID_PRIVATE_KEY`는 `push.ts`(`server-only`). 양호.
- `VAPID_SUBJECT` 기본값에 개인 이메일 하드코딩(`push.ts:10`) — 푸시 서비스에 연락처로 전달됨. 정보성.
- `public/sw.js:19,26` `data.url`을 검증 없이 `client.navigate(url)`. 페이로드는 VAPID 서명·암호화돼 서버만 보낼 수 있으므로 현재는 안전하나, 키 유출 시 임의 URL 이동 가능(낮음, L10). `new URL(url, self.location.origin).origin === self.location.origin` 한 줄 추가.

---

## 5. 운세 생성(프롬프트·비용·캐시)

- **프롬프트 인젝션: 없음(양호).** `brief.ts`가 모델에 보내는 입력은 엔진 사실·점수·요일·절기·내 기록 **숫자**뿐. 이름·메모·기분 문자열은 들어가지 않는다(grep 확인). `recent`(최근 3일 운세 headline/body)는 모델 자신의 과거 출력(service role로만 쓰는 테이블)이라 사용자 조작 불가.
- 출력은 `validate.ts` 검사 후 템플릿 폴백, 렌더링은 React 텍스트(`dangerouslySetInnerHTML` 0건) → XSS 없음.
- **비용 상한: H1.** 호출 실패·429는 템플릿으로 강등(`llm.ts:190~198`) — 가용성 양호.
- 캐시 키: `(user_id, fortune_date)`·`(guest_key, fortune_date)` 부분 유니크 + 지문 24hex(96bit) + guest_key 32hex(128bit) → 충돌 무시 가능. 동시 insert 중복(23505)은 `cache.ts`가 찾아서 update — 양호. `inFlight`는 인스턴스 로컬(H1 ④).
- `src/lib/guest.ts`는 **어디서도 import되지 않는 죽은 코드**(쿠키 기반 게스트 경로는 익명 로그인으로 대체됨). 남겨 두면 나중에 검증 없는 쿠키 입력 경로가 되살아날 수 있다(낮음, L11). `actions.ts:36 safeNext`도 미사용.

---

## 6. 헤더 · 설정 (`next.config.ts`, `vercel.json`)

### M1 (중간) — 보안 헤더 없음

- `next.config.ts:18~26` `headers()`는 캐시 헤더만. `vercel.json`은 region·cron만. CSP·`X-Frame-Options`/`frame-ancestors`·`Referrer-Policy`·`X-Content-Type-Options`·`Permissions-Policy` 모두 없음. HSTS는 Vercel이 자동 부여 **(추정, 배포 응답 미확인)**.
- 시나리오: 앱을 iframe에 넣어 투명하게 겹치면 "기록 모두 지우기"(5초 내 두 번 클릭) 같은 서버 액션 버튼을 클릭재킹으로 누르게 할 수 있다. CSP가 없어 서드파티 CSS(jsdelivr)·향후 XSS에 대한 2차 방어도 없다.
- 수정: `headers()`에 전 경로 `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'; default-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co; worker-src 'self'`(먼저 Report-Only로), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- 서드파티: Pretendard CSS를 `@v1.3.9`로 **버전 고정**(양호). 동적 서브셋 CSS라 SRI는 폰트 파일까지 못 덮지만 CSS 자체에 `integrity`는 붙일 수 있다(낮음).

---

## 7. 클라이언트 번들 비밀 유출

- `NEXT_PUBLIC_*` 사용: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VAPID_PUBLIC_KEY` — 모두 공개 전제 값. 양호.
- `server-only`: `admin.ts`, `server.ts`, `push.ts`, `guest.ts`, `fortune/index.ts`. `adminClient` 호출처는 `actions.ts`("use server")·cron 라우트·`stats/page.tsx`(서버 컴포넌트)·`fortune/index.ts`뿐 → 서비스 롤 키가 클라이언트로 갈 경로 없음. `db.ts`는 `server-only`가 없지만 클라이언트를 인자로 받고 비밀을 읽지 않는다.
- 저장소에 JWT/`sb_secret_` 하드코딩 0건. `.gitignore`가 `.env*`를 덮고 `.env.example`만 추적.
- `.env.local`에 **`OPENAI_API_KEY`가 있으나 diary 코드는 쓰지 않는다**(낮음, L12) — 유출 면적만 늘리므로 제거.
- 레거시 루트 `.env`에 `ADMIN_EMAILS`·많은 `NEXT_PUBLIC_FF_*` — 레거시 범위.

---

## 8. 낮음 항목 모음

| # | 위치 | 내용 | 수정 |
|---|---|---|---|
| L7 | `api/cron/remind/route.ts:14` | `!==` 비상수시간 비교 | `timingSafeEqual` |
| L8 | `stats/page.tsx:28~31` | 쿼리스트링 비밀 + `!==` | 헤더/쿠키 + `timingSafeEqual` |
| L9 | `actions.ts:222` | 투표 날짜 범위 미검사 | `validateEntryDate` 재사용 |
| L10 | `public/sw.js:26` | push `url` 동일 출처 미확인 | origin 비교 |
| L11 | `lib/guest.ts`, `actions.ts:36` | 미사용 코드(쿠키 입력 경로) | 삭제 |
| L12 | `.env.local` | 미사용 `OPENAI_API_KEY` | 제거 |
| L13 | `package.json:13~23` | `^` 범위 지정(스킬: 정확 고정 권장). lockfile은 커밋됨. `@supabase/ssr` 0.7.0은 루트(0.12)보다 낡음 | `0.12.x`로 올리고 정확 버전 고정 |
| L14 | `015_...sql:185` | 레거시 `auth.role()` (L1과 동일) | `to authenticated` |

---

## 9. 잘 된 점

1. **RLS 설계가 교과서적** — 모든 `night_*` 테이블에 RLS, `to authenticated` + `(select auth.uid()) = user_id` + `with check`, 운세 테이블은 읽기 전용, 공유 집계 테이블은 정책 없음(브라우저 완전 차단). SECURITY DEFINER·뷰 없음, 트리거 함수 `search_path` 고정.
2. **세션 검증이 올바름** — `getClaims()`로 서명 검증, 화면·액션은 `sub`/`is_anonymous`만 신뢰, `user_metadata` 미사용. 미들웨어는 토큰 갱신만. 서비스 롤은 `server-only` 뒤에, 사용자 데이터는 항상 사용자 클라이언트(RLS)로.
3. **입력 검증이 서버·DB 이중** — `entry.ts`/`profile.ts` 허용 목록·범위 검증이 DB CHECK 제약과 일치. 오류 문구는 고정 한국어, 내부 메시지는 로그만.
4. **LLM 경로에 사용자 문자열이 들어가지 않음** — 프롬프트 인젝션 면적 0. 출력은 검사기 통과분만, 렌더링은 텍스트 노드. 실패 시 템플릿 폴백으로 가용성 유지.
5. **계정 삭제 흐름이 신중함** — 사용자 클라이언트로 본인 행 삭제 → service role은 `user_id` 조건 필수 → `auth.admin.deleteUser` → 실패 시 세션 유지. 게스트 쿠키도 `httpOnly/sameSite=lax/secure`.

---

## 10. 우선순위 제안

1. H2 `safeNext` 공통화(`new URL(...).origin` 비교) — 30분.
2. H1 프로필 변경 하루 제한 + 재생성 상한 + 토큰 집계 저장 — 반나절.
3. M1 보안 헤더(`frame-ancestors`/XFO 먼저, CSP는 Report-Only) — 1시간.
4. M3 `recordShareAction` 세션 요구 + 일 1회 — 30분.
5. M4 푸시 endpoint 허용 목록 — 30분.
6. M2 `fresh` 경로 `signOut` 제거 — 10분.
7. M5/M6 서버 `signInAnonymously` 제거, 익명 캡차·정리 cron — 설정 작업.
