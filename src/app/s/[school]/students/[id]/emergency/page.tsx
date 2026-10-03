import Link from "next/link";
import { PageHeader, Field, inputCls, btnDangerCls, btnGhostCls } from "@/ui/kit";
import { ConfirmButton } from "@/ui/confirm";
import { loadRecipients, route, routeEnv } from "@/messaging/notify";
import { EMERGENCIES } from "@/messaging/templates";
import { cn } from "@/lib/utils";
import { sendEmergency } from "./actions";
import { emergencyContext } from "./context";

/** EMERGENCY — one job: tell this child's parents now. Six big reasons, one
 *  short line of detail, Send now. The confirm says who gets it and how. */
export default async function Emergency({ params }: { params: Promise<{ school: string; id: string }> }) {
  const { school: slug, id } = await params;
  const { school, s, parents } = await emergencyContext(slug, id);
  const tos = parents.map((p) => ({ kind: "guardian" as const, id: p.id }));
  const [env, people] = await Promise.all([routeEnv(), loadRecipients(school.id, tos)]);
  // who gets it, and on what — the same routing rule the send uses
  const who = parents.map((p) => {
    const r = people.get(`guardian:${p.id}`);
    const how = r ? [...new Set(route({ school, kind: "emergency_illness", vars: { child: "x", phone: "x", detail: "x" } }, r, env)
      .map((x) => ({ sms: "SMS", whatsapp: "WhatsApp", telegram: "Telegram", push: "the app", email: "email" })[x.channel]))] : [];
    return `${p.name} (${how.join(", ") || "no phone number"})`;
  });

  return (
    <div className="max-w-xl">
      <PageHeader title={`Emergency — ${s.firstName} ${s.lastName}`} sub="Tell the parents now. Choose what has happened." />
      <form action={sendEmergency.bind(null, slug, id)} className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          {EMERGENCIES.map(([kind, label]) => (
            <label key={kind} className="flex min-h-16 cursor-pointer items-center justify-center rounded-xl border-2 border-border bg-card px-3 py-3 text-center text-[17px] font-semibold has-[:checked]:border-danger has-[:checked]:bg-danger-soft has-[:checked]:text-danger">
              <input type="radio" name="reason" value={kind} required className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        <Field label="One short line of detail" optional>
          <input name="detail" maxLength={120} placeholder="e.g. High temperature since break time" className={cn(inputCls, "h-12 text-[16px]")} />
        </Field>
        <Field label="Time to collect (only for Collect early)" optional>
          <input name="time" type="time" className={cn(inputCls, "h-12 w-40 text-[16px]")} />
        </Field>
        <ConfirmButton danger className={cn(btnDangerCls, "h-14 w-full text-[18px]")} disabled={parents.length === 0}
          title={`Send to ${parents.length} parent${parents.length === 1 ? "" : "s"} now?`}
          body={`${who.join("; ")}. Emergencies go by WhatsApp and SMS both, even when the messaging balance is empty. There is no un-send.`}
          confirmLabel="Send now">
          Send now
        </ConfirmButton>
        {parents.length === 0 && (
          <p className="text-[15px] text-danger">
            No parent is on this child&apos;s file.{s.emergencyPhone ? ` Call the emergency contact: ${s.emergencyName ?? ""} ${s.emergencyPhone}.` : ""}
          </p>
        )}
      </form>
      <Link href={`/students/${id}`} className={cn(btnGhostCls, "mt-4")}>Back to {s.firstName}&apos;s file</Link>
    </div>
  );
}
