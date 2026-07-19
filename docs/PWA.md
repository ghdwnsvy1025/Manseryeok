# PWA 설치 설정

이 프로젝트는 배포 환경에서 설치형 PWA로 동작합니다.

## 포함된 기능

- `/manifest.webmanifest` 앱 매니페스트
- 일반·maskable SVG 앱 아이콘
- `display: standalone` 독립 실행
- 서비스 워커 등록
- 앱 셸 및 정적 자산 캐시
- 네트워크 장애 시 캐시된 앱 셸 fallback
- Android 설치 프롬프트 및 iOS 홈 화면 추가 안내

서비스 워커는 `/api/*` 요청이나 외부 도메인 응답을 캐시하지 않습니다.
사주 프로필과 일기는 기존 localStorage/IndexedDB 또는 Supabase 저장소를 사용하며
서비스 워커 캐시에 넣지 않습니다.

## 배포 조건

1. HTTPS 환경에 배포합니다. localhost는 개발 예외로 허용됩니다.
2. 프로덕션 빌드에서만 서비스 워커를 등록합니다.
3. Chrome DevTools → Application에서 Manifest와 Service Workers를 확인합니다.
4. Android Chrome에서 ‘앱 설치’, iOS Safari에서 ‘홈 화면에 추가’를 확인합니다.

## 앱인토스 등 외부 플랫폼

PWA 설치 기능과 앱인토스 미니앱 등록은 별개입니다. 앱인토스에 배포할 경우 해당
플랫폼의 개발자 콘솔, 허용 도메인, 심사 정책, SDK 요구사항을 추가로 적용해야
합니다. 현재 구성은 일반 웹/PWA 설치 기반입니다.
