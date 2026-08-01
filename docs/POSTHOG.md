# PostHog 설정 · 지인 베타 검증 가이드

이 문서만 보고 **Insight(퍼널/트렌드/리텐션)를 만들고 → 가설을 판정**하면 됩니다.  
(이벤트는 앱 코드에 이미 심겨 있음. PostHog UI에서 “이벤트 정의”를 새로 만들 필요 없음.)

---

## 0. 한 줄 답

**네. 01~10(일상) + H1a~H5b(가설용) + §6 지인 1인 표를 쓰고, 주말에 §8 판정표를 채우면 됩니다.**

공통 설정:
- 기간: **Last 7 days** (또는 베타 시작일~오늘)
- 집계: **Unique users** (특별히 적힌 경우 제외)
- n이 작을 때: **%보다 명 수**를 우선

---

## 1. 환경 변수

```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_BETA_COHORT=friends_2026_w31
```

Vercel **Production**에 넣고 **Redeploy**.

---

## 2. 이벤트 이름 → 무슨 기능인지 (한글 해설)

PostHog Live/Insight에 영어로 보이면 이 표를 보면 됩니다.  
(질문·운세·일기 **문장 내용은 안 보내고**, “했다/안 했다”만 갑니다.)

### 자동 (PostHog 기본)
| 이벤트 | 의미 |
|--------|------|
| `$pageview` | 페이지가 열림 (앱이 심은 게 아니라 PostHog 기본) |
| `$pageleave` | 페이지를 떠남 |

### 진입 · 로그인
| 이벤트 | 의미 (앱에서) |
|--------|----------------|
| `app_opened` | 앱/사이트에 **들어옴** (세션당 1번) |
| `auth_guest_clicked` | **게스트로 시작** 버튼 누름 |
| `auth_google_clicked` | **Google 로그인** 버튼 누름 |
| `auth_email_submitted` | 이메일 로그인 제출 (거의 안 씀) |
| `signed_in` | 로그인/게스트 진입 **성공** |
| `signed_out` | 로그아웃 |

### 사주 프로필
| 이벤트 | 의미 |
|--------|------|
| `profile_started` | 사주 프로필 **입력 시작** |
| `profile_created` | 사주 프로필 **등록 완료** |

### 하루 핵심 루프 (운세 → 질문 → 일기 → 명언)
| 이벤트 | 의미 |
|--------|------|
| `fortune_opened` | **오늘의 운세**를 봄/열음 (재펼침 포함 · `is_repeat`) |
| `fortune_collapsed` | 오늘의 운세 **접기** |
| `question_tease_clicked` | 오늘의 질문 **첫 클릭**(세션당 1회 · 재노출 re 없음) |
| `question_shown` | **오늘의 질문**이 API로 처음 로드됨 (캐시 재펼침은 안 감) |
| `journal_started` | 체크인·일기 **작성을 처음 시작** (탭/입력) |
| `journal_saved` | 저장 성공 · `save_kind`=`create`\|`edit` · `has_text` |
| `quote_shown` | 저장 후 **명언/문장** (재노출 re 없음) |
| `event_tags_expanded` | 「무슨 일이 있었나요」 **펼치기** (`is_repeat`) |
| `content_feedback_clicked` | 「이 문장이 도움이 됐나요」 등 피드백 · `surface`/`mode`/`rating` · `is_repeat` |

### 홈 · 메뉴 · 프로필
| 이벤트 | 의미 |
|--------|------|
| `home_today_entry_clicked` | 홈에서 오늘 일기 **쓰기/수정** (`mode`) · `is_repeat` |
| `home_stats_trend_clicked` | 홈 **기록·추이 보기** |
| `feedback_opened` | **의견 보내기** 창 열림 |
| `feedback_submitted` | 베타 피드백 **제출** |
| `menu_opened` | 헤더 **메뉴** 열림 · `is_repeat` |
| `menu_item_clicked` | 메뉴 항목 · `item`=profiles\|saju\|feedback\|logout · `is_repeat` |
| `profile_edit_clicked` | 프로필 **수정** · `is_repeat` |
| `profile_add_clicked` | 프로필/다른 사람 **추가(+)** |
| `profile_open_manseryeok_clicked` | 프로필에서 **만세력 열기** |

### 기록 탭 · 사주 화면
| 이벤트 | 의미 |
|--------|------|
| `nav_tab_clicked` | 하단 탭 · `tab`=journal\|home\|stats |
| `stats_opened` | 통계/기록 화면 열림 |
| `stats_period_selected` | 기록 탭 **주/월** · `period` · `is_repeat` |
| `stats_categories_menu_clicked` | **카테고리 메뉴** · `is_repeat` |
| `stats_month_changed` | 기록 **월 바꾸기** · `is_repeat` |
| `calendar_day_selected` | 캘린더 **날짜** · `is_today` · `is_repeat` |
| `entry_list_selected` | 목록에서 **일기 선택** · `is_repeat` |
| `entry_list_edit_clicked` | 목록/리포트 **수정** · `is_repeat` |
| `past_entry_opened` | 지난 일기 열람 |
| `pattern_tab_selected` | 사주패턴 **천간/지지** · `tab` · `is_repeat` |
| `ganji_collection_opened` | **간지 도감** · `is_repeat` |
| `saju_opened` | **내 사주** 화면 |
| `saju_mode_selected` | **기본/연구 모드** · `mode` · `is_repeat` |
| `saju_research_hint_clicked` | 연구모드 **글자/힌트** 클릭 · `is_repeat` |
| `saju_daewoon_clicked` | **대운** 클릭 · `is_repeat` |
| `saju_sewoon_clicked` | **세운** 클릭 · `is_repeat` |
| `natal_reading_opened` | **사주 종합풀이** · `is_repeat` |
| `diary_sheet_opened` | 자유 일기 시트 |
| `checkin_step` | 체크인 단계 |

### `is_repeat` (re) 보는 법
같은 세션에서 **두 번째부터** `is_repeat=true`.  
- 퍼널·몇 명: **Unique users** (re 있어도 사람 수는 안 부풂)  
- 몇 번 눌렀나: **Total count** 또는 breakdown `is_repeat`

### 설치(PWA) · 오류
| 이벤트 | 의미 |
|--------|------|
| `install_prompt_shown` | 홈 화면 추가/설치 **안내가 보임** |
| `install_clicked` | 설치/추가 **버튼 누름** |
| `install_dismissed` | 설치 안내 **닫음/나중에** |
| `install_accepted` | Android에서 설치 다이얼로그 **수락** (드묾) |
| `install_completed` | 이름만 있음 · **아직 안 보냄** |
| `flow_error` | 핵심 흐름 **실패** (`step`으로 어디가 깨졌는지) |

`flow_error`의 `step` 예: `auth_guest` · `auth_google` · `profile_create` · `fortune_load` · `question_load` · `journal_save` · `quote_load` · `install`

### 같이 붙는 속성 (거의 모든 이벤트)
| 속성 | 의미 |
|------|------|
| `auth_provider` | `guest` / `google` / … |
| `in_app_browser` | `kakao` 등 인앱 브라우저인지 |
| `is_pwa_standalone` | 홈 화면 추가(앱처럼)로 열었는지 |
| `beta_cohort` | 베타 그룹 이름 |
| `app_version` | 앱 버전 |
| `is_repeat` | UI 재클릭 여부 (해당 이벤트만) |

**금지(절대 안 보냄):** 일기/질문/운세/풀이 문장, 생일, 이메일.

---

## 3. Insight 만드는 공통 방법

### Funnel
1. 왼쪽 **Product analytics** → **New insight**
2. 타입 **Funnel**
3. 아래 표의 이벤트를 **위에서 아래 순서**로 추가
4. Conversion window / Unique users 설정
5. Save → 이름 붙이기 → 대시보드 **「베타 Day1」**(또는 「베타 가설」)에 Add

### Trends
1. New insight → **Trends**
2. Event 선택 (+ 필요 시 Breakdown)
3. Unique users (또는 Total count)
4. Save → 대시보드에 Add

### Retention
1. New insight → **Retention**
2. Start event / Return event 지정
3. Period: **Day**, 기간 7일
4. Save → 대시보드에 Add

`$pageview`는 PostHog 자동 이벤트. Activation 첫 단계로 써도 됨 (`app_opened` 권장).

---

## 4. 대시보드 「베타 Day1」— 01~10 전부

**「베타 Day1」= 베타용 메인 대시보드 이름**입니다.  
Day2·Day3를 새로 만들지 않고, **같은 보드를 기간만 바꿔** 보면 됩니다.  
(이름 헷갈리면 PostHog에서 「베타 일상」으로 바꿔도 됨.)

아래 Insight를 만들고 → Save → 대시보드 **「베타 Day1」**에 Add.

---

### 01 Beta Entrants
| | |
|--|--|
| **종류** | Trends |
| **Event** | `app_opened` (없으면 `$pageview`) |
| **계산** | Unique users · 일별(day) |
| **Breakdown** | `in_app_browser` |
| **목적** | 몇 명이 들어왔는지, 카톡 인앱(`kakao`) 비중 |
| ☐ | 만들었음 |

---

### 02 Activation Funnel
| | |
|--|--|
| **종류** | Funnel |
| **단계** | `app_opened` → `signed_in` → `profile_created` → `fortune_opened` → `journal_saved` |
| **Window** | **24시간** · Unique users · Sequential |
| **Breakdown** | `auth_provider` (가능하면) |
| **목적** | 진입 → 첫 저장까지. **매일 가장 먼저** |
| ☐ | 만들었음 |

첫 단계를 `$pageview`로 둔 기존 퍼널이 있으면 그대로 써도 되고, 여유 되면 `app_opened` 버전도 하나 더.

---

### 03 Core Loop Funnel
| | |
|--|--|
| **종류** | Funnel |
| **단계** | `fortune_opened` → `question_shown` → `journal_started` → `journal_saved` → `quote_shown` |
| **Window** | **30분** · Unique users |
| **목적** | 하루 핵심 루프. **가장 큰 이탈 단계 한 곳만** 개선 |
| ☐ | 만들었음 |

---

### 04 Time to First Save
| | |
|--|--|
| **종류** | Funnel |
| **단계** | `app_opened` → `journal_saved` (두 단계만) |
| **Window** | 24시간 · Unique users |
| **표시** | 결과에서 **Time to convert** (전환 시간) 확인 |
| **목적** | 3분 체험인지, 10분 이상 걸리는지 |
| ☐ | 만들었음 |

---

### 05 D1 App Return
| | |
|--|--|
| **종류** | Retention |
| **Start** | `journal_saved` |
| **Return** | `app_opened` (목록에 없으면 `$pageview`) |
| **Period** | **Day** · 7일 |
| **목적** | 저장한 사람이 **다음 날** 다시 여는지 (가설 4) |
| ☐ | 만들었음 |

---

### 06 Repeat Journal Retention
| | |
|--|--|
| **종류** | Retention |
| **Start** | `journal_saved` |
| **Return** | `journal_saved` |
| **Period** | **Day** · 7일 |
| **목적** | 재방문이 아니라 **다시 저장**하는지 (가설 4·5) |
| ☐ | 만들었음 |

---

### 07 Critical Flow Errors
| | |
|--|--|
| **종류** | Trends |
| **Event** | `flow_error` |
| **계산** | Total count + Unique users (시리즈 2개 또는 전환해 보기) |
| **Breakdown** | 1순위 `step` · 필요 시 `in_app_browser` |
| **목적** | 같은 오류가 **2명 이상**이면 우선 수정 |
| ☐ | 만들었음 / ☐ 스킵 (이벤트 아직 없음) |

**중요:** `flow_error`는 **실패가 한 번도 없으면** 이벤트 선택 목록에 안 뜹니다.  
직접 “만들어서” 넣을 수 없음. Activity에 `flow_error`가 보인 뒤에 이 Insight를 추가하면 됨.  
(테스트: DevTools Offline → 운세/저장 실패 유도)

---

### 08 Install + Fit Signals
| | |
|--|--|
| **종류** | Funnel + (선택) Trends |
| **설치 퍼널** | `install_prompt_shown` → `install_clicked` |
| **함께** | Trends: `feedback_submitted` · Unique users · (선택) `install_dismissed` |
| **목적** | 설치·피드백은 **보조 신호**. 일기 재저장(06)이 더 중요 |
| ☐ | 설치 퍼널 / ☐ feedback Trends |

실제로 자주 보이는 이벤트는 **`install_prompt_shown` / `install_clicked` / `install_dismissed`** 뿐.  
`install_accepted`는 Android 네이티브 설치 다이얼로그에서 “추가”를 눌렀을 때만 나가고, iOS·카톡·수동 가이드 경로에서는 **안 나옴**.  
`install_completed`는 코드에 이름만 있고 **아직 발화하지 않음** → 퍼널에 넣지 말 것.

---

### 09 Feature popularity (기능 인기 · 우리 추가분)
| | |
|--|--|
| **종류** | Trends |
| **시리즈** (각각 Unique users) | `fortune_opened`, `question_shown`, `diary_sheet_opened`, `stats_opened`, `past_entry_opened`, `saju_opened`, `natal_reading_opened` |
| **선택** | `nav_tab_clicked` + breakdown `tab` |
| **목적** | 어떤 기능이 많이/적게 열리는지 |
| ☐ | 만들었음 |

---

### 10 Save quality (has_text · 우리 추가분)
| | |
|--|--|
| **종류** | Trends |
| **Event** | `journal_saved` |
| **Breakdown** | `has_text` |
| **계산** | Unique users |
| **목적** | `true`=정리글 있음, `false`=기분만 하고 저장 |
| ☐ | 만들었음 |

---

### Day1 우선순위 (바쁘면)

1. **필수:** 01 · 02 · 03  
2. **곧:** 04 · 05 · 06 · 09 · 10  
3. **여유:** 08  
4. **나중:** 07 (`flow_error` 생긴 뒤)  
5. **가설 판정 전에:** §4.5 **H1a~H5b**

---

## 4.5 가설용 Insight (H1a~H5b) — **만드는 게 맞음**

| | 역할 |
|--|--|
| **01~10** | 매일 보는 보드 (건강·루프·기능) |
| **H1a~H5b** | 주말에 가설 성공/실패를 **숫자로** 채울 때 쓰는 돋보기 |

01~10만으로도 대략 볼 수 있지만, 게스트/구글 분리·프로필만·질문→시작만 보면 §8을 채우기 어렵습니다.  
**H도 만들으세요.** 「베타 Day1」에 붙이거나 별도 보드 **「베타 가설」**에 모아도 됩니다.

| ID | 이름 | 종류 | 설정 | 가설 |
|----|------|------|------|------|
| ☐ H1a | Auth guest | Funnel | `auth_guest_clicked` → `signed_in` · **24h** · Unique | 1 |
| ☐ H1b | Auth google | Funnel | `auth_google_clicked` → `signed_in` · **24h** · Unique | 1 |
| ☐ H1c | Auth errors | Trends | `flow_error` · Total+Unique · breakdown `step` · (선택) `in_app_browser` | 1 |
| ☐ H2a | Profile complete | Funnel | `signed_in` → `profile_created` · **24h** | 2 |
| ☐ H2b | Profile start→done | Funnel | `profile_started` → `profile_created` · **24h** | 2 |
| ☐ H3a | First save 24h | Funnel | `profile_created` → `journal_saved` · **24h** | 3 |
| ☐ H3b | Quote after save | Funnel | `journal_saved` → `quote_shown` · **30m** | 3 |
| ☐ H3c | Q→start | Funnel | `question_shown` → `journal_started` · **30m** | 3 |
| ☐ H4a | D1 return | Retention | Start `journal_saved` → Return `app_opened`(또는 `$pageview`) · Day · 7d | 4 |
| ☐ H4b | Repeat save | Retention | Start `journal_saved` → Return `journal_saved` · Day · 7d | 4 |
| ☐ H5a | Feedback | Trends | `feedback_submitted` · Unique | 5 |
| ☐ H5b | Install click | Funnel | `install_prompt_shown` → `install_clicked` · 7d | 5 |

중복 안내:
- **H4a = 05**, **H4b = 06**, **H5b ≈ 08**, **H1c ≈ 07** → 이미 만들었으면 **다시 만들지 말고** 그대로 가설에 사용.
- `profile_created`에 `completion_time_bucket`가 보이면 H2에 breakdown → `<1m` / `1_3m` / `3m_plus`.
- H1c는 Activity에 `flow_error`가 생긴 뒤에만.

---

## 5. 가설은 어떻게 체크하나

### 한 줄
**매일** 01·02·03·09·10 + 지인 쓰면 §6 1행 → **주말** §6 표 + H 숫자를 §5.1에 대입 → **§8 판정표** → 고칠 곳 **1개**.

### 절차
1. PostHog 기간을 **베타 시작~오늘** (또는 Last 7 days)로 맞춘다.  
2. §6 지인표를 펼치고, 가설 1 → 5 순서대로 §5.1 **볼 Insight**를 연다.  
3. **Unique 명 수 + 지인표 N/M**을 먼저 적고, n이 충분할 때만 %를 본다.  
4. 성공/실패/보류를 §8에 체크한다.  
5. 실패·보류 중 **다음 액션 1개만** 고른다.

저장 사용자가 &lt;8명이면 가설 4는 %로 성공/실패 말고 **보류** (또는 “돌아옴 있음/없음”만).

---

## 5.1 검증 가설 5개 — 볼 Insight + 성공/실패

### 가설 1. 진입 방식이 첫 사용을 막지 않는다
**가설:** 게스트 또는 Google을 선택한 사용자는 큰 문제 없이 앱에 진입한다.

| | |
|--|--|
| **볼 Insight** | **H1a · H1b · H1c**(또는 07) · 보조 **02** 앞단 |
| **숫자** | H1a/H1b 전환 % · 각 진입 Unique 명 · H1c의 auth `step` |
| **성공** | 클릭→`signed_in` 대략 70%+ · 게스트·구글 각 ≥3명 · 동일 auth step 오류 2명 미만 |
| **실패** | 클릭 후 `signed_in` &lt;50% · 카톡에서만 auth 실패 ≥2명 |

### 가설 2. 사주 프로필 등록이 과도하게 번거롭지 않다
**가설:** 진입한 사용자는 첫 세션 안에 사주 프로필 등록을 끝낸다.

| | |
|--|--|
| **볼 Insight** | **H2a · H2b** · 보조 **02** signed→profile |
| **숫자** | H2a % · H2b % · `completion_time_bucket` |
| **성공** | signed→created ≥60% · started→완료 ≥70% · `3m_plus` 절반 미만 |
| **실패** | `profile_started` 후 미완료 ≥3명 |

### 가설 3. 핵심 루프가 실제로 돈다
**가설:** 운세를 본 사용자는 질문을 확인하고 일기를 저장한다.

| | |
|--|--|
| **볼 Insight** | **03** · **H3a · H3b · H3c** · **04** · 보조 **09·10** |
| **숫자** | 03 전체 · H3a · H3c · H3b · 03에서 가장 큰 이탈 단계 |
| **성공** | H3a ≥50% · Core(03) ≥40% · H3b ≥90% |
| **실패** | H3c &lt;절반 · 명언 실패 ≥2건 |

### 가설 4. 첫 저장이 재방문 신호로 이어진다
**가설:** 일기를 한 번 저장한 사용자 중 일부는 다시 앱을 사용한다.

| | |
|--|--|
| **볼 Insight** | **05 = H4a** · **06 = H4b** |
| **숫자** | Retention Day1 복귀 명/% · 재저장 명/% |
| **성공** (활성 저장 ≥8명일 때) | D1 대략 30%+ · 재저장 대략 20%+ · 다른 날짜 저장 ≥2명 |
| **실패** | 저장 ≥8명인데 D1 ≤1명 · 재저장 0 |
| **주의** | n&lt;8이면 **보류** |

### 가설 5. 사용자가 최소한의 가치를 느낀다
**가설:** 질문이나 일기 요청에 긍정 신호가 나타난다.

| | |
|--|--|
| **볼 Insight** | **06/H4b** · **H5a** · **H3c** · **08/H5b** · 인터뷰·피드백 본문 |
| **숫자** | 재저장 명 · feedback Unique · H3c % · install_clicked 명 → 충족 개수 |
| **성공** | 재저장≥2 · 긍정 피드백≥3 · Q→start≥50% · `install_clicked`≥2 중 **2개 이상** |
| **실패** | 재저장 0 · 피드백 0 · Q 시작 극저 · “다시 쓸 이유 없다” 반복 |

---

## 6. 지인 1인 체크리스트 (소표본 정밀)

n이 작을 때 **%보다 사람 단위**가 정확합니다.  
지인이 쓸 때마다(또는 그날 끝) PostHog Activity 타임라인 + 짧은 대화를 보고 **한 행**을 채우세요.  
주말에 이 표들을 모아 §8 판정표에 반영합니다.

### 마스터 표 (시트/노션에 복붙)

| # | 이름/별칭 | 날짜 | 경로 | 로그인 | 프로필 | 운세 | 질문 | 작성시작 | 저장 | 명언 | D+1옴 | 재저장 | 설치클릭 | 피드백 | 막힌 곳 | 한줄 소감 | PostHog distinct |
|---|-----------|------|------|--------|--------|------|------|----------|------|------|-------|--------|----------|--------|---------|-----------|------------------|
| 1 | | | 카톡/크롬/Safari/PWA | 게스트/구글 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐/내용 | | | |
| 2 | | | | | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | | | | |

- **경로:** 카톡 인앱 / 외부 브라우저 / 홈화면(PWA)  
- **☐:** 해당 이벤트·행동이 **그 사람에게 있었으면** 체크  
- **막힌 곳:** 예) `question_shown` 다음 없음 · 프로필 입력 중 이탈  
- **PostHog distinct:** Activity에서 그 사람 ID/이니셜 (게스트면 `guest:…` 앞부분)

### 1인 상세 카드 (복붙)

```text
[지인] ________  사용일: ____-__-__  경로: ☐카톡 ☐크롬 ☐Safari ☐PWA
로그인: ☐게스트 ☐구글    PostHog: ________________

타임라인 (Activity에서 순서 확인)
☐ app_opened
☐ auth_*_clicked → signed_in
☐ profile_started → profile_created
☐ fortune_opened
☐ question_shown
☐ journal_started
☐ journal_saved   has_text: ☐있음 ☐없음(기분만)
☐ quote_shown
☐ (선택) stats / saju / natal / diary_sheet / install_* / feedback

끊긴 직후 이벤트: ______________  → replay 봤음 ☐
flow_error 있었음: ☐없음 ☐있음 step=________

다음 날
☐ 앱 다시 염 (app_opened / $pageview)
☐ 다시 저장 (journal_saved)

짧은 인터뷰 (필수 아님, 가능하면)
- 어디가 귀찮았나: _______________________________
- 다시 열고 싶은가: ☐예 ☐아니오 ☐모름
- 한줄: _________________________________________

이 사람 한줄 결론: 진입/프로필/루프/재방문/가치 중 약한 곳 = ________
```

### 채우는 요령
1. Live는 필요 없음. **Activity**에서 그 세션 이벤트 순서만 보면 됨.  
2. 운세·질문은 **당일 첫 로드만** 잡힐 수 있음(캐시 재오픈은 이벤트 없음) → “안 씀”이 아니라 **타임라인에 한 번이라도 있으면 ☐**.  
3. 같은 증상이 **2명 이상**이면 버그/UX 후보로 §8 “다음 액션”에 올림.  
4. 가설 판정: 표의 ☐ 개수를 세어 “N명 중 M명”으로 적기 (% 단정 금지, n&lt;8이면 특히).

---

## 7. 일주 운영 루틴

| 언제 | 할 일 |
|------|--------|
| 세팅 날 | §4 **01~10** + §4.5 **H1a~H5b**(중복 제외) → 대시보드 고정 |
| 지인 사용 직후 | §6 **1인 카드/표 1행** (5분) |
| 자주 (매일 5분) | **01 · 02 · 03 · 09 · 10** |
| 이탈 클 때 | Funnel 이탈자 → Session replay 1~2개 → §6 “막힌 곳” |
| 주말 / 베타 끝 | §6 표 합산 + §5 **H** → §8 판정표 |
| 판정 후 | 고칠 곳 **1개만** |

---

## 8. 판정표 (복붙)

```text
기간: ____ ~ ____   대략 활성 인원: __명
(근거는 Insight % + §6 지인표 “N명 중 M명”)

H1 진입        ☐성공 ☐실패 ☐보류
  근거: H1a __% (__명) / H1b __% (__명) / auth error __
  지인표: 게스트 성공 __/__ · 구글 성공 __/__

H2 프로필      ☐성공 ☐실패 ☐보류
  근거: H2a __% / H2b __% / 3m_plus __
  지인표: 프로필 완료 __/__ · 미완료 __명

H3 루프        ☐성공 ☐실패 ☐보류
  근거: 03 Core __% / H3a __% / H3b __% / H3c __% / Time-to-save __
  지인표: 저장까지 __/__ · 질문만 보고 멈춤 __명

H4 재방문      ☐성공 ☐실패 ☐보류
  근거: D1 __명(__%) / 재저장 __명(__%) (활성 저장 __명)
  지인표: D+1 __/__ · 재저장 __/__

H5 가치        ☐성공 ☐실패 ☐보류
  근거: 재저장/피드백/Q시작/install_clicked 중 충족 __개
  지인표: 다시 쓰고 싶음(예) __명 · 긍정 피드백 __건

다음 액션 1개: ________________________________
```

---

## 9. 매일 보는 법 (짧음)

1. **01** 오늘 몇 명 · 카톡 비중  
2. **02** Activation  
3. **03** Core Loop — 끊기는 **한 단계**  
4. **09 · 10** 기능 인기 · 일기 없이 저장  
5. 막히면 replay / **07**(있을 때) → §6 표에 반영  
6. **가설 판정은 매일 하지 말고** 주말에 §5 + §6 + §8

키가 없으면 분석만 꺼지고 앱은 그대로 동작합니다.
