import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config — only providers and pages, no DB calls.
 * Used by proxy.ts (middleware) which runs in the edge runtime.
 * The full config in auth.ts extends this with DB-backed callbacks.
 */
export default {
  providers: [Google, GitHub],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
