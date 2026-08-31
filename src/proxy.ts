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
const RESERVED = ["/api", "/platform", "/sign-in", "/signup", "/sign/", "/t/", "/s/", "/go"];

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;

  // the ORIGINAL path rides along as a header so server code (Team & access
  // tab checks) knows which tab a request is for, rewrites included
  const fwd = new Headers(req.headers);
  fwd.set("x-peysich-path", pathname);
  const pass = { request: { headers: fwd } };

  if (pathname.startsWith("/api")) return NextResponse.next(pass);

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
    // "/" only becomes the school when someone is actually signed in —
    // otherwise a lingering tenant cookie would bounce every visitor off
    // the marketing page onto sign-in. (Presence check only; the school
    // layout still verifies the session properly.)
    const hasSession = req.cookies.getAll().some((c) => c.name.includes("session_token"));
    if (tenant && !RESERVED.some((p) => pathname.startsWith(p))
      && (pathname !== "/" || hasSession)) {
      const url = req.nextUrl.clone();
      url.pathname = `/s/${tenant}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url, pass);
    }
    return NextResponse.next(pass);
  }

  if (host === `admin.${ROOT}`) {
    if (pathname.startsWith("/platform")) return NextResponse.next(pass);
    const url = req.nextUrl.clone();
    url.pathname = `/platform${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, pass);
  }

  if (host.endsWith(`.${ROOT}`)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    // /sign/<token> (phone signing) is a global page — never a school route
    if (!sub.includes(".") && !pathname.startsWith("/sign/")) {
      const url = req.nextUrl.clone();
      url.pathname = `/s/${sub}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url, pass);
    }
  }
  return NextResponse.next(pass);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)).*)"],
};
