import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students, studentItems, feeInvoices, loans, books, routeStudents, routes,
} from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, Badge, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { exitStudent } from "../actions";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/ui/feedback";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** EXIT / WITHDRAW — the offboarding flow: clearance check across fees,
 *  library, custody and transport, then exit details, then one confirm.
 *  Nothing is deleted; the file becomes historical and re-admission later
 *  is just the Enrol flow on the same record. */
export default async function ExitStudent({ params, searchParams }: {
  params: Promise<{ school: string; id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug, id } = await params;
  const { err } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  if (s.status !== "active") {
    return (
      <div className="max-w-xl">
        <PageHeader title={`${s.firstName} ${s.lastName}`} sub="This student is not active — the exit flow only applies to active students." />
        <Link href={`/students/${id}`} className={btnGhostCls}>Back to the student file</Link>
      </div>
    );
  }

  const { studentBalance } = await import("@/modules/fees/engine");
  const { getFeesConfig } = await import("@/modules/fees/config");
  const feesCfg = getFeesConfig(school.settings);
  const [ledgerBal, openLoans, custody, [transport]] = await Promise.all([
    studentBalance(school.id, id),
    db.select({ title: books.title, loanedAt: loans.loanedAt })
      .from(loans).innerJoin(books, eq(loans.bookId, books.id))
      .where(and(eq(loans.schoolId, school.id), eq(loans.studentId, id), isNull(loans.returnedAt))),
    db.select().from(studentItems).where(and(
      eq(studentItems.studentId, id), isNull(studentItems.returnedAt))),
    db.select({ name: routes.name }).from(routeStudents)
      .innerJoin(routes, eq(routeStudents.routeId, routes.id))
      .where(and(eq(routeStudents.schoolId, school.id), eq(routeStudents.studentId, id))),
  ]);
  const balance = feesCfg.clearanceGate === "off" ? 0 : ledgerBal;
  const issues = (balance > 0 ? 1 : 0) + openLoans.length + custody.length;
  const feesBlocked = feesCfg.clearanceGate === "block" && balance > 0;

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <li className="flex items-start justify-between gap-3 py-2">
      <span className="flex items-center gap-2">
        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
          ok ? "bg-success/15 text-success" : "bg-warning-soft text-warning")}>
          {ok ? "✓" : "!"}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </span>
      <span className={cn("text-right text-[14px]", ok ? "text-muted-foreground" : "font-medium text-warning")}>{detail}</span>
    </li>
  );

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Exit — ${s.firstName} ${s.lastName}`}
        sub={`${s.admissionNo} · nothing is deleted: the file becomes historical and can be re-admitted later.`} />

      {err === "clearance" && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          There are unresolved clearance items — resolve them, or tick the acknowledgement to exit anyway.
        </p>
      )}

      {/* 1 · clearance check */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1 · Clearance check</h2>
          <Badge tone={issues === 0 ? "success" : "warning"}>
            {issues === 0 ? "All clear" : `${issues} item${issues > 1 ? "s" : ""} outstanding`}
          </Badge>
        </div>
        <ul className="mt-2 divide-y divide-border">
          <Row ok={balance <= 0} label="Fees & accounts"
            detail={balance <= 0 ? "No outstanding balance" : `${ghs(balance)} outstanding — record payments in Fees`} />
          <Row ok={openLoans.length === 0} label="Library"
            detail={openLoans.length === 0 ? "No books out"
              : openLoans.map((l) => l.title).join(", ") + " not returned"} />
          <Row ok={custody.length === 0} label="Office custody"
            detail={custody.length === 0 ? "Nothing held for this student"
              : custody.map((c) => `${c.itemName} (${c.location})`).join("; ") + " — return via Documents & Items"} />
          <Row ok={true} label="Transport"
            detail={transport ? `On route “${transport.name}” — released automatically on exit` : "Not on a route"} />
        </ul>
      </Card>

      {/* 2 · exit details + 3 · confirm */}
      <form action={exitStudent.bind(null, slug, id)} className="mt-4 space-y-4">
        <Card>
          <h2 className="font-semibold">2 · Exit details</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Reason for leaving">
              <select name="reason" required className={inputCls}>
                <option value="transferred">Transferred to another school</option>
                <option value="withdrawn">Withdrawn by family</option>
                <option value="completed">Completed schooling (graduates to alumni)</option>
                <option value="expelled">Dismissed by the school</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Effective exit date">
              <input name="exitDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
            </Field>
            <Field label="Destination school (goes on the leaving certificate)">
              <input name="exitDestination" placeholder="e.g. Sunrise Academy, Kumasi" className={inputCls} />
            </Field>
            <Field label="Note (kept on the file)">
              <input name="exitNote" placeholder="Family relocating to Tamale" className={inputCls} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">3 · Confirm</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[14px] text-muted-foreground">
            <li>Drops off registers, score sheets and rosters immediately — never marked absent again.</li>
            <li>This year&apos;s enrolment is closed with the reason; all history and documents are preserved.</li>
            <li>Student portal becomes read-only (past reports and receipts stay viewable); transport seat is released.</li>
            <li>The <b>leaving certificate</b> and final statement become available on the file.</li>
            <li>Recorded in error? The file has an <b>Undo exit</b>. Returning next year? Just <b>Enrol</b> them again.</li>
          </ul>
          {feesBlocked && (
            <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              This school <b>blocks exits until fees are cleared</b> ({ghs(balance)} outstanding).
              Record the payment, or formally waive it as an adjustment on the student file —
              then come back here. A full admin can relax this under Fees → Catalog &amp; settings.
            </p>
          )}
          {issues > 0 && !feesBlocked && (
            <label className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm">
              <input type="checkbox" name="override" className="mt-0.5" />
              <span>I acknowledge the outstanding clearance items above and the school accepts the exit anyway.</span>
            </label>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Link href={`/students/${id}`} className={btnGhostCls}>Cancel</Link>
            <SubmitButton className={btnCls + " bg-danger"} pendingText="Exiting…">Exit student</SubmitButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
