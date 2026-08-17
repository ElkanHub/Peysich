import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/auth";
import { presignUpload, r2Enabled } from "@/lib/r2";
import { uid } from "@/lib/utils";

const KINDS = new Set(["photo", "logo", "submission"]);
const MAX_MB = 10;

/** Presigned direct upload: browser PUTs straight to R2, bypassing Vercel.
 *  Any signed-in user; key is scoped to THEIR school. */
export async function POST(req: NextRequest) {
  if (!r2Enabled) return NextResponse.json({ error: "storage-disabled" }, { status: 503 });
  const session = await auth.api.getSession({ headers: req.headers });
  const u = session?.user as { schoolId?: string | null; role: string } | undefined;
  if (!u?.schoolId && u?.role !== "platform_admin")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind, contentType, size } = await req.json();
  if (!KINDS.has(kind) || typeof contentType !== "string")
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  if (Number(size) > MAX_MB * 1024 * 1024)
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  const ext = (contentType.split("/")[1] ?? "bin").slice(0, 5);
  const key = `school/${u.schoolId ?? "platform"}/${kind}/${uid()}.${ext}`;
  const url = await presignUpload(key, contentType);
  return NextResponse.json({ url, key });
}
