# 로컬 개발 가이드

## 터미널에 입력이 안 될 때

**원인:** `npm run dev`가 실행 중이면 그 터미널은 서버 로그를 표시하느라 **새 명령 입력이 불가**합니다. 버그가 아니라 정상 동작입니다.

### 해결 방법 (택 1)

| 방법 | 설명 |
|------|------|
| **A. 새 터미널** | Cursor 하단 터미널에서 `+` 버튼 → 새 탭에서 명령 실행 |
| **B. 서버 중지** | 해당 터미널에서 `Ctrl + C` → dev 서버 종료 후 입력 가능 |
| **C. 스크립트** | `npm run dev:stop` 으로 3000~3002 포트 서버 한꺼번에 종료 |

### 권장 루틴

```bash
# 개발 시작 (캐시 깨졌을 때)
npm run dev:clean

# 다른 터미널에서 테스트/명령 실행
npm test

# 서버 끄기
npm run dev:stop
```

> **주의:** dev 서버를 여러 번 켜면 3000, 3001, 3002… 포트에 중복 실행됩니다.  
> 이때 `.next` 캐시 오류(`Cannot find module './948.js'`)가 자주 납니다.  
> `npm run dev:stop` 후 `npm run dev:clean` 하세요.

---

## 노트북 + 데스크탑 동시 작업 (Git)

### 브랜치 역할

| 브랜치 | 용도 |
|--------|------|
| `main` | **Vercel 배포용** — 직접 작업하지 말고 PR로만 병합 |
| `v0` | 공통 개발 브랜치 (지금 사용 중) |
| `laptop/기능` | 노트북 전용 작업 (선택) |
| `desktop/기능` | 데스크탑 전용 작업 (선택) |

### 매일 작업 순서

**작업 시작 전 (항상!)**
1. GitHub Desktop → **Fetch origin**
2. `v0` 브랜치 선택 → **Pull origin**

**작업 후**
1. 커밋 메시지 작성 → **Commit**
2. **Push origin**

**Vercel에 반영하려면**
1. GitHub.com → `v0` → `main` **Pull Request** 생성
2. **Merge** → Vercel이 `main` 자동 배포

> `v0`에만 push하면 GitHub에는 올라가지만 **Vercel은 갱신되지 않습니다.**  
> 배포하려면 반드시 `main`에 merge해야 합니다.

### 두 PC에서 `v0` 동시에 쓸 때

- **한 PC에서 push한 뒤**, 다른 PC는 반드시 **Pull** 후 작업
- 같은 파일을 동시에 수정하면 **충돌(conflict)** 발생 → GitHub Desktop에서 해결

### 일기 데이터 동기화

- **코드** → GitHub (`v0` / `main`)
- **일기 내용** → 브라우저 로컬(IndexedDB) 또는 **Supabase** ([SUPABASE.md](./SUPABASE.md))

노트북·PC에서 같은 일기를 쓰려면 Supabase 설정이 필요합니다.

---

## 자주 쓰는 명령

```bash
npm run dev          # 개발 서버 (이 터미널은 입력 막힘)
npm run dev:clean    # .next 삭제 후 서버 시작
npm run dev:stop     # 3000~3002 포트 서버 종료
npm run build        # 배포 전 빌드 확인
npm test             # 테스트
```
