import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { schools, signTokens, staff } from "@/db/schema";
import { r2Enabled, r2Put, presignDownload } from "@/lib/r2";
import { getDocSignConfig } from "@/core/doc-sign";
import { invalidateSchool } from "@/core/tenant";
import { uid } from "@/lib/utils";

/* Sign-on-phone bridge. The token (minted by an admin in Settings) is the
 * whole credential: long, random, 15-minute, single-use. GET is the PC's
 * poll — "has the phone signed yet?"; POST is the phone delivering the
 * drawn signature / stamp photo. */

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

async function loadToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [t] = await db.select().from(signTokens).where(eq(signTokens.id, token));
  return t ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await loadToken(token);
  if (!t) return NextResponse.json({ state: "invalid" });
  if (t.usedAt) {
    // hand the PC a preview of what the phone saved
    let key: string | null = null;
    if (t.slot.startsWith("staff:")) {
      const [s] = await db.select({ k: staff.signatureKey }).from(staff)
        .where(and(eq(staff.id, t.slot.slice(6)), eq(staff.schoolId, t.schoolId)));
      key = s?.k ?? null;
    } else {
      const [school] = await db.select().from(schools).where(eq(schools.id, t.schoolId));
      key = school ? getDocSignConfig(school.settings)[t.slot as "headSigKey" | "adminSigKey" | "stampKey"] : null;
    }
    const url = key && r2Enabled ? await presignDownload(key).catch(() => null) : null;
    return NextResponse.json({ state: "done", url });
  }
  if (t.expiresAt < new Date()) return NextResponse.json({ state: "expired" });
  return NextResponse.json({ state: "waiting" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!r2Enabled) return NextResponse.json({ error: "storage-disabled" }, { status: 503 });
  const { token } = await params;
  const t = await loadToken(token);
  if (!t || t.usedAt || t.expiresAt < new Date())
    return NextResponse.json({ error: "expired" }, { status: 410 });

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = TYPES[contentType];
  if (!ext) return NextResponse.json({ error: "bad-type" }, { status: 415 });
  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES)
    return NextResponse.json({ error: "too-large" }, { status: 413 });

  // claim the token FIRST — atomic, so it can never be spent twice
  const claimed = await db.update(signTokens).set({ usedAt: new Date() })
    .where(and(eq(signTokens.id, t.id), isNull(signTokens.usedAt))).returning();
  if (!claimed.length) return NextResponse.json({ error: "expired" }, { status: 410 });

  try {
    const [school] = await db.select().from(schools).where(eq(schools.id, t.schoolId));
    if (!school) throw new Error("school gone");
    const key = `school/${school.id}/sign/${uid()}.${ext}`;
    await r2Put(key, body, contentType);
    if (t.slot.startsWith("staff:")) {
      const [s] = await db.update(staff).set({ signatureKey: key })
        .where(and(eq(staff.id, t.slot.slice(6)), eq(staff.schoolId, school.id)))
        .returning({ id: staff.id });
      if (!s) throw new Error("staff gone");
    } else {
      const cfg = getDocSignConfig(school.settings);
      const settings = {
        ...(school.settings as Record<string, unknown>),
        docSign: { ...cfg, [t.slot]: key },
      };
      await db.update(schools).set({ settings, updatedAt: new Date() }).where(eq(schools.id, school.id));
      invalidateSchool(school.slug);
    }
    return NextResponse.json({ ok: true });
  } catch {
    // give the token back so the person can simply try again
    await db.update(signTokens).set({ usedAt: null }).where(eq(signTokens.id, t.id));
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
