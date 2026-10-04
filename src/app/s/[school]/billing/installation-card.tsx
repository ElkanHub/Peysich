import { installFee } from "@/core/installation";
import { Card, Badge } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { ConfirmButton } from "@/ui/confirm";
import { btnCls } from "@/ui/kit";
import { payInstallation, requestInstallation } from "./install-actions";

/** Billing → Installation and training: one price, done in person. What the
 *  card says follows where the installation stands. */
export async function InstallationCard({ slug, school }: {
  slug: string; school: { id: string; name: string; planKey: string; installation: string; installFeePesewas: number };
}) {
  if (school.installation === "done") return null;
  const fee = await installFee(school);
  if (fee <= 0) return null;
  const ghs = `GHS ${(fee / 100).toLocaleString()}`;
  const st = school.installation;
  return (
    <Card className="mb-6" >
      <div id="installation" className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            Installation and training
            {st === "paid" && <Badge tone="success">Paid</Badge>}
            {(st === "requested" || st === "offered") && <Badge tone="warning">Waiting for payment</Badge>}
          </p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {st === "paid"
              ? "Thank you. We will call to agree the day, come to the school, set everything up and train your staff."
              : <>We come to {school.name}, set everything up with your classes, children, fees and teachers, and train
                your staff to use it. One price, once: <b className="text-foreground">{ghs}</b>.</>}
          </p>
          {st === "requested" && <p className="mt-1 text-[14px] text-muted-foreground">You asked for it. We will call you to agree a day.</p>}
        </div>
        <div className="shrink-0">
          {st === "none" && (
            <form action={requestInstallation.bind(null, slug)}>
              <SubmitButton className={btnCls + " h-11 text-[15px]"} pendingText="Asking…">Ask for installation</SubmitButton>
            </form>
          )}
          {(st === "requested" || st === "offered") && (
            <form action={payInstallation.bind(null, slug)}>
              <ConfirmButton className={btnCls + " h-11 text-[15px]"} title={`Pay ${ghs} for installation and training?`}
                body="You pay by MoMo or card on the next screen. It is paid once, and covers the setup and the training."
                confirmLabel={`Pay ${ghs}`}>
                Pay {ghs}
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
