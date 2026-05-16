# 사이클 자동화 없음 — 운영자 수동 트리거

`cycle:liquidate`와 `cycle:reset`은 cron/systemd timer/GitHub Actions 등 어떤 스케줄러에도 연결돼 있지 않다. 운영자(보통 jhju)가 직접 명령을 실행해서 라운드를 종료/시작한다.

## Considered Options

- **cron으로 매주 월 09시 + 금 17시**: ADR-0003에서 가정했던 모델. 일정한 주기로 자동 굴리기 좋지만, 토이 정체성("아무도 안 쓰면 멈춰도 OK")과 충돌하고, 운영자가 "오늘은 다음 주까지 놔두자" 같은 유연성을 잃음.
- **GitHub Actions schedule**: 무료에 설정 간단. 다만 SQLite 파일에 접근하려면 서버 호스팅과 같은 환경이어야 해서 추가 인프라 필요.
- **`/admin`에서 버튼**: 어드민 UI 추가 필요. 현재 어드민 인터페이스가 없으므로 보류.

## Consequences

- 라운드 길이가 운영자 판단에 달림. 한 주, 한 달, 분기 — 무엇이든 가능.
- 월급(ADR-0009 참조)이 베이직 인컴 역할이라 라운드 안 돌려도 게임이 죽지 않음.
- README와 UI에 "수동 운영"임을 명시했으므로 사용자 기대치 일치.
- 추후 자동화 원하면 `cycle:liquidate && cycle:reset`을 cron에 거는 작업 5분이면 됨.
