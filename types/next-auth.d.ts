import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** vibestonks Trader row id — used to scope balance/holdings queries */
      traderId?: number;
      isAdmin?: boolean;
      displayName?: string;
      /** false면 /onboarding으로 가이드 (닉네임 확인 단계) */
      onboarded?: boolean;
      /** ISO string. 마지막 월급 입금 시각 */
      lastSalaryAt?: string | null;
      /** 이 요청에서 월급이 막 입금됐는지 — UI 토스트용 */
      salaryJustCredited?: boolean;
    } & DefaultSession["user"];
  }
}
