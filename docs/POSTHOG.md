# PostHog 설정 (지인 베타)

코드에 P0 핵심 루프 + **기능 인기** 이벤트가 붙어 있습니다. 키만 넣으면 동작합니다.

## 1. 환경 변수

```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_BETA_COHORT=friends_2026_w31
```

Vercel Production에 넣고 **Redeploy**.

## 2. 핵심 루프 이벤트

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
| `flow_error` | 핵심 흐름 실패 |

## 3. 기능 인기 이벤트 (추천 구조)

| 이벤트 | 언제 | 주요 properties |
|--------|------|-----------------|
| `nav_tab_clicked` | 하단 탭 클릭 | `tab`: journal\|home\|stats |
| `stats_opened` | 기록 탭 페이지 진입 | `surface` |
| `past_entry_opened` | 캘린더 날짜·수정하기 | `source`, `has_entry` |
| `saju_opened` | 내 사주 화면 | `surface` |
| `natal_reading_opened` | 종합풀이 열기 | `surface`, `had_cache` |
| `diary_sheet_opened` | 하루 정리글 시트 열기 | `had_text` |
| `checkin_step` | 행복도 등 단계 | `step`: happiness\|… |

공통: `auth_provider`, `in_app_browser`, `is_pwa_standalone`, `beta_cohort`, `app_version`  
금지: 일기/질문/운세/풀이 **문장**, 생일, 이메일.

## 4. PostHog에서 만들 Insight

### 이미 만든 것
- `01 Beta Entrants` — Trends `$pageview` 또는 `app_opened`
- `02 Activation` — Funnel
- `03 Core Loop` — Funnel

### 추가로 만들 것 (기능 인기)

**09 Feature popularity** (Trends)
1. New insight → **Trends**
2. 시리즈를 여러 개 추가 (각각 Unique users):
   - `nav_tab_clicked` (breakdown `tab` 해도 됨)
   - `fortune_opened`
   - `question_shown`
   - `diary_sheet_opened`
   - `stats_opened`
   - `past_entry_opened`
   - `saju_opened`
   - `natal_reading_opened`
3. 이름: `09 Feature popularity` → 대시보드에 추가

**10 Save with/without diary** (Trends)
1. Event: `journal_saved`
2. Breakdown: `has_text`
3. Unique users
4. 이름: `10 Save quality (has_text)`  
→ `true` = 정리글 있음, `false` = 기분체크만 하고 저장

### (선택)
- `07 flow_error` by `step`
- Retention: start `journal_saved` → return `$pageview`

## 5. 매일 보는 법

1. Feature popularity — 어떤 기능 Unique users가 많은지  
2. Save quality — 일기 없이 저장 비율  
3. Core Loop — 어디서 끊기는지 한 단계  
4. (막히면) Session replay 1~2개  

키가 없으면 분석만 꺼지고 앱은 그대로 동작합니다.
