# PostHog 설정 (지인 베타)

코드는 P0 이벤트가 붙어 있습니다. **키만** 넣으면 동작합니다.

## 1. PostHog 프로젝트

1. https://posthog.com 가입
2. 새 프로젝트 생성
3. **Project Settings → Project API Key** (`phc_…`) 복사
4. 리전이 US면 host 기본값 그대로, EU면 `https://eu.i.posthog.com`

## 2. 환경 변수

로컬 `.env.local` 및 Vercel Production:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
# 선택
NEXT_PUBLIC_BETA_COHORT=friends_2026_w31
NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA=  # Vercel이 자동 주입하면 app_version에 사용
```

Vercel에 넣은 뒤 **Redeploy** 해야 클라이언트에 반영됩니다.

## 3. P0 이벤트 (본문·생일·이메일·질문/운세 문장·raw error 미포함)

| 이벤트 | 언제 |
|--------|------|
| `app_opened` | 세션당 1회 (landing_surface, has_auth_session) |
| `auth_guest_clicked` | 비로그인 시작 |
| `auth_google_clicked` | Google 버튼 |
| `signed_in` | 게스트 로컬 세션 / Google 세션 확정 |
| `signed_out` | 로그아웃 |
| `profile_started` | 사주 온보딩 화면 노출 |
| `profile_created` | 프로필 저장 성공 |
| `fortune_opened` | 운세 열람 |
| `question_shown` | 오늘의 질문 노출 (question_id만, 본문 없음) |
| `journal_started` | 체크인/본문 최초 상호작용 (세션·날짜당 1회) |
| `journal_saved` | 저장 성공 (길이 구간·save_number 등) |
| `quote_shown` | 저장 후 명언 |
| `flow_error` | 핵심 흐름 실패 (allowlist error_code만) |
| `feedback_submitted` | 베타 피드백 |
| install_* | PWA 유도 |

공통 super properties: `auth_provider`, `in_app_browser`, `is_pwa_standalone`, `beta_cohort`, `app_version`

게스트는 Supabase 세션이 없으므로 `guest:{uuid}` 로 identify 합니다.

## 4. PostHog에서 만들 퍼널 (수동)

**Activation (24h, unique users)**  
`app_opened → signed_in → profile_created → fortune_opened → journal_saved`

**Core loop (30m)**  
`fortune_opened → question_shown → journal_started → journal_saved → quote_shown`

## 5. 프라이버시

- 일기/피드백/질문/운세 **문장 금지**
- `captureEvent`에서 민감 키·120자 초과 문자열 차단
- Session Replay는 PostHog 프로젝트 설정에서 input masking 권장

키가 없으면 분석만 꺼지고 앱은 그대로 동작합니다.
