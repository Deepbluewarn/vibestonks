import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./auth.config";

/**
 * Edge-runtime middleware. Uses the minimal auth.config (no DB) so it can
 * run at the edge. Full session enrichment happens in auth.ts callbacks.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/auth/error");

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}) as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|public/).*)"],
};
