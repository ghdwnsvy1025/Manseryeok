# @saju/engine

생년월일시를 사주 여덟 글자로 바꾸고, 오행 분포율·대운·지장간·용신을 계산하는 엔진입니다. 문장은 쓰지 않습니다.

- 원본: 이 폴더가 원본입니다. 레거시 `src/lib/saju/`(태그 `legacy-final`)에서 2026-10-04에 옮겼고, 레거시 쪽은 더 고치지 않습니다.
- 사주 코어는 이 폴더를 `core/vendor/manseryeok/`로 복사해 씁니다. 복사할 때 `ORIGIN.txt`에 이 저장소의 커밋 해시를 적습니다.
- **계산 결과가 바뀌는 커밋은 `ENGINE_VERSION`(src/index.ts)을 올립니다.** 앱이 이 값을 사주 프로필 스냅숏과 운세 캐시 지문에 넣기 때문에, 그대로 두면 옛 계산이 캐시에 남습니다. `test/engineVersion.test.ts`가 계산 결과 지문을 버전별로 적어 두고 있어서, 결과가 바뀌었는데 버전이 그대로면 테스트가 깨집니다. 올릴 때 그 파일에 새 버전 줄을 더합니다.
- 만세력 공통 회귀 표: `test/fixtures/shared-cases.json`. 사주 코어·바이럴이 같은 표를 복사해 각자 테스트에서 돌립니다. 정답은 한국천문연구원 기준이고, 구현이 정답과 다른 곳은 `known`에 적혀 있습니다(아래).
- 24절기(12절입 + 12중기): `SOLAR_TERMS_24`, `solarTermsOfYear(year)`. 오행 표기: `ELEMENT_EN_TO_KO`(wood→목), `ELEMENT_KO_TO_EN`, `ELEMENT_WORD`(목→나무).

## 알려진 차이 (2026-10-15, 공통 표 `known.engine`)

- **음력은 중국 음력이다.** `lunar-javascript`는 중국 음력(동경 120° 기준)이라 한국 음력(KASI, 135°)과 1900~2050년 사이 1,978일(63구간)이 다릅니다. 초하루가 하루 어긋나는 달(예: 음력 1990-09-01 → 한국 10/19, 엔진 10/18)과 윤달 위치가 다른 해(2012 한국 윤3월/중국 윤4월, 2017 윤5월/윤6월)가 있습니다. 그런 달의 한국 음력 생일은 일주가 하루 어긋나거나 '존재하지 않는 날' 오류가 납니다. 바이럴은 `korean-lunar-calendar`(KASI)라 맞습니다.
- **절입 시각이 2~6분 이르다.** 태양 황경을 저정밀 식으로 구해서 KASI보다 이릅니다(2024 입춘 17:21:27 vs 17:27, 경칩 11:16 vs 11:22). 절입 몇 분 안에 태어난 경우 연주·월주가 다를 수 있습니다.
- 오행 분포 공식: `docs/ELEMENT_DISTRIBUTION.md` (명세 원문은 `docs/sajubase_final.md` 자료 B)
- 만세력 계산 과정: `docs/MANSERYEOK_CALCULATION_GUIDE.md`

```ts
import { calculateSaju, getDayPillar, calculateElementDistribution } from "@saju/engine";
```

검사: `npm test` (vitest) · `npm run typecheck`
