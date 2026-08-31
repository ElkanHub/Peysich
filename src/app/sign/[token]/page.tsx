import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, signTokens } from "@/db/schema";
import { PhoneSign } from "./phone-sign";

export const dynamic = "force-dynamic";

const SLOT_LABEL: Record<string, string> = {
  headSigKey: "Head teacher's signature",
  adminSigKey: "Main admin's signature",
  stampKey: "School stamp",
};

/** The phone half of "sign on your phone": opened by scanning the QR code
 *  in Settings. The token is the whole credential — no sign-in needed. */
export default async function SignOnPhone({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = /^[A-Za-z0-9_-]{20,64}$/.test(token)
    ? (await db.select().from(signTokens).where(eq(signTokens.id, token)))[0] ?? null
    : null;
  const school = t ? (await db.select().from(schools).where(eq(schools.id, t.schoolId)))[0] : null;
  let slotLabel = t ? SLOT_LABEL[t.slot] ?? t.slot : "";
  if (t?.slot.startsWith("staff:")) {
    const { staff } = await import("@/db/schema");
    const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, t.slot.slice(6)));
    slotLabel = s ? `${s.name} — signature` : "Teacher's signature";
  }

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
        {school?.name ?? "Peysich"}
      </p>
      {children}
    </div>
  );

  if (!t || !school)
    return shell(
      <div className="my-auto text-center">
        <p className="text-lg font-semibold">This signing link isn&apos;t valid</p>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Scan the QR code in Settings again — each code works once.
        </p>
      </div>,
    );

  if (t.usedAt)
    return shell(
      <div className="my-auto text-center">
        <p className="text-lg font-semibold text-success">Already saved ✓</p>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          This link has done its job — you can close this page and return to your computer.
        </p>
      </div>,
    );

  if (t.expiresAt < new Date())
    return shell(
      <div className="my-auto text-center">
        <p className="text-lg font-semibold">This signing link has expired</p>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Links last 15 minutes. Open Settings on your computer and scan a fresh QR code.
        </p>
      </div>,
    );

  return shell(
    <PhoneSign token={token} slotLabel={slotLabel} stamp={t.slot === "stampKey"} />,
  );
}
