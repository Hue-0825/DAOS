# DAOS 서버와 핵심 시스템 코드

| 구성 | 원본 소스 |
|---|---|
| 메인 서버와 주문 원장 | [worker.mjs](../daos-demo/worker.mjs), [중앙 화면](../daos-demo/central/), [DB 스키마와 시연 데이터](../daos-demo/drizzle/) |
| 스토어·지역 허브·기사 웹 게이트웨이 | [공통 게이트웨이](../daos-demo/gateway-worker.mjs), [역할별 배포 생성기](../daos-demo/prepare-gateway.mjs) |
| 스토어·허브·기사 앱 화면 | [스토어](../daos-demo/shop/), [지역 허브](../daos-demo/hub/), [기사 웹·오프라인 코드](../daos-demo/driver/), [Android·iOS 소스](../daos-demo/mobile/) |
| 통합 시연 사이트 및 통합 로그인 | [통합 사이트 Worker](../daos-demo/public-demo/worker.mjs), [역할별 세션](../daos-demo/portal-sso.mjs), [기존 공유 권한](../daos-demo/share-access.mjs) |
| 로컬 4개 웹 실행 | [split.mjs](../daos-demo/split.mjs), [gateway.mjs](../daos-demo/gateway.mjs), [preview.mjs](../daos-demo/preview.mjs) |
| 로봇 시연 | [공정 및 복구 엔진](../daos-demo/public-demo/robot/warehouse-engine.mjs), [중앙과 엣지 모델](../daos-demo/public-demo/robot/warehouse-layers.mjs), [화면 제어](../daos-demo/public-demo/robot/warehouse-view.mjs), [지도와 로봇 외형](../daos-demo/public-demo/robot/warehouse-scene.mjs) |

## 가장 중요한 흐름

1. **현장이 어떤 작업을 계속할지 판단** — `Warehouse.tick`은 선행 공정, 예약 가능 여부, 백업 범위를 확인합니다. `CentralPlan`은 로봇의 공정·구역 권한, 만료시각, 운전 세대를 확인하고 `ZoneEdge`는 한 번에 한 로봇만 같은 이동 칸을 예약하게 합니다.
2. **복구 후 확인** — `Warehouse.restore`는 전환 시점의 상자 위치를 저장합니다. `Warehouse.updateConnection`은 위치를 먼저 인계하고, `Warehouse.finishRestore`는 중앙 기록·현장 로그·가상 스캔을 대조해 새 에폭을 발급합니다.
3. **배송 기록 재전송** — 메인 서버의 `POST /api/driver/events`는 배차 버전과 집하·구간 출발 순서를 검사합니다. 기사 앱은 서버가 접수한 기록만 전송 대기에서 뺍니다.

세 계층 로봇 시연은 브라우저에서 재현합니다. 실물 MQTT·PDA·카메라 연동은 후속 실증 범위입니다. 역할별 배포 Worker는 공통 게이트웨이와 각 역할의 리소스에서 생성됩니다. 배포 비밀값은 Sites 환경에서 관리합니다.

[프로젝트 소개와 기술 검증](https://daos-logistics.ryker6365.chatgpt.site/project.html#architecture) · [복구 기준 DAOS20261110](https://github.com/Hue-0825/DAOS/tree/DAOS20261110)
