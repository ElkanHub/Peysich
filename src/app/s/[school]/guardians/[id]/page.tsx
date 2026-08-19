import Link from "next/link";
import { and, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Phone, MessageSquare, MonitorSmartphone } from "lucide-react";
import { db } from "@/db";
import { guardians, students, studentGuardians, classes, feeInvoices } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Card, Field, PageHeader, Badge, Empty, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { IssueLoginButton, ResetPasswordButton } from "@/ui/issue-login";
import { updateGuardian, linkChild, unlinkChild, setPrimaryGuardian } from "../actions";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/ui/feedback";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const PREF = {
  phone: { label: "Phone call", Icon: Phone, hint: "Does not use the portal — call them." },
  sms: { label: "SMS", Icon: MessageSquare, hint: "Does not use the portal — text or call." },
  portal: { label: "Portal", Icon: MonitorSmartphone, hint: "Reads the parent portal." },
} as const;

/** GUARDIAN PROFILE — one family contact, all their children, the other
 *  guardians of those children, and exactly how to reach them. */
export default async function GuardianProfile({ params, searchParams }: {
  params: Promise<{ school: string; id: string }>;
  searchParams: Promise<{ find?: string }>;
}) {
  const { school: slug, id } = await params;
  const { find } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const [g] = await db.select().from(guardians)
    .where(and(eq(guardians.id, id), eq(guardians.schoolId, school.id)));
  if (!g) notFound();

  const kids = await db.select({
    id: students.id, firstName: students.firstName, lastName: students.lastName,
    admissionNo: students.admissionNo, status: students.status, photoUrl: students.photoUrl,
    className: classes.name, isPrimary: studentGuardians.isPrimary,
  }).from(studentGuardians)
    .innerJoin(students, eq(studentGuardians.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(eq(studentGuardians.guardianId, id))
    .orderBy(students.lastName, students.firstName);
  const kidIds = kids.map((k) => k.id);

  const [coGuardians, balances, candidates] = await Promise.all([
    kidIds.length
      ? db.selectDistinct({
          id: guardians.id, name: guardians.name, phone: guardians.phone,
          relation: guardians.relation, contactPref: guardians.contactPref,
        }).from(studentGuardians)
          .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
          .where(and(inArray(studentGuardians.studentId, kidIds), ne(guardians.id, id)))
      : [],
    kidIds.length
      ? db.select({
          studentId: feeInvoices.studentId,
          bal: sql<number>`coalesce(sum(total_pesewas - paid_pesewas), 0)`,
        }).from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, school.id), inArray(feeInvoices.studentId, kidIds)))
          .groupBy(feeInvoices.studentId)
      : [],
    find
      ? db.select({
          id: students.id, firstName: students.firstName, lastName: students.lastName,
          admissionNo: students.admissionNo, className: classes.name,
        }).from(students).leftJoin(classes, eq(students.classId, classes.id))
          .where(and(eq(students.schoolId, school.id), eq(students.status, "active"),
            or(ilike(students.firstName, `%${find}%`), ilike(students.lastName, `%${find}%`),
              ilike(students.admissionNo, `%${find}%`))))
          .limit(8)
      : [],
  ]);
  const balByKid = new Map(balances.map((b) => [b.studentId, Number(b.bal)]));
  const totalBal = balances.reduce((a, b) => a + Number(b.bal), 0);
  const activeKids = kids.filter((k) => k.status === "active").length;
  const photo = new Map<string, string>();
  if (r2Enabled)
    await Promise.all(kids.filter((k) => k.photoUrl).map(async (k) =>
      photo.set(k.id, await presignDownload(k.photoUrl!))));
  const pref = PREF[(g.contactPref as keyof typeof PREF) ?? "phone"] ?? PREF.phone;

  return (
    <div className="max-w-3xl">
      <PageHeader title={g.name}
        sub={`${g.relation}${g.occupation ? ` · ${g.occupation}` : ""} · ${kids.length} ${kids.length === 1 ? "child" : "children"} on file`} />

      {/* the front-desk fact: how do we actually reach this person? */}
      <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
        g.contactPref === "portal" ? "border-border bg-muted/40" : "border-warning/40 bg-warning-soft")}>
        <p className="flex items-center gap-2 text-sm">
          <pref.Icon size={16} className={g.contactPref === "portal" ? "text-muted-foreground" : "text-warning"} />
          <span><b>{pref.label}</b> — {pref.hint}</span>
        </p>
        <a href={`tel:${g.phone.replace(/\s/g, "")}`}
          className={btnCls + " inline-flex items-center gap-1.5"}>
          <Phone size={14} /> Call {g.phone}
        </a>
      </div>

      {activeKids === 0 && kids.length > 0 && (
        <p className="mb-5 rounded-md bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
          No active children currently enrolled — this guardian is kept for history and re-activates
          automatically if a child is re-admitted.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Contact & preferences</h2>
          <form action={updateGuardian.bind(null, slug, id)} className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Full name"><input name="name" defaultValue={g.name} required className={inputCls} /></Field>
            <Field label="Phone"><input name="phone" defaultValue={g.phone} required className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={g.email ?? ""} className={inputCls} /></Field>
            <Field label="Relation">
              <select name="relation" defaultValue={g.relation} className={inputCls}>
                {["parent", "mother", "father", "grandparent", "aunt", "uncle", "sibling", "other"]
                  .map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Occupation"><input name="occupation" defaultValue={g.occupation ?? ""} className={inputCls} /></Field>
            <Field label="How to reach them">
              <select name="contactPref" defaultValue={g.contactPref} className={inputCls}>
                <option value="phone">Phone call — not a portal user</option>
                <option value="sms">SMS — not a portal user</option>
                <option value="portal">Uses the parent portal</option>
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Office note">
                <input name="note" defaultValue={g.note ?? ""}
                  placeholder='e.g. "Call after 4pm — works night shift"' className={inputCls} />
              </Field>
            </div>
            <SubmitButton className={btnGhostCls + " col-span-2"} pendingText="Saving…">Save contact details</SubmitButton>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Portal access</h2>
            <div className="mt-2.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Parent login</span>
              {g.userId
                ? <span className="inline-flex items-center gap-2">
                    <span className="text-xs text-success">active</span>
                    <ResetPasswordButton slug={slug} kind="guardian" id={g.id} />
                  </span>
                : <IssueLoginButton slug={slug} kind="guardian" id={g.id} />}
            </div>
            {g.contactPref !== "portal" && g.userId && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Has a login but is marked as not using the portal — keep phoning for anything urgent.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Family account</h2>
            <dl className="mt-2.5 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Children (active)</dt>
                <dd data-nums="">{activeKids} of {kids.length}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Outstanding fees (all children)</dt>
                <dd data-nums="" className={totalBal > 0 ? "font-medium text-danger" : "text-success"}>
                  {totalBal > 0 ? ghs(totalBal) : "Cleared"}</dd></div>
            </dl>
          </Card>
        </div>

        <Card className="md:col-span-2">
          <h2 className="font-semibold">Children in this school</h2>
          {kids.length === 0 && <div className="mt-3"><Empty title="No children linked yet" hint="Search below to link a student." /></div>}
          <ul className="mt-2 divide-y divide-border">
            {kids.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link href={`/students/${k.id}`} className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-[11px] font-semibold text-primary">
                    {photo.has(k.id)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={photo.get(k.id)} alt="" width={32} height={32} loading="lazy" className="h-full w-full object-cover" />
                      : `${k.firstName[0]}${k.lastName[0]}`}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-primary">{k.firstName} {k.lastName}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {k.admissionNo} · {k.className ?? "no class"}
                    </span>
                  </span>
                </Link>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={k.status === "active" ? "success" : "default"}>{k.status}</Badge>
                  {(balByKid.get(k.id) ?? 0) > 0 &&
                    <span className="text-[12px] font-medium text-danger" data-nums="">{ghs(balByKid.get(k.id)!)} owing</span>}
                  {k.isPrimary
                    ? <Badge tone="brand">primary contact</Badge>
                    : <form action={setPrimaryGuardian.bind(null, slug, id, k.id)}>
                        <SubmitButton className="rounded border border-border px-2 py-1 text-[11.5px] hover:bg-muted">Make primary</SubmitButton>
                      </form>}
                  <form action={unlinkChild.bind(null, slug, id, k.id)}>
                    <SubmitButton className="rounded border border-border px-2 py-1 text-[11.5px] text-danger hover:bg-muted">Unlink</SubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
          {/* link another child — also the fix for accidental duplicate parents */}
          <form className="mt-3 flex items-end gap-2 border-t border-border pt-3">
            <Field label="Link a child (search name or admission no)">
              <input name="find" defaultValue={find ?? ""} placeholder="Ama / ADM0012…" className={inputCls} />
            </Field>
            <button className={btnGhostCls}>Search</button>
          </form>
          {find && (
            <ul className="mt-2 space-y-1 text-sm">
              {candidates.filter((c) => !kidIds.includes(c.id)).map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span>{c.lastName}, {c.firstName}
                    <span className="ml-2 text-[12px] text-muted-foreground">{c.admissionNo} · {c.className ?? "no class"}</span></span>
                  <form action={linkChild.bind(null, slug, id, c.id)}>
                    <SubmitButton className="rounded border border-border px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-muted">Link</SubmitButton>
                  </form>
                </li>
              ))}
              {candidates.filter((c) => !kidIds.includes(c.id)).length === 0 &&
                <li className="text-muted-foreground">No matching active students.</li>}
            </ul>
          )}
        </Card>

        <Card className="md:col-span-2">
          <h2 className="font-semibold">Co-guardians</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Other guardians linked to the same children.</p>
          {coGuardians.length === 0
            ? <p className="mt-2 text-sm text-muted-foreground">None — sole guardian on file.</p>
            : (
              <ul className="mt-2 divide-y divide-border">
                {coGuardians.map((c) => {
                  const p = PREF[(c.contactPref as keyof typeof PREF) ?? "phone"] ?? PREF.phone;
                  return (
                    <li key={c.id} className="flex items-center justify-between py-2">
                      <Link href={`/guardians/${c.id}`} className="text-sm font-medium text-primary">
                        {c.name} <span className="font-normal text-muted-foreground">· {c.relation}</span>
                      </Link>
                      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <p.Icon size={13} /> {c.phone}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>
      </div>
    </div>
  );
}
