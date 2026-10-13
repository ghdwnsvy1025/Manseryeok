# A. 코드 정확성·버그·테스트 검토 — 사주 일기 (apps/diary, 브랜치 rebuild)

검토일 2026-10-14. 읽기 전용 검토. 기준: 소스 전수 읽기 + `vercel-react-best-practices` 스킬 + `claude-api` 스킬(Anthropic API 파라미터 검증).
경로는 모두 `apps/diary/` 기준. "추정"으로 표시한 항목은 코드 읽기로만 판단했고 실행으로 재현하지 않은 것.

## 0. 실행 결과

| 항목 | 결과 |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **통과** (오류 0) |
| `npm test` (`vitest run`, `ANTHROPIC_API_KEY` 환경변수 제거하고 실행) | **23 파일 / 217 테스트 전부 통과**, 9.2초 |
| 네트워크 | 테스트는 네트워크를 쓰지 않는다. Supabase·Anthropic·next/cache·next/navigation은 전부 `vi.mock` 또는 가짜 객체(`client` 옵션)로 대체된다. vitest는 `.env.local`을 읽지 않으므로 실제 키가 테스트로 흘러들지 않는다. `fortune.test.ts:742` "키가 없으면 모델을 부르지 않고 템플릿" 테스트만 `process.env.ANTHROPIC_API_KEY`를 직접 지우고 복구한다. |

`vitest.scripts.config.ts`에 묶인 스크립트(백테스트·샘플·이관)는 `npm test`에 포함되지 않는다(이것은 실제 모델·DB를 부르는 일회성 도구라 의도된 분리로 보인다).

## 1. 발견 사항

### 치명

**A-1. `/me` 달력이 30일 이하 달에서 500 — `entry_date <= 'YYYY-MM-31'`**
- 파일: `src/lib/db.ts:211` (`listEntriesInMonth`)
- 증거:
  ```ts
  sb.from("night_entries").select(cols).eq("user_id", userId)
    .gte("entry_date", `${ym}-01`).lte("entry_date", `${ym}-31`)
  ```
  `supabase/migrations/0001_night_core.sql:57`: `entry_date date not null`
- 실패 시나리오: `ym`이 `2026-09`, `2026-11`, `2026-02` 등 31일이 없는 달이면 PostgREST가 `entry_date <= '2026-09-31'`로 보내고 Postgres가 `date/time field value out of range` (22008)로 거절한다. `listEntriesInMonth`는 `fail("한 달 기록 읽기")`로 throw → `MePage`의 `Promise.all`이 통째로 실패 → 나 화면 전체가 에러. 오늘(10월, 31일)은 멀쩡하지만, 달력의 "‹ 이전 달"(→ `/me?m=2026-09`)을 누르는 즉시 재현되고, 11월 1일부터는 기본 화면이 깨진다. `?d=2026-09-15` 링크(상세 날짜)도 같은 길을 탄다. 1년 중 5개월이 해당.
- DB에 직접 실행해 보지는 못했고(검토 권한 범위 밖) 컬럼 타입과 Postgres 날짜 리터럴 규칙으로 판정했다. 재현은 `/me?m=2026-09`를 열어 보면 된다.
- 수정 제안: `.lt("entry_date", 다음달-01)` (예: `shift(ym, 1) + "-01"` — `calendar.ts`의 `shift`를 export) 또는 `buildMonth`가 이미 아는 `daysIn`으로 `-${pad(daysIn)}`을 만든다. 테스트에 "9월·2월 범위"를 추가.

### 높음

**A-2. 운세 생성 경로에 시간 상한이 없다 — Vercel 함수 제한에 걸리면 Suspense가 영원히 안 끝나고 캐시도 안 남는다**
- 파일: `src/lib/fortune/llm.ts:190, 140-146`, `src/app/page.tsx:73` (`dynamic = "force-dynamic"`만 있고 `maxDuration` 없음), `vercel.json`(functions 설정 없음)
- 증거:
  ```ts
  const client = opts.client ?? (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null);
  ...
  thinking: { type: "adaptive" }, output_config: { effort: "low", ... }, max_tokens: 2048
  ```
  `new Anthropic()`은 timeout 기본 10분, maxRetries 기본 2(429·5xx·연결 오류는 자동 재시도). `MAX_ATTEMPTS = 3`이므로 최악의 경우 한 화면 렌더에서 HTTP 호출이 3×3 = 9번까지 갈 수 있다. 실측(REBUILD_PLAN 6절) 첫 호출 3.9초.
- 실패 시나리오: Anthropic 쪽이 느리거나 529/5xx를 내는 날, 함수 실행 시간이 Vercel 기본 상한(Hobby 10초, Pro 15초 — `maxDuration` 미설정)을 넘기면 스트리밍 중인 RSC 응답이 끊긴다. 사용자는 `FortuneLoading` 뼈대에 머물고, `saveFortuneCache`까지 도달하지 못해 캐시가 안 남으므로 다음 방문에 **같은 비용을 다시 쓴다**. 사용자가 새로고침을 반복하면 비용이 선형으로 는다(아래 A-4와 결합).
- 수정 제안: `new Anthropic({ timeout: 8_000, maxRetries: 0 })`(TS SDK는 밀리초) + `page.tsx`에 `export const maxDuration = 30`(플랜에 맞게) 두 줄. 재시도는 `generateFortuneText`의 attempt 루프가 이미 맡고 있으니 SDK 재시도는 끄는 게 맞다.

**A-3. 모델 호출이 실패하면 "템플릿" 결과가 그 날 캐시에 영구 저장된다 — 일시 장애가 하루 종일 굳는다**
- 파일: `src/lib/fortune/index.ts:128-142`, `src/lib/fortune/llm.ts:195-206`
- 증거:
  ```ts
  const content = await computeFortune({ ...req, recent });   // source: "template" 이어도
  const row: FortuneCacheRow = { ..., content, model: content.source === "llm" ? ... : null };
  await saveFortuneCache(sb, req.owner, row, cached?.id ?? null);
  ```
  `llm.ts`: `catch (e) { ... result.issues.push([why]); return result; }` — 429·5xx·타임아웃·JSON 파싱 실패 모두 템플릿으로 떨어지고, `index.ts`는 source를 보지 않고 캐시에 쓴다. 다음 요청은 `cachedFortuneContent`가 지문만 맞으면 그대로 돌려준다.
- 실패 시나리오: 오전 7시 Anthropic 529가 2분 지속 → 그 사이 열어 본 사용자 전원이 하루 종일 템플릿 운세("내 속도대로 가는 날이에요" 류)를 본다. v4.5 테스트 기준 템플릿 비율 12%를 줄이려 attempt를 3으로 늘린 노력과 어긋난다. 반대로 "3회 탈락 → 템플릿"은 재시도해도 같을 가능성이 높으니 캐시해도 된다 — 즉 API 오류와 검사 탈락을 구분해야 한다.
- 수정 제안: `GenerateResult.issues`의 첫 항목이 API 오류/키 없음이면 캐시에 쓰지 않거나(`content.attempts === 0 || issues[0]이 API 오류`), 캐시 행에 `retry_after`를 두고 `cachedFortuneContent`가 그것을 보게 한다.

**A-4. 같은 사용자·같은 날 모델이 두 번 불릴 수 있다 (프리페치 + 실제 이동, 또는 서버리스 인스턴스 분산)** — 추정
- 파일: `src/lib/fortune/index.ts:68-78`, `src/components/BottomNav.tsx:78-89, 104-106`, `next.config.ts` (`staleTimes.dynamic: 30`)
- 증거:
  ```ts
  const inFlight = new Map<string, Promise<FortuneContent>>();   // 모듈 변수 = 인스턴스 하나 안에서만 공유
  ```
  `BottomNav`는 `/write`·`/me`에 있을 때 idle 시점에 `router.prefetch("/")`(전체 RSC)를 날리고, `<Link prefetch={true}>`도 건다. 캐시 미스인 날 이 프리페치가 `FortuneSection` → `getTodayFortune`을 돌린다.
- 실패 시나리오: 온보딩 직후 `/welcome` → 사용자가 "오늘 운세 보기"를 누르는 사이 프리페치가 먼저 떠 있던 요청과 다른 Vercel 인스턴스로 가면 `inFlight`가 공유되지 않아 모델 호출이 2번. `saveFortuneCache`의 중복키 → update 폴백 덕에 오류는 없지만 비용은 2배. 1,000 DAU 기준 월 20만 원 예산(REBUILD_PLAN)의 가정이 "하루 1회"라 이 경로가 열리면 흔들린다.
- 수정 제안: DB에 "계산 중" 표식(`night_fortunes`에 `content null` 행을 먼저 insert, 중복키면 짧게 폴링)으로 인스턴스 간 잠금을 걸거나, 프리페치는 운세 섹션을 건너뛰게(`FortuneSection`에서 `headers()`의 `Next-Router-Prefetch`/`RSC` 확인 → 캐시 미스면 호출하지 않고 로딩만 반환).

### 중간

**A-5. `max_tokens: 2048`에 adaptive thinking — thinking 토큰이 상한에 포함돼 JSON이 잘릴 수 있다** — 추정
- 파일: `src/lib/fortune/llm.ts:138-146, 155-157`
- 증거:
  ```ts
  max_tokens: 2048, thinking: { type: "adaptive" }, output_config: { effort: "low", format: { type: "json_schema", ... } }
  ...
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text");
  return JSON.parse(text.text) as ModelText;
  ```
  `stop_reason === "max_tokens"`를 보지 않는다. 잘린 JSON은 `JSON.parse`에서 throw → 재작성 없이 곧장 템플릿(그리고 A-3에 따라 하루 캐시).
- API 파라미터 자체(`claude-sonnet-5` + adaptive + effort low + `output_config.format`)는 claude-api 스킬 기준으로 유효하다. 샘플링 파라미터를 보내지 않는다는 주석도 맞다. 시스템 프롬프트 `cache_control`도 올바르게 걸려 있다.
- 수정 제안: `max_tokens`를 4096~8192로 올리고(출력은 ~500토큰이라 비용 차이 없음), `stop_reason === "max_tokens"`면 `issues`에 남기고 attempt를 이어 가게.

**A-6. `getLinkPromptState`·`markLinkPrompted`의 오류 삼킴 정규식이 너무 넓다**
- 파일: `src/lib/db.ts:259, 274`
- 증거: `if (error.code === "42703" || /column|does not exist/i.test(error.message)) return { promptedAt: null, promptCount: 0 };`
- 실패 시나리오: 메시지에 "column"이 들어가는 다른 오류(권한, 타입 불일치, RLS 위반 등)도 "컬럼 없음"으로 보고 조용히 0을 돌려준다 → 익명 사용자에게 연결 안내 카드가 매번 다시 뜬다. 같은 파일의 `isMissingColumnError`(155행)가 이미 정확한 판정을 가지고 있는데 두 곳만 옛 정규식을 쓴다.
- 수정 제안: 두 곳 모두 `isMissingColumnError(error)`로 교체.

**A-7. 쓰기 화면 새벽 분기의 직렬 쿼리(워터폴)와 `hourKST()` 두 번 호출**
- 파일: `src/app/write/page.tsx:30-38, 47-51`
- 증거:
  ```ts
  if (!requested && hourKST() < NIGHT_CUTOFF_HOUR) {
    const y = await getEntry(supabase, user.id, yesterday);          // 1차 왕복
    const carry = nightCarryDate(today, hourKST(), Boolean(y));     // 시각을 다시 읽음
  ...
  const [existing, profile, cachedFortune] = await Promise.all([ getEntry(supabase, user.id, date), ... ]);  // 2차 왕복
  ```
- 실패 시나리오: 0~4시에 `getEntry`가 두 번 직렬로 간다(carry가 되면 같은 날짜를 두 번 읽는다). 03:59:59에 첫 `hourKST()`는 3, 둘째는 4가 되면 carry가 조용히 꺼진다 — 결과는 "오늘로 열림"이라 해롭진 않지만 비결정적이다. (`async-parallel` 규칙)
- 수정 제안: 시각을 한 번만 변수에 담고, 어제 기록·프로필·오늘 기록을 한 `Promise.all`로 읽은 뒤 날짜를 결정한다.

**A-8. 운세 점수에 "오늘 쓴 기록"이 다시 들어간다 (자기 참조)** — 설계 확인 필요
- 파일: `src/app/page.tsx:142-150, 171-172`, `src/lib/fortune/live.ts:85-90`, `src/lib/fortune/personal.ts:37`
- 증거: `listEntriesForStats`는 오늘 기록을 포함하고, 캐시 미스 날 `computeFortune`의 `adjustWithEntries`가 그 기록을 "오늘과 같은 일간/일지" 집합에 넣는다. 캐시 히트 날도 `withLivePersonal`이 오늘 기록을 넣어 "내 기록으로 본 오늘" 막대를 그린다.
- 실패 시나리오: 사용자가 먼저 기록(행복도 9)을 쓰고 운세를 처음 열면, 오늘 점수가 오늘의 행복도를 보고 올라간다 — "맞춤도"가 실제보다 좋아 보인다. B5 설계 메모는 블록 표시만 언급하고 점수 계산을 의도했는지는 적혀 있지 않다.
- 수정 제안: `adjustWithEntries`에 넘길 때 `entry_date !== today`로 거른다(표시 블록은 그대로 둬도 된다).

**A-9. `recordShareAction`은 인증 없이 아무나 호출할 수 있는 서버 액션인데, 부르는 화면이 없다**
- 파일: `src/app/actions.ts:289-297`, `src/components/FortuneShareButton.tsx` (어느 페이지도 import하지 않음), `src/lib/fortuneShareCanvas.ts`, `src/lib/shareCanvas.ts`, `src/lib/guest.ts`(`readGuestProfile` 등 미사용)
- 증거: `adminClient().from("night_share_events").insert({ kind, method })` — `getUser()` 확인 없음. (`server-auth-actions` 규칙)
- 실패 시나리오: 액션 ID만 알면 `night_share_events`에 무한 insert → `/stats` 공유 숫자 오염. 현재 v3.24에서 공유 버튼이 빠져 있어 호출 코드는 죽은 코드다.
- 수정 제안: 당장은 액션·버튼·캔버스·`guest.ts`를 지우거나, 남길 거면 `getUser()`로 세션을 확인하고 하루 N회로 제한.

### 낮음

**A-10. 알림 시각 불일치 가능성** — `src/lib/remind.ts:79`(`REMIND_HOURS = [21]`) vs `src/app/settings/page.tsx:524`(`Math.max(20, Math.min(23, hourOf(...)))`), `NotificationSettings.tsx:556`("매일 밤 ${remindHour}시"). DB에 `22:00`이 들어 있으면 화면은 22시라고 말하지만 크론은 21시 한 번만 돌아(`pickDue`가 `hourOf === 21`만 고름) 알림이 영원히 안 간다. 지금은 `enablePushAction`이 21로 강제하니 레거시/수동 데이터에서만 생긴다. 제안: 설정 화면도 `isAllowedRemindHour`로 보정.

**A-11. `TouchFx`의 `:has()` 선택자** — `src/components/TouchFx.tsx:1003` `label:has(> input)`. 오래된 Safari(15.3 이하)·일부 웹뷰에서 `closest()`가 SyntaxError를 던져 누를 때마다 콘솔 오류(기능은 CSS :active라 살아 있음). 제안: try/catch 또는 `label` 단독.

**A-12. 연결 안내 카드가 두 번 연속 뜰 수 있음** — `src/lib/linkPrompt.ts:222-227` + `LinkPromptCard.tsx:692-694`. 기록이 이미 7건 이상인 익명 사용자(이관 데이터 등)는 `promptCount 0 → 1`로 기록된 다음 렌더에서 `promptCount === 1 && entryCount >= 7`로 다시 참 → 연속 두 번. 제안: 첫 표시 때 `entryCount >= 7`이면 count를 2로 기록.

**A-13. `EntryForm` 하이드레이션 복구 effect는 React 내부 동작에 기댄다** — 추정. `src/app/write/EntryForm.tsx:165-177`. 제어 라디오(`checked={on}`)를 React가 하이드레이션 때 상태(null)로 되돌리면 `FormData`에 값이 안 남는다. 2026-10-08 진단에서 실기기로 확인했다고 적혀 있으니 동작은 하겠지만 테스트가 없고 React 마이너 업데이트에 취약하다. 제안: 라디오를 `defaultChecked` + `onChange`(비제어)로 바꾸면 effect 자체가 필요 없다.

**A-14. 투표 연타 경쟁** — 추정. `src/components/VoteButtons.tsx:152-166`. 빠르게 두 번 누르면 `upsert(1)`과 `delete`가 서로 다른 요청으로 나가 서버 도착 순서가 뒤바뀔 수 있고, UI(sessionStorage)는 마지막 누른 값을 믿는다. 제안: 직전 transition이 끝날 때까지 버튼 비활성.

**A-15. 자잘한 것**
- `src/lib/entry.ts:66` 주석 "레거시와 같은 13개" — 실제 20개.
- `src/app/page.tsx:68-71` import가 함수 정의 뒤에 온다(동작엔 문제 없음).
- `src/app/me/page.tsx:138-143` `countEntries`와 `listEntriesForStats`(limit 2000)를 둘 다 읽는다 — 2000건 미만이면 `all.length`로 충분.
- `src/app/stats/page.tsx:318` `key !== secret` 단순 비교(타이밍 공격은 실익이 없어 보이나 `crypto.timingSafeEqual`이 한 줄).
- `src/lib/time.ts` 모듈 상단의 `Intl.DateTimeFormat` 재사용은 좋다(`js-cache-function-results`). 다만 `page.tsx:131-133`에서 `todayKST()`와 `hourKST()`가 서로 다른 `new Date()`를 쓴다 — 자정 경계에서 날짜와 시각이 어긋날 수 있다(확률 극히 낮음).

## 2. 테스트 커버리지 공백

| 영역 | 상태 | 비고 |
|---|---|---|
| `db.ts` 날짜 범위 쿼리 (`listEntriesInMonth`) | **없음** | A-1이 잡히지 않은 이유. 가짜 supabase가 필터 값을 검증하지 않는다. "9월 범위 끝 값이 유효한 날짜인지"만 검사하는 단위 테스트로 막을 수 있다. |
| `getTodayFortune` 캐시 흐름 (`index.ts`) | **없음** | 지문 일치→반환, 불일치→update, `inFlight` 중복 제거, `cached: undefined/null/row` 세 입력, "API 오류 결과가 캐시에 저장되는가"(A-3) 모두 테스트가 없다. `saveFortuneCache`(cache.ts)만 4건 있다. |
| `callModel`의 `max_tokens` / JSON 파싱 실패 | **없음** | A-5. 가짜 client가 `stop_reason: "max_tokens"`와 잘린 text를 돌려주는 케이스 추가. |
| `withLivePersonal` + 오늘 화면 결합 | 약함 | `today-page.test.ts:161`의 `cachedFortune`에 `date`가 없어 `withLivePersonal`이 첫 줄에서 그대로 반환한다(실제 경로를 타지 않는다). `date: today`와 `personal`·`core`를 넣어야 B5 경로가 검증된다. |
| `/api/cron/remind` 라우트, `/auth/callback` | **없음** | 순수 함수(`pickDue`, `remindMessage`)만 테스트. 라우트의 401, `?hour=`, gone→비활성화 처리, 콜백의 `next` 검증·identity_already_exists 분기는 미검증. |
| `writeNav.nightCarryDate` | 있음(3건) | 쓰기 페이지 자체의 "날짜 없이 새벽에 열면 어제, `?date=`가 있으면 그대로" 통합은 미검증. |
| `calendar.buildMonth` | 1건 | 2월·30일 달·2020-01 하한·`next` null 경계가 없다. |
| `middleware` | 1건 | 세션 갱신(setAll로 쿠키가 응답에 실리는지)은 미검증. |
| `EntryForm`·`ProfileForm` 클라이언트 동작 | 없음 | DOM 환경이 없으니 범위 밖으로 보는 게 맞다. |

테스트가 실제 동작과 어긋난 곳: `today-page.test.ts`는 위 `withLivePersonal` 건 외에는 문제없다. `anon.test.ts`의 미들웨어 테스트는 `@supabase/ssr`을 통째로 가짜로 바꿔 "리디렉트 안 함"만 본다 — 의도대로.

## 3. React / Next 성능 (스킬 기준)

- `server-parallel-fetching`: 오늘(`page.tsx:142`)·나(`me/page.tsx:138`)·설정은 `Promise.all`로 잘 묶었다. 쓰기 화면만 새벽 분기에서 워터폴(A-7).
- `async-suspense-boundaries`: 운세 카드만 Suspense로 떼고 캐시 히트는 Suspense 없이 그리는 구조(`page.tsx:173-188`)는 모범적이다.
- `bundle-*`: `@saju/engine`에서 named import, 무거운 클라이언트 라이브러리 없음. `lunar-javascript`는 서버 쪽에서만 쓰인다. 문제 없음.
- `rerender-*`: `VoteButtons`·`SignalLegend`·`SavedPastNotice`가 `useEffect`에서 저장소를 읽어 `setState`한다 — SSR 불일치를 피하려는 의도라 허용 범위. `MonthCalendar`의 effect deps에 매 렌더 새 객체인 `days`가 들어가지만 sessionStorage 가드로 실질 부작용은 없다.
- `client-event-listeners`: `TouchFx`는 문서에 리스너 하나만 건다(좋음, passive).
- `rendering-hoist-jsx`: `page.tsx`의 `card`·`goldButton` 문자열, `GanjiGrid`의 60칸 렌더는 서버라 비용 없음.
- `server-no-shared-module-state`: `fortune/index.ts`의 `inFlight`, `supabase/admin.ts`의 `cached` 클라이언트, `push.ts`의 `configured`는 요청별 데이터가 아니라 괜찮다. 단 `inFlight`는 인스턴스 경계를 넘지 못한다(A-4).
- `BottomNav`의 전체 RSC 프리페치 + `staleTimes.dynamic: 30`: 탭 전환이 빠른 대신 탭을 옮길 때마다 나머지 두 화면의 서버 렌더(각 5~7개 쿼리)가 돈다. 트래픽이 늘면 DB 호출이 사용자당 3배. 캐시 미스 날엔 모델 호출까지 당긴다(A-4). 지금 규모에선 용인.
- `layout.tsx`의 외부 Pretendard CSS `<link rel="stylesheet">`는 렌더 차단이지만 `preconnect`를 걸어 두었고 서브셋이라 허용.

## 4. 좋은 점

1. `saveFortuneCache`의 중복키 → select → update 폴백과 그에 대한 테스트(동시 요청 시나리오까지)가 깔끔하다.
2. `validateEntry`·`validateProfile`·`validateEntryDate`를 화면과 서버가 같이 쓰고, 엔진 오류 문구를 사용자에게 내보내지 않는 규칙이 테스트로 고정돼 있다.
3. 컬럼 마이그레이션 전후를 `isMissingColumnError`로 흡수하는 설계(0003_promise)와 그 테스트 — 배포 순서가 꼬여도 500이 안 난다.
4. 운세 글 검사기(`validate.ts`)가 금지어·숫자 날조·예시 베낌·최근 운세 중복까지 기계로 막고, 시스템 프롬프트의 예시 3편이 검사기를 통과하는지까지 테스트한다.
5. 모든 날짜를 KST `YYYY-MM-DD` 문자열로 통일하고(`time.ts`), 새벽 4시 전 "어젯밤" 규칙을 순수 함수(`nightCarryDate`)로 빼서 오늘·쓰기 화면이 같은 함수를 쓴다.
6. `getClaims()`로 요청당 Auth 왕복을 미들웨어 한 번으로 줄인 결정이 문서(주석)에 근거와 함께 남아 있다.

## 5. 권장 처리 순서

1. A-1 (`-31` 범위) — 한 줄 수정, 즉시. 11월 1일 전에 반드시.
2. A-2 + A-5 (타임아웃·재시도·`max_tokens`·`maxDuration`) — 네 줄.
3. A-3 (API 오류 결과는 캐시하지 않기).
4. A-6, A-9 정리. A-4는 비용 지표(`/stats`의 운세 행 수 vs 사용자 수)를 보고 판단.
