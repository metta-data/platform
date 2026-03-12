import { auth, authEnabled } from "@/lib/auth";
import { NextResponse } from "next/server";

// When auth is not configured, allow all requests through
/* eslint-disable @typescript-eslint/no-explicit-any --
   Auth.js v5 beta types are incomplete; auth() callback typing requires `any` */
const middleware = authEnabled
  ? (auth as any)((req: any) => {
      const { pathname } = req.nextUrl;
      const session = req.auth;

      const isAdminPage = pathname.startsWith("/admin");
      const isAdminApi = pathname.startsWith("/api/");

      if (!isAdminPage && !isAdminApi) {
        return NextResponse.next();
      }

      // Not authenticated
      if (!session?.user) {
        if (isAdminApi) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
          );
        }
        const signInUrl = new URL("/api/auth/signin", req.url);
        signInUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(signInUrl);
      }

      // Authenticated but not admin
      if (!session.user.isAdmin) {
        if (isAdminApi) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/", req.url));
      }

      return NextResponse.next();
    })
  : function middleware() {
      return NextResponse.next();
    };

export default middleware;

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/instances/:path*",
    "/api/ingest/:path*",
    "/api/upload/:path*",
    "/api/debug/:path*",
    "/api/snapshots/all",
    "/api/admin/:path*",
  ],
};
