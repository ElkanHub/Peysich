import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: pure host→path routing (no DB — layouts do the deep checks).
 *   stmarys.peysich.com/attendance → rewrite → /s/stmarys/attendance
 *   admin.peysich.com/*            → rewrite → /platform/*
 *   peysich.com/*                  → marketing/auth routes as-is
 */
const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").split(":")[0];

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;

  // API routes (incl. better-auth) pass through untouched on any host
  if (pathname.startsWith("/api")) return NextResponse.next();

  if (host === ROOT || host === `www.${ROOT}`) return NextResponse.next();

  if (host === `admin.${ROOT}`) {
    const url = req.nextUrl.clone();
    url.pathname = `/platform${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host.endsWith(`.${ROOT}`)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    if (!sub.includes(".")) {
      const url = req.nextUrl.clone();
      url.pathname = `/s/${sub}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)).*)"],
};
