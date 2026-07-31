# PostHog 설정 (지인 베타)

코드는 이미 붙어 있습니다. **키만** 넣으면 동작합니다.

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
```

Vercel에 넣은 뒤 **Redeploy** 해야 클라이언트에 반영됩니다.

## 3. 수집 이벤트 (본문·생일·이메일 미포함)

| 이벤트 | 언제 |
|--------|------|
| `app_opened` | 앱 셸 로드 |
| `auth_google_clicked` | 구글 버튼 |
| `auth_email_submitted` | 이메일 제출 |
| `signed_in` / `signed_out` | 세션 |
| `profile_created` | 사주 프로필 등록 |
| `journal_saved` | 체크인 저장 |
| `fortune_opened` | 운세 열기 |
| `question_shown` | 오늘의 질문 |
| `quote_shown` | 저장 후 명언/문장 |

키가 없으면 분석만 꺼지고 앱은 그대로 동작합니다.
