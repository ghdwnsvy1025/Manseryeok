# @saju/engine

생년월일시를 사주 여덟 글자로 바꾸고, 오행 분포율·대운·지장간·용신을 계산하는 엔진입니다. 문장은 쓰지 않습니다.

- 원본: 이 폴더가 원본입니다. 레거시 `src/lib/saju/`(태그 `legacy-final`)에서 2026-10-04에 옮겼고, 레거시 쪽은 더 고치지 않습니다.
- 사주 코어는 이 폴더를 `core/vendor/manseryeok/`로 복사해 씁니다. 복사할 때 `ORIGIN.txt`에 이 저장소의 커밋 해시를 적습니다.
- 오행 분포 공식: `docs/ELEMENT_DISTRIBUTION.md` (명세 원문은 `docs/sajubase_final.md` 자료 B)
- 만세력 계산 과정: `docs/MANSERYEOK_CALCULATION_GUIDE.md`

```ts
import { calculateSaju, getDayPillar, calculateElementDistribution } from "@saju/engine";
```

검사: `npm test` (vitest) · `npm run typecheck`
