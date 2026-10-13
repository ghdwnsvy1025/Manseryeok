# C. 성능 · 접근성 · SEO · PWA 리뷰 — 사주 일기 (apps/diary)

- 기준: 2026-10-14 작업 트리 소스 + `npm run build` 산출물. 읽기 전용(파일 수정 없음). 개발 서버·라이브 측정 없음 → Core Web Vitals·실제 대비·스크린리더 동작은 **"라이브 측정 필요"**로 표시하고 코드에서 보이는 가설만 적었다.
- 적용 체크리스트: `performance`, `accessibility`(WCAG 2.2), `web-quality-audit` 스킬.
- 이전 조사 `docs/전수조사-2026-10-07.md`(Manseryeok/docs)의 A1·A2·A4·A5는 반영됐고(리전 icn1, getClaims, Pretendard 가변 서브셋, 1년 immutable 캐시), **A6(팡 PNG 2.5MB·blur)과 "카드 webp 200KB를 228px로 표시(srcset 없음)"은 아직 남아 있다.** 이 문서는 그 뒤의 상태를 다시 본 것.
- 모든 경로는 `C:\Users\HongJunpyo\Desktop\사주 앱\사주 일기\Manseryeok\apps\diary\` 기준.

---

## 0. 빌드 산출물 (측정값)

`next build` 성공 (Next 15.5.27, `.env.local` 사용, experimental.staleTimes).

| 라우트 | 페이지 청크 | First Load JS | 비고 |
|---|---|---|---|
| `/` | 5.87 kB | **180 kB** | supabase-js 청크 포함(SaveBurst·LinkPromptCard→LinkGoogleButton) |
| `/login` | 1.73 kB | 175 kB | GoogleButton → supabase client |
| `/settings` | 5.24 kB | 179 kB | LinkGoogleButton·NotificationSettings |
| `/me` | 3.68 kB | 110 kB | |
| `/write` | 4.66 kB | 111 kB | |
| `/onboarding` | 3.53 kB | 110 kB | |
| `/welcome` | 2.36 kB | 108 kB | |
| 공통(shared) | — | 103 kB | `255-…js` 46.5 kB + `4bd1b696-…js`(react-dom) 54.2 kB |
| Middleware | — | 93.8 kB | `@supabase/ssr` 포함 |

큰 청크(원본 / gzip): `370-…js` 186 KB / 52 KB(**supabase-js 전체: GoTrue·Realtime 포함**), `44530001-…js` 65 KB / 13 KB(gotrue), `255-…js` 169 KB / 45 KB(next), `4bd1b696-…js` 168 KB / 52 KB(react-dom).

CSS (layout에서 셋 다 render-blocking, 원본 / gzip):
- `8a40d146….css` 78 KB / 15 KB — Tailwind preflight + globals.css(3,035줄)
- `346eead8….css` **91 KB / 27 KB** — next/font `Gowun_Batang` 400·700 `@font-face` 191개(unicode-range 분할)
- `368a404e….css` **43 KB / 12 KB** — next/font `Song_Myung` `@font-face` 90개
- `.next/static/media/` woff2 279개, 4.1 MB(필요 범위만 내려받으므로 전송량은 작다)

클라이언트 번들에 `lunar-javascript`·`@anthropic-ai/sdk`·`web-push`는 **새지 않는다** (`.next/static/chunks/**` grep 결과 없음; `onboarding` 청크의 "lunar"는 `calendar === "lunar"` 문자열). `server-only`가 `lib/fortune/index.ts`, `lib/push.ts`, `lib/supabase/server.ts`, `lib/guest.ts`에 걸려 있어 구조적으로 막혀 있다.

정적 이미지(public/): `cards-square/` 60장 **14 MB**(각 1080×1080 webp 200~276 KB), `characters/` 60장 7.0 MB(각 777×900 webp 80~172 KB), `ui/` 4.4 MB(그중 PNG 셋이 3.2 MB), `icons/` 3.1 MB(`app-icon-1024.png` 2 MB는 어디서도 참조 안 함).

---

## 1. 성능

### 높음

**P1. 쓰기 화면이 열릴 때마다 PNG 3.3 MB를 `<link rel="preload">`로 받는다**
- `src/components/BurstPreload.tsx:6` — `BURST_ASSETS`에 `pop-paper-bits-clean.png`(1024², **1,291 KB**), `pop-gold-dust-clean.png`(1024², **1,122 KB**), `stamp-inked-red-clean.png`(109 KB); `src/components/WritePreload.tsx:8-16`에 `note-slip-clean.png`(1024×512, **787 KB**) 추가. `src/app/write/page.tsx:93-94`에서 둘 다 그린다. `/?saved=오늘`에서도 `BurstPreload`(`src/app/page.tsx:185`).
- 영향: preload는 우선순위가 높아 폼 자체의 CSS 배경(도장·띠지, 10~20 KB webp)과 대역폭을 두고 경쟁한다. 4G 폰에서 3 MB는 2~5초. 저장 뒤 팡에서만 쓰는 조각 그림을 매번 쓰기 화면을 열 때 받는다(기록을 안 쓰고 나가면 전부 버림). 이전 조사 A6와 같은 항목.
- 수정 한 줄: 팡 조각 두 장을 알파 webp 512px로 재납품(예상 각 60~120 KB), `note-slip`·`stamp-inked-red`도 webp로; 팡 조각 preload는 쓰기 화면이 아니라 **저장 버튼을 누르는 순간**(`EntryForm.onSubmit`) `new Image()`로 바꾼다.

**P2. 1080×1080 카드·777×900 캐릭터를 100~320 px로 그린다 — srcset·next/image 없음**
- `src/app/me/page.tsx:187` (카드 1080² → `max-w-[220px]`), `src/components/GanjiGrid.tsx:59` (캐릭터 777×900 → **64 px 칸**, 60장 lazy), `GanjiGrid.tsx:75,106`, `src/app/page.tsx:216,228` (캐릭터 → 100 px), `src/components/SaveBurst.tsx:182,201,209`, `src/components/CalendarDayDetail.tsx:25`, `FortuneLoading.tsx:14` (48 px).
- 영향: 오늘 화면 머리에서 캐릭터 2장 ≈ 250~340 KB, 나 화면 머리 카드 ≈ 230 KB, 60갑자 격자를 다 채우면 최대 7 MB. 2x 폰에서도 카드는 440 px면 충분(현재의 1/6 용량). LCP 후보(오늘 화면 캐릭터, 나 화면 카드)가 커서 **LCP 악화 가설** — 라이브 측정 필요.
- 수정 한 줄: 빌드 스크립트로 `cards-square/*-480.webp`, `characters/*-200.webp`를 만들어 `srcset`/`sizes`를 붙이거나, `next/image`(`sizes="(max-width: 448px) 54vw, 220px"`)로 바꾼다(Vercel 이미지 최적화 한도 안: 원본 120장). `?v=2` 쿼리(`src/lib/character.ts:40`)는 파일명 버전으로.

### 중간

**P3. 폰트 CSS가 render-blocking 3겹: 외부 Pretendard + next/font 134 KB**
- `src/app/layout.tsx:16,38` — jsdelivr `<link rel="stylesheet">`(교차 출처, preconnect만 있음, 53 KB CSS → woff2 여러 개). `layout.tsx:14-15` — `Song_Myung`·`Gowun_Batang`을 next/font로 넣어 **`@font-face` 281개 = CSS 134 KB(39 KB gz)**가 레이아웃 CSS로 붙는다(`preload: false`라 글꼴 파일 자체는 안 미리 받지만 CSS는 렌더를 막는다).
- 영향: 첫 그리기 전에 CSS 3개(54 KB gz) + 외부 CSS 1개를 순서대로 기다린다. 서드파티 CDN 장애·느림이 그대로 첫 화면 지연이 된다. 라이브 측정 필요(FCP·LCP).
- 수정 한 줄: Gowun Batang 700을 빼서(사용처 확인) `@font-face` 수를 줄이고, Pretendard는 `public/fonts/`에 동일 dynamic-subset을 복사해 **같은 출처**로 서빙(`next.config headers`에 immutable)하거나 `<link rel="preload" as="style">` + `media="print" onload` 패턴으로 비차단화.

**P4. 미들웨어가 매 요청·매 프리페치마다 Supabase Auth 서버로 왕복한다**
- `src/middleware.ts:25` `await supabase.auth.getUser()` — 네트워크 호출. `src/components/BottomNav.tsx:31,56`은 경로가 바뀔 때마다 나머지 두 탭을 `router.prefetch` + `prefetch={true}`(전체 RSC) → 탭 한 번에 **미들웨어 왕복 3회 + 서버 컴포넌트 렌더 3회**(각 DB 질의 3~7개).
- 영향: 탭 전환 즉시성은 좋아졌지만(의도된 설계) 서버·Supabase 사용량이 3배, 쓰지 않는 탭의 운세 캐시·통계 질의까지 돈다. TTFB는 미들웨어 왕복(서울 엣지→Supabase 서울이라 작지만 0)이 상한.
- 수정 한 줄: 미들웨어도 페이지처럼 `getClaims()`로 로컬 검증하고 만료 임박(예: exp−60s)일 때만 `getUser()`로 갱신; 프리페치는 `requestIdleCallback` 뒤 **현재 탭 제외 1개**(다음에 갈 확률이 높은 쪽)만.

**P5. supabase-js 전체(65 KB gz)가 `/`·`/login`·`/settings`에 실린다**
- `src/lib/supabase/client.ts`(`createBrowserClient`) → `AnonBoot`(layout), `GoogleButton`, `LinkGoogleButton`. 빌드 매니페스트상 `370-…js`(Realtime·Storage·Functions 포함)가 `/layout` 청크 목록에 들어 있다.
- 영향: 첫 방문 JS 180 KB 중 65 KB가 익명 세션 생성·OAuth 호출 하나를 위한 것. 라이브 측정 필요(TBT).
- 수정 한 줄: `AnonBoot`가 하는 `signInAnonymously`는 서버 액션/Route Handler로 옮겨 쿠키만 심고(`bootAnonAction`이 이미 있음), 클라이언트 supabase는 `/login`·`/settings`에서만 `dynamic import`로.

**P6. 서비스 워커·설치 외 요청이 미들웨어·세션을 안 타는 범위 확인됨 — 단 `sw.js`·manifest는 `Cache-Control` 없음**
- `next.config.ts:19-27`은 `ui/ cards-square/ characters/ icons/`만 immutable. `public/sw.js`, `public/manifest.webmanifest`는 Vercel 기본(`public, max-age=0, must-revalidate`) → 괜찮다(SW는 짧은 캐시가 맞다). 낮음으로 기록만.

### 낮음

- **P7.** `public/icons/app-icon-1024.png`(2 MB) 미참조, `app-icon-512.png` 551 KB(단색 아이콘이면 60 KB면 충분) — 저장소·배포 용량만. manifest 아이콘은 설치 때 한 번 받는다.
- **P8.** `src/components/FortuneShareButton.tsx` + `src/lib/fortuneShareCanvas.ts` — v3.24에서 공유 버튼을 뺀 뒤 **어디서도 import되지 않는 죽은 코드**(번들엔 안 들어감). 지우거나 복귀 계획을 적어 둔다. 캔버스 자체는 클릭 시 1080×1350 PNG 1회 생성·`document.fonts.load` 대기 — 비용 적절.
- **P9.** `BottomNav.tsx:46` `backdrop-blur` — 스크롤마다 합성 비용(저사양 안드로이드). 이전 조사 A6. 한지 배경이라 `bg-night/95` 불투명으로 바꿔도 보이는 차이 없음.
- **P10.** `layout.tsx:46` `TouchFx` + `SaveBurst` 16조각 애니·`CelebrateOnMount` — 모두 reduced-motion을 존중하고 DOM 노드를 0.5~0.8초 뒤 지운다. `deviceMemory ≤ 4`/`Save-Data`에서 팡 조각 수를 줄이는 분기는 아직 없음.
- **좋음(기록):** 데이터 fetch는 `getClaims()`(로컬) → `Promise.all` 한 단(`page.tsx:109-117` 7개, `me/page.tsx:141-147` 5개) → 운세 캐시 미스만 `Suspense`(`page.tsx:143`). 워터폴 없음. `write/page.tsx:30-39`만 새벽 분기에서 질의 하나가 순차.

---

## 2. 접근성

### 높음

**A1. 금색(#d8a332) 글자·포커스 링이 한지 위에서 1.7:1 — 텍스트 4.5:1, 비텍스트 3:1 모두 미달**
- 토큰: `src/app/globals.css:18` `--color-gold`. 한지 `--color-paper` 위 **1.73:1**, `paper-2` 위 1.95:1, `paper-3` 위 1.54:1(계산값).
- 쓰인 곳(글자): `src/components/BottomNav.tsx:59` 활성 탭 라벨 `text-lamp`(=gold) 15px bold — **주 내비의 현재 탭이 안 보이는 셈**; `src/components/TodayEntryCard.tsx:44` "저장했어요" 14px bold `text-gold`; `FortuneCard.tsx:157` "+" 토글(aria-hidden이라 제외); 화살표 `↑`는 aria-hidden + sr-only 텍스트라 제외.
- 쓰인 곳(포커스): `globals.css:83-86` 전역 `:focus-visible { outline: 2px solid var(--color-gold) }`, `globals.css:267-271` `.field:focus` 금색 테두리, `:325-328`, `:436-438`, `:941-944`, `:1126-1128`, EntryForm `peer-focus-visible:outline-gold`. WCAG 2.2 **1.4.11(비텍스트 대비 3:1)** 및 **2.4.7 포커스 가시성** 미달 — 키보드 사용자는 어디에 포커스가 있는지 못 본다.
- 수정 한 줄: 포커스 링은 `--color-ink`(11.6:1) 또는 `--color-moss`(4.6:1) 2px + `outline-offset 2px`로 전역 교체(톤 문서 "금색은 버튼 하나"와도 맞음); 활성 탭은 `text-gold-ink`(#2b1f05, 12:1) + 금색 **아이콘·밑줄**로 표시; "저장했어요"는 `text-moss`.

### 중간

**A2. 저장 완료 "팡" 다이얼로그에 포커스 이동·가둠·배경 inert가 없다**
- `src/components/SaveBurst.tsx:239-258` `createPortal(<div role="dialog" aria-modal="true" …>)`. 열릴 때 `focus()` 호출 없음, 닫히면 포커스 복귀 없음, 바깥 `main`에 `inert`/`aria-hidden` 없음. 바깥 탭을 무시하는 설계(v3.6)라 **키보드·스크린리더 사용자는 "확인"에 도달하려면 Tab으로 페이지 전체를 지나야 한다**.
- 수정 한 줄: 열릴 때 `.burst-ok` 버튼에 `focus()`(reduced-motion 무관), `Escape`로 닫기, 열린 동안 `document.querySelector('main')?.setAttribute('inert','')`; 또는 네이티브 `<dialog>`+`showModal()`.

**A3. 흐린 글자(`--color-faint` 2.5:1)·오행 토색(`--color-el-earth` 2.9:1)·금속색(3.8:1)이 본문 크기에 쓰인다**
- `globals.css:17,263` `.field::placeholder`(온보딩 입력칸 16px), `src/app/write/EntryForm.tsx:221` `placeholder:text-faint`(17px). 자리표시자는 입력 안내 문구이므로 대비 대상. 이전 조사 "공통: faint 대비 2.5:1"과 같은 항목(미수정).
- `globals.css:32-36` `--color-el-earth #a67c2e`(한지 위 **2.87:1**), `--color-el-metal #6f6f6a`(3.83:1): `src/app/page.tsx:23-33` 머리 한자(송명), `src/app/me/page.tsx:240-252` 접힌 "내 사주" 미리보기 17px, 나무패 28px(큰 글자 3:1 기준도 토색은 미달). 나무패는 `wood-tablet` 이미지 위라 실제 값은 **라이브 측정 필요**.
- 수정 한 줄: `--color-faint`를 `#7d6d4e`(≈4.5:1)로, `--color-el-earth`를 `#8a6420`(4.5:1, fortuneShareCanvas.ts가 이미 쓰는 값)·`--color-el-metal`을 `#5f5f5a`로 올린다. 오행은 글자색만으로 구분하지 말고 이미 있는 `data-el`로 작은 기호를 덧붙이면 1.4.1(색만으로 전달 금지)도 함께 해결.

**A4. `aria-label`이 generic `<span>`/`<div>`에 걸려 있어 읽히지 않을 수 있고, 한자에 `lang="zh-Hant"`**
- `src/app/page.tsx:29` `<span lang="zh-Hant" aria-label={간지 한글}>`, `page.tsx:213` `<div className="medal-pair" aria-label="나 … × 오늘 …">`, `me/page.tsx:240` `<span lang="zh-Hant" aria-label="내 사주 여덟 글자">`, `FortuneCard.tsx` `.compare`·`.area-chips`·`.gaewoon`의 `aria-label`도 `div`/`span`. ARIA 1.2는 generic 역할에 `aria-label`을 금지(브라우저가 무시) → 스크린리더는 라벨 대신 한자를 **중국어 음성**(`zh-Hant`)으로 읽는다. 한국 사용자에게는 한국어 독음이 맞다.
- 수정 한 줄: 한자 묶음을 `<span role="img" aria-label="기축">`(또는 `<abbr title>`)로 바꾸고 `lang`은 `ko`로 두거나 떼고(한자 독음은 한국어), 그룹 라벨은 `role="group"` 또는 `<figure>`/`<section aria-label>`로.

**A5. 폼 오류가 `role="alert"`로 뜨지만 포커스는 안 옮기고, 입력칸과 `aria-describedby`로 묶이지 않음**
- `src/app/onboarding/ProfileForm.tsx:79,227`, `src/components/NameForm.tsx:44`, `EntryForm.tsx:231`. `aria-invalid`는 있다(좋음). 온보딩의 연·월·일·시·분은 `aria-label`만 있고 눈에 보이는 `<label>`과 프로그램적으로 연결되지 않는다(`groupLabel`은 `span`).
- 수정 한 줄: 오류 `<p>`에 `id`를 주고 해당 입력에 `aria-describedby`, 제출 실패 시 첫 오류 필드로 `focus()`; 연·월·일 묶음은 `<fieldset><legend>`.

### 낮음

- **A6. 터치 타깃**: 60갑자 칸 ≈ 36 px(`GanjiGrid.tsx:36-66`, 375px 기준), 기분 띠지 40 px(`EntryForm.tsx:191`), 달력 칸 ≈ 44 px, 공유 버튼 32 px(시각)+::after 44 px, 투표 44 px, 바텀 내비 64 px, `.tap` 44 px. WCAG 2.2 **2.5.8(24 px AA)**은 전부 통과, 44 px 권장은 격자·띠지만 미달. 격자는 `gap-px`라 인접 타깃이 붙어 있어 오탭 가능 → `gap-0.5`+칸 36 px 유지.
- **A7. 모션 축소**: `prefers-reduced-motion`을 CSS 6곳(`globals.css:775,1168,1432,1895,2210,2656`)과 `lib/fx.ts`(inkAt·celebrate), `SaveBurst.tsx:90,141`에서 존중 — **잘 됨**. 남은 것: `details[open] > .fortune-body` 펼침·`.nav-pending` 깜빡임은 처리됨, `summary` 안 "+" `transition-transform`(FortuneCard.tsx:157)과 `.kv__bar` 폭 전환만 미처리(사소).
- **A8. 스킵 링크 없음**: 내비가 화면 아래(DOM 순서도 main 뒤)라 실질 영향 작음. `/me`는 머리→달력→통계→사주 순으로 길어 `<a href="#stats">` 류 점프가 있으면 좋다.
- **A9. `InstallHint`·`SignalLegend`·`SavedPastNotice`가 수화 뒤에야 나타난다**(`InstallHint.tsx:36` `unknown`→null) — 설정 화면 레이아웃 이동(CLS 가설, 라이브 측정 필요). 서버에서 `ios` 기본 안내를 그리고 클라이언트에서 바꾸면 이동 없음.
- **A10. 제목 구조**: 각 화면 `h1` 하나, 운세 카드 `h2`→`h3`, 오늘의 기록 `h2` — 정상. `lang="ko"`(`layout.tsx:35`), `color-scheme: light`, 랜드마크 `main`/`nav aria-label="주 메뉴"`/`header` — 정상. 바텀 내비 아이콘은 `aria-hidden` + 글자 라벨 + `aria-current="page"`(`BottomNav.tsx:57`) — 정상.
- **A11. 이미지 대체 텍스트**: 장식(격자 캐릭터, 실루엣, 빈 그래프)은 `alt=""`, 의미 있는 카드는 `alt="{간지} 카드"` — 정상. `HappinessChart.tsx:49` SVG `role="img" aria-label` — 정상(데이터 표는 없으나 figcaption 범례 있음).

---

## 3. SEO · 메타 · 공유 미리보기

### 중간

**S1. Open Graph·Twitter 카드·`metadataBase`·OG 이미지 없음**
- `src/app/layout.tsx:18-24` `metadata`에 `title`/`description`/`manifest`/`icons`만. `src/app/` 아래 `opengraph-image.*`, `robots.ts`, `sitemap.ts` 없음(`ls` 확인). 알림·카톡 링크(`/write`, 운세 공유 텍스트의 `window.location.origin`)가 카카오톡·인스타 DM에 붙을 때 **이미지 없는 밋밋한 미리보기**.
- 영향: 바이럴 유입(마케팅 전략의 핵심)에서 첫 인상이 약하다. 검색 랭킹과는 무관(앱 화면은 전부 force-dynamic·개인화).
- 수정 한 줄: `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)`, `openGraph: { title, description, images: ['/og.png'], locale: 'ko_KR', type: 'website' }`, `twitter: { card: 'summary_large_image' }` + 정적 `public/og.png`(1200×630, 한지 + 60갑자 카드 한 장, saju-assets 규칙대로).

**S2. `robots` 정책이 `/stats`에만 있다**
- `src/app/stats/page.tsx:8`만 `noindex`. `/write`, `/me`, `/settings`, `/onboarding`, `/welcome`, `/api/*`는 세션 의존 화면이라 색인될 가치가 없고, 크롤러가 오면 익명 세션 `Booting` 뼈대만 색인된다.
- 수정 한 줄: `src/app/robots.ts`로 `/`·`/login`만 allow, 나머지 disallow; 각 개인 화면 `metadata.robots = { index: false }`.

### 낮음

- **S3.** 모든 화면 `title`이 "사주읽는밤 일기" 하나 — `metadata.title.template = "%s · 사주읽는밤 일기"`로 화면별 제목(쓰기·나·설정)을 주면 브라우저 탭·히스토리·스크린리더 페이지 제목이 구분된다(접근성 2.4.2에도 해당).
- **S4.** `manifest.description`은 "~돼요", `metadata.description`은 "~됩니다" — 어미 불일치(이전 조사 공통 항목, 반쯤 수정).

---

## 4. PWA

### 중간

**W1. 오프라인 대체 화면이 없다 — 설치형 앱이 네트워크 없이 열리면 브라우저 오류 페이지**
- `public/sw.js` — `install`(skipWaiting)·`activate`(claim)·`push`·`notificationclick`만. `fetch` 핸들러 없음. 주석대로 **HTML·번들을 캐시하지 않아 "옛 번들이 남아 화면 깨짐" 사고는 구조적으로 없음(잘된 점)**. 다만 `display: standalone`(manifest)에서 오프라인/비행기 모드로 열면 Chrome의 공룡 페이지·iOS의 빈 화면이 앱 안에 뜬다. 밤에 쓰는 앱이라 지하철·비행기 상황이 흔하다.
- 수정 한 줄: `sw.js`에 `install` 때 `/offline.html`(한지 한 장 + "연결되면 다시 열어요") 하나만 캐시하고, `fetch`는 `request.mode === 'navigate'` 실패 시에만 그 페이지를 돌려준다(앱 HTML·`_next/`는 여전히 캐시하지 않음).

**W2. 서비스 워커 갱신 안내·버전 표기 없음(현재는 무해, 캐시를 추가하는 순간 필요)**
- `src/components/PwaRegister.tsx:8` 등록만. `skipWaiting`+`claim`이라 새 SW가 즉시 교체되고 캐시가 없으니 오래된 HTML 문제는 **없다**. W1처럼 캐시를 넣을 때 `CACHE_NAME` 버전과 `activate`에서 옛 캐시 삭제를 함께 넣어야 한다. 기록용.

### 낮음

- **W3. manifest 보강**: `public/manifest.webmanifest`에 `id`(설치 식별 고정, 예 `"/"`), `screenshots`(Android 리치 설치 UI, 1080×1920 2장), `categories: ["lifestyle"]`, `dir: "ltr"` 없음. `name`/`short_name`/`lang: ko`/`start_url: /?source=pwa`/`scope`/`display: standalone`/`orientation: portrait`/`theme_color`(= `viewport.themeColor` #f1debb)/`background_color`/`maskable` 아이콘 192·512 — **설치 요건은 충족**. `start_url`의 `?source=pwa`는 아무 데서도 읽지 않는다(`grep source=pwa` 없음) — 분석 용도면 `metrics.ts`에 연결.
- **W4. `InstallHint.tsx`**: `display-mode: standalone` + iOS `navigator.standalone` 검사, `beforeinstallprompt` 캡처(`:32`), 카톡 인앱 분기 — 조건은 타당. `beforeinstallprompt`는 수화 전에 발생할 수 있어 리스너를 `layout`의 `PwaRegister`(먼저 마운트)에서 잡아 전역에 보관하면 설정 화면에서 버튼이 더 자주 뜬다.
- **W5. 푸시**: `sw.js` 알림 `icon`/`badge`에 같은 192 PNG — Android 배지는 단색 96×96 이어야 제대로 보인다(`app-icon-maskable.svg`를 단색 PNG로).

---

## 5. 모바일 레이아웃

- **뷰포트**: `layout.tsx:26-31` `width=device-width, initialScale 1, viewportFit cover`, `html { -webkit-text-size-adjust: 100% }` — 정상. `user-scalable` 제한 없음(접근성 1.4.4 통과).
- **100vh**: 사용 없음. `min-h-dvh`(`layout.tsx:41`, `globals.css:80`), `/welcome` `min-h-[calc(100dvh-7rem)]` — 주소창 변동에 안전. **잘됨.**
- **safe-area**: 바텀 내비 `pb-[env(safe-area-inset-bottom)]`(`BottomNav.tsx:46`), 본문 `pb-28`(112 px = 내비 64 + 여유). 위쪽 `env(safe-area-inset-top)`은 없지만 `statusBarStyle: default`라 iOS 상태바 아래에서 시작 — 문제 없음. 팡 오버레이(`fixed inset-0`, `burst-ok` 버튼)는 safe-area를 안 더해 **홈 인디케이터와 "확인" 버튼이 겹칠 수 있음**(낮음, 라이브 확인) → `.burst-overlay { padding-bottom: env(safe-area-inset-bottom) }`.
- **가로 스크롤 가설(라이브 측정 필요)**: `SaveBurst` 조각이 `--dx` 최대 ±270 px로 날아가는데 `.burst-overlay`(`globals.css:752`)에 `overflow: hidden`이 **없다**(`fx-layer`에는 있음). 375 px 화면에서 카드 중심 ±270 px이면 뷰포트를 벗어나 iOS Safari가 문서 폭을 늘릴 수 있다 → `.burst-overlay { overflow: hidden }` 한 줄. `GanjiGrid` `-mx-5`는 부모 `px-5`와 상쇄되어 안전.
- **키보드**: 쓰기 화면 `textarea`가 `field-sizing`으로 자라고(`globals.css:160` 주변), 폼 하단 저장 버튼이 `fixed`가 아니라 키보드에 가려지는 문제 없음.

---

## 6. 잘 된 점

1. **서버 데이터 한 단 + 캐시 히트 즉시 렌더**: `getClaims()` 로컬 검증 → `Promise.all` 7개 → 운세 캐시 미스일 때만 `Suspense`(`page.tsx:109-154`). 2026-10-07 A2·A3 교정이 코드에 그대로 보인다.
2. **서버 전용 경계가 분명**: `lunar-javascript`·`@anthropic-ai/sdk`·`web-push`·service-role 클라이언트가 클라이언트 번들에 한 바이트도 없다(`server-only` 4곳, 빌드 청크 grep으로 확인). 클라이언트 컴포넌트 25/47개지만 대부분 수십 줄의 작은 상호작용 조각.
3. **모션 축소 존중이 체계적**: CSS 6블록 + `lib/fx.ts` + `SaveBurst` 타이머까지 `prefers-reduced-motion`을 보고, 팡은 자동으로 닫히지 않으며(2.2.1 시간 제한 없음) 진동도 짧다.
4. **폼 의미 구조**: 도장·띠지가 전부 네이티브 `radio`/`checkbox`(`sr-only`) + `label`이라 JS 전에도 동작하고(`EntryForm.tsx:55-69` 수화 전 값 복구까지), `fieldset/legend`, `role="radiogroup"`, `aria-pressed`, `aria-invalid`, `role="alert"`, `aria-live`가 제자리에 있다. 달력 칸은 `button` + `aria-label` + `aria-pressed`.
5. **정적 자산 캐시·미들웨어 제외·리전 정렬**: `next.config.ts:18-27` 1년 immutable, `middleware.ts:31` matcher에서 이미지 경로 제외, `vercel.json` `icn1` — 이미지 요청이 엣지 인증을 타지 않는다. SW가 앱 HTML을 캐시하지 않아 "옛 번들" 사고가 원천 차단.

---

## 7. 우선순위 제안

1. **A1** 포커스 링·활성 탭 금색 → 먹색/이끼색 (토큰 2줄, 톤 문서 00에 "금색은 글자·포커스에 쓰지 않는다" 한 줄 추가) — 키보드 사용자에게 즉시 효과, 비용 최소.
2. **P1** 팡·쪽지 PNG 3.3 MB → webp 512px + 저장 시점 로드 — 쓰기 화면 체감 1순위, 에셋 재납품 1회(saju-assets).
3. **P2** 카드·캐릭터 srcset(480/200px 변형) — 오늘·나 화면 LCP 가설, 빌드 스크립트 하나.
4. **A2·A3·A4** 팡 다이얼로그 포커스, faint/오행 토색 대비, generic aria-label — 반나절.
5. **S1·S2·W1** OG 이미지·robots·오프라인 한 장 — 마케팅 유입과 설치형 사용 경험.
6. **P3·P4·P5** 폰트 CSS·미들웨어 getClaims·supabase-js 분리 — 라이브 측정(LCP/TTFB/TBT) 뒤 효과가 큰 것부터.

## 8. 라이브 측정이 필요한 항목 (다른 세션)

- LCP 요소 확인(오늘: 캐릭터 2장 vs 제목 송명 글자, 나: 카드) 및 p75 LCP/INP/CLS.
- 외부 Pretendard CSS 차단 시간, next/font CSS 134 KB 파싱 시간.
- 설정 화면 `InstallHint` 수화 뒤 삽입 CLS, 팡 오버레이 가로 넘침·safe-area 겹침.
- 나무패(`wood-tablet` 이미지) 위 오행 글자 실제 대비, 띠지(`tag-strip-navy`) 위 `paper-2` 글자 대비.
- 탭 전환 시 미들웨어 `getUser()` 왕복 시간과 프리페치 3회의 TTFB 합.
- 스크린리더(TalkBack/VoiceOver)로 한자 라벨 읽기, 팡 다이얼로그 Tab 순서.
