import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: host→path routing (no DB — layouts do the deep checks).
 *
 * Subdomain mode (a real domain with wildcard DNS):
 *   stmarys.peysich.com/attendance → rewrite → /s/stmarys/attendance
 *   admin.peysich.com/*            → rewrite → /platform/*
 *
 * Preview mode (no wildcard, e.g. peysich.vercel.app): schools are selected by
 * a cookie instead of a subdomain — visit /t/<slug> once to enter a school,
 * /t/exit to leave. Only ROUTING uses the cookie; auth still verifies the
 * signed-in user belongs to that school on every request (school layout).
 * When a real domain + wildcard exists, subdomain mode simply takes over.
 */
const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").split(":")[0];
const TENANT_COOKIE = "pv_tenant";
/** Root-host paths that must never be rewritten into a school. */
const RESERVED = ["/api", "/platform", "/sign-in", "/signup", "/t/", "/s/"];

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) return NextResponse.next();

  if (host === ROOT || host === `www.${ROOT}`) {
    // /t/<slug> — enter a school (preview mode); /t/exit — back to marketing
    if (pathname.startsWith("/t/")) {
      const slug = pathname.slice(3).split("/")[0].toLowerCase();
      const res = NextResponse.redirect(new URL("/", req.url));
      if (slug === "exit" || slug === "clear") res.cookies.delete(TENANT_COOKIE);
      else if (/^[a-z0-9-]{1,40}$/.test(slug))
        res.cookies.set(TENANT_COOKIE, slug, {
          httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:",
        });
      return res;
    }
    const tenant = req.cookies.get(TENANT_COOKIE)?.value;
    if (tenant && !RESERVED.some((p) => pathname.startsWith(p))) {
      const url = req.nextUrl.clone();
      url.pathname = `/s/${tenant}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (host === `admin.${ROOT}`) {
    if (pathname.startsWith("/platform")) return NextResponse.next();
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
