# 실시간 갱신은 인-프로세스 EventEmitter + SSE

거래/청산/리셋이 발생하면 모든 접속 클라이언트의 화면이 즉시 갱신되어야 한다. 이를 위해 (1) Node `EventEmitter` 싱글턴을 인-프로세스 메시지 버스로 사용하고, (2) `/api/stream` Server-Sent Events 엔드포인트가 그 버스에 구독하여 (3) 클라이언트는 `EventSource`로 받은 후 `router.refresh()`로 Server Component를 재실행한다.

EventEmitter는 **`globalThis`에 보관**한다. Next.js dev 모드(Turbopack)에서 모듈이 여러 번 평가될 때 server action 측과 route handler 측이 별개의 EventEmitter 인스턴스를 갖는 문제를 막기 위함이며, Prisma client에서 통용되는 표준 패턴.

## Considered Options

- **WebSocket**: 양방향 메시징 가능하지만 토이엔 과함. SSE는 단방향 push만 필요해서 더 단순하고 HTTP 친화적.
- **클라이언트 폴링**: setInterval로 `/api/me` 호출. 무거움, 지연 큼, 본질적으로 실시간 아님.
- **외부 pub/sub(Redis 등)**: 멀티 인스턴스 배포에 필요한데 토이는 단일 인스턴스라 오버킬.

## Consequences

- 멀티 인스턴스 배포로 가면 인-프로세스 EventEmitter는 다른 인스턴스의 이벤트를 못 받음. 그땐 Redis pub/sub 등으로 교체 필요 (`lib/events.ts` 한 파일 변경으로 가능하게 설계).
- `router.refresh()`는 페이지 단위 RSC 재요청이라 작은 변경에도 페이지 전체가 다시 렌더링됨. 토이엔 OK, 트래픽 늘면 더 granular 한 SWR/relay 패턴으로 이주 고려.
- VSCode 터널 같은 일부 프록시는 SSE를 버퍼링하는 경우 있음 — 직접 접근 시엔 OK, 터널 통과 시 변동 있을 수 있음.
- SSE 클라이언트는 onerror 시 1초 후 재연결. dev에서 HMR이나 router.refresh 후 잠깐 끊겼다 자동 복구.
