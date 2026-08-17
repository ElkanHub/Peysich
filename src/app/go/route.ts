import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/core/auth";
import { db } from "@/db";
import { schools } from "@/db/schema";

/** Post-login router: sends each role to its home, in both URL modes.
 *  platform_admin → /platform · school user → their school (subdomain, or
 *  tenant cookie + / in preview mode) · no session → /sign-in */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL("/sign-in", req.url));
  const u = session.user as { role: string; schoolId?: string | null };

  if (u.role === "platform_admin")
    return NextResponse.redirect(new URL("/platform", req.url));

  if (u.schoolId) {
    const [school] = await db.select({ slug: schools.slug }).from(schools)
      .where(eq(schools.id, u.schoolId));
    if (school) {
      const rootWithPort = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
      const host = (req.headers.get("host") ?? "").toLowerCase();
      const onRoot = host === rootWithPort || host === `www.${rootWithPort}`;
      const wildcardless = rootWithPort.endsWith("vercel.app") || rootWithPort.includes("localhost");
      if (onRoot && wildcardless) {
        // preview mode: enter the school via tenant cookie
        const res = NextResponse.redirect(new URL("/", req.url));
        res.cookies.set("pv_tenant", school.slug, {
          httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:",
        });
        return res;
      }
      if (onRoot) // subdomain mode, signed in on the root → hop to their subdomain
        return NextResponse.redirect(`${req.nextUrl.protocol}//${school.slug}.${rootWithPort}/`);
      return NextResponse.redirect(new URL("/", req.url)); // already on their subdomain
    }
  }
  return NextResponse.redirect(new URL("/", req.url));
}
