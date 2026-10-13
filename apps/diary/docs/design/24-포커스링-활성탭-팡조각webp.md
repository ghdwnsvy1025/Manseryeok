# 24 — 포커스 링·활성 탭 색, 팡 조각·쪽지 webp 교체 (v3.26)

> 먼저 `00-톤.md`(v3.26 절까지)를 읽는다. `frontend-design` 스킬로 작업. 출처: `docs/검토/2026-10-14-전체검토.md` C-A1(접근성 높음), C-P1(성능 높음), D §3-3(별칭 토큰). 기능 쪽은 끝나 있다(에셋 변환·manifest 등록 완료). 디자이너는 색·className·CSS url만.

## 왜
- 금색 `#d8a332`는 한지 `paper #f1debb` 위 대비 **1.73:1**(실측). 전역 `:focus-visible` 링과 바텀 내비 활성 탭 라벨에 쓰여 키보드 사용자는 포커스를 못 보고, 현재 탭이 안 보인다. WCAG 1.4.11(비텍스트 3:1)·2.4.7 미달.
- 쓰기 화면이 열릴 때마다 팡 조각 PNG 2장(2.4MB)과 쪽지 PNG(787KB)를 `<link rel=preload>`로 받는다. 같은 그림을 512px webp로 다시 납품했다(78KB + 15KB).

## 수정 가능 파일
`src/app/globals.css`(`:focus-visible`, `.field:focus`, `.burst-bit--paper/--gold`, `.note-slip`, 그 밖의 `outline: … var(--color-gold)` 자리), className만: `src/components/BottomNav.tsx`, `src/components/TodayEntryCard.tsx`(44행 "저장했어요"), `src/app/write/EntryForm.tsx`·`src/app/onboarding/ProfileForm.tsx`의 `peer-focus-visible:outline-gold`, 에셋 목록 문자열만: `src/components/BurstPreload.tsx`(`BURST_ASSETS`)·`src/components/WritePreload.tsx`(`WRITE_ASSETS`). `docs/design/00-톤.md` v3.26 절 보완. 금지: `src/lib/**`, `src/app/actions.ts`, `src/app/login/**`, `src/app/settings/**`, 로직·문구(“저장했어요” 글자는 그대로).

## 필요한 에셋
| 에셋 | 출처 | 크기·배경 |
|---|---|---|
| `public/ui/pop-paper-bits-clean-512.webp` | 키트 `pop-paper-bits-clean.png`를 512로 줄임(납품 완료, manifest 등록됨) | 512×512 투명 |
| `public/ui/pop-gold-dust-clean-512.webp` | 키트 `pop-gold-dust-clean.png` 512 | 512×512 투명 |
| `public/ui/note-slip-clean-512.webp` | 키트 `note-slip-clean.png` 512 | 512×256 투명 |
새 그림 없음(비용 0). 도장 `stamp-inked-red-clean.png`은 이미 256px 111KB라 그대로 둔다.

## 1. 포커스 링 — 먹색
- `:focus-visible { outline: 2px solid var(--color-ink); outline-offset: 2px }`. 한지 위 11.6:1. 같은 규칙으로 `.seg__cell`, `.promise-seg__cell`, `.promise-stamp__mark`, `.vote__btn:focus-visible`, `peer-focus-visible:outline-gold`(→ `outline-ink`) 등 `outline … var(--color-gold)`를 **전부** 바꾼다(`grep -n "outline.*gold" globals.css`로 찾는다).
- 남색 띠지·남색 면 위(`.tag--navy`, 투표 눌림 금면 등)에서는 먹색이 안 보이면 `outline-color: var(--color-paper-2)`로 그 자리만 예외.
- **입력칸 "입력 중"**(`.field:focus`, v3.3 "금색 2px")은 금 테두리 2px이 paper-3 위 1.5:1이라 같은 문제. `--color-moss`(#4e6a2f, 4.6:1) 2px로 바꾼다. 오류(먹 1.5px + danger 글)와 구분된다. 00 v3.3·v3.11의 "입력 중 금색 2px" 문장을 v3.26이 대신한다고 적는다.

## 2. 바텀 내비 활성 탭
- 라벨: `text-lamp`(=gold) → **`text-gold-ink`**(#2b1f05, 12:1) 굵게. 안 고른 탭 muted 그대로.
- 아이콘(`.nav-icon`, aria-hidden 장식)은 금빛 유지해도 된다. 대신 활성 표시를 글자에만 맡기지 않게 **라벨 아래 2px 금빛 짧은 밑줄**(gold-wash, 폭 글자만큼) 하나를 더한다 — 금색 "면"이 아니라 선이라 "금색 면 하나" 규칙 밖.
- 별칭 토큰 정리(D §3-3): `bg-night/90` → `bg-paper/90`, `text-lamp` → 위 색. `--color-night`·`--color-lamp` 별칭은 다른 사용처가 없으면 `@theme`에서 지운다.

## 3. "저장했어요"(TodayEntryCard 44행)
- `text-gold` → `text-moss`. 14px bold, 한지 위 4.6:1.

## 4. 팡 조각·쪽지 webp
- `.burst-bit--paper` url → `/ui/pop-paper-bits-clean-512.webp`, `.burst-bit--gold` → `/ui/pop-gold-dust-clean-512.webp`. 조각 위치는 `SaveBurst.tsx`가 퍼센트로 계산하므로 시트 해상도와 무관 — 코드 수정 없음. 팡을 실제로 띄워 조각이 전과 같은 위치·모양인지 확인(저장 흐름이 어려우면 `/?saved=오늘` 분기나 `mode="reveal"` 경로).
- `.note-slip` border-image: url → `/ui/note-slip-clean-512.webp`, 조각 수치는 이미지 픽셀이므로 **반으로**: `90 28 30 28` → `45 14 15 14`. `border-width 30px 10px 12px`와 `/ 30px 10px 12px /`는 화면 px라 그대로.
- `BURST_ASSETS`·`WRITE_ASSETS`의 세 PNG 경로를 webp로 바꾼다. (팡 조각 프리로드를 "저장 버튼 누르는 순간"으로 옮기는 일은 기능 쪽이 뒤에 한다 — 여기서는 경로만.)
- 옛 PNG 3장은 `public/ui/`에서 지운다(키트 원본은 `에셋/`에 남아 있다).

## 하지 않는 것
- 금색 면 버튼·gold-wash 면·금 테두리(카드·메달)는 건드리지 않는다. 바뀌는 건 **글자·포커스·입력 중 테두리**의 금색뿐.
- 새 그림, 새 모션 없음. 도장 PNG 교체 없음.

## 끝났을 때 확인
- `npx tsc --noEmit`, `npm test` 통과.
- `grep -n "color-gold" globals.css`에서 `outline`·`.field:focus`·`text-gold`(글자) 용도가 0건. 남는 금색은 면·막대·테두리·아이콘뿐.
- 375px 스크린샷: 온보딩 입력칸에 포커스(먹 링 + moss 테두리), 바텀 내비 활성 탭(어두운 글자 + 금 밑줄), 쓰기 화면 쪽지(이음새 없음), 팡 조각.
- 브라우저 JS로 대비 계산: 포커스 링 ≥ 3:1, 활성 탭 라벨 ≥ 4.5:1, "저장했어요" ≥ 4.5:1.
- 쓰기 화면 네트워크 탭에서 `pop-*`·`note-slip` 요청이 webp이고 합계 100KB 아래.
