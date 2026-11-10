# DAOS 통합 시연 및 로봇 관제실

[통합 사이트](https://daos-logistics.ryker6365.chatgpt.site/)와 [로봇 관제실](https://daos-logistics.ryker6365.chatgpt.site/robot/)을 제공합니다. 로봇 관제실은 기존 메인 관제센터에서 인증을 받아, 서버가 제공하는 작업표와 연결 상태를 사용합니다.

`node build.mjs`는 Worker와 화면을 빌드합니다. 배포할 때 중앙 서버와 로봇 웹에 동일한 비밀 환경 변수 `DAOS_ROBOT_KEY`를 등록합니다. 로봇 웹의 서버 간 통신에는 선택적으로 `DAOS_CENTRAL_ACCESS`를 사용합니다. 실제 비밀값은 Sites 환경에서 관리합니다.

## 통합 로그인

통합 사이트에서 ChatGPT에 로그인한 뒤 운영 화면을 열면 각 웹에 시연 세션이 연결됩니다. 처음 참여하는 운영자는 기존 메인 관제센터 공유 링크로 한 번 권한을 확인합니다. 사이트별로 직접 받은 기존 공유 링크도 사용할 수 있습니다. 각 운영 웹의 시연 세션이 만료되면 통합 사이트에서 그 화면을 다시 엽니다.

메인 관제센터·스토어·허브·기사 웹은 각자의 `DAOS_SSO_KEY`를 사용합니다. 통합 사이트에는 역할별로 대응하는 `DAOS_SSO_CENTRAL`, `DAOS_SSO_SHOP`, `DAOS_SSO_HUB`, `DAOS_SSO_DRIVER`를 설정합니다. 운영자 확인은 메인 서버와 통합 사이트에 설정된 기존 `DAOS_ROBOT_KEY`를 사용합니다.
