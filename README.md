# DAOS 스마트 물류

국립창원대학교 2026 스마트물류 문제해결 경진대회 팀 프로젝트입니다. 서버 장애가 발생해도 기사 기기에 미리 저장된 작업표로 배송을 이어가고, 연결을 복구한 뒤 작업 기록을 동기화합니다.

## 시작하기

- [공유용 공개 시연](https://daos-logistics.ryker6365.chatgpt.site/)에서 가상 배송으로 기존 방식과 DAOS의 장애 대응을 비교할 수 있습니다.
- [배송 운영 데모 안내](daos-demo/README.md)에서 배포 주소, 실행 방법, 주문·배차·장애 시연 순서를 확인할 수 있습니다. 운영 화면에는 접근 권한이 필요합니다.
- [Android 설치용 APK](daos-demo/downloads/DAOS-Driver.apk) · [iPhone Xcode 프로젝트](daos-demo/mobile/ios/). iPhone 설치에는 Apple 서명이 필요합니다.
- [프로젝트 설계서](docs/PROJECT_PLAN.md)에서 로봇, 물류센터, 복구 검증의 계획을 확인할 수 있습니다.

## 구현 범위

| 구성 | 현재 범위 |
|---|---|
| 쇼핑몰 | 등록 배송지 선택, 접수 순서에 따른 배송일 배정 |
| 메인 관제센터 | 주문 원장, 날짜별 허브 전송, 시연 시간과 작업 서버 연결 제어 |
| 지역 허브 | 시·도·시간대별 배차와 취소 |
| 기사 앱 | 확정 작업표 저장, 장애 중 배송 처리, 복구 후 기록 동기화 |
| 물류센터 로봇 | DAOS 작업표로 하차·운반·분류·출차 배정·상차를 시연하는 로봇 20대 |

## 저장소 구조

```text
docs/                     프로젝트 설계와 검증 계획
daos-demo/                배송 운영 데모
  central/ hub/ shop/     관제센터, 지역 허브, 쇼핑몰
  driver/ mobile/        기사 화면, Android 및 iOS 소스
  drizzle/               주문 및 배차 데이터베이스 초기화
  public-demo/           통합 입구
  downloads/             Android 시연용 APK
```

배송 운영 데모를 로컬에서 실행하려면 Node.js 24 이상이 필요합니다. `daos-demo/`에서 정적 리소스를 풀고 네 화면을 시작합니다.

```sh
cd daos-demo
tar -xzf assets.tar.gz
node split.mjs
```

공개 시연은 가상 배송으로 동작합니다. 실제 장비 적용과 성능 검증은 프로젝트 설계서에서 다룹니다.
