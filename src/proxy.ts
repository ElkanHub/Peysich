import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: host→path routing (no DB — layouts do the deep checks).
 *
 * Subdomain mode (a real domain with wildcard DNS):
 *   stmarys.schoolspec.app/attendance → rewrite → /s/stmarys/attendance
 *   admin.schoolspec.app/*            → rewrite → /platform/*
 *
 * Preview mode (no wildcard, e.g. schoolspec.vercel.app): schools are selected by
 * a cookie instead of a subdomain — visit /t/<slug> once to enter a school,
 * /t/exit to leave. Only ROUTING uses the cookie; auth still verifies the
 * signed-in user belongs to that school on every request (school layout).
 * When a real domain + wildcard exists, subdomain mode simply takes over.
 */
const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").split(":")[0];
/** The marketing domain, when it is a separate one (schoolspec.com beside the
 *  app's schoolspec.app). Unset locally and in preview — then the root host
 *  keeps serving the marketing page itself, exactly as before. */
const MARKETING = (process.env.NEXT_PUBLIC_MARKETING_DOMAIN ?? "").toLowerCase().split(":")[0];
const TENANT_COOKIE = "pv_tenant";
/** Root-host paths that must never be rewritten into a school. */
const RESERVED = ["/api", "/platform", "/sign-in", "/signup", "/sign/", "/t/", "/s/", "/go", "/offline"];
const GLOBAL = new Set(["/manifest.webmanifest", "/sw.js", "/offline", "/og.png"]);

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;

  // the ORIGINAL path rides along as a header so server code (Team & access
  // tab checks) knows which tab a request is for, rewrites included
  const fwd = new Headers(req.headers);
  fwd.set("x-schoolspec-path", pathname);
  const pass = { request: { headers: fwd } };

  if (pathname.startsWith("/api")) return NextResponse.next(pass);
  // the installable-app files live at the root of EVERY host (a school's
  // subdomain installs as that school): never rewrite them into a tenant
  if (GLOBAL.has(pathname) || pathname.startsWith("/icons/") || pathname.startsWith("/splash/"))
    return NextResponse.next(pass);

  // The marketing domain holds exactly one page. Sign-in, signup, the console
  // and every school belong to the app domain — a second copy served here could
  // not set the app's session cookie (it is scoped to .${ROOT}), so the sign-in
  // would look fine and silently do nothing. Send them across instead.
  if (MARKETING && host === MARKETING) {
    if (pathname === "/") return NextResponse.next(pass);
    return NextResponse.redirect(new URL(pathname + req.nextUrl.search, `https://${ROOT}`), 308);
  }

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
    // one marketing page, on one domain: a signed-out visitor to the app's own
    // root is sent to it rather than shown a second indexable copy. 307, not
    // 308 — the answer changes the moment they have a session.
    if (MARKETING && pathname === "/" && !hasSession)
      return NextResponse.redirect(`https://${MARKETING}/`, 307);
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
