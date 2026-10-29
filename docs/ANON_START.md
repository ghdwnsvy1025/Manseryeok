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
- 로그아웃 뒤 흐름: `signOutAction` → `redirect("/")` 로 바로. 중간 화면이 보이지 않게 액션 안에서 끝낸다. 로그아웃 액션 안에서 바로 새 익명 세션을 만들어 쿠키를 심은 뒤 redirect한다(2026-10-07 수정: 소프트 내비게이션이라 AnonBoot effect가 재실행되지 않아 멈추던 버그). AnonBoot는 경로 변경마다 세션을 재확인하는 안전망. 기존 익명 데이터는 그 기기에서 더 못 봄 — 설정의 "기록 모두 지우기" 문구가 이것을 설명.

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

## 6. 홈 화면 앱에서 Google 연결이 안 붙던 일 (2026-10-25)

### 무슨 일이 있었나
2026-10-23 밤 iPhone 홈 화면 앱(익명 `1aa4bbd3…`)에서 설정의 "Google로 연결하기"를 눌렀는데 연결이 붙지 않았고, 앱에는 아무 안내도 없었다. 그 몇 분 사이 Safari 쪽 옛 익명 계정(`887dd8f4…`)이 움직였다.

### 원인 (두 겹)
1. **그 Google은 이미 다른 계정이다.** 운영 Auth를 읽어 보니 같은 생년월일(1995-10-25)로 익명 시작 전에 Google 로그인해 만든 계정이 둘 있다 — `7c3da5b6…`(10-03, google+email)과 `dc056437…`(10-04, google+email). Supabase는 익명 계정에 이미 다른 사용자에게 붙은 Google을 연결하지 않는다(`identity_already_exists`, 메일만 겹치면 `email_exists`). 이 거절은 Supabase 콜백(`/auth/v1/callback`) 안에서 정해지고 연결은 트랜잭션째 되돌려진다 — supabase/auth `internal/api/external.go`의 `linkIdentityToUser` 뒤에야 PKCE 코드를 주므로, **코드가 우리 콜백에 왔다면 연결은 이미 저장된 것**이고 코드 대신 오류가 왔다면 연결은 없다.
   - 전 진단(10-24)의 "어느 계정에도 Google 없음"은 `auth.admin.listUsers()`가 `identities`를 빈 배열로 돌려준 데서 나왔다. 계정별 `getUserById()`나 `app_metadata.providers`로 봐야 한다.
2. **결과가 앱이 아닌 창으로 갔다.** iOS 홈 화면 앱은 다른 출처(Google)로 가는 이동을 앱 밖(인앱 브라우저·Safari)에서 열고, 콜백도 그 창의 쿠키로 돌아온다. 그래서 오류 안내(`/settings?error=link`)는 Safari의 옛 계정 설정 화면에 떴고, 앱은 "Google로 이동하는 중…"에 멈춘 채 아무것도 몰랐다.

### 바뀐 흐름
- 버튼(설정·첫 저장 안내의 `LinkGoogleButton`, `/login`의 `GoogleButton`)은 콜백 주소에 `mode=link|fresh`를 붙이고, 연결이면 localStorage `night_link_pending`(누른 시각)을 남긴다.
- `/auth/callback`은 요청에 PKCE verifier 쿠키(`sb-<ref>-auth-token-code-verifier`)가 있는지로 **버튼을 누른 창인지** 가른다(`lib/googleLink.ts`).
  - 누른 창: 전과 같다 — 오류면 `/settings?error=link|1`(또는 `/login`), 성공이면 교환 뒤 `next`. 연결 코드인데 교환만 실패하면 연결은 됐으니 `next`로(아래 확인이 "연결됨"을 그린다).
  - 다른 창: 그 창의 계정을 건드리지 않고 세션을 읽지 않는 안내 `/auth/done?status=…`로. `linked`(연결 코드가 왔다 = 연결됨, 앱으로 돌아가요) · `exists`(이미 다른 기록이 있는 Google, 다른 계정으로) · `other-browser`(기존 계정 로그인은 이 창에서 못 마침) · `failed`. 이 화면에서는 AnonBoot가 익명 계정을 만들지 않는다.
- 앱으로 돌아오면(`visibilitychange`·`pageshow`) `useLinkReturn`이 누른 흔적을 보고 `refreshSession()` — 연결됐으면 흔적을 지우고 화면을 다시 그려 "연결됨"(AuthSync가 `login_success mode=link`), 아니면 "아직 연결되지 않았어요 … 그 Google 계정으로 전에 만든 기록이 따로 있는 거예요. 다른 Google 계정으로" + "다시 확인". 멈춰 있던 버튼도 푼다.
- **이미 이 계정에 붙음은 성공이다** (2026-10-25 밤 사용자가 겪음): 연결이 다른 창에서 끝났는데 화면의 토큰은 최대 1시간 익명으로 남아 버튼이 그대로 보이고, 한 번 더 누르면 Supabase가 `identity_already_exists` "Identity is already linked"(바로 이 계정)로 거절한다. 예전 콜백은 이것을 "이 Google 계정은 이미 다른 기록과 연결돼 있어요"로 옮겼다. 이제 ① 버튼은 누르기 직전 `refreshSession()`으로 토큰을 갱신해(`anonymousNow`) 이미 Google 계정이면 Google로 가지 않고 화면만 새로 그리고, ② 콜백은 "… to another user"·`email_exists`만 실패(`other`)로, 바로 이 계정(`self`)은 연결 성공과 같게(누른 창은 `next`, 다른 창은 `/auth/done?status=linked`) 보낸다.
- 검토했다가 버린 안: verifier를 서버에서 만들어 콜백 주소에 봉인해 싣기(10-24 곁 세션 `claude/friendly-mahavira-2fe1bb` 작업 트리). 연결은 교환과 무관하게 Supabase에서 끝나므로 얻는 것이 없고, 코드와 verifier가 한 주소에 실려 그 주소만 있으면 세션을 받을 수 있게 된다.

### 남은 것
- 홈 화면 앱에서 **기존 Google 계정으로 로그인**(새 세션 받기)은 여전히 앱 안에서 끝나지 않는다 — 세션이 Safari 쪽에 생긴다. 앱 안에서 되게 하려면 다른 창에서 받은 세션을 서버를 거쳐 앱에 넘기는 장치가 필요하다(별도 작업).
- 이 사용자의 기록 (2026-10-25, 사용자 승인 뒤 실행): Safari `887dd8f4…`의 기록 10·운세 11·피드백 4와 옛 Google `7c3da5b6…`(g***@naver.com)의 기록 12·운세 3·피드백 1을 폰 앱 `1aa4bbd3…`로 옮기고(같은 날 운세는 폰 앱 > Safari > Google 순으로 하나), `7c3da5b6…` 계정을 지웠다 → 폰 앱 기록 23·운세 16·피드백 5. 이제 폰 앱에서 그 Google로 "연결하기"를 하면 붙는다. `dc056437…`(h***@gmail.com, 옛 앱 기록 64)은 그대로. 백업·스크립트·실행 기록은 저장소 밖 `사주 일기/백업/기록이동_2026-10-25/`(일기 원문 포함, 공유 금지).
- 테스트: `test/google-link.test.ts`.

## 7. 첫 화면에서 Google로 기록 지키며 시작 (2026-10-29)

사용자 결정(문답): 첫 화면 Google은 **새로 온 사람이 처음부터 기록을 지키는** 용도이고 고를 수 있다(익명 시작이 기본). 전에 쓰던 사람의 로그인은 지금의 작은 링크("이미 Google로 쓰던 분은 여기서 로그인")로 둔다.

- 자리: 온보딩 카드 안, 금색 "내 카드 보기" 아래 테두리 버튼 "Google로 기록 지키며 시작" + "폰을 바꾸거나 앱을 지워도 기록이 그대로예요"(디자인 명세 30 3절). 익명 첫 온보딩에서만(`offerGoogle`).
- 순서: **생년월일 저장이 먼저**다. 폼의 두 번째 제출 버튼이라 `then=google`이 붙고, `saveProfileAction`은 저장 뒤 이동하지 않고 `{ then: "google" }`을 돌려준다(revalidatePath도 안 한다 — 하면 화면이 "고치기"로 다시 그려져 버튼이 사라진다). 그다음 `GoogleStart`가 토큰을 갱신해(`anonymousNow`) 익명이면 `linkIdentity`(next `/welcome`, mode link). Google을 오가는 동안 적은 생년월일이 사라질 일이 없다.
- 결과:
  - 연결됨 → `/welcome`(같은 창은 콜백이, 홈 화면 앱은 돌아와서 `useLinkReturn`이 확인하고 이동).
  - 그 Google이 이미 다른 계정 → 같은 창은 `/auth/done?status=exists&next=/welcome`: "지금 기록에 붙이지 못했어요. 방금 적은 생년월일로 그대로 시작해요" + 금색 "내 카드 보기" + 작은 "전에 쓰던 기록으로 가려면 여기서 로그인". 다른 창은 6절 그대로.
  - 취소·그 밖의 실패 → 같은 창은 그냥 `/welcome`(기록은 이미 만들어졌다). 앱 화면에서 확인이 안 되면 6절의 "아직 연결되지 않았어요" 아래 "그냥 내 카드 보기".
- 파일: `src/app/onboarding/GoogleStart.tsx`, `ProfileForm.tsx`(`offerGoogle`, submitter), `actions.ts`(`FormState.then`), `lib/googleLink.ts`(`ONBOARDING_LINK_NEXT`, `providerErrorTarget`), `app/auth/done/page.tsx`. 테스트 `test/google-link.test.ts`·`test/anon.test.ts`.
- 확인 못 한 것: 실제 Google 화면을 거치는 흐름(로컬에서 첫 화면을 열면 운영 DB에 익명 계정이 생겨 열지 않았다).

## 하지 않는 것
- 익명 행 정리 크론(나중에. 30일 이상 기록 0건인 익명 계정 삭제).
- 카카오 로그인.
