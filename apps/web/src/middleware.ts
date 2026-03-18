import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/api/admin", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const proto = req.headers.get("x-forwarded-proto");

  if (
    process.env.NODE_ENV === "production" &&
    proto === "http" &&
    !pathname.startsWith("/api/health")
  ) {
    const httpsUrl = req.nextUrl.clone();
    httpsUrl.protocol = "https";
    return NextResponse.redirect(httpsUrl, 301);
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get("cm_session")?.value;
  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
