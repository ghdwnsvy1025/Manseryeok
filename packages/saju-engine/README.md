# @saju/engine

생년월일시를 사주 여덟 글자로 바꾸고, 오행 분포율·대운·지장간·용신을 계산하는 엔진입니다. 문장은 쓰지 않습니다.

- 원본: 이 폴더가 원본입니다. 레거시 `src/lib/saju/`(태그 `legacy-final`)에서 2026-10-04에 옮겼고, 레거시 쪽은 더 고치지 않습니다.
- 사주 코어는 이 폴더를 `core/vendor/manseryeok/`로 복사해 씁니다. 복사할 때 `ORIGIN.txt`에 이 저장소의 커밋 해시를 적습니다.
- **계산 결과가 바뀌는 커밋은 `ENGINE_VERSION`(src/index.ts)을 올립니다.** 앱이 이 값을 사주 프로필 스냅숏과 운세 캐시 지문에 넣기 때문에, 그대로 두면 옛 계산이 캐시에 남습니다. `test/engineVersion.test.ts`가 계산 결과 지문을 버전별로 적어 두고 있어서, 결과가 바뀌었는데 버전이 그대로면 테스트가 깨집니다. 올릴 때 그 파일에 새 버전 줄을 더합니다.
- 만세력 공통 회귀 표: `test/fixtures/shared-cases.json`. 사주 코어·바이럴이 같은 표를 복사해 각자 테스트에서 돌립니다. 정답은 한국천문연구원 기준이고, 구현이 정답과 다른 곳은 `known`에 적혀 있습니다(아래).
- 24절기(12절입 + 12중기): `SOLAR_TERMS_24`, `solarTermsOfYear(year)`. 오행 표기: `ELEMENT_EN_TO_KO`(wood→목), `ELEMENT_KO_TO_EN`, `ELEMENT_WORD`(목→나무).

## 만세력 기준 (1.1.0, 2026-10-15)

- **음력은 한국천문연구원 음력이다** (`korean-lunar-calendar`, 바이럴과 같은 소스). 데이터가 음력 1900-01-01 ~ 2050-11-18까지라 음력 입력은 1900-2050년만 받습니다. 1.0.0은 `lunar-javascript`(중국 음력)라 1900~2050년 사이 1,978일이 달랐습니다(초하루 하루 차이, 2012·2017 윤달 위치).
- **절입 시각은 寿星万年历 고정밀 황경이다** (`lunar-javascript`의 `ShouXingUtil.qiAccurate`, 베이징 시각 → UT). KASI 발표값과 초 단위로 맞습니다. 1.0.0은 Meeus 저정밀 식이라 2~6분 일렀습니다. 절기는 1800-2200년을 구할 수 있어 1900년 초·2100년 말 입력도 대운이 나옵니다.
- 공통 표의 `known.engine`은 1.1.0에서 모두 지웠습니다.

- 오행 분포 공식: `docs/ELEMENT_DISTRIBUTION.md` (명세 원문은 `docs/sajubase_final.md` 자료 B)
- 만세력 계산 과정: `docs/MANSERYEOK_CALCULATION_GUIDE.md`

```ts
import { calculateSaju, getDayPillar, calculateElementDistribution } from "@saju/engine";
```

검사: `npm test` (vitest) · `npm run typecheck`
