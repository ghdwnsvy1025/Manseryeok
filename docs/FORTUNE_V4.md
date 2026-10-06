# 오늘의 운세 v4 — 사주 코어 판정 위에 다시 짓기 (2026-10-05)

> 결정(2026-10-05): 판정 + 대운·세운 + 영역(B안) / 용신은 코어 규칙(현묘표)로 통일 / 글은 더 매끄럽고 자세하게 / 10점 점수 유지.
> 1단계(코어 판정 함수 이식)는 끝났다: `packages/saju-core-rules` (`@saju/core-rules`), 원본 커밋 ebf972d.
> 이 문서는 2단계(판정 조립)와 3단계(글)의 설계다. 바뀌면 여기부터 고친다.

## 왜 v3가 얕았나
- 일진 천간의 십신 하나, 일지·월지와의 합충, 용신 이분법 — 축이 셋뿐이라 어느 날이든 비슷한 말.
- 대운·세운을 안 봐서 같은 임자일이 해마다 같음.
- 영역이 없어 "작은 목표를 정해요" 같은 범용 문장.

## v4 판정 파이프라인 (`apps/diary/src/lib/fortune/`)

```
프로필(생년월일시·성별·달력·도시, 원국 pillars 스냅샷)
  → 원국: toCorePillars(pillars) → balance → yongsin(현묘표) → relations
  → 맥락: fromBirth(BirthInput) → currentLuckContext(birth, 오늘) = 현재대운·세운(올해)·월운(이달)
  → 일진: dayGanji(오늘) → luck(p, 일진) + luckRelations(p, 일진) + luckAreas(luck, "일운")
  → 중첩: luckClash(현재대운, 일진), luckClash(세운, 일진)  (+ 대운·세운 자체의 luck 판정은 배경 사실)
  → 점수: 10점 환산 (아래)
  → 기록 보정: personal.ts 그대로 (w = n/(n+5))
  → 글: 3단계
```

### 원국은 어느 쪽 pillars를 쓰나
"나" 화면·격자·이관 검증이 모두 일기 앱 엔진(`@saju/engine`)의 `pillars` 스냅샷을 기준으로 하므로, **원국 네 기둥은 일기 앱 스냅샷을 쓴다.** `fromBirth`는 **대운 목록을 얻는 데만** 쓴다. 두 쪽 네 기둥이 다르면(경도 보정·자시 규칙 차이) 콘솔 경고를 남기고 일기 앱 스냅샷을 믿는다. 테스트에서 이관된 사주 샘플로 둘이 같은지 확인한다.

### 입력 변환
- `ProfileInput` → `BirthInput`: `{year, month, day, hour?, minute?, 달력: calendar==="lunar"?"음력":"양력", 윤달: isLeapMonth, 성별: gender==="male"?"남":"여", 출생지: CITIES[city].coreName}` — CITIES에 코어 출생지 이름(서울·부산…)을 매핑하는 필드가 없으면 `src/lib/profile.ts`에 추가. 매핑 안 되는 도시는 경도를 직접 넘긴다(`경도: city.longitude`).
- 게스트(쿠키)도 같은 필드를 갖고 있으므로 같은 경로. 게스트는 기록이 없을 뿐.

### 세운 연도
`currentLuckContext`는 기준일의 양력 연도로 세운을 뽑는다. **입춘 전(1월 1일 ~ 입춘 전날)은 전년 세운**을 쓴다. 입춘 시각은 `@saju/engine`의 절기 함수로 구한다. 이건 어댑터 호출 쪽(일기 앱)에서 처리하고 테스트를 둔다.

### 시간 모름 · 균형붕괴
- `hour === null`: 코어 Y-10 — `unknownHour(p)`로 시주 12개를 넣어 보고 용신이 10/12 이상 모이면 그 용신으로 진행, 아니면 **용신 축을 빼고**(luck의 라벨 대신 십신·합충만) 계산하고 `fitNote`에 "태어난 시간을 모르면 운세의 폭이 넓어져요" 한 줄.
- `isCollapsed` (균형붕괴): 코어 규칙대로 전왕표. `luck()`이 내부에서 처리하는지 확인하고, 안 하면 코어 README의 지시대로.

## 10점 환산 (Q4-A)
코어 `luck()`은 천간·지지 각각 점수(용 +2, 희 +1, 한 0, 구 −1, 기 −2; 천간 ×1.5)와 합계 판정 5단계를 낸다. 코어 테스트 기대값(예: 戊戌 매우 유리 / 壬寅 어려움)을 깨지 않는 선에서:

```
raw = luck.합계점수                         // 범위 대략 −5 ~ +5
rel = Σ luckRelations 지지별 (유리 +0.5·강도, 불리 −0.5·강도, 최대 ±1.5)
ctx = 대운충 −0.8 (최고경보 −1.2) + 세운충 −0.5 + 월운충 −0.3  (유리한 합은 +0.3씩, 최대 +0.6)
score01 = clamp(0.5 + (raw + rel + ctx) / 12, 0.12, 0.92)
```
- 계수는 가설이다. **이관된 기록 89건으로 "v4 점수 vs 실제 행복도" 상관을 v3와 비교**해 v3보다 나쁘면 계수를 조정한다(`scripts/fortune-backtest.ts`, 결과를 이 문서에 표로).
- 밴드는 그대로: ≥6.8 좋음 / ≥4.8 무난 / 그 아래 주의.
- 영역: `luckAreas(l, "일운")` 결과 중 판정이 "한"이 아닌 영역만 최대 3개. 영역별 숫자는 만들지 않는다(코어 규칙: 일운은 확신도 "낮음", 5단계까지만). 화면엔 "사람 ↑ / 돈 → / 일 ↓" 식 신호만.

## FortuneContent v4 (types.ts)
v3 필드 유지 + 추가:
```ts
core: {
  dayLuck: { stem: {tenGod, label, score}, branch: {...}, total: 판정5 },
  relations: { hits: [{ pos: "연|월|일|시", kind: "충|육합|삼합|반합|…", direction: "유리|불리|중립", strength }], flags: string[] },
  context: { daeun?: {간지, 판정5, clash?: {강도, 최고경보}}, seun: {...}, wolun?: {...}, 입춘전: boolean },
  areas: [{ area: "대인|재물|직업|학업|연애|가족|건강", signal: "↑|→|↓", why: string }],
  facts: string[],          // 글 재료. 사용자용 낱말로 바꾼 사실 문장 6~10개
  keywords: { positive: string[], negative: string[] },  // luckKeywords
  caveats: string[],        // "시간 모름", "입춘 전" 등
}
```
`FORTUNE_VERSION = "v4"` → 캐시 지문이 바뀌어 기존 캐시는 자동 무효.

## 3단계 — 글 (Q3)
코어 content 층 방식의 축소판. `llm.ts`를 교체.
1. **brief**: `core.facts`(십신은 생활어 TEN_GOD_THEME로), `keywords`, 내 기록 숫자(`personal.n/mean/sameGanjiMean`), 금지어, 분량 규칙.
2. **모델 1회** → JSON `{headline, body, areas: [{area, line}], do, dont}`. 본문 4~6문장, 영역 줄은 신호 있는 영역만 1줄씩, 하면/피해요 각 1문장.
3. **검사**: 금지어(`findBanned` + 코어 금지 낱말), 기간 약속 금지("N일 더 쓰면"), 숫자는 facts에 있는 것만, 어미 "~어요", 길이 범위.
4. 탈락하면 이유를 붙여 **1회 재작성**. 또 탈락하면 템플릿(`text.ts`를 v4 재료로 확장: 영역 줄 템플릿 추가).
5. 모델: **Q5 결정 — Claude Sonnet 5** (`claude-sonnet-5`, 환경변수 `FORTUNE_MODEL`로 덮어씀). Anthropic SDK(`@anthropic-ai/sdk`), 규칙(system) `cache_control`, `max_tokens` 2048, `thinking: adaptive` + `effort: low`, 구조화 출력(`output_config.format`), 샘플링 파라미터 없음. 키는 `ANTHROPIC_API_KEY`(apps/diary/.env.local·Vercel). **OpenAI 경로는 제거** — 운세에서 `OPENAI_API_KEY`를 더 쓰지 않는다. 키가 없으면 모델을 부르지 않고 템플릿.

### 3단계 구현 메모 (2026-10-05)
- `brief.ts` — `buildBrief()`: facts(한자→한글, 괄호 십신 제거)·areas·keywords·caveats·personal·`mine`(내 숫자 한 문장 재료)·`allowedNumbers`·`banned`(text.ts BANNED + 코어 COMMON_BAN·HEALTH_BAN)·`jargon`·분량 규칙. 기록이 없으면 `mine: null`이고 기록 이야기를 금지한다.
- `validate.ts` — `validateFortuneText()`: 금지어·전문용어(일상어 "상관없-", "~는 편인"은 제외)·한자·이모지·숫자(brief에 있는 것만)·기간 약속·단정·어미("~요" 80% 이상, 명령조·"~다" 0)·본문 4~6문장·areas 개수·이름·순서 일치·줄 1문장·길이 상한·내 숫자 문장. 사유 목록을 돌려준다.
- `llm.ts` — `generateFortuneText()`: 모델 → 검사 → 탈락이면 사유·이전 글을 붙여 1회 재작성 → 또 탈락이면 템플릿. refusal·API 오류도 템플릿. 결과에 `attempts`·`model`·`usage`. 호출마다 `console.info` 한 줄(토큰).
- `index.ts` — 모델 JSON의 `areas[].line`을 쓰고 신호는 brief 것. `FortuneContent.attempts`·`model`, `night_fortunes.model`에 모델 ID.
- 샘플: `scripts/fortune-sample.ts` (모델 호출 2회, `maxAttempts: 1`). 첫 실행에서 두 글 모두 "흐름"에 걸렸다 → system [톤] 첫 줄에 금지 낱말을 뚜렷하게 올렸다. "힘이 드는 편인 병오"가 "편인"으로 걸린 건 검사기 거짓 양성이라 코어 V06 규칙(ㄴ 받침 꾸밈말 + 편인)을 가져와 고쳤다.
6. 비용 가드: 하루 1인 1회 캐시(기존), 게스트는 기록이 없으므로 **같은 사주+같은 날 캐시 공유**(기존 guestKey) 유지.

## 화면 (디자인 명세 02에 보강)
운세 카드: 밴드·점수·제목·본문(길어짐) → **영역 줄 1~3개**("사람 ↑ 오늘은 먼저 연락이 와요") → 하면/피해요 → 맞춤도 한 줄. 영역 줄은 라벨 열 고정폭, 화살표는 글자(↑→↓) — 아이콘 금지 규칙 유지. 본문이 길어지므로 닫힌 상태(밴드 단어까지만)가 기본.

## 테스트
- 코어 테스트 39개(패키지) 유지.
- `fortune.test.ts` v4: 고정 사주 2개 × 날짜 5개의 점수·밴드·영역 스냅샷, 입춘 전 세운, 시간 모름 분기, 대운 충 플래그.
- 백테스트 스크립트: 이관 기록 89건의 (v3 점수, v4 점수, 실제 행복도) 상관을 출력. 결과를 아래 표에.

| 버전 | 피어슨 r (점수 vs 행복도) | n |
|---|---|---|
| v3 (base만, 기록 보정 없음) | −0.104 | 90 |
| v4 (raw+rel+ctx, 기록 보정 없음) | −0.075 | 90 |
| v4 raw만 | −0.067 | 90 |
| v4 raw+rel | −0.072 | 90 |

측정 2026-10-05 (`npx vitest run --config vitest.scripts.config.ts scripts/fortune-backtest.ts`). 기록 90건·사용자 7명(이관 89건 + 새 앱 1건). 두 버전 모두 r≈0 — n=90에서 r의 표준오차가 약 0.105라 둘 다 유의하지 않고, v4가 v3보다 나쁘지 않으므로 **계수는 가설값 그대로 둔다**(잡음에 맞춰 조정하지 않음). 기록이 더 쌓이면 다시 잰다. v4 점수 분포: 평균 4.95, 최소 1.2, 최대 9.2 (행복도 평균 6.46).
원국 불일치 경고 5건(한 사용자, 시주만 丁未 ↔ 丙午 — 일기 앱 "자정 + 진태양시" vs 코어 "자시 + 경도" 차이). 일기 앱 스냅샷을 믿고 대운 목록만 코어 것을 썼다.

### 2단계 구현 메모 (2026-10-05)
- `apps/diary/src/lib/fortune/core.ts` — `computeCoreFortune({pillars, profile, date, todayHanja})` → `FortuneContent["core"]`. 계수는 `COEF`, 시간 모름 기준은 `UNKNOWN_HOUR_MIN = 10`.
- 합의 방향: `luckRelations`의 합에는 방향이 없어 **합 오행의 역할(용·희 유리 / 기·구 불리 / 한 중립)**로 정했고 강도는 단계(강 2 / 중 1 / 약 0.5). 육합(오행 없음)은 유리. 같은 글자(복음)는 중립·0.
- 용신이 확정되지 않은 시간 모름: raw=0, 라벨 null, 영역·키워드 비움, 충·합은 **방향 없이 ±0.25×강도**만 반영(`COEF.relNoYongsin`). `fitNote` "태어난 시간을 모르면 운세의 폭이 넓어져요."
- 균형붕괴는 코어 `luck()`이 전왕표로 자체 처리한다(`방식: "전왕표"`) → caveat만 추가.
- 영역 신호: 천간·지지 두 줄의 점수를 영역별로 합산해 ≥1 ↑ / ≤−1 ↓ / 그 사이(두 글자가 반대 방향) →. 라벨 "한"은 제외. 연애는 성별에 맞는 쪽(재성↔남, 관성↔여)만.
- 캐시 지문 = `[FORTUNE_VERSION "v4", ENGINE_VERSION, pillars, 출생 입력]` → v3 캐시는 지문이 달라 자동으로 다시 계산.
- `base.ts`(v3)는 백테스트·테스트 참조용으로 남겼다. `FortuneContent.base`는 선택 필드가 됐고 v4 캐시엔 없다.

## 하지 않는 것 (지금)
- 일진 신살(도화·역마·귀인·공망) — 코어가 판정에서 배제. 나중에.
- 영역별 숫자 점수 — 코어 규칙(일운 확신도 낮음)에 어긋남.
- 운에서의 격(`gyeokInLuck`) — 하루 단위엔 과함.
