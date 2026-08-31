import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicants, applicantGuardians, levels } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { PrintButton } from "@/ui/print-button";
import { btnGhostCls } from "@/ui/kit";

/** The printable OFFER LETTER — the in-person channel. Branded paper the
 *  office hands (or posts) to a guardian; browser print / save-as-PDF. */
export default async function OfferLetter({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const [a] = await db.select().from(applicants)
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  if (!a || !a.offerAt) notFound();
  const [gList, lvs] = await Promise.all([
    db.select().from(applicantGuardians).where(eq(applicantGuardians.applicantId, a.id))
      .orderBy(applicantGuardians.sortOrder),
    db.select().from(levels).where(eq(levels.schoolId, school.id)),
  ]);
  const b = (school.branding ?? {}) as { logoUrl?: string; primaryColor?: string; address?: string; phone?: string; motto?: string };
  const logoUrl = b.logoUrl && r2Enabled ? await presignDownload(b.logoUrl).catch(() => null) : null;
  const color = b.primaryColor || "#5E1D3E";
  const levelName = lvs.find((l) => l.id === a.levelId)?.name ?? "—";
  const dear = gList[0]?.name ?? a.guardianName ?? "Parent/Guardian";

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/admissions/${a.id}`} className="text-[13.5px] font-medium text-primary">← Applicant file</Link>
        <div className="flex gap-2">
          <PrintButton />
          <span className={btnGhostCls + " cursor-default opacity-70"}>Print → save as PDF works too</span>
        </div>
      </div>

      <div className="bg-white p-8 text-black shadow-[var(--shadow-lg)] print:p-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b-4 pb-3" style={{ borderColor: color }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-12 w-12 object-contain" />
          )}
          <div className="min-w-0">
            <p className="text-[19px] font-bold leading-tight" style={{ color }}>{school.name}</p>
            <p className="text-[10.5px] text-neutral-500">
              {[b.motto, b.address, b.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <p className="mt-5 text-right text-[12px] text-neutral-600" data-nums="">
          {a.offerAt.toISOString().slice(0, 10)}
        </p>
        <p className="mt-4 text-center text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
          Offer of Admission
        </p>

        <div className="mt-5 space-y-3 text-[13.5px] leading-relaxed">
          <p>Dear {dear},</p>
          <p className="whitespace-pre-line">{a.offerMessage ?? `We are pleased to offer ${a.name} a place at ${school.name}.`}</p>
          <p>
            This offer is for <b>{a.name}</b>, admitted into <b>{levelName}</b>
            {a.offerDeadline && <> — kindly confirm acceptance by <b data-nums="">{a.offerDeadline}</b></>}.
            Please bring this letter to the school office to complete enrolment.
          </p>
          <p>We look forward to welcoming your child.</p>
        </div>

        <div className="mt-12 flex justify-between text-[11px] text-neutral-600">
          <p className="w-[42%] border-t border-neutral-400 pt-1 text-center">Head Teacher</p>
          <p className="w-[42%] border-t border-neutral-400 pt-1 text-center">School stamp</p>
        </div>
        <p className="mt-6 border-t border-neutral-200 pt-2 text-center text-[10px] text-neutral-400">
          {school.name} · Generated with Peysich
        </p>
      </div>
    </div>
  );
}
