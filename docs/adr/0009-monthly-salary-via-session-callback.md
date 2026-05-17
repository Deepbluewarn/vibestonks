# 주급은 세션 콜백에서 자동 입금

매주 1,000pt 주급은 별도 cron이나 백그라운드 작업이 아니라 **NextAuth `session` 콜백 안에서 그때그때 체크/입금**한다. `traders.lastSalaryAt`의 weekKey(해당 주의 월요일 날짜)가 현재와 다르면 트랜잭션 하나로 잔고 += 1,000 + lastSalaryAt = now.

> 초기에는 calendar month 단위(월급)였으나 주기가 너무 길어 주(Mon-Sun) 단위로 변경. DB 컬럼명(`lastSalaryAt`)과 이벤트 타입(`salary`)은 그대로 유지 — 마이그레이션 비용 회피.

## Considered Options

- **cron 또는 자정 잡(job)으로 매주 월요일 전체 입금**: 깔끔하지만 서버 항상 떠 있어야 하고, 한꺼번에 모든 트레이더 잔고를 건드리는 큰 트랜잭션 발생. 토이엔 과함.
- **/api/salary 엔드포인트를 클라이언트가 호출**: 클라이언트 트리거라 누가 호출 안 하면 안 들어옴. 보안/일관성 ↓.
- **세션 콜백에서 lazy 평가 (채택)**: 사용자가 접속할 때만 자기 분량 처리. 트래픽 분산, 콜백 한 번에 SELECT 1 + (필요 시) UPDATE 2. SQLite single-writer라 동시 요청 race는 transaction + freshRead로 방어.

## Consequences

- 한 주 내내 접속 안 한 사람은 그 주 주급을 못 받음 — 다음 로그인하면 그 시점 주의 주급만 받음(소급 X). 토이 정체성에 맞음.
- 활성 라운드가 없을 때는 보류 — 라운드 재개 후 첫 세션에 들어옴.
- 신규 가입자는 `signIn` 콜백에서 `lastSalaryAt = now`로 마킹되어 첫 주 시드 + 주급 이중 지급 방지.
- 입금 후 `trade` 이벤트(가짜 tickerId=-1)를 SSE로 publish해서 다른 탭/유저 화면 갱신 트리거.
- weekKey는 UTC 기준 월요일 — 한국 시간으로는 월요일 09:00에 주가 바뀜.
