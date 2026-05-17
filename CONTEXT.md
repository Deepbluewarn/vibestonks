# vibestonks

가짜 주식 토이. 한 라운드 = 한 판. AMM(본딩 커브) 기반 가격, 외부 데이터 의존 없음. 종목 이름은 일상 사건을 모티프로 한 농담 라벨. 라운드 마감/시작은 운영자가 수동으로 트리거.

## Language

### 트레이더 정체성

**Trader (트레이더)**:
이 앱에 Google 또는 GitHub 소셜 로그인으로 가입한 사용자. 가입 시 자동으로 활성 라운드 잔고 1,000pt가 부여되고, `lastSalaryAt`이 now로 마킹되어 첫 달 월급은 시드 + 월급 이중 지급이 되지 않음.
_Avoid_: User, 회원, Player

**Onboarding (온보딩)**:
신규 트레이더가 닉네임을 정하는 1회성 단계. `traders.onboardedAt`이 NULL이면 `/onboarding`으로 강제 이동. 닉네임은 2~20자.
_Avoid_: Signup wizard

**Display Name (닉네임)**:
랭킹과 거래 이력에 표시되는 이름. OAuth provider 이름이 기본값이고 **Onboarding** 단계에서 사용자가 직접 정함.
_Avoid_: 이름, Username

**Admin (어드민)**:
`traders.isAdmin = true`인 트레이더. 현재 시스템에선 운영자가 SQLite 직접 수정으로 부여. 메커니즘 자체엔 인사이더 정보 없음.
_Avoid_: Operator, Moderator

### 자산과 시장

**Seed (시드)**:
새 라운드 시작 시 모든 **Trader**에게 지급되는 시작 포인트. 현재 1,000.
_Avoid_: 자본금, allowance, 초기 잔고

**Balance (잔고)**:
**Trader**가 현재 가진 포인트. 활성 라운드(week_id 단위) 안에서만 의미 있음. 매수 시 차감, 매도/청산/월급 시 증가, **Hard Reset** 시 시드값으로 되돌아감.
_Avoid_: 현금, cash, wallet

**Ticker (종목)**:
거래 가능한 가상 자산. 이름(`$오늘비왔다`, `$팀장화남`, `$rain` 등)은 일상 사건 모티프의 농담 라벨이며 외부 의미 없음. 시스템 입장에서 종목 간 구조적 차이는 없음.
_Avoid_: Stock, 주식, Asset, Coin

**Outstanding Shares (발행 주식 수)**:
한 **Ticker**에 현재 살아 있는 총 주식 수. 매수 시 +N으로 발행되고 매도 시 -N으로 소각됨. 모든 **Trader**의 해당 종목 보유량의 합과 항상 일치.
_Avoid_: Supply, 유통량, Float

**Bonding Curve (본딩 커브)**:
**Outstanding Shares**에서 **Price**를 도출하는 결정론적 공식. 현재: `price = 100 + 2 × shares`.
_Avoid_: Pricing function, formula

**Price (가격)**:
**Ticker**의 현재 단가. **Bonding Curve**에서 직접 도출되므로 별도 저장하지 않음.
_Avoid_: 시세, Quote

### 이벤트와 사이클

**Trade (거래)**:
한 번의 매수 또는 매도 행위. 본딩 커브를 따라 적분된 비용/수익이 계산됨. 트랜잭션 안에서 잔고/보유/발행 모두 원자적으로 갱신되고 **Balance Event** 로 기록.
_Avoid_: Order, Transaction

**Liquidation (청산)**:
라운드 마감 시 **Admin**이 `cycle:liquidate`로 트리거. 모든 **Trader**의 모든 보유 주식이 그 시점 가격(=Closing Price)으로 자동 매도되어 **Balance**에 합산. 본딩 커브를 따르지 않고 마감가에 mark-to-market.
_Avoid_: Settlement, Cash-out

**Hard Reset / Round Reset (하드 리셋)**:
새 라운드 시작 시 **Admin**이 `cycle:reset`으로 트리거. 모든 **Balance**가 **Seed**로, 모든 **Outstanding Shares**가 0으로 되돌아가고 새 랜덤 5개 **Ticker** 발행.
_Avoid_: Soft reset, 정산

**Round / Week (라운드)**:
하나의 **Hard Reset**으로 시작해서 다음 **Liquidation**으로 종료되는 게임 단위. DB 스키마에선 `weeks` 테이블이지만 운영자가 임의 주기로 돌리므로 "주" 자체는 가변. UI에선 보통 "라운드"로 표기.
_Avoid_: Season, Episode

**Salary (주급)**:
매 주(월요일~일요일) 첫 로그인 시 자동으로 **Balance**에 +1,000pt 입금. `traders.lastSalaryAt`이 같은 주(weekKey: 그 주 월요일 날짜)인지로 중복 지급 방지. 활성 라운드가 없으면 보류. 라운드 리셋과 무관하게 굴러가는 베이직 인컴.
_Avoid_: 월급(이전 명칭), Stipend, Allowance

### 기록과 가시성

**Balance Event (잔고 변동 이벤트)**:
잔고가 변하는 모든 시점에 ledger 테이블(`balance_events`)에 1행씩 기록. type: `buy`, `sell`, `liquidation`, `salary`, `init`, `round_reset`. delta(±포인트)와 balance_after(직후 잔고) 모두 박힘.
_Avoid_: Audit log, Transaction record

**Ranking (랭킹)**:
활성 라운드 기준 **Balance** 내림차순. 프라이버시 모델(ADR-0005)에 따라 상위 3명만 이름+잔고 공개, 나머지는 본인 등수만 공개.
_Avoid_: Leaderboard, Scoreboard

**Price History (가격 시계열)**:
한 라운드 안의 한 **Ticker**에 대한 거래 기반 step 시리즈. 첫 거래 직전 시점(`max(활동폭 × 5%, 1초)` 만큼 앞)부터 현재까지 동적 시간 범위. 차트 시각화 + 호버 툴팁 메타데이터(거래 side, shares) 포함.

**Live Update (실시간 갱신)**:
trade/liquidation/reset 이벤트가 발생하면 SSE(`/api/stream`)로 모든 접속 클라이언트에 브로드캐스트. 클라이언트는 `router.refresh()`로 Server Component를 재실행해 화면 갱신. 인-프로세스 `EventEmitter` 싱글턴 기반 (globalThis로 dev hot reload 대응).

## Relationships

- 한 **Trader**는 여러 **Ticker**에 대해 각각 0 이상의 주식을 보유
- 한 **Ticker**의 **Outstanding Shares** = 모든 **Trader**의 해당 종목 보유량 합
- 한 **Round**는 정확히 한 번의 **Hard Reset**(시작)과 한 번의 **Liquidation**(종료)을 가짐 (운영자가 트리거)
- **Price**는 **Outstanding Shares**의 종속 변수 (역 저장 안 함)
- 모든 **Balance** 변동은 **Balance Event** 1행을 만듦
- **Salary**는 라운드 경계와 독립적 — calendar month 단위로 한 번씩

## Example dialogue

> **개발자:** 누가 1주를 사면 가격이 정확히 얼마 올라요?
> **도메인:** 본딩 커브가 `100 + 2 × shares`니까 한 주에 +2원. 단, 매수자가 실제로 지불하는 건 그 적분값 — 즉 사기 직전 가격과 사고 난 후 가격의 중간값.
> **개발자:** 그러면 1주 사고 바로 1주 팔면 손해 없어요?
> **도메인:** 그 사이에 다른 사람이 거래 안 했으면 정확히 본전. 누가 끼어들어 가격을 움직였으면 그만큼 손익.
> **개발자:** 라운드 마감에 안 팔고 들고 있던 사람은요?
> **도메인:** 운영자가 `cycle:liquidate` 돌리면 마감가로 강제 청산. 본딩 커브 안 거치고 그냥 `보유 × 마감가`만큼 잔고에 들어감. 시스템이 약간 보조금을 내는 셈인데, 다음 리셋에서 어차피 다 0으로 가니까 회계상 문제 없음.
> **개발자:** 월급은 라운드랑 어떻게 엮여요?
> **도메인:** 안 엮여. calendar month 단위로 따로 굴러가. 새 달에 처음 로그인하면 잔고에 +1,000. 라운드를 한 달 안 돌리면 잔고가 누적되어서 다음 라운드 때 더 큰 시드가 됨 — 이라기보다 라운드 리셋이 누적분을 1,000으로 되돌리니까 라운드 안 돌리면 누적되고 돌리면 사라지는 구조.

## Flagged ambiguities

- "정산"은 사용 안 함 — **Liquidation**(라운드 마감)과 **Hard Reset**(라운드 시작)을 모두 가리킬 수 있어 혼동되므로 두 용어로 명확히 분리.
- "주식 개수"는 두 가지로 쓸 수 있어 주의: **Outstanding Shares** (종목 차원의 총량) vs **Trader**의 보유량 (개인 차원). 항상 어느 쪽인지 명시.
- "주차" vs "라운드" — DB 스키마는 `weeks` 테이블이지만 운영자가 임의 주기로 돌리므로 실제론 "라운드"가 더 정확. UI 한국어는 "라운드", 코드 식별자는 `week_id` 그대로 유지 (마이그레이션 비용 회피).
