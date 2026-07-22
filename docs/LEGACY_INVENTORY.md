# Legacy Inventory

> Phase 1 산출물. 조사일: 2026-07-21  
> 상태: **문서화 완료** — 물리 디렉터리 대규모 이동은 Phase 2 (회귀 테스트 통과 후)

이 문서는 기존 기능을 삭제하지 않고 `Legacy`로 보존·격리하기 위한 인벤토리다.  
인증·만세력 계산·사용자 ID는 Legacy가 아니라 **shared/core**로 유지한다.

## 1. 기술 스택 요약

| 항목 | 값 |
|------|-----|
| 앱 | Next.js 14 App Router, React 18, TypeScript |
| 스타일 | Tailwind 3 + `--px-*` |
| 인증/DB | Supabase Auth + Postgres RLS |
| 로컬 | IndexedDB (`diary/indexedDbStorage`) |
| 사주 | `src/lib/saju/*` + lunar-javascript |
| 테스트 | Jest + ts-jest (`npm test`) |
| 빌드 | `npm run build` |

## 2. 기능 인벤토리 표

| 기능 | 현재 경로/파일 | 데이터 저장소 | 공유 의존성 | Legacy 이동 방식 | 회귀 위험 |
|------|----------------|---------------|-------------|------------------|-----------|
| 하단 내비 | `src/components/AppNav.tsx` | — | 라우트 | Phase 2: 새 5탭 + Legacy 메뉴 링크. 현 URL alias | 중 |
| 예보 홈 | `/`, `home/HomeDashboard.tsx`, `forecast/*` | `daily_forecasts`, IDB forecast | saju dayPillar, diary | `/legacy` 또는 설정>이전 기능 (Phase 2) | 중 |
| 일기/체크인 | `/diary`, `DiaryEditor.tsx`, Happiness/Energy pickers | `diary_entries`, IDB | createEntry, storage | Legacy UI 유지, Adapter 읽기 | **높음** |
| 기록 이력 | `/diary/history` | 동일 | storage | Legacy | 낮음 |
| 패턴/간지통계 | `/diary/stats`, `lib/diary/stats|abStats|trendStats` | diary_entries | dayPillar | Legacy + read-only Adapter | 중 |
| 간지 수집 | `/diary/collection` | diary | collection.ts | Legacy | 낮음 |
| 만세력 UI | `/saju`, `SajuForm`, `SajuResult` | saju_profiles | **calculateSaju (core)** | UI만 Legacy 가능, 계산은 core | **높음** |
| 계정/로그인 UI | `/diary/login`, `WelcomeAuthGate` | auth.users, user_profiles | **supabase auth (core)** | UI Legacy 가능, 세션 공유 | **높음** |
| 관리자 RAG | `/admin`, knowledge/* | RAG tables | admin emails | 운영 — Legacy 아님 | 중 |
| 제품 IA 목업 | `components/product/*`, `services/analysis/*` | — | — | 실험/Legacy 후보 | 낮음 |
| 경험 모드 | `lib/product/modes.ts` | local/profile | — | 새 온보딩과 매핑 | 중 |

## 3. 라우트 맵 (현행 → Legacy 준비)

| 현행 URL | Phase 1 | Phase 2 예정 |
|----------|---------|--------------|
| `/` | 유지 (플래그 OFF 시 현행) | 새「오늘」또는 Legacy 예보 |
| `/diary` | 유지 | Legacy 일기 / 새 일기 분기 |
| `/diary/history` | 유지 | Legacy |
| `/diary/stats` | 유지 | Legacy 패턴 |
| `/diary/collection` | 유지 | Legacy |
| `/diary/login` | 유지 | 설정·계정 (auth core) |
| `/saju` | 유지 | Legacy 만세력 UI + 새「나의 사주」 |
| `/admin` | 유지 | 운영 |

Phase 1에서는 **리다이렉트·물리 이동 없음**. `featureFlags.legacyMenuEnabled` 등으로 준비만 한다.

## 4. shared/core로 유지 (이동·복제 금지)

| 책임 | 경로 |
|------|------|
| Auth 클라이언트/서버 | `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` |
| Auth 콜백 | `src/app/auth/callback/route.ts` |
| 관리자/게스트 | `src/lib/auth/admin.ts`, `guestMode.ts` |
| 사용자·사주 프로필 | `user_profiles`, `saju_profiles`, `profileStorage`, `registerSajuProfile*` |
| 만세력 계산 | `src/lib/saju/calculator.ts` → `calculateSaju` |
| 기둥·JDN·절기·음력 | `dayPillar`, `monthPillar`, `yearPillar`, `hourPillar`, `jdn`, `solarTerms`, `lunarConverter` |
| 지장간·십신·오행 | `hiddenStems`, `elementDistribution`, `constants` |
| 날짜→일진 래퍼 | `src/lib/diary/dayPillar.ts` (`getPillarsForDate`) |

## 5. 삭제·파괴 금지

- `diary_entries` / `saju_profiles` / `user_profiles` 테이블·컬럼 DROP
- 기존 행복도·기분 필드 강제 덮어쓰기
- `calculateSaju` 알고리즘 임의 변경
- `auth.users.id`와 별도 계정 ID 체계

## 6. 관련 문서

- Feature flags: `docs/FEATURE_FLAGS.md`
- 마이그레이션 전략: `docs/MIGRATION_STRATEGY.md`
- QA: `docs/saju_app_qa_metrics_checklist.md`
- 마스터: `docs/cursor_saju_app_rebuild_master_prompt.md`

## 7. Phase 1 완료 기준 (본 문서)

- [x] 인벤토리 표 작성
- [x] core vs Legacy 구분
- [ ] 물리 폴더 `src/legacy/` 이동 — **Phase 2** (미착수)
- [ ] Legacy 메뉴 UI — **Phase 2** (미착수)
