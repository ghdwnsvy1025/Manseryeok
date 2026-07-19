# Supabase 일기 동기화 설정

노트북·PC에서 같은 일기를 쓰려면 Supabase를 설정하세요.

## 1. Supabase 프로젝트 생성

1. https://supabase.com 에서 새 프로젝트 생성
2. **Settings → API** 에서 URL과 `anon` key 복사

## 2. 환경 변수

`.env.local` (로컬) 및 Vercel **Environment Variables**에 추가:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 3. DB 마이그레이션

Supabase Dashboard → **SQL Editor** → 아래 파일을 **순서대로** 실행:

1. [`supabase/migrations/001_diary_entries.sql`](../supabase/migrations/001_diary_entries.sql)
2. [`supabase/migrations/002_year_pillar_ko.sql`](../supabase/migrations/002_year_pillar_ko.sql)
3. [`supabase/migrations/003_p0_profiles_and_diary_fields.sql`](../supabase/migrations/003_p0_profiles_and_diary_fields.sql)
4. [`supabase/migrations/004_experience_condition_origin.sql`](../supabase/migrations/004_experience_condition_origin.sql)

## 4. Auth 기본 설정

Dashboard → **Authentication → Providers** → Email 활성화

Dashboard → **Authentication → URL Configuration**:

- Site URL: 배포 주소 (예: `https://example.com`)
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://example.com/auth/callback`

실제 개발 포트가 다르면 해당 localhost 주소도 추가하세요.

## 5. Google 로그인

1. Google Cloud Console에서 OAuth 2.0 Client ID(Web application)를 생성합니다.
2. Authorized redirect URI에 Supabase가 안내하는 callback URL을 입력합니다.
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase Dashboard → **Authentication → Providers → Google**에서 활성화합니다.
4. Google Client ID와 Client Secret을 입력합니다.

앱은 로그인 후 `/auth/callback`에서 PKCE 코드를 세션으로 교환하고
`/diary/login`으로 돌아옵니다.

## 6. 카카오 로그인

1. Kakao Developers에서 애플리케이션을 생성합니다.
2. 카카오 로그인과 필요한 최소 동의 항목(계정 이메일)을 활성화합니다.
3. Redirect URI에 Supabase callback URL을 등록합니다.
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. Supabase Dashboard → **Authentication → Providers → Kakao**에서 활성화합니다.
5. REST API 키(Client ID)와 Client Secret을 입력합니다.

사주 생년월일·출생 시각·지역과 일기 원문은 Google/Kakao OAuth 요청에
포함하지 않습니다. 소셜 제공자가 반환한 계정 식별 정보만 인증에 사용합니다.

## 7. 사용

1. `/diary/login` 에서 가입·로그인
2. 로그인 상태면 일기가 Supabase에 저장 (두 PC 동기화)
3. 미설정·미로그인 시 브라우저 IndexedDB에만 저장
4. 로그인 전에 만든 로컬 사주 프로필은 첫 로그인 때 계정에 연결
5. 로컬 일기는 사용자 확인 후 원격 계정으로 가져오기

회원가입 단계에서는 이메일과 비밀번호만 요구합니다. 이름·전화번호·주민번호·
사주 생년월일은 가입 정보로 수집하지 않고, 사주 프로필 등록 단계와 분리합니다.
