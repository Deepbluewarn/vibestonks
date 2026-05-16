# 인증은 Google + GitHub 소셜 로그인

NextAuth v5의 Google·GitHub provider를 인증 수단으로 채택. 누구나 자기 계정으로 즉시 가입 가능하고, 별도 계정 관리/이메일 발신 인프라가 필요 없다.

## Considered Options

- **자체 ID/비밀번호**: 계정 관리·해시·복구 흐름 직접 구현 부담 큼. 토이엔 과함.
- **이메일 매직 링크**: 가입 마찰 ↓ 하지만 SMTP 발신 인프라 필요.
- **OIDC provider (Auth0, Clerk 등)**: 별도 인프라/서비스 의존. 토이엔 과함.
- **Google만**: 거의 모든 사용자가 Gmail 보유. 접근성 최고.
- **GitHub만**: 개발자 친화. 비개발자엔 진입 장벽.
- **Google + GitHub (채택)**: 둘 다. NextAuth가 멀티 provider 잘 지원, 코드 추가 미미.

## Consequences

- `auth.config.ts`(edge-safe)와 `auth.ts`(DB 콜백 포함)로 분리 — middleware는 edge에서 가벼운 config만 사용.
- `signIn` 콜백에서 트레이더 자동 생성 + 활성 라운드 잔고 1,000 자동 입금 + lastSalaryAt=now 마킹.
- `sub`은 `{provider}:{providerAccountId}` 형태로 네임스페이스 분리 — 같은 사람이 Google과 GitHub로 따로 가입하면 별도 트레이더로 취급(의도). 다중 계정 어뷰즈 가능성은 작은 토이 스케일에선 무시.
