# Data Model

## Legacy

| 개념 | 테이블 |
|------|--------|
| 기존 일기 | `diary_entries` |
| 프로필 | `user_profiles`, `saju_profiles` |
| 예보·RAG | `daily_forecasts`, `knowledge_*` |

변경·삭제 금지 (개편 additive).

## Phase 2 — Journal

| 개념 | 테이블 |
|------|--------|
| diary entry | `journal_entries` |
| category | `category_catalog` |
| preferences | `user_category_preferences` |
| scores | `category_scores` |
| tags | `event_tag_catalog` / `journal_entry_tags` |

## Phase 3 — Astrology snapshots

| 개념 | 테이블 |
|------|--------|
| profile cache | `astrology_profiles` |
| date snapshot | `astrology_snapshots` |
| feature vector | `astrology_feature_vectors` |

버전: `calculation_version`, `theory_version`, `feature_schema_version`.

## Phase 4 — 개인화 Ridge MVP · complete

| 개념 | 테이블 |
|------|--------|
| model | `personalization_models` |
| metrics | `personalization_model_metrics` |
| predictions | `personalization_predictions` |

## Phase 5 — 분석 UI·서술 · complete

실시간 조립. **011 없음.** ViewModel은 조회·가공만 (원본 불변).

## Phase 6 — 최종 QA·출시 준비

스키마 추가 없음. 보존 스냅샷·릴리스 게이트: `verify-phase6-release-gate.mjs`.
