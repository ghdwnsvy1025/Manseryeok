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

Supabase Dashboard → **SQL Editor** → 아래 파일 내용 실행:

[`supabase/migrations/001_diary_entries.sql`](../supabase/migrations/001_diary_entries.sql)

## 4. Auth 설정

Dashboard → **Authentication → Providers** → Email 활성화

## 5. 사용

1. `/diary/login` 에서 가입·로그인
2. 로그인 상태면 일기가 Supabase에 저장 (두 PC 동기화)
3. 미설정·미로그인 시 브라우저 IndexedDB에만 저장
