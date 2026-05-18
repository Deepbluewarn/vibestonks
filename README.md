# antstock

가짜 주식 토이. 한 라운드 단위 미니 토너먼트.

한 라운드 동안 트레이더는 **1,000 포인트**로 시작해 5개 종목(랜덤 라벨)을 AMM(본딩 커브)으로 사고 팝니다. **라운드 마감과 다음 라운드 시작은 운영자가 수동으로 트리거**합니다 — 마감 시점에 보유 주식이 그 시점 가격으로 일괄 청산되고, 다음 라운드를 시작하면 모든 트레이더가 다시 1,000pt + 새 랜덤 5종목으로 리셋됩니다.

**주급**: 매주 월요일 이후 첫 로그인 시 자동으로 잔고에 +1,000pt가 입금됩니다(같은 주 안에서는 한 번만). 라운드를 안 돌려도 게임이 죽지 않도록 깔아두는 베이직 인컴.

종목 이름은 농담 라벨(`$오늘비왔다`, `$카톡씹힘` 등)이고 외부 데이터와 연결되지 않습니다. 가격은 오로지 매수·매도로만 움직여요.

> ⚠️ **면책**: 이 서비스는 **실제 주식·자산·시세와 무관한** 시뮬레이션 게임입니다. 어떤 종류의 투자 권유나 정보 제공이 아닙니다.

## 도메인 용어

[CONTEXT.md](./CONTEXT.md) 참고.

## 주요 의사결정

[docs/adr/](./docs/adr/) 참고.

## 시작하기

```bash
npm install
npm run db:reset      # SQLite 초기화 + 마이그레이션
npm run db:seed       # 1주차 + 5종목 + dev trader
npm run dev           # Next.js 시작 (http://localhost:8554)
```

### 환경 변수

```env
AUTH_SECRET=...                  # `openssl rand -base64 32`
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...

ANTSTOCK_DB_PATH=./.data/db.sqlite   # 선택, 기본값 동일
```

## 관리자 권한 부여

첫 어드민은 CLI로 부트스트랩, 그 후엔 `/admin` 페이지에서 토글:

```bash
npm run admin:grant                  # 전체 트레이더 목록 출력
npm run admin:grant -- alice         # 닉네임 매칭 → isAdmin 토글
npm run admin:grant -- google:1234   # sub 직접
```

## 라운드 사이클 (수동 운영)

자동 스케줄러는 아직 붙어 있지 않습니다. 운영자가 다음 명령을 직접 실행해서 사이클을 굴립니다.

```bash
npm run cycle:liquidate   # 라운드 마감 — 보유 주식 마감가 일괄 청산
npm run cycle:reset       # 새 라운드 시작 — 잔고 1000으로 리셋 + 새 랜덤 5종목
```

원하는 주기·시각은 운영자가 정하면 됩니다. 정기 운영을 원하면 `cron`, `systemd timer`, GitHub Actions schedule 등으로 두 명령을 호출하면 됩니다.
