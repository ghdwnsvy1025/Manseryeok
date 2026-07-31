# 지인 테스트 초대 안내

URL: https://saju-diary.vercel.app  
(Vercel → Project → Domains에 나온 주소가 다르면 **그 주소**로 통일하세요. 보통 `_`는 `-`로 붙습니다.)

## 시작 방법

1. **「Google로 3초 만에 시작」**을 눌러 주세요. (가입 양식 없음 · Gmail만 있으면 됨)
   - Google이 없으면 **「이메일이 더 편해요」**로도 가능합니다.
2. **사주 프로필은 본인 1개만** 등록하면 됩니다.
3. 하단 탭은 **홈 · 일기 · 기록**만 사용하세요.
4. 오늘 일기를 한 번 저장해 보고, 홈의 운세·문장을 확인해 주세요.
5. 버그·어색한 문장은 화면 오른쪽 아래 **의견** 버튼, 또는 헤더 ☰ → **의견 보내기**로 제보해 주세요.

## 알아 두실 것

- 데이터는 앱 운영용 DB에 저장되며, 다른 테스터와는 서로 보이지 않습니다.
- 버그·어색한 문장·깨진 화면이 있으면 **스크린샷 + 어떤 버튼을 눌렀는지**를 보내 주세요.

## 운영자 체크 (초대 전)

- [x] Vercel Production: `NEXT_PUBLIC_FF_NEW_DIARY` 등 ON, `OPENAI_API_KEY` 있음, `NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS` 없음
- [x] Supabase: migration **025** 적용 (`verify-025-profile-scope` / backfill OK)
- [ ] Supabase: migration **028** (`beta_feedback`), **029** (`none_special`/`other` 태그) 적용
- [x] 명언 `quote_library` ≈47행 + embedding 샘플 확인
- [ ] Auth Redirect(수동): Site URL + **`https://saju-diary.vercel.app/auth/callback`**
  - `https://example.com/auth/callback`, 옛 `manseryeok-self…` 는 **삭제**
  - localhost는 유지: `http://localhost:3000/auth/callback`
- [ ] Google OAuth: Supabase Providers → Google ON (이미 되어 있으면 OK)
- [ ] PostHog: Vercel에 `NEXT_PUBLIC_POSTHOG_KEY` (+ 선택 `NEXT_PUBLIC_POSTHOG_HOST`) 넣고 재배포 — `docs/POSTHOG.md`
- [ ] 시크릿 창에서 구글 로그인 → 사주 → 일기 저장 → 홈 콘텐츠 1회 (본인 확인)
- [x] LLM API 비로그인 → 401 (`AUTH_REQUIRED`) 배포 확인
- [ ] OpenAI 대시보드 사용량 한도·알림
