import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Card, PageHeader } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { DocImageUploader } from "../settings/doc-sign";
import { clearDocImage } from "../settings/docsign-actions";
import { AccountCards } from "./account-client";

/** My Account (every role): profile + password — and, for staff, THEIR OWN
 *  signature, submitted right here so nobody queues at the admin's desk. */
export default async function Account({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireSchool(slug);
  const [me] = await db.select({ id: staff.id, signatureKey: staff.signatureKey }).from(staff)
    .where(and(eq(staff.schoolId, school.id), eq(staff.userId, user.id)));
  const sigUrl = me?.signatureKey && r2Enabled
    ? await presignDownload(me.signatureKey).catch(() => null) : null;

  return (
    <div className="max-w-md space-y-5">
      <PageHeader title="My Account" />
      <AccountCards />
      {me && (
        <Card>
          <h2 className="font-semibold">My signature</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            Signs the papers your role signs — report cards as Class Teacher or Form Master.
            Draw it, sign on your phone, or upload a photo of it.
          </p>
          <div className="mt-3">
            <DocImageUploader slug={slug} slot={`staff:${me.id}`} label="Signature"
              hint="dark ink on white shows best on printed documents"
              enabled={r2Enabled} currentUrl={sigUrl} />
            {me.signatureKey && (
              <form action={clearDocImage.bind(null, slug, `staff:${me.id}` as const)} className="mt-1">
                <SubmitButton className="text-[12.5px] text-danger underline-offset-2 hover:underline"
                  pendingText="Removing…">Remove my signature</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
