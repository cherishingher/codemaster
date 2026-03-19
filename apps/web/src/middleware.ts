import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/api/admin", "/admin"];

const API_RATE_LIMIT = 120;
const API_RATE_WINDOW_MS = 60_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkGlobalRate(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + API_RATE_WINDOW_MS });
    return { ok: true, remaining: API_RATE_LIMIT - 1 };
  }
  entry.count++;
  if (entry.count > API_RATE_LIMIT) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: API_RATE_LIMIT - entry.count };
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of ipHits) {
      if (val.resetAt <= now) ipHits.delete(key);
    }
  }, API_RATE_WINDOW_MS);
}

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

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/health")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { ok, remaining } = checkGlobalRate(ip);
    if (!ok) {
      return NextResponse.json(
        { error: "too_many_requests", message: "请求过于频繁" },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": String(API_RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Limit", String(API_RATE_LIMIT));
    res.headers.set("X-RateLimit-Remaining", String(remaining));

    const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
    if (isProtected) {
      const sessionToken = req.cookies.get("cm_session")?.value;
      if (!sessionToken) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }
    return res;
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected) {
    const sessionToken = req.cookies.get("cm_session")?.value;
    if (!sessionToken) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
