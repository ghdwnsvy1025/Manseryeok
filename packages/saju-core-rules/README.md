# @saju/core-rules

사주 코어(`사주 앱/사주 코어/core/src`)의 **판정 함수 복사본**입니다. 용신·운 유불리·충합·격국·영역·키워드 칸 고르기까지, 톤 없는 중립 판정만 하고 문장은 쓰지 않습니다.

- **원본은 사주 코어 저장소**입니다. 이 폴더의 판정 로직은 고치지 않습니다. 바꾸려면 코어에서 먼저 바꾸고 다시 복사합니다 (각 파일 첫 줄에 출처·커밋 주석).
- 만세력 계산은 같은 저장소의 `@saju/engine`(`packages/saju-engine`)을 씁니다. 코어의 `core/vendor/manseryeok/`는 그 엔진의 복사본이라 함수·시그니처가 같습니다.
- 1단계(이식)만 들어 있습니다. 운세 조립·글 생성은 여기 두지 않습니다.

```ts
import { toCorePillars, balance, yongsin, luck } from "@saju/core-rules";
const p = toCorePillars(profile.pillars);   // 일기 앱 PillarsSnapshot → 코어 Pillars
const b = balance(p); const y = yongsin(p, b);
luck(p, "庚申", b, y).판정;                  // "매우 유리" | "유리" | "보통" | "주의" | "어려움"
```

검사: `npm test` (vitest, 39개) · `npm run typecheck`

## 복사 출처

- 사주 코어 커밋 **`ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc`**, 2026-10-05 복사.
- 코어의 `core/vendor/manseryeok/ORIGIN.txt`는 엔진 커밋 `e57449c`(2026-09-16) 기준 복사본이라고 적혀 있습니다. 현재 `@saju/engine`과의 차이는 아래 "엔진 차이" 참고.

| 이 패키지 파일 | 원본 | 바꾼 점 |
|---|---|---|
| `src/base.ts` | `core/src/base.ts` | import 경로의 `.ts` 확장자 제거만 |
| `src/yongsin.ts` | `core/src/yongsin.ts` | 같음 |
| `src/relations.ts` | `core/src/relations.ts` | 같음 |
| `src/structure.ts` | `core/src/structure.ts` | 같음 |
| `src/gyeokguk.ts` | `core/src/gyeokguk.ts` | 같음 |
| `src/extras.ts` | `core/src/extras.ts` | 같음 |
| `src/areas.ts` | `core/src/areas.ts` | 같음 |
| `src/keywords.ts` | `core/src/keywords.ts` | `.ts` 제거 + `import KWJSON from "../../규칙/키워드.json" with { type: "json" }` → `import KWJSON from "./data/키워드"` (import attributes 대신 `.ts` 상수) |
| `src/birth.ts` | `core/src/birth.ts` | `.ts` 제거 + `../vendor/manseryeok/{calculator,lunarConverter,solarTerms}.ts` → `@saju/engine` (`calculateSaju`·`lunarToSolar`·`getSolarTermKSTIso`, 시그니처 동일 → 어댑터 불필요) |
| `src/data/키워드.json` | `규칙/키워드.json` | 그대로 복사 (대조용) |
| `src/data/키워드.ts` | `규칙/키워드.json` | JSON 본문을 `const 키워드 = {...}; export default 키워드;` 로 감쌈. `test/data.test.ts`가 `.json`과 deepEqual 로 대조 |
| `test/{yongsin,structure,relations,gyeokguk,extras,birth}.test.ts` | `core/test/…` | `import test from "node:test"` → `import { test } from "vitest"`, `.ts` 제거. `node:assert/strict` 와 기대값은 그대로 |
| `test/areas.test.ts` | `core/test/areas_gunghap.test.ts` | 위와 같고, `gunghap.ts`를 옮기지 않아 궁합 테스트 2개(gunghap·iljuPair) 제거 |
| `test/birth.test.ts` | `core/test/birth.test.ts` | 마지막 케이스("Y-11 월운이 판정에 붙고 …")는 `reading.ts` 의존이라 제거 → 같은 기대값을 `test/adapters.test.ts`에서 `luck()`·`luckRelations()`로 직접 확인 |
| `test/fixtures/expected_42.json` | `core/test/fixtures/expected_42.json` | 그대로 |

### 옮기지 않은 것

- `core/src/reading.ts` — 8개 섹션을 묶는 조립 층. 그중 "기준일로 현재 대운·세운 고르기"만 `src/adapters/luckContext.ts`로 뗐습니다.
- `core/src/gunghap.ts` — 궁합. 일기 앱에 필요 없음.
- `core/cli.ts`, `core/vendor/manseryeok/` — `@saju/engine`으로 대체.

### 원본 아님 (이 패키지에서 새로 쓴 것)

| 파일 | 내용 |
|---|---|
| `src/index.ts` | export 진입점 |
| `src/adapters/pillars.ts` | `toCorePillars(snapshot): Pillars` — 일기 앱 `PillarsSnapshot`({year,month,day,hour?: {stem, branch}} 한자) → 코어 `Pillars` (`[연, 월, 일, 시 \| null]` 간지 문자열). `apps/diary/src/lib/profile.ts`에 의존하지 않고 구조만 따름 |
| `src/adapters/luckContext.ts` | `currentLuckContext(birth, 기준일): LuckContext` — `reading.ts` 37·52~56행의 고르기 규칙을 그대로: 현재 대운 = `시작일 ≤ 기준일 < 끝일`; 첫 대운 전이면 순서 0·간지는 월주; 세운 = 기준일 양력 연도와 다음 해(`yearGanji`); 월운 = `monthGanjiList(기준일, 1)[0]`. **유불리 판정은 하지 않음** |
| `test/adapters.test.ts`, `test/data.test.ts` | 어댑터·데이터 대조 테스트 |

## 엔진 차이 (vendor/manseryeok ↔ @saju/engine)

세 함수의 시그니처는 같아 어댑터 없이 import 경로만 바꿨습니다. 본문 차이는 다음 셋인데, 모두 코어가 쓰는 경로에서는 결과가 같습니다.

| 모듈 | 차이 | 코어에 미치는 영향 |
|---|---|---|
| `calculator.ts` | 엔진은 `timeCorrection` 보정으로 자정을 넘기면 날짜도 함께 이동(`addMinutesToDateTime`). vendor는 시각만 mod 24 (버그) | 없음 — `birth.ts`는 `timeCorrection: "none"`으로 부르고 경도·서머타임 보정을 스스로 한다 |
| `calculator.ts` | 엔진은 음력 입력일 때 양력 날짜 검사를 건너뜀 | 없음 — `birth.ts`는 `lunarToSolar`를 먼저 돌려 항상 양력으로 넘긴다 |
| `monthPillar.ts` | `debug.usedMonthSolarTermStart/End`를 엔진은 탐색에 쓴 경계(`jdeToKSTIso(boundaries[...])`)로, vendor는 `getSolarTermKSTIso(연, 황경)`로 계산 | 월주 간지는 같음. `birth.ts`의 "절입 시각 1시간 이내 출생" **경고 문구** 판정에만 이 값이 쓰이는데, 둘 다 같은 절입 시각을 가리키므로 실질 차이 없음 (분 단위 표기 차이가 있다면 경고 경계에서만) |
| `lunarConverter.ts` | vendor의 `[사주코어 수정] getMonth() < 0` 윤달 판정이 엔진에도 이미 반영돼 있음 | 없음 |

코어 테스트 `birth.test.ts`(1990-05-15 14:30·00:10·23:40, 1988 서머타임, 1957 동경 127.5°, 음력, 월운) 7개가 엔진 위에서 그대로 통과합니다.

## 일운에 적용할 때 주의

출처: 사주 코어 `규칙/용신.md`, `규칙/영역.md` (커밋 ebf972d 기준 줄 번호)

- **Y-09 운의 유불리 = 글자 라벨** (`용신.md` 149~161행): 운 천간·지지(정기)의 오행을 용/희/한/구/기 라벨로 바꿔 **용 +2, 희 +1, 한 +0.5, 구 −1, 기 −2**, 천간은 **×1.5**. 합계 ≥+3 매우 유리 / >0 유리 / 0 보통(십신 방향성만) / <0 주의 / ≤−3 어려움. 코드는 `luck()`.
- **검증은 대운 기준** (`용신.md` 163~171행): 강사 노트의 "좋은/나쁜 대운" 90개와 비교해 71% (전부 "좋음"으로 찍는 기준선 63%). 즉 **대운 라벨로 잰 수치이고, 세운·월운·일운에 대한 일치율은 0건**입니다. 코어는 운 판정 확신도를 "보통" 이하로만 냅니다.
- **라벨의 천장** (`용신.md` 173~174행): 강사는 운 글자와 원국 글자의 개별 상호작용(용신이 극당함, 희신이 과함, 소운별 갈림)을 보는데 라벨만으로는 못 잡습니다. 그래서 점수와 별개로 **플래그**를 같이 냅니다 (`용신.md` 176~181행): `용신 손상`, 운 지지–원국 지지 충(`충.md` C-08), 운으로 합 성립(`삼합.md` S-08), 개두·절각(`운 내부 상충`). 코드는 `luckRelations()`·`gyeokInLuck()`. 플래그는 점수에 넣지 않습니다.
- **Y-08 균형붕괴 사주** (`용신.md` 131~133행): 중심기운 ≥50% 이고 용신 오행 ≤8% 이면 Y-09 대신 **전왕 패턴표**(중심기운과 같은 방향의 운=무난, 극하려는 운=나쁨). `isCollapsed()`가 참이면 `luck()` 결과를 그대로 쓰면 안 됩니다.
- **Y-11 월운 = Y-09를 달마다 적용 [가설·검증 없음]** (`용신.md` 196~201행): 달은 양력 1일이 아니라 **절입**에 바뀜(`monthGanjiList`). **확신도는 항상 "낮음"**, 글에서는 "가볍게 참고"라고 밝힐 것. 일운은 코어에 아직 규칙이 없고(`00_읽는법.md` 22행 "(예정) Y-09를 월·일 단위로 확장 — 아직"), 월운과 같은 지위로 보는 것이 맞습니다.
- **영역별 기간 신호** (`영역.md` 179~181행): = (그 영역을 건드리는 운 글자의 Y-09 점수) + (그 영역의 주 재료 글자가 운에서 충·합을 맞는지 플래그). **"월운·일운은 노트에 근거가 거의 없습니다 → 같은 방식을 적용하되 확신도는 항상 '낮음'"**. 0~100 점수화는 전부 [가설]이므로 코어는 **5단계 라벨**까지만 내고 숫자화는 컨텐츠 층의 일. Y-09 일치율이 71%이므로 영역별 기간 신호의 확신도는 그보다 높을 수 없습니다. `luckAreas(l, "일운")`이 이미 단위 인자를 받습니다 (`areas.ts` E-11).
- **세운 연도 주의** (`reading.ts` 37행, `adapters/luckContext.ts`): 코어는 기준일의 양력 연도로 `yearGanji`를 뽑습니다. 입춘(2월 4일 무렵) 전 1~2월은 전년 간지가 맞을 수 있으니 일운에 세운을 붙일 때 호출 쪽에서 판단해야 합니다.
- **시간 모름** (`reading.ts` 20~26·39행, Y-10): 시주가 없으면 `unknownHour()`로 12개 시주를 집계해 용신이 10개 이상 모일 때만 그 값을 쓰고, 아니면 **운의 유불리를 말하지 않습니다**("접힘"). 일기 앱 프로필의 `hour: null`도 같은 처리가 필요합니다.
