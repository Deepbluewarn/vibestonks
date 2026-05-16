# 잔고 변동을 `balance_events` ledger로 별도 기록

잔고를 변경하는 모든 이벤트(매수, 매도, 청산, 월급, 시드, 라운드 리셋)는 발생 시점에 `balance_events` 테이블에 한 행씩 기록한다. delta(±포인트), balance_after(직후 잔고), type, 관련 tickerId/weekId가 함께 박힘. `trades` 테이블과 일부 중복이지만 ledger는 잔고 흐름 추적이 명시적 목적.

## Considered Options

- **`trades` 테이블만 사용**: buy/sell/liquidation은 기록되지만 salary, init, round_reset은 안 들어가서 잔고 변동의 일부가 사라짐. `/history` 페이지를 만들기 어려움.
- **계산으로 재구성**: 매번 trades + salary 타임라인 + weeks 조합해서 화면에서 재구성. 코드 복잡, 항상 정확하지 않을 위험.
- **ledger 전용 테이블 (채택)**: 한 줄로 모든 변동을 캡처. balance_after를 함께 저장해서 잔고 곡선 그리기 쉬움. 디스크 비용은 무시할 수준.

## Consequences

- 신규 변동 지점이 늘면 ledger insert 코드도 같이 늘어야 함 (예: 향후 칭호 마켓 = 추가 `purchase` type).
- 마이그레이션 시점 이후 데이터만 ledger에 있음 — 그 이전 trades는 ledger에 백필 안 됨. 토이라 OK.
- `/history` 페이지가 단일 쿼리(ledger ORDER BY DESC LIMIT N)로 가능. 빠르고 단순.
