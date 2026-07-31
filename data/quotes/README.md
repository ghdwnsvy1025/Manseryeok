# 명언 데이터셋

| 파일 | 용도 | 시드 우선순위 |
|------|------|-------------|
| `verified_classic_quotes_500_ko.json` | 동양 고전 출처 검증 500 | **1순위** |
| `western_classic_quotes_500_ko.json` | 서양 고전 출처 검증 500 | **1순위** |
| `korean_aphorisms_5000.json` | AI 생성 한국어 격언 5000 | 후순위 |

## 시드

```bash
# 검증 고전 1000개만 (기본)
node scripts/seed-verified-classic-quotes.mjs

# 격언 5000까지 포함 (후순위)
node scripts/seed-verified-classic-quotes.mjs --include-aphorisms
```

선정 시 `verified_classic_*` 출처가 점수 가산을 받고, 일기 기분·낮은 카테고리·요약과 맞춰 조언성 높은 구절을 고릅니다.
