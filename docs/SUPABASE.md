# Supabase 일기 동기화 설정

노트북·PC에서 같은 일기를 쓰려면 Supabase를 설정하세요.

## 1. Supabase 프로젝트 생성

1. https://supabase.com 에서 새 프로젝트 생성
2. **Settings → API** 에서 URL과 `anon` key 복사

## 2. 환경 변수

`.env.local` (로컬) 및 Vercel **Environment Variables**에 추가:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 서버 전용 — 절대 Git에 올리지 마세요 (.env.local / Vercel만)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

ADMIN_EMAILS=you@example.com

OPENAI_API_KEY=your_openai_api_key_here
```

실제 값은 `.env.example` 형식을 참고해 `.env.local`에만 넣으세요.  
`SUPABASE_SERVICE_ROLE_KEY`와 `ADMIN_EMAILS`는 **절대** `NEXT_PUBLIC_` 접두어를 붙이지 마세요.

## 3. DB 마이그레이션

Supabase Dashboard → **SQL Editor** → 아래 파일을 **순서대로** 실행:

1. [`supabase/migrations/001_diary_entries.sql`](../supabase/migrations/001_diary_entries.sql)
2. [`supabase/migrations/002_year_pillar_ko.sql`](../supabase/migrations/002_year_pillar_ko.sql)
3. [`supabase/migrations/003_p0_profiles_and_diary_fields.sql`](../supabase/migrations/003_p0_profiles_and_diary_fields.sql)
4. [`supabase/migrations/004_experience_condition_origin.sql`](../supabase/migrations/004_experience_condition_origin.sql)
5. [`supabase/migrations/005_forecast_mvp.sql`](../supabase/migrations/005_forecast_mvp.sql)
6. [`supabase/migrations/006_rag_knowledge.sql`](../supabase/migrations/006_rag_knowledge.sql) — 사주 이론 RAG (pgvector)
7. [`supabase/migrations/007_focus_tengod.sql`](../supabase/migrations/007_focus_tengod.sql) — `focus_rating` / `ten_god` (로컬기록)
8. [`supabase/migrations/008_journal_category_system.sql`](../supabase/migrations/008_journal_category_system.sql) — 신규 journal (Phase 2)
9. [`supabase/migrations/009_astrology_snapshots.sql`](../supabase/migrations/009_astrology_snapshots.sql) — 사주 스냅샷 (Phase 3)
10. [`supabase/migrations/010_personalization_models.sql`](../supabase/migrations/010_personalization_models.sql) — 개인화 Ridge (Phase 4)

> **점검 (2026-07-21):** 연결 프로젝트에 008이 아직 없을 수 있다.  
> `node scripts/verify-journal-008.mjs` 로 확인. 상세는 `docs/MIGRATION_STRATEGY.md`.


로그인 후 `Could not find the table 'public.diary_entries'` 가 보이면
**지금 연결된 프로젝트에 테이블이 없는 상태**입니다. 위 SQL을
`.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 **같은 프로젝트**에서 실행하세요.

> Note: migration 004의 잘못된 `id like 'demo-%'` 구문은 제거되었습니다. 데모 데이터는 앱의 `dataOrigin` 필드로 구분합니다.
> migration 006은 `vector` 확장이 필요합니다. Supabase 프로젝트에서 기본적으로 사용 가능합니다.

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

현재 앱 UI에서는 카카오 로그인을 숨겨 두었습니다. 나중에 다시 켤 때:

1. Kakao Developers에서 애플리케이션을 생성합니다.
2. 카카오 로그인과 필요한 최소 동의 항목(계정 이메일)을 활성화합니다.
3. Redirect URI에 Supabase callback URL을 등록합니다.
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. Supabase Dashboard → **Authentication → Providers → Kakao**에서 활성화합니다.
5. REST API 키(Client ID)와 Client Secret을 입력합니다.

사주 생년월일·출생 시각·지역과 일기 원문은 Kakao OAuth 요청에
포함하지 않습니다. 소셜 제공자가 반환한 계정 식별 정보만 인증에 사용합니다.

## 7. 사용

1. `/diary/login` 에서 가입·로그인
2. 로그인 상태면 일기가 Supabase에 저장 (두 PC 동기화)
3. 미설정·미로그인 시 브라우저 IndexedDB에만 저장
4. 로그인 전에 만든 로컬 사주 프로필은 첫 로그인 때 계정에 연결
5. 로컬 일기는 사용자 확인 후 원격 계정으로 가져오기

회원가입 단계에서는 이메일과 비밀번호만 요구합니다. 이름·전화번호·주민번호·
사주 생년월일은 가입 정보로 수집하지 않고, 사주 프로필 등록 단계와 분리합니다.

## 8. 관리자 사주 이론 학습 (RAG)

1. `ADMIN_EMAILS`에 본인 로그인 이메일을 넣습니다.
2. migration `006_rag_knowledge.sql`을 실행합니다.
3. `/diary/login?next=/admin` 으로 로그인한 뒤 `/admin`을 엽니다.
4. 이론 텍스트를 등록하면 Supabase `knowledge_documents` / `knowledge_chunks`에 저장됩니다.
5. 배포(Vercel) 환경에도 동일한 env와 마이그레이션이 있으면, **모든 사용자**의
   만세력·오늘 흐름·내일 예보 해설이 이 이론을 검색해 반영합니다.
6. 이론이 없거나 AI 키가 없으면 기존 로컬 템플릿 해설로 안전하게 동작합니다.

일기 원문·정확한 생년월일·원국 전문은 이론 검색·AI 해설 요청에 포함되지 않습니다.
