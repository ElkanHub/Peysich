import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/core/auth";
import { db } from "@/db";
import { schools } from "@/db/schema";

/** Post-login router: sends each role to its home, in both URL modes.
 *  platform_admin → /platform · school user → their school (subdomain, or
 *  tenant cookie + / in preview mode) · no session → /sign-in */
export async function GET(req: NextRequest) {
  // Read past the 60s cookie cache: sign-up has just written schoolId onto the
  // user, and the cached copy still says null. The fresh read re-issues the
  // cache cookie; carry it on the redirect so the school layout sees it too.
  const { headers: fresh, response: session } = await auth.api.getSession({
    headers: req.headers, query: { disableCookieCache: true }, returnHeaders: true,
  });
  const go = (to: string | URL) => {
    const res = NextResponse.redirect(to);
    for (const c of fresh.getSetCookie()) res.headers.append("set-cookie", c);
    return res;
  };
  if (!session) return go(new URL("/sign-in", req.url));
  const u = session.user as { role: string; schoolId?: string | null };

  const rootWithPort = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const wildcardless = rootWithPort.endsWith("vercel.app") || rootWithPort.includes("localhost");

  // The console lives on admin.<root>. A platform admin who signed in on a
  // school's door (or came back from Google onto one) must hop there: on a
  // school's host, /platform is read as a page of that school and 404s.
  if (u.role === "platform_admin") {
    if (wildcardless) return go(new URL("/platform", req.url));
    return host === `admin.${rootWithPort}` ? go(new URL("/", req.url)) : go(`${req.nextUrl.protocol}//admin.${rootWithPort}/`);
  }

  if (u.schoolId) {
    const [school] = await db.select({ slug: schools.slug }).from(schools)
      .where(eq(schools.id, u.schoolId));
    if (school) {
      const onRoot = host === rootWithPort || host === `www.${rootWithPort}`;
      if (onRoot && wildcardless) {
        // preview mode: enter the school via tenant cookie
        const res = go(new URL("/", req.url));
        res.cookies.set("pv_tenant", school.slug, {
          httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:",
        });
        return res;
      }
      // subdomain mode: their school lives at <slug>.<root>. Signed in on the
      // root, or on ANOTHER school's subdomain (a parent who signed in on the
      // door of the wrong school) → hop to their own. Already there → home.
      const mine = `${school.slug}.${rootWithPort}`;
      if (host !== mine) return go(`${req.nextUrl.protocol}//${mine}/`);
      return go(new URL("/", req.url));
    }
  }
  return go(new URL("/", req.url));
}
