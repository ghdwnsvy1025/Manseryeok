# Phase 2 Implementation

> **전체 개편 중 Phase 2 완료** (Phase 3 자동 진행 없음)  
> 일자: 2026-07-21

사용자 요청 범위: **신규 일기·카테고리 점수 시스템**  
(마스터 문서의 Phase 번호와 다를 수 있음 — 본 작업은 요청된 「Phase 2」 목표를 따름)

## 구현 요약

- 신규 경로 `/journal`, `/journal/categories` (feature flag `newDiaryEnabled`)
- 카테고리 seed 9개, 최소 4 / 권장 6 / 최대 9
- 점수 1–5 + 해당 없음(null), 사건 태그, 자유 일기, 하루 만족도·기분
- 저장: IndexedDB (`manseryeok-journal`) + Supabase 008 테이블(로그인·마이그레이션 적용 시)
- Legacy `/diary` 행복도 저장과 **데이터 미병합**

## 화면

| 경로 | 기능 | flag OFF |
|------|------|----------|
| `/journal` | 작성·조회·수정 | 안내 게이트 |
| `/journal/categories` | 온보딩/설정 | 안내 게이트 |
| `/diary` | Legacy 기록 | 항상 유지 |

## 플래그

`NEXT_PUBLIC_FF_NEW_DIARY=true` 로 개발 환경에서 ON. 기본값 `false`.

## 삭제

일기 soft/hard delete는 이번 범위에서 **미구현** (요청: Phase 정의에 있을 때만).

## 테스트

`src/__tests__/journal/journalSystem.test.ts` + 기존 legacy 회귀 유지.
