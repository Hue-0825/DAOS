# DAOS 최종 검증 기록

## 시연 시작 주소

- [통합 시연과 역할 선택](https://daos-logistics.ryker6365.chatgpt.site/operations.html)
- [메인 관제센터](https://daos-dispatch-demo.ryker6365.chatgpt.site/central/)
- [지역 허브](https://daos-hub-demo.ryker6365.chatgpt.site/)
- [기사 앱](https://daos-phone-driver.ryker6365.chatgpt.site/driver/)
- [로봇 관제실](https://daos-logistics.ryker6365.chatgpt.site/robot/)

## 검증 결과

| 범위 | 확인 내용 |
| --- | --- |
| 로봇 | 상자 5개 약 1분 정상 시연(입고 도크 시작), 컨베이어 도착 뒤 로봇팔 인수, 장애·복구 정지, 전환 위치 인계, 스캔·엣지 로그 오류 보류, 통로 양보와 만료 전 비우기 |
| 기사 앱 | 브라우저 연결 플래그와 별개로 서버 요청, 오프라인 운행일 유지, 보류 기록 격리와 재확인, 버전이 바뀐 정적 파일의 오프라인 대체 |
| 메인 서버 | 같은 배차 요청을 동시에 보냈을 때 한 건만 확정, 배차 없는 요청은 버전 유지, 이벤트 ID 동일 재전송 인정, 다른 ID로 보낸 중복은 검증 보류 |
| 배포 | 통합 로그인에서 메인 관제센터와 기사 앱을 열고 작업 원장·작업표 확인. 로봇 시연에서 메인 관제센터 상태와 전환 지표 확인 |
| 모바일 | Android APK 서명 검증, iOS 시뮬레이터용 빌드, 두 패키지의 최신 기사 앱 파일 대조 |

## 결과 해석

로봇 화면의 장애 중 공정 처리율은 이번 시연의 정상 운전과 백업 운전에서 초당 완료한 공정 수를 비교한 값입니다. 30분 장애 비용은 별도의 가정 기반 시나리오입니다. 복구 화면의 중복·선행 공정·엣지 복제본·위치 스캔 검사는 브라우저에서 재현됩니다. 머클 트리 비교와 실제 센서·설비 연동은 현장 검증 범위입니다.

공유 사이트를 새로 고치면 배포본을 볼 수 있습니다. 실제 Android·iPhone 설치 후 비행기 모드 첫 실행은 확인하지 않았습니다. Android 데모 APK의 서명이 기존 설치본과 다르면 덮어쓸 수 없습니다. iPhone 기기 설치용 빌드에는 Apple 서명이 필요합니다.

## 재검증 명령

- 메인 서버: `node build.mjs && node tests/dispatch-integrity.test.mjs && node tests/calendar.test.mjs`
- 통합 시연: `node tests/factory-flow.test.mjs && node tests/robot-transition.test.mjs && node tests/warehouse-faults.test.mjs`
- iOS Xcode 소스: `bash mobile/ios/prepare.sh` 실행 후 `mobile/ios/DAOSDriver.xcodeproj` 열기
