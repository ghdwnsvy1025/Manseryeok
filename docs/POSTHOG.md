# PostHog 설정 · 지인 베타 검증 가이드

이 문서만 보고 **Insight(퍼널/트렌드/리텐션)를 만들고 → 가설을 판정**하면 됩니다.  
(이벤트는 앱 코드에 이미 심겨 있음. PostHog UI에서 “이벤트 정의”를 새로 만들 필요 없음.)

---

## 0. 한 줄 답

**네. 아래 순서대로 Funnel / Trends / Retention을 만들고 대시보드에 붙인 뒤, 가설 판정표만 채우면 됩니다.**

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

## 2. 앱이 보내는 이벤트 (참고)

### 핵심 루프
| 이벤트 | 언제 |
|--------|------|
| `app_opened` | 세션당 1회 |
| `auth_guest_clicked` / `auth_google_clicked` | 로그인 선택 |
| `signed_in` / `signed_out` | 세션 |
| `profile_started` / `profile_created` | 사주 온보딩 |
| `fortune_opened` | 운세 열람 |
| `question_shown` | 질문 노출 (본문 없음) |
| `journal_started` | 체크인/글 최초 상호작용 |
| `journal_saved` | 저장 성공 (`has_text` 포함) |
| `quote_shown` | 명언 노출 |
| `flow_error` | 핵심 흐름 실패 (`step`, `error_code`) |
| `feedback_submitted` | 베타 피드백 |
| `install_*` | PWA 유도 |

### 기능 인기
| 이벤트 | properties 예 |
|--------|----------------|
| `nav_tab_clicked` | `tab`: journal \| home \| stats |
| `stats_opened` | `surface` |
| `past_entry_opened` | `source`, `has_entry` |
| `saju_opened` | `surface` |
| `natal_reading_opened` | `surface`, `had_cache` |
| `diary_sheet_opened` | `had_text` |
| `checkin_step` | `step`: happiness \| … |

공통 super props: `auth_provider`, `in_app_browser`, `is_pwa_standalone`, `beta_cohort`, `app_version`  
**금지:** 일기/질문/운세/풀이 문장, 생일, 이메일.

---

## 3. Insight 만드는 공통 방법

### Funnel
1. 왼쪽 **Product analytics** → **New insight**
2. 타입 **Funnel**
3. 아래 표의 이벤트를 **위에서 아래 순서**로 추가
4. Conversion window / Unique users 설정
5. Save → 이름 붙이기 → 대시보드 **「베타 Day1」**에 Add

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

`$pageview`는 PostHog 자동 이벤트. Activation 첫 단계로 써도 됨 (`app_opened`와 병행 가능).

---

## 4. 만들 Insight 체크리스트 (그대로 따라하기)

이미 만든 것은 체크만 하고 넘어가기.

### 대시보드 일상용
| ID | 이름 | 종류 | 설정 |
|----|------|------|------|
| ☐ 01 | Beta Entrants | Trends | `$pageview` 또는 `app_opened` · Unique · (선택) breakdown `in_app_browser` |
| ☐ 02 | Activation | Funnel | `$pageview`(또는 `app_opened`) → `signed_in` → `profile_created` → `fortune_opened` → `journal_saved` · **24h** |
| ☐ 03 | Core Loop | Funnel | `fortune_opened` → `question_shown` → `journal_started` → `journal_saved` → `quote_shown` · **30m** |
| ☐ 09 | Feature popularity | Trends | 아래 이벤트를 시리즈로 Unique users: `fortune_opened`, `question_shown`, `diary_sheet_opened`, `stats_opened`, `past_entry_opened`, `saju_opened`, `natal_reading_opened` (+ `nav_tab_clicked` breakdown `tab`) |
| ☐ 10 | Save quality | Trends | `journal_saved` · breakdown **`has_text`** · Unique |

### 가설 검증용 (없으면 추가)
| ID | 이름 | 종류 | 설정 |
|----|------|------|------|
| ☐ H1a | Auth guest | Funnel | `auth_guest_clicked` → `signed_in` · 24h |
| ☐ H1b | Auth google | Funnel | `auth_google_clicked` → `signed_in` · 24h |
| ☐ H1c | Auth errors | Trends | `flow_error` · Total + Unique · filter/breakdown `step` · breakdown `in_app_browser` |
| ☐ H2a | Profile complete | Funnel | `signed_in` → `profile_created` · 24h |
| ☐ H2b | Profile start→done | Funnel | `profile_started` → `profile_created` · 24h |
| ☐ H3a | First save 24h | Funnel | `profile_created` → `journal_saved` · 24h |
| ☐ H3b | Quote after save | Funnel | `journal_saved` → `quote_shown` · 30m |
| ☐ H3c | Q→start | Funnel | `question_shown` → `journal_started` · 30m |
| ☐ H4a | D1 return | Retention | Start `journal_saved` → Return `$pageview` 또는 `app_opened` · Day · 7d |
| ☐ H4b | Repeat save | Retention | Start `journal_saved` → Return `journal_saved` · Day · 7d |
| ☐ H5a | Feedback | Trends | `feedback_submitted` · Unique |
| ☐ H5b | Install | Funnel | `install_prompt_shown` → `install_clicked` → `install_completed` · 7d |
| ☐ 07 | Flow errors | Trends | `flow_error` · breakdown `step` |

`profile_created`의 `completion_time_bucket`가 보이면 H2에서 breakdown으로 `<1m` / `1_3m` / `3m_plus` 확인.

---

## 5. 검증 가설 5개 — 볼 Insight + 성공/실패

### 가설 1. 진입 방식이 첫 사용을 막지 않는다
**가설:** 게스트 또는 Google을 선택한 사용자는 큰 문제 없이 앱에 진입한다.

| | |
|--|--|
| **볼 Insight** | 02 Activation 앞단, H1a, H1b, H1c |
| **성공** | `app_opened`(또는 `$pageview`) 중 70%+ `signed_in` · 게스트·구글 각 ≥3명 · auth `flow_error` 동일 step 2명 미만 |
| **실패** | 클릭 후 `signed_in` &lt;50% · 카톡(`in_app_browser=kakao`)에서만 auth 실패 ≥2명 |

### 가설 2. 사주 프로필 등록이 과도하게 번거롭지 않다
**가설:** 진입한 사용자는 첫 세션 안에 사주 프로필 등록을 끝낸다.

| | |
|--|--|
| **볼 Insight** | H2a, H2b, (선택) `completion_time_bucket` |
| **성공** | `signed_in`→`profile_created` ≥60% · `profile_started`→완료 ≥70% · `3m_plus` 절반 미만 |
| **실패** | `profile_started` 후 미완료 ≥3명 |

### 가설 3. 핵심 루프가 실제로 돈다
**가설:** 운세를 본 사용자는 질문을 확인하고 일기를 저장한다.

| | |
|--|--|
| **볼 Insight** | H3a, **03 Core Loop**, H3b, H3c, (보조) 09·10 |
| **성공** | `profile_created`→24h `journal_saved` ≥50% · Core ≥40% · `journal_saved`→`quote_shown` ≥90% |
| **실패** | 질문은 보지만 `journal_started` 안 함 ≥절반 · 저장 후 명언 실패 ≥2건 |

### 가설 4. 첫 저장이 재방문 신호로 이어진다
**가설:** 일기를 한 번 저장한 사용자 중 일부는 다시 앱을 사용한다.

| | |
|--|--|
| **볼 Insight** | H4a, H4b |
| **성공** (활성 저장 ≥8명일 때) | D1 복귀 대략 30%+ · 3일 내 재저장 대략 20%+ · 다른 날짜 저장 ≥2명 |
| **실패** | 저장 ≥8명인데 D1 복귀 ≤1명 · 재저장 0명 |
| **주의** | n&lt;8이면 % 비교 말고 **돌아온 사람 있음/없음**만 |

### 가설 5. 사용자가 최소한의 가치를 느낀다
**가설:** 질문이나 일기 경험에 긍정 신호가 나타난다.

| | |
|--|--|
| **볼 Insight** | H4b, H5a, H3c, H5b + (질적) 인터뷰/피드백 본문 |
| **성공** | 아래 중 **2개 이상**: 재저장 ≥2명 · 긍정 피드백 ≥3 · Q→start ≥50% · PWA 설치 완료 ≥2 |
| **실패** | 재저장 0 · 긍정 피드백 0 · Q 시작률 극저 · “다시 쓸 이유 없다” 반복 |

---

## 6. 일주 운영 루틴

| 언제 | 할 일 |
|------|--------|
| 세팅 날 | §4 체크리스트로 Insight 만들고 대시보드에 고정 |
| 매일 5분 | 01 · 02 · 03 · 09 · 10 · (막히면) 07 |
| 이탈 클 때 | 해당 Funnel 이탈자 → Session replay 1~2개 |
| 3일차 | H4 Retention “돌아왔는지” |
| 7일차 | 아래 판정표 채우고 **고칠 곳 1개만** 정하기 |

---

## 7. 판정표 (복붙)

```text
기간: ____ ~ ____   대략 활성 인원: __명

H1 진입        ☐성공 ☐실패 ☐보류
  근거: signed_in 전환 __% / 게스트 __명 구글 __명 / auth error __

H2 프로필      ☐성공 ☐실패 ☐보류
  근거: signed→created __% / started→created __% / 3m_plus __

H3 루프        ☐성공 ☐실패 ☐보류
  근거: Core __% / quote __% / Q→start __% / 24h save __%

H4 재방문      ☐성공 ☐실패 ☐보류
  근거: D1 __명 / 재저장 __명 (활성 저장 __명)

H5 가치        ☐성공 ☐실패 ☐보류
  근거: 재저장/피드백/Q시작/설치 중 충족 __개

다음 액션 1개: ________________________________
```

---

## 8. 매일 보는 법 (짧음)

1. **09** 기능 인기 — 뭐가 안 열리는지  
2. **10** `has_text` — 일기 없이 저장 비율  
3. **03** Core Loop — 끊기는 **한 단계**  
4. 막히면 replay 1~2개  

키가 없으면 분석만 꺼지고 앱은 그대로 동작합니다.
