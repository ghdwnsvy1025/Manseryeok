# 사주읽는밤 일기 — 재구축 계획

> 결정일: 2026-10-04 · 지금 앱(레거시)은 그대로 두고 새 앱을 옆에 지은 뒤, 데이터만 옮겨 배포를 갈아끼운다.
> 이 문서가 기준이다. 결정을 바꾸면 이 문서부터 고친다.

---

## 1. 왜 다시 짓나

| 항목 | 레거시 (2026-10-04) |
|---|---|
| 소스 | 약 86,000줄 · 컴포넌트 157개 · lib 271개 · 테스트 104개 |
| API 라우트 | 30개 |
| DB | 테이블 31개 · 마이그레이션 30개 |
| 실제 데이터 | 기록 111건(그중 83건이 한 계정) · 사주 프로필 23개 · 로그인 계정 24개 |
| 최근 2주 로그인 | 0명 (지인 베타는 8월 초 1~9건 쓰고 멈춤) |

일기 시스템 두 벌, 홈 세 벌, 운세 입력 2만 토큰, Phase마다 쌓인 기능이 그대로 남아 있다. 지킬 데이터는 작고 코드는 크다. 고쳐 쓰기보다 새로 짓고 옮기는 게 싸고 안전하다.

## 2. 확정된 결정

### 제품
| 주제 | 결정 |
|---|---|
| 핵심 사용자 | 사주를 모르는 20~30대. 기록 습관을 들이고 싶은 사람. 전문용어는 기본 숨김 |
| 핵심 기능 | ① 일기 ② 기록이 쌓일수록 정확해지는 운세 ③ 심화: 간지별 내 행복도 |
| 화면 | **오늘 · 쓰기 · 나** 세 개 |
| 기록 입력 | 행복도 1~10 + 기분 최대 3개 + 한 줄 메모. 카테고리 점수 7개는 **제거** |
| 비로그인 | 오늘 운세 보기만 가능. 기록 버튼을 누르면 Google 로그인 |
| 첫 주 보상 | 엔진이 즉시 만드는 "오늘 간지 × 내 일간" 한 줄 (LLM 없음) |
| 저장 후 보상 | 명언 대신 "내일은 ○○일" 한 줄. 명언 데이터는 보관만 |
| 진행 지표 | 맞춤도 % 하나. XP·레벨 제거 |
| 재방문 | 저녁 로컬 알림(PWA) + 카카오 채널 "사주읽는밤" |
| 공유 | "내가 가장 행복한 날은 乙卯일" 카드 (바이럴 60갑자 카드 디자인 재사용) |
| 수익 | 이 앱은 무료 습관 앱. 영역별 깊은 풀이는 사주 코어 유료 상품으로 연결. 그 전까지 잠금 탭 없음 |
| 이름 | **사주읽는밤 일기** (카카오 채널·바이럴과 통일) |
| LLM 예산 | 월 20만 원 이하 (1,000 DAU 기준) |

### 정확도 공식 (가설 카드·Ridge 대체)
```
오늘 점수 = 사주 기본점수(엔진) × (1 − w) + 내 간지별 행복도 평균 × w
w        = n / (n + k)      n = 오늘과 같은 간지 성분(일간·일지·오행)의 내 기록 수, k = 5
맞춤도 % = 같은 공식을 전체 기록 수에 적용
```
첫날부터 움직이고, 설명할 수 있고, "쓸수록 내 것이 된다"는 문장이 사실이 된다. 👍👎 피드백도 같은 방식으로 섞는다.

### 기술
| 주제 | 결정 |
|---|---|
| 위치 | 이 저장소 안 `apps/diary/` (새 앱) · `packages/saju-engine/` (공용 엔진). 루트 `app/`은 쓰지 않는다 — Next.js가 루트 `app/`을 `src/app`보다 먼저 잡아 레거시가 깨진다 |
| 스택 | Next.js 15 · React 19 · Supabase(같은 프로젝트, 새 테이블) · Tailwind · PostHog · Vercel |
| 엔진 | `src/lib/saju/`를 `packages/saju-engine/`로 옮겨 원본으로 삼는다. 사주 코어는 지금처럼 커밋 해시를 적어 복사(vendor)한다 |
| LLM | 운세 1회 호출 · 입력 2,000토큰 이내 · 사용자(게스트는 프로필 지문)·날짜 단위 서버 캐시 |
| DB | 테이블 6개, 이름은 모두 `night_` 접두어 (레거시 테이블과 겹치지 않게): `night_profiles` · `night_saju_profiles` · `night_entries` · `night_fortunes` · `night_fortune_feedback` · `night_notification_settings`. 간지 통계는 저장하지 않고 읽을 때 계산. 마이그레이션은 `apps/diary/supabase/migrations/`, 적용은 SQL Editor |
| API | 5개: 운세 생성 · 기록 저장 · 간지 통계 · 알림 등록 · 계정 삭제 |

## 3. 단계

| 단계 | 내용 | 기간 | 상태 |
|---|---|---|---|
| 0 | 데이터 전체 백업 · 레거시 동결 · 이 문서 | 1일 | **완료 2026-10-04** |
| 1 | 엔진 패키지 분리 · 새 앱 뼈대 · Google 로그인 · 기록 저장 | 5일 | **코드 완료 2026-10-04** · DB 적용과 실계정 로그인 확인 대기 |
| 2 | 운세 v3 (엔진 점수 + LLM 1회 + 캐시) | 4일 | **코드 완료 2026-10-04** · 게스트 흐름 확인, 로그인 사용자 화면은 사용자 확인 대기 |
| 3 | 간지별 행복도 · 맞춤도 · 나 탭 | 4일 | **코드 완료 2026-10-04** |
| 4 | 저녁 알림 · 설치 유도 · 공유 카드 | 3일 | **코드 완료 2026-10-04** · 실기기 푸시 수신은 배포 뒤 확인 |
| 5 | 레거시 데이터 이관 · 배포 전환 · 레거시 보관 | 1일 | **이관 완료 2026-10-04** · 배포 전환은 디자인 반영 뒤 사용자가 Vercel에서 (아래 9절) |

## 4. 0단계 기록

**레거시 동결 지점**: 태그 `legacy-final` = `2fa5ff0` (GitHub main, 지금 Vercel 운영본).
동결 이후 레거시에는 기능을 더하지 않는다. 운영본은 5단계 전환까지 그대로 돌아간다.

**재구축 브랜치**: `rebuild`. 첫 커밋에 만세력 버그 수정 2건(음력 30일 검사, 월 절기 끝 시각)과 회귀 테스트, 9월 25일 문서 2개를 담았다.

**데이터 백업**: 저장소 밖 `사주 일기/backup/2026-10-04_legacy/` (106MB). 깃에 올리지 않는다 — 생년월일·일기 원문·이메일이 들어 있다.
- `tables/*.json` 31개 테이블 전체, 행 수 검증 완료 (`manifest.json`)
- `auth_users.json` 계정 24개의 id·이메일·가입 방식 (이관 시 user_id 매핑용)
- `migrations/` 레거시 스키마 SQL 30개
- `laptop-wip/` 노트북 `Desktop/Manseryeok`에만 있던 미커밋 작업 (8월 3일 커밋 기준 수정 36파일 패치 + 미추적 파일)

**이관 대상 (5단계)**
| 데이터 | 처리 |
|---|---|
| `journal_entries` 111건 (Google 계정 108 · 익명 3) | 행복도·기분·메모·날짜만 새 기록 테이블로. 익명 3건은 버린다 (새 앱은 게스트 기록 없음) |
| `diary_entries` 21건 (구 시스템, 한 계정) | 같은 날짜 journal이 없으면 새 기록으로 |
| `saju_profiles` 23개 | 로그인 계정 소유 17개만 (익명 6개 제외) |
| 나머지 (운세 캐시·질문·명언 전달·노출 이벤트·지식 청크 등) | 옮기지 않는다. 백업으로만 보관 |

**레거시 테스트 기준선**: 864개 중 853 통과 · 8 실패 · 3 스킵. 실패 8건은 받았을 때부터 있던 것(기능 플래그 기본값, 이론 문서 해시, 노출 이벤트 카탈로그 등)이고 고치지 않는다.

**레거시 플래그 (운영 .env)**: LEGACY_MENU · NEW_DIARY · SAJU_SNAPSHOT · PERSONALIZATION(+TRAIN·DISPLAY) · NEW_ANALYSIS · ANALYSIS_NARRATIVE_LLM · ANALYSIS_CACHE · HYPOTHESIS_CARDS · CALM_HOME · SOFT_THEME · SEAL_LEGACY 켜짐. CHECKIN_V2 꺼짐.

## 5. 1단계 기록

- `packages/saju-engine`: 레거시 `src/lib/saju/` 최상위 15개 파일과 테스트 11개(146건)를 옮겼다. 풀이 문장 생성기(`reading/`·`rules/`·`interpretation/`)는 새 앱에서 안 써서 두고 왔다. jest → vitest.
- `apps/diary`: Next 15 · React 19 · Tailwind 4 · @supabase/ssr. 화면은 오늘(`/`) · 쓰기(`/write`) · 나(`/me`) · 로그인 · 생년월일(`/onboarding`). 저장은 서버 액션.
- 엔진은 `file:` 링크로 쓴다. npm이 링크된 패키지의 의존성을 깔지 않아서 앱이 `lunar-javascript`를 직접 의존하고, `next.config.ts`에서 `resolve.symlinks = false`로 앱의 node_modules에서 찾게 했다. Vercel 배포 시 Root Directory는 `apps/diary`.
- 개발 서버는 레거시와 같은 3001 포트를 쓴다. Supabase 리디렉트 허용 목록(`/auth/callback`)을 그대로 쓰기 위해서다.
- 계산 기준은 레거시와 같다: 자정 일 바뀜 · 진태양시 보정 · 출생지 8개 도시 경도. 1990-01-01 12:00 서울 → 己巳 丙子 丙寅 甲午로 레거시 화면과 일치.

## 6. 2단계 기록

- `src/lib/fortune/`: `base.ts`(엔진 점수: 십신 가감 + 일지·월지 합충 + 용신/기신) · `personal.ts`(베이지안 수축, K=5; 맞춤도 K=20) · `text.ts`(템플릿 문장, 금지어 검사) · `llm.ts`(gpt-4o-mini 1회, JSON 스키마, 입력 4,000자 상한) · `index.ts`(캐시 `night_fortunes`, 지문 = 버전+엔진+네 기둥).
- 게스트: 생년월일을 쿠키(`night_guest`, 180일)에만 두고 서버엔 저장하지 않는다. 캐시 키는 생년월일시 해시라 같은 사주면 캐시를 나눠 쓴다.
- 모델 문장에 금지어가 있으면 템플릿으로 대체한다. 모델 실패·키 없음도 템플릿.
- 피드백 "맞아요/아니에요"는 `night_fortune_feedback`에 저장만 한다 (점수 반영은 3단계에서 간지 통계와 함께).
- 실측: 게스트 첫 호출 3.9초(모델 포함), 재방문은 캐시로 즉시. 1990-01-01 12:00 서울 × 2026-10-04 신해일 → 정재·육합·용신 → 7.1 좋음.

## 7. 3단계 기록

- `src/lib/stats/ganji.ts`: 60갑자 격자, 천간·지지·오행 묶음, 하이라이트(최고·최저 간지는 2번 이상, 천간·지지는 3번 이상일 때만), 신호 단계(없음/약함 <3/보통 <7/뚜렷함).
- "나" 화면: 격자 → 맞춤도(K=20) → 사실 줄 → 접힌 묶음 세 개 → 네 기둥 → 기록 목록. 칸 선택은 `?cell=N` 링크라 자바스크립트 없이 동작.
- 피드백 "맞아요/아니에요"를 점수에 섞는 건 보류. 표본이 모일 때까지 저장만 한다.
- 디자인 명세 `apps/diary/docs/design/03-나-간지격자.md`.

## 8. 4단계 기록

- **저녁 알림**: Web Push(VAPID). 사용자가 "나" 탭에서 켜면 브라우저 구독을 `night_notification_settings.web_push`에 저장. Vercel Cron이 매시 정각 UTC 10~14시(한국 19~23시)에 `/api/cron/remind`를 부르고(`vercel.json`), 그 시각이 알림 시각이면서 오늘 기록이 없는 사람에게만 보낸다. 만료 구독(404/410)은 자동으로 끈다. 서비스 워커(`public/sw.js`)는 캐시 없이 푸시만.
  - 배포 시 Vercel 환경변수에 넣을 것: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (로컬 `.env.local`에 생성해 둠. 같은 값을 써야 기존 구독이 유지된다).
  - 아이폰은 홈 화면에 추가한 PWA에서만 푸시가 된다. 화면이 그렇게 안내한다.
  - 카카오 채널은 링크(`https://pf.kakao.com/_WJJxiX`)만. 채널 메시지 자동 발송은 카카오 비즈니스 API가 필요해 보류.
- **앱으로 두기**: `manifest.webmanifest` + 설치 안내(카톡 인앱·iOS·Android 분기, `beforeinstallprompt` 있으면 버튼). 아이콘은 레거시 것을 임시로 복사 → 디자인 명세 04에서 교체.
- **공유 카드**: 브라우저 캔버스로 1080×1350 PNG를 그려 Web Share API(파일 공유)로 넘기고, 안 되면 내려받기. 서버 렌더러(satori)는 webp·한글 글꼴 문제로 포기. 캐릭터는 `public/characters/<간지>.webp`(디자인 세션이 바이럴에서 복사).
- 디자인 명세 `apps/diary/docs/design/04-알림-설치-공유.md`.

## 9. 5단계 기록 — 이관 결과와 배포 전환 절차

**이관 (2026-10-04 실행, `apps/diary/scripts/migrate-legacy.migrate.ts`)**

| 항목 | 결과 |
|---|---|
| 기록 | 88건 넣음 (journal 108건 → 같은 날 중복 21건은 최신 것만 87건 + 구 diary 중 journal과 안 겹친 1건). 익명 3건 버림 |
| 사주 프로필 | 11명 중 10명 넣음 (1명은 새 앱에서 이미 만들어 건너뜀) |
| 검증 | 레거시에 저장돼 있던 네 기둥과 엔진 재계산이 11명 전부 일치 |
| 결과 테이블 | `night_entries` 89 (legacy 88 + app 1) · `night_saju_profiles` 11 · `night_profiles` 11 (모두 `migrated_from_legacy` 표시) |

다시 돌려도 안전하다 (같은 날은 건너뛴다). 되돌리려면 `delete from night_entries where source = 'legacy'`.

**배포 전환 (사용자가 Vercel 대시보드에서)**

1. 디자인 세션 작업을 검토·커밋해 `rebuild`에 올린다 (`public/characters/` 60장 포함 — 공유 카드가 쓴다).
2. Vercel 프로젝트 Settings → General → **Root Directory = `apps/diary`**, Framework = Next.js. Node 20 이상.
3. Settings → Environment Variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`. 값은 로컬 `apps/diary/.env.local`과 같게 (VAPID가 다르면 기존 알림 구독이 끊긴다).
4. Settings → Git → Production Branch를 `rebuild`로 바꾸거나, `rebuild`를 `main`에 머지한다. 머지하는 쪽을 권장 (그래야 "main = 운영"이 유지된다). 머지 전 `main`의 레거시 코드는 태그 `legacy-final`로 남아 있다.
5. 배포 뒤 확인: `/` 게스트 운세 · Google 로그인(`/auth/callback`은 레거시와 같은 경로라 Supabase 리디렉트 목록 수정 불필요) · `/me` 격자 · `/manifest.webmanifest` · 크론은 다음 날 UTC 12시(한국 21시)에 Vercel 로그에서 `/api/cron/remind` 200 확인.
6. 크론은 무료 플랜 제한(하루 1회)에 맞춰 **밤 9시 고정**이다. 유료 플랜으로 가면 `REMIND_HOURS`와 `vercel.json`을 매시로 늘린다.
7. 안정되면 `src/`(레거시 앱)를 지우고 `packages/`·`apps/`만 남긴다. 그 커밋 전에 `legacy-final` 태그가 있는지 다시 확인.

## 10. 레거시에서 가져올 것 / 버릴 것

**가져올 것**: 만세력·오행 분포 엔진 · Supabase 프로젝트와 Google 로그인 설정 · "오늘 기록, 고마워요" 계열 문장 톤 · PWA 설치 안내(카톡 인앱 처리 포함) · 시간대별 홈 분기(낮=운세, 밤=기록)

**버릴 것**: 구 일기 시스템 · 가설 카드 흐름 · 카테고리 점수 · Ridge 개인화 · 예보·분석·서술 화면 · 관리자 RAG와 지식 테이블 · 명언 라이브러리 노출 · XP·레벨 · 회전 티저 · "결·기운·흐름" 어휘
