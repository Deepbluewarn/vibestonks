# 단일 Next.js 앱 + SQLite (별도 백엔드 없음)

antstock은 작은 규모(수 명~수십 명)의 개인 토이 프로젝트이므로 별도 게이트웨이/백엔드 서비스를 두지 않고 Next.js 한 앱이 API 라우트로 비즈니스 로직을 처리한다. 인증은 NextAuth v5 직결, DB는 SQLite 단일 파일을 Next.js 서버 프로세스만 접근 가능한 경로(예: `/var/lib/antstock/db.sqlite`)에 두며 `app/`이나 `public/` 아래에는 절대 두지 않는다.

## Considered Options

- **별도 백엔드 서비스 + API 게이트웨이**: 다중 백엔드 통합/Token Exchange 같은 시나리오가 있을 때 가치 있지만, 인프라가 3배(프론트/게이트웨이/백엔드)로 늘어 토이엔 과함.
- **Postgres**: 동시성·복제는 잘 되지만 동시 트레이더 수가 적고 거래량도 적어 SQLite로 충분. 추후 필요해지면 마이그레이션 경로 있음.

## Consequences

- 잠재적 사용자(친구, 본인)가 개발자일 가능성이 크므로 DB 파일 경로를 의도적으로 가린다 — 호기심에 직접 SELECT 해서 다른 사람 포지션을 보는 걸 막기 위함.
- 멀티 인스턴스로 가야 할 정도로 트래픽이 늘면 SQLite → Postgres + 외부 pub/sub로 이주.
