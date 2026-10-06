# 익명 시작 · 속도 · 설정 (2026-10-06)

> 사용자 피드백(2026-10-06) 1·2·4·5·6·9번에 대한 기능 설계. 디자인(로딩 UI 모양)은 톤 v3.2가 정한다.

## 1. 익명 시작 (Supabase Anonymous Sign-in, 대시보드에서 이미 켜짐)

- 첫 방문: 세션이 없으면 **서버가 아니라 클라이언트**에서 `supabase.auth.signInAnonymously()`를 한 번 호출해 세션 쿠키를 만든다(미들웨어에서 하면 매 요청마다 시도할 위험). 구현: `src/components/AnonBoot.tsx`(client, layout에 마운트) — `getSession()`이 null이면 `signInAnonymously()` 뒤 `router.refresh()`.
- 익명 사용자도 `auth.users`에 생기므로 RLS·`night_*` 테이블·알림·크론이 **그대로** 동작한다. `ensureUserRow`를 익명 세션에도 적용(이름 "손님").
- 게스트 쿠키(`night_guest`) 경로는 제거한다. 생년월일은 익명 계정의 `night_saju_profiles`에 저장. `readGuestProfile`·`guestProfileAction`·`clearGuestAction`·`guestKeyOf` 삭제, `night_fortunes.guest_key`는 컬럼만 남김(마이그레이션 불필요).
- 미들웨어 `PROTECTED` 제거. `/write`·`/me`·`/onboarding`은 세션(익명 포함)만 있으면 통과. 세션이 아직 없으면(첫 요청) 리디렉트하지 않고 페이지가 "준비 중" 상태를 그린다 — AnonBoot가 곧 refresh한다.
- 프로필이 없는 익명 사용자가 `/write`·`/me`에 가면 `/onboarding?next=…`로 보낸다(지금 로그인 사용자와 같은 규칙).

## 2. Google 연결 (익명 → 영구)

- `supabase.auth.linkIdentity({ provider: "google" })` 를 쓰는 버튼 `LinkGoogleButton.tsx`. 콜백은 기존 `/auth/callback` 재사용(코드 교환 뒤 `next`로). 연결되면 `auth.users.is_anonymous`가 false가 되고 같은 user_id라 데이터가 그대로다.
- 보여 주는 곳: ① **첫 저장 직후** 오늘 화면의 "오늘의 기록" 카드 아래 한 번("기기를 바꿔도 남게 Google로 연결해요" + 버튼 + "나중에"). `night_profiles.link_prompted_at`(새 컬럼, 마이그레이션 `0002_anon.sql`)에 기록해 한 번만. ② 기록 7건째 한 번 더. ③ 설정에는 항상.
- 이미 Google로 로그인한 기존 사용자(11명)는 그대로. `/login`은 링크를 전부 지우되 **주소를 직접 치면 열린다**(기존 사용자용). 로그인 화면 문구는 "이미 Google로 쓰던 분은 여기서 이어가요".
- 익명 사용자가 `/login`에서 Google 로그인을 하면(링크가 아니라 로그인) 새 계정이 되어 익명 데이터와 분리된다 — 그래서 `/login`에서도 세션이 익명이면 `linkIdentity`를 쓴다.

## 3. 설정 모으기 (피드백 2번)

- `/me` 오른쪽 위 "설정" 글자 링크 → `/settings`(새 페이지): Google 연결 상태(연결됨 이메일 / 연결 버튼), 알림(`NotificationSettings` 이동), 생년월일 고치기(→ `/onboarding`), 앱으로 두기(`InstallHint` 이동), 로그아웃(Google 연결된 계정만 표시. 익명 사용자에게는 "기록 모두 지우기"로 바꿔 보여 주고 확인 한 번).
- `/me`에서는 이메일 표시·로그아웃·알림 블록을 뺀다.
- 로그아웃 뒤 흐름: `signOutAction` → `redirect("/")` 로 바로. 중간 화면이 보이지 않게 액션 안에서 끝낸다. 로그아웃하면 다음 방문 때 AnonBoot가 새 익명 세션을 만든다(기존 익명 데이터는 그 기기에서 더 못 봄 — 설정의 "기록 모두 지우기" 문구가 이것을 설명).

## 4. 속도 (피드백 1·4·5·6)

- **스트리밍**: `src/app/page.tsx`를 두 층으로. 바깥(제목·60칸 띠·기록 카드)은 즉시 렌더, 운세 카드는 `<Suspense fallback={<FortuneLoading/>}>` 안의 서버 컴포넌트 `FortuneSection`이 `getTodayFortune`을 기다린다. 모델 호출 3~6초 동안 나머지 화면은 이미 보인다.
- `src/app/{write,me,settings}/loading.tsx` 추가: 화면 뼈대(카드 틀 + 제목 자리). 탭을 누르는 즉시 그려진다. 모양은 톤 v3.2 "로딩" 절.
- `FortuneLoading` 모양도 톤 v3.2. 기능 쪽은 자리만 만든다(`className="fortune-loading"`, 글자 "오늘 글자를 읽고 있어요").
- 생년월일 저장 액션(`saveProfileAction`)은 저장 뒤 **운세를 기다리지 않고** `redirect("/")`. 운세는 오늘 화면의 Suspense가 맡는다.
- BottomNav 링크에 `prefetch` 기본값 유지. 탭 전환 시 서버 컴포넌트 재요청이 느린 부분은 `loading.tsx`가 가린다.

## 5. 테스트·확인

- `test/`: 익명 세션에서 saveEntryAction이 저장되는지(가짜 supabase), linkIdentity 버튼이 익명일 때만 "연결" 문구인지, PROTECTED 제거 뒤 미들웨어가 리디렉트하지 않는지.
- 수동: 시크릿 창에서 `/` → 생년월일 입력 → 바로 오늘 화면(운세 자리 로딩) → 몇 초 뒤 운세 → 쓰기 저장 → 팡 → Google 연결 카드 1회 → 설정에서 상태 확인.
- 마이그레이션 `apps/diary/supabase/migrations/0002_anon.sql`: `night_profiles.link_prompted_at timestamptz`, `link_prompt_count smallint default 0`. 사용자가 SQL Editor에서 적용해야 한다 — 보고에 명시.

## 하지 않는 것
- 익명 행 정리 크론(나중에. 30일 이상 기록 0건인 익명 계정 삭제).
- 카카오 로그인.
