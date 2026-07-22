# Known Limitations — Phase 6 / 6.1

> 마스터 Phase 8 대응 (서두만).

## 제품·도메인

- 월·일운 일부 이론 parity **partial** (Phase 3부터 명시)
- 분석 캐시(011) **미구현** — `analysisCacheEnabled` 예약만
- `legacyMenuEnabled` 플래그 정의만 있고 UI 미연결
- `/api/analyze`, `/api/diary/classify` **410 disabled** (외부 AI 차단 정책)

## 검증 공백 (잔여)

- 실기기 Safari/Chrome 터치·회전·소프트키보드 — 인간 체크리스트
- Google OAuth 실계정 — 인간
- axe/Lighthouse CI 미도입 — Playwright + 수동으로 대체
- 만료 세션 UX 실기기 재현 미기록

## 보안·운영

- anon key는 클라 노출 전제(RLS 필수)
- ephemeral E2E 사용자는 service role로 생성 — **운영 배포 파이프라인에 넣지 말 것**
- `NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS` 는 Playwright 전용 — **운영 금지**
- 관리자 RAG는 `ADMIN_EMAILS` + service role 서버 경로에 의존

## 의도적 제한

- 일기 원문·계수·PII는 LLM 서술 입력에 넣지 않음
- predictionVisible=false / degraded → UI·LLM 모두 숨김
- App-wide = **pending_human_smoke** (실기기만 잔여)
