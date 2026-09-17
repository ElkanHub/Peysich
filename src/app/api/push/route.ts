import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/core/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { pushEnabled, pushToUsers } from "@/lib/push";
import { uid } from "@/lib/utils";

/** Push subscriptions for the signed-in person's devices.
 *  GET → is push configured + the public key · POST → save this device
 *  DELETE → forget this device · PUT → send yourself a test. */

async function me(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const u = session?.user as { id: string; schoolId?: string | null } | undefined;
  return u ?? null;
}

export async function GET() {
  return NextResponse.json({ enabled: pushEnabled, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null });
}

export async function POST(req: NextRequest) {
  const u = await me(req);
  if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null) as
    { subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }; ua?: string } | null;
  const s = body?.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth)
    return NextResponse.json({ error: "That subscription is incomplete." }, { status: 400 });
  await db.insert(pushSubscriptions).values({
    id: uid(), userId: u.id, schoolId: u.schoolId ?? null, endpoint: s.endpoint,
    p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent: (body?.ua ?? "").slice(0, 200) || null,
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: { userId: u.id, schoolId: u.schoolId ?? null, p256dh: s.keys.p256dh, auth: s.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const u = await me(req);
  if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({})) as { endpoint?: string };
  if (endpoint) await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, u.id)));
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const u = await me(req);
  if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const r = await pushToUsers([u.id], {
    title: "SchoolSpec", body: "Notifications are on for this device. 🎉", url: "/account", tag: "test",
  });
  return NextResponse.json({ ok: true, ...r });
}
