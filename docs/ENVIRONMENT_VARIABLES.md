# Environment Variables — Phase 6 — 최종 QA·출시 준비

> 마스터 Phase 8 대응 (서두만). 코드·`.env.example` 기준.

| 이름 | 클라 노출 | 서버 | 필수 | 기본 | 비밀 | 비고 |
|------|-----------|------|------|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | 필수 | — | 아니오 | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | 필수 | — | 제한적 | RLS 전제 |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | yes | 관리/검증 | — | **예** | 클라 금지 |
| `OPENAI_API_KEY` | **no** | yes | LLM·RAG 시 | — | **예** | |
| `OPENAI_NARRATIVE_MODEL` | no | yes | 선택 | gpt-4o-mini | 아니오 | |
| `ADMIN_EMAILS` | no | yes | 관리자 | 빈=거부 | 아니오 | |
| `NEXT_PUBLIC_FF_LEGACY_MENU` | yes | — | 선택 | false | 아니오 | 미사용 UI |
| `NEXT_PUBLIC_FF_NEW_DIARY` | yes | — | 선택 | false | 아니오 | |
| `NEXT_PUBLIC_FF_SAJU_SNAPSHOT` | yes | — | 선택 | false | 아니오 | |
| `NEXT_PUBLIC_FF_PERSONALIZATION` | yes | — | 선택 | false | 아니오 | display alias |
| `NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN` | yes | — | 선택 | false | 아니오 | |
| `NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY` | yes | — | 선택 | false | 아니오 | |
| `NEXT_PUBLIC_FF_NEW_ANALYSIS` | yes | — | 선택 | false | 아니오 | |
| `NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM` | yes | — | 선택 | false | 아니오 | 클라 힌트 |
| `FF_ANALYSIS_NARRATIVE_LLM` | **no** | yes | 선택 | false | 아니오 | 실제 LLM |
| `NEXT_PUBLIC_FF_ANALYSIS_CACHE` | yes | — | 선택 | false | 아니오 | 미사용 |
| `TEST_USER_A_EMAIL` 등 | no | 스크립트 | 로컬만 | — | **예** | **운영 금지** |
| `TEST_USER_*_JWT` | no | 스크립트 | 로컬만 | — | **예** | **운영 금지** |
| `BASELINE_DIARY_ENTRIES` 등 | no | 스크립트 | 검증용 | — | 아니오 | 로컬 |

## 환경별

| 변수군 | 개발 | 스테이징 | 운영 |
|--------|------|----------|------|
| Supabase URL/anon | 프로젝트 | 동일/분리 | 운영 프로젝트 |
| service role | 로컬 `.env.local` | 시크릿 스토어 | 시크릿 스토어 |
| LLM key | 선택 | 선택 | LLM ON 시에만 |
| Feature flags | 실험 | 보수적 | 보수적→단계 ON |
| TEST_USER_* | 허용 | 금지 권장 | **금지** |

잘못된/없는 flag 값: `envBool` → 기본 false (안전).
