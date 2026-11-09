# DAOS 물류 장애 대응 시연

쇼핑몰에서 주문을 받고 메인 서버가 시·도 허브로 분류합니다. 허브에서 배차를 확정하면 기사 앱이 작업표를 저장합니다. 연결을 끊으면 DAOS 모드에서 저장된 작업을 계속할 수 있고, 복구 후 완료 기록을 서버로 보냅니다.

| 구성 | 시연 주소 | 소스 |
|---|---|---|
| 쇼핑몰 웹 | https://daos-shop-demo.ryker6365.chatgpt.site/ | `shop/` |
| 메인 서버 주문 원장 | https://daos-dispatch-demo.ryker6365.chatgpt.site/central/ | `worker.mjs`, `central/`, `drizzle/` |
| 시·도 허브 | https://daos-hub-demo.ryker6365.chatgpt.site/ | `hub/` |
| 기사 앱 | Android APK 및 iOS Xcode 프로젝트 | `mobile/`, `driver/` |

## 시연 순서

1. 쇼핑몰에서 시연 정보로 주문하거나 메인 서버에 준비된 시연 주문을 사용합니다.
2. 허브와 기사 앱에서 같은 시·도를 선택합니다. 2026년 11월 9일·10일·11일 주문을 날짜와 권역별로 배차할 수 있습니다. 배차 카드에서 배송지와 권역 지도를 확인합니다.
3. 배차 확정 후 기사 앱의 작업표가 저장되고 허브에 백업 완료가 표시되면, 허브에서 기사 서버 연결을 끊습니다.
4. DAOS 모드에서 작업하고 서버를 복구해 미동기화 기록이 전송되는 것을 확인합니다.
5. 같은 날을 다시 시연하려면 서버를 복구한 상태에서 허브의 **배차 리셋**를 누릅니다. 선택한 시·도와 배송일의 시연 배차와 기록을 초기화하고, 주문을 배차 대기로 돌립니다. 리셋 이전 기기 기록은 재배차 후 수신 대상에서 제외됩니다.

## 로컬 실행

Node.js 24 이상이 필요합니다. 압축된 정적 리소스만 제공되는 체크아웃이면 먼저 `tar -xzf assets.tar.gz`를 실행한 뒤 `node split.mjs`로 네 프로세스를 실행합니다.

- 쇼핑몰 `http://127.0.0.1:8780/`
- 메인 서버 `http://127.0.0.1:8781/central/`
- 허브 `http://127.0.0.1:8782/`
- 기사 앱 미리보기 `http://127.0.0.1:8783/driver/`

시연 주문은 초기 실행 시 11월 9일·10일·11일에 100건씩 자동으로 채워집니다.

## 기사 앱 빌드

- **Android** — [시연용 APK 다운로드](downloads/DAOS-Driver.apk). 직접 빌드하려면 `JAVA_HOME`, `ANDROID_BUILD_TOOLS`, `ANDROID_PLATFORM_JAR`를 설정하고 `bash mobile/android/build.sh`를 실행합니다. APK는 시연용 키로 서명합니다. 업데이트 설치에는 동일 키를 사용하세요.
- **iPhone** — `bash mobile/ios/prepare.sh` 후 `mobile/ios/DAOSDriver.xcodeproj`를 Xcode에서 엽니다. Signing & Capabilities에서 본인 Team과 고유 Bundle ID를 설정해 기기에서 실행하거나 TestFlight로 배포합니다. 기기 설치용 파일에는 Apple 서명이 필요합니다.
- 두 앱은 지도와 작업 화면을 설치 파일에 포함합니다. 최초 서버 연결 시 앱 상단 **서버 로그인**을 누르고 배포 사이트에 접근할 수 있는 계정으로 로그인합니다.
- 비공개 웹 서비스 키·환경값, 주문 데이터와 앱 서명 키는 저장소에 포함하지 않습니다.

지도 데이터 © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). 쇼핑몰 제품 사진은 시연용으로 생성했습니다.
