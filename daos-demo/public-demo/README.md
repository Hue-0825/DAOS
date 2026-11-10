# DAOS 통합 시연 및 로봇 관제실

[통합 사이트](https://daos-logistics.ryker6365.chatgpt.site/)와 [로봇 관제실](https://daos-logistics.ryker6365.chatgpt.site/robot/)을 제공합니다. 로봇 관제실은 기존 메인 관제센터에서 인증을 받아, 서버가 제공하는 작업표와 연결 상태를 사용합니다.

`node build.mjs`는 Worker와 화면을 빌드합니다. 배포할 때 중앙 서버와 로봇 웹에 동일한 비밀 환경 변수 `DAOS_ROBOT_KEY`를 등록합니다. 로봇 웹의 서버 간 통신에는 선택적으로 `DAOS_CENTRAL_ACCESS`를 사용합니다. 실제 비밀값은 Sites 환경에서 관리합니다.
