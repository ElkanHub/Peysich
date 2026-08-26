import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students, classes, guardians, studentGuardians, enrollments, academicYears,
  studentFiles, studentItems, feeInvoices, feePayments, reportCards, terms,
  attendanceRecords, rooms, user as userTable,
} from "@/db/schema";
import { requireSchool, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Card, DataTable, Field, PageHeader, Tr, Td, Badge, Empty, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { IssueLoginButton, ResetPasswordButton } from "@/ui/issue-login";
import { PhotoUploader, DocumentUploader } from "./uploaders";
import { addStudentItem, returnStudentItem, savePaymentNote, cancelExit } from "./actions";
import { addGuardianToStudent, unlinkChild } from "../../guardians/actions";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/ui/feedback";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const TABS = ["profile", "academics", "performance", "documents", "fees"] as const;
const TAB_LABEL = { profile: "Profile", academics: "Academics", performance: "Performance", documents: "Documents & Items", fees: "Fees & Payments" };

/** THE STUDENT FILE — everything the office knows about one child, in one
 *  place: profile, academic history, digital documents + physical custody
 *  register, and the money story. Tabs are URL state; actions stay put. */
export default async function StudentFile({ params, searchParams }: {
  params: Promise<{ school: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { school: slug, id } = await params;
  const sp = await searchParams;
  const { school, user } = await requireSchool(slug, ["admin", "teacher"]);
  const isAdmin = ["admin", "platform_admin"].includes(user.role);
  // money and custody are office business — teachers get profile + academics
  const visibleTabs = isAdmin ? TABS : (["profile", "academics", "performance"] as const);
  const tab = (visibleTabs as readonly string[]).includes(sp.tab ?? "") ? sp.tab as typeof TABS[number] : "profile";

  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  if (!isAdmin) { // teachers open only THEIR students' files
    const scope = await getTeacherScope(school.id, user.id);
    if (!s.classId || !scope?.allClassIds.has(s.classId)) notFound();
  }
  const [cls] = s.classId ? await db.select().from(classes).where(eq(classes.id, s.classId)) : [null];
  const [room] = cls?.roomId ? await db.select().from(rooms).where(eq(rooms.id, cls.roomId)) : [null];
  const term = await getCurrentTerm(school.id);
  const photoUrl = s.photoUrl && r2Enabled ? await presignDownload(s.photoUrl) : null;
  const [login] = s.userId
    ? await db.select({ username: userTable.username, email: userTable.email })
        .from(userTable).where(eq(userTable.id, s.userId))
    : [null];

  const gs = await db.select({
    id: guardians.id, name: guardians.name, phone: guardians.phone,
    relation: guardians.relation, occupation: guardians.occupation,
    contactPref: guardians.contactPref, isPrimary: studentGuardians.isPrimary,
  })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(eq(studentGuardians.studentId, id));

  return (
    <div className="max-w-3xl">
      {/* file header — identity + THE primary action, always top-right */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-lg font-semibold text-primary">
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : `${s.firstName[0]}${s.lastName[0]}`}
          </span>
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
              {s.firstName} {s.otherNames ? `${s.otherNames} ` : ""}{s.lastName}
            </h1>
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              {s.admissionNo} · {cls?.name ?? "no class"}{room ? ` (${room.name})` : ""} · <span className="capitalize">{s.sex}</span>
              <span className="ml-2"><Badge tone={s.status === "active" ? "success" : "default"}>{s.status}</Badge></span>
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            {s.status === "active" && (
              <Link href={`/students/${id}/exit`}
                className={btnGhostCls + " text-danger hover:bg-danger/10"}>Exit</Link>
            )}
            <Link href={`/students/${id}/enroll`} className={btnGhostCls}>Enrol</Link>
            <Link href={`/students/${id}/edit`} className={btnCls}>Edit profile</Link>
          </div>
        )}
      </div>

      {/* offboarded file: the exit record, its documents, and the way back */}
      {s.exitReason && s.status !== "active" && (
        <div className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">
            Left the school on {s.exitDate} — <span className="capitalize">{s.exitReason}</span>
            {s.exitDestination ? ` → ${s.exitDestination}` : ""}
          </p>
          {s.exitNote && <p className="mt-0.5 text-[14px] text-muted-foreground">{s.exitNote}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[14px]">
            <Link href={`/students/${id}/leaving-certificate`} className="font-medium text-primary">
              Leaving certificate & final statement ↗
            </Link>
            {isAdmin && (
              <>
                <span className="text-muted-foreground">Returning? <b>Enrol</b> re-activates this same file.</span>
                <form action={cancelExit.bind(null, slug, id)} className="inline">
                  <SubmitButton className="text-danger underline-offset-2 hover:underline">Undo exit (recorded in error)</SubmitButton>
                </form>
              </>
            )}
          </p>
        </div>
      )}

      {/* tabs — URL state, stable order */}
      <div className="mb-5 flex gap-1 border-b border-border">
        {visibleTabs.map((t) => (
          <Link key={t} href={`?tab=${t}`}
            className={cn("border-b-2 px-3.5 py-2 text-[14px] font-medium transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>

      {tab === "profile" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Personal</h2>
            <dl className="mt-2.5 space-y-1.5 text-sm">
              {[["Date of birth", s.dob], ["ID / birth cert no", s.idNumber],
                ["Place of birth", s.placeOfBirth],
                ["Nationality", s.nationality], ["Hometown", s.hometown],
                ["Religion", s.religion], ["Residential address", s.address],
                ["Previous school", s.previousSchool],
                ["Attendance", s.boarding ? "Boarder" : "Day student"]].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="text-right">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <h2 className="font-semibold">Health & emergency</h2>
            <dl className="mt-2.5 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Blood group</dt><dd>{s.bloodGroup ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Medical notes</dt>
                <dd className="text-right">{s.medicalNotes ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Emergency contact</dt>
                <dd>{s.emergencyName ? `${s.emergencyName} · ${s.emergencyPhone ?? ""}` : "—"}</dd></div>
            </dl>
            {s.medicalNotes && (
              <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">
                ⚠ Has medical notes — visible to teachers of this class.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Guardians</h2>
            {gs.length === 0 && <p className="mt-2 text-sm text-muted-foreground">None linked.</p>}
            <ul className="mt-2 space-y-1.5 text-sm">
              {gs.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-2">
                  <span>
                    <Link href={`/guardians/${g.id}`} className="font-medium text-primary">{g.name}</Link>
                    {g.isPrimary && <span className="ml-1.5"><Badge tone="brand">primary</Badge></span>}
                    {g.contactPref !== "portal" &&
                      <span className="ml-1.5 text-[12.5px] text-warning">📞 {g.contactPref === "sms" ? "SMS" : "phone"}-only</span>}
                    <span className="block text-[13px] text-muted-foreground">
                      {g.relation}{g.occupation ? ` · ${g.occupation}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-muted-foreground">{g.phone}</span>
                    {isAdmin && (
                      <form action={unlinkChild.bind(null, slug, g.id, id)}>
                        <SubmitButton className="rounded border border-border px-1.5 py-0.5 text-[12px] text-danger hover:bg-muted">Unlink</SubmitButton>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {isAdmin && (
              <details className="mt-3 border-t border-border pt-3">
                <summary className="cursor-pointer text-[14px] font-medium text-primary">Add a guardian</summary>
                <form action={addGuardianToStudent.bind(null, slug, id)} className="mt-2 grid grid-cols-2 gap-2.5">
                  <Field label="Full name"><input name="name" required className={inputCls} /></Field>
                  <Field label="Phone (reuses an existing parent)"><input name="phone" required className={inputCls} /></Field>
                  <Field label="Relation">
                    <select name="relation" className={inputCls}>
                      {["parent", "mother", "father", "grandparent", "aunt", "uncle", "sibling", "other"]
                        .map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="How to reach them">
                    <select name="contactPref" className={inputCls}>
                      <option value="phone">Phone call — not a portal user</option>
                      <option value="sms">SMS — not a portal user</option>
                      <option value="portal">Uses the parent portal</option>
                    </select>
                  </Field>
                  <label className="col-span-2 flex items-center gap-2 text-[14px]">
                    <input type="checkbox" name="isPrimary" /> Primary contact
                  </label>
                  <SubmitButton className={btnGhostCls + " col-span-2"}>Add guardian</SubmitButton>
                </form>
              </details>
            )}
          </Card>
          {isAdmin && <Card>
            <h2 className="font-semibold">Access & photo</h2>
            <dl className="mt-2.5 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Student login</dt>
                <dd className="flex items-center gap-2">
                  {s.userId ? (
                    <>
                      <span className="font-mono text-xs">{login?.username ?? login?.email}</span>
                      {isAdmin && <ResetPasswordButton slug={slug} kind="student" id={s.id} />}
                    </>
                  ) : isAdmin ? <IssueLoginButton slug={slug} kind="student" id={s.id} /> : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Admitted</dt>
                <dd>{s.admittedOn ?? s.createdAt.toISOString().slice(0, 10)}</dd>
              </div>
            </dl>
            <div className="mt-3"><PhotoUploader slug={slug} studentId={id} enabled={r2Enabled} currentUrl={photoUrl} initials={`${s.firstName[0]}${s.lastName[0]}`} /></div>
          </Card>}
        </div>
      )}

      {tab === "academics" && <AcademicsTab schoolId={school.id} studentId={id} termId={term?.id} />}

      {tab === "performance" && (
        <PerformanceTab schoolId={school.id} studentId={id} classId={s.classId} termId={term?.id} />
      )}

      {tab === "documents" && (
        <DocumentsTab slug={slug} schoolId={school.id} studentId={id} isAdmin={isAdmin} />
      )}

      {tab === "fees" && (
        <FeesTab slug={slug} schoolId={school.id} studentId={id}
          paymentNote={s.paymentNote} isAdmin={isAdmin} />
      )}
    </div>
  );
}

/** All configured tests + exam for the current term, converted to their
 *  weights — the at-a-glance version of the printable record. */
async function PerformanceTab({ schoolId, studentId, classId, termId }: {
  schoolId: string; studentId: string; classId: string | null; termId?: string;
}) {
  const { getStructure } = await import("@/core/academics");
  const { skillRatings, skillDomains } = await import("@/db/schema");
  const S = await getStructure(schoolId);
  const cls = classId ? S.classById.get(classId) : null;
  if (!cls || !termId) {
    return <Card><p className="text-sm text-muted-foreground">No current class or term — nothing to show yet.</p></Card>;
  }
  const preschool = !!S.levelById.get(cls.levelId)?.preschool;
  const printable = `/students/${studentId}/performance/${termId}`;

  if (preschool) {
    const [rs, doms] = await Promise.all([
      db.select().from(skillRatings).where(and(
        eq(skillRatings.studentId, studentId), eq(skillRatings.termId, termId))),
      db.select().from(skillDomains).where(eq(skillDomains.schoolId, schoolId)),
    ]);
    const rateBy = new Map(rs.map((r) => [r.domainId, r.rating]));
    return (
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Skills this term</h2>
          <Link href={printable} className="text-[14px] font-medium text-primary">Open printable record →</Link>
        </div>
        <ul className="mt-2 divide-y divide-border text-sm">
          {doms.sort((a, b) => a.sortOrder - b.sortOrder).map((d) => (
            <li key={d.id} className="flex justify-between py-1.5">
              <span>{d.name}</span>
              <span className="font-medium capitalize">{rateBy.get(d.id) ?? "—"}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const { PerformanceTable } = await import("@/modules/assessment/performance-table");
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">This term, across every assessment</h2>
        <Link href={printable} className="text-[14px] font-medium text-primary">Open printable record →</Link>
      </div>
      <div className="mt-3">
        <PerformanceTable schoolId={schoolId} studentId={studentId} classId={cls.id} termId={termId} />
      </div>
    </Card>
  );
}

async function AcademicsTab({ schoolId, studentId, termId }: {
  schoolId: string; studentId: string; termId?: string;
}) {
  const [history, reports, att] = await Promise.all([
    db.select({ year: academicYears.name, className: classes.name, status: enrollments.status })
      .from(enrollments)
      .innerJoin(academicYears, eq(enrollments.yearId, academicYears.id))
      .innerJoin(classes, eq(enrollments.classId, classes.id))
      .where(eq(enrollments.studentId, studentId)),
    db.select({
      termId: reportCards.termId, name: terms.name, published: reportCards.published,
      data: reportCards.data, startsAt: terms.startsAt,
    }).from(reportCards).innerJoin(terms, eq(reportCards.termId, terms.id))
      .where(eq(reportCards.studentId, studentId)).orderBy(terms.startsAt),
    termId
      ? db.select().from(attendanceRecords).where(and(
          eq(attendanceRecords.studentId, studentId), eq(attendanceRecords.termId, termId)))
      : [],
  ]);
  const present = att.filter((a) => a.status !== "absent").length;
  // performance over time: average subject total per term (from the immutable
  // report snapshots), so the office sees the trend at a glance
  const trend = reports
    .filter((r) => r.data.subjects.length > 0)
    .map((r) => ({
      name: r.name,
      avg: Math.round(r.data.subjects.reduce((a, x) => a + x.total, 0) / r.data.subjects.length),
    }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Attendance this term</h2>
        <p className="mt-2 text-[26px] font-semibold" data-nums="">
          {att.length ? `${present}/${att.length}` : "—"}
          <span className="ml-1 text-sm font-normal text-muted-foreground">days present</span>
        </p>
      </Card>
      <Card>
        <h2 className="font-semibold">Report cards</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {reports.map((r) => (
            <li key={r.termId} className="flex justify-between">
              <Link href={`/students/${studentId}/report/${r.termId}`}
                className="text-primary underline-offset-2 hover:underline">{r.name} report</Link>
              <Badge tone={r.published ? "success" : "default"}>{r.published ? "published" : "draft"}</Badge>
            </li>
          ))}
          {reports.length === 0 && <li className="text-muted-foreground">None yet.</li>}
        </ul>
      </Card>
      {trend.length > 0 && (
        <Card className="md:col-span-2">
          <h2 className="font-semibold">Performance over time</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Average score across all subjects, per term.</p>
          <div className="mt-3 space-y-2">
            {trend.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-muted-foreground">{t.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, t.avg)}%` }} />
                </div>
                <span className="w-10 text-right font-medium" data-nums="">{t.avg}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card className="md:col-span-2">
        <h2 className="font-semibold">Enrolment history</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {history.map((h, i) => (
            <li key={i} className="flex justify-between">
              <span>{h.year} — {h.className}</span>
              <span className="capitalize text-muted-foreground">{h.status}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

async function DocumentsTab({ slug, schoolId, studentId, isAdmin }: {
  slug: string; schoolId: string; studentId: string; isAdmin: boolean;
}) {
  const [files, items] = await Promise.all([
    db.select().from(studentFiles)
      .where(and(eq(studentFiles.schoolId, schoolId), eq(studentFiles.studentId, studentId)))
      .orderBy(desc(studentFiles.createdAt)),
    db.select().from(studentItems)
      .where(and(eq(studentItems.schoolId, schoolId), eq(studentItems.studentId, studentId)))
      .orderBy(desc(studentItems.receivedAt)),
  ]);
  const links = new Map<string, string>();
  if (r2Enabled) for (const f of files) links.set(f.id, await presignDownload(f.fileKey));

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold">Digital documents</h2>
        <p className="mt-0.5 text-[14px] text-muted-foreground">
          Scans and uploads linked to this student — birth certificate, immunization card, past reports.
        </p>
        {files.length === 0
          ? <div className="mt-3"><Empty title="No documents yet"
              hint={r2Enabled ? "Upload the first document below." : "Uploads activate once file storage (R2) is configured — use the physical register meanwhile."} /></div>
          : (
            <div className="mt-3">
              <DataTable head={["Document", "Type", "Added", "By", ""]}>
                {files.map((f) => (
                  <Tr key={f.id}>
                    <Td className="font-medium">{f.title}
                      {f.note && <p className="text-[13px] font-normal text-muted-foreground">{f.note}</p>}</Td>
                    <Td><Badge>{f.kind.replace(/_/g, " ")}</Badge></Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{f.createdAt.toISOString().slice(0, 10)}</Td>
                    <Td className="text-muted-foreground">{f.uploadedBy}</Td>
                    <Td>{links.has(f.id) &&
                      <a href={links.get(f.id)} target="_blank" className="text-[14px] font-medium text-primary">Open ↗</a>}</Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
          )}
        {isAdmin && r2Enabled && (
          <div className="mt-4 border-t border-border pt-4">
            <DocumentUploader slug={slug} studentId={studentId} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Physical items in custody</h2>
        <p className="mt-0.5 text-[14px] text-muted-foreground">
          Originals handed to the office — what was received, from whom, and exactly where it is kept.
        </p>
        {items.length === 0
          ? <div className="mt-3"><Empty title="Nothing in custody"
              hint='e.g. "Birth certificate (original) — Office cabinet A, folder 12".' /></div>
          : (
            <div className="mt-3">
              <DataTable head={["Item", "Kept at", "Received", "Status", ""]}>
                {items.map((it) => (
                  <Tr key={it.id}>
                    <Td className="font-medium">{it.itemName}
                      {it.receivedFrom && <p className="text-[13px] font-normal text-muted-foreground">from {it.receivedFrom}</p>}</Td>
                    <Td>{it.location}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {it.receivedAt.toISOString().slice(0, 10)} · {it.receivedBy}</Td>
                    <Td>{it.returnedAt
                      ? <Badge>returned {it.returnedAt.toISOString().slice(0, 10)}</Badge>
                      : <Badge tone="brand">in custody</Badge>}</Td>
                    <Td>
                      {isAdmin && !it.returnedAt && (
                        <form action={returnStudentItem.bind(null, slug, studentId, it.id)}
                          className="flex items-center gap-1">
                          <input name="returnedTo" placeholder="returned to…"
                            className="w-28 rounded-md border border-border px-2 py-1 text-[13px]" />
                          <SubmitButton className="rounded border border-border px-2 py-1 text-[13px] hover:bg-muted">Return</SubmitButton>
                        </form>
                      )}
                    </Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
          )}
        {isAdmin && (
          <form action={addStudentItem.bind(null, slug, studentId)}
            className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Field label="Item"><input name="itemName" required placeholder="Birth certificate (original)" className={inputCls} /></Field>
            <Field label="Kept at (be precise)"><input name="location" required placeholder="Office cabinet A · folder 12" className={inputCls} /></Field>
            <Field label="Received from"><input name="receivedFrom" placeholder="Mother — Akosua Mensah" className={inputCls} /></Field>
            <Field label="Note"><input name="note" className={inputCls} /></Field>
            <SubmitButton className={btnGhostCls + " col-span-2"}>Record item into custody</SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}

async function FeesTab({ slug, schoolId, studentId, paymentNote, isAdmin }: {
  slug: string; schoolId: string; studentId: string; paymentNote: string | null; isAdmin: boolean;
}) {
  const invoices = await db.select().from(feeInvoices)
    .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.studentId, studentId)))
    .orderBy(desc(feeInvoices.createdAt));
  const pays = invoices.length
    ? await db.select().from(feePayments)
        .where(eq(feePayments.invoiceId, invoices[0].id)).orderBy(desc(feePayments.createdAt))
    : [];

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold">Payment arrangement</h2>
        <p className="mt-0.5 text-[14px] text-muted-foreground">
          How and where this family pays — the office memory that survives staff changes.
        </p>
        {isAdmin ? (
          <form action={savePaymentNote.bind(null, slug, studentId)} className="mt-3">
            <textarea name="paymentNote" rows={2} defaultValue={paymentNote ?? ""}
              placeholder='e.g. "Father pays via MoMo 024 XXX XXXX, usually week 2 of term. Backup: GCB Adum branch, standing order."'
              className={inputCls} />
            <SubmitButton className={btnGhostCls + " mt-2"} pendingText="Saving…">Save arrangement</SubmitButton>
          </form>
        ) : (
          <p className="mt-2 text-sm">{paymentNote ?? "—"}</p>
        )}
      </Card>

      {isAdmin && <FeeArrangements slug={slug} schoolId={schoolId} studentId={studentId} />}

      <Card>
        <h2 className="font-semibold">Invoices</h2>
        <div className="mt-3">
          <DataTable head={["Raised", "Total", "Paid", "Balance", "Status", ""]}>
            {invoices.map((i) => (
              <Tr key={i.id}>
                <Td className="text-muted-foreground">{i.createdAt.toISOString().slice(0, 10)}</Td>
                <Td data-nums="">{ghs(i.totalPesewas)}</Td>
                <Td data-nums="" className="text-success">{ghs(i.paidPesewas)}</Td>
                <Td data-nums="" className={i.totalPesewas - i.paidPesewas > 0 ? "text-danger" : "text-success"}>
                  {ghs(i.totalPesewas - i.paidPesewas)}</Td>
                <Td><Badge tone={i.status === "paid" ? "success" : i.status === "part_paid" ? "warning" : "danger"}>
                  {i.status.replace("_", " ")}</Badge></Td>
                <Td><Link href={`/fees/invoice/${i.id}`} className="text-[12.5px] font-medium text-primary">open →</Link></Td>
              </Tr>
            ))}
          </DataTable>
        </div>
        {pays.length > 0 && (
          <div className="mt-3 text-[13px] text-muted-foreground">
            <p className="font-medium text-foreground">Payment trail (latest invoice)</p>
            {pays.map((p) => (
              <p key={p.id}>{p.createdAt.toISOString().slice(0, 10)} · {ghs(p.amountPesewas)} · via {p.method}
                {p.receiptNo ? ` · receipt ${p.receiptNo}` : ""}{p.voidedAt ? " · VOID" : ""}</p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Fee assignment inputs for THIS child: transport flag, scholarships,
 *  one-off adjustments — the office's levers, all with a paper trail. */
async function FeeArrangements({ slug, schoolId, studentId }: {
  slug: string; schoolId: string; studentId: string;
}) {
  const { scholarships, studentScholarships, feeAdjustments } = await import("@/db/schema");
  const { setTransportRider, grantScholarship, revokeScholarship, addAdjustment } =
    await import("../../fees/actions");
  const [[s], schols, mine, adjs] = await Promise.all([
    db.select({ transportRider: students.transportRider }).from(students).where(eq(students.id, studentId)),
    db.select().from(scholarships).where(and(eq(scholarships.schoolId, schoolId), eq(scholarships.active, true))),
    db.select().from(studentScholarships).where(and(
      eq(studentScholarships.schoolId, schoolId), eq(studentScholarships.studentId, studentId))),
    db.select().from(feeAdjustments).where(and(
      eq(feeAdjustments.schoolId, schoolId), eq(feeAdjustments.studentId, studentId)))
      .orderBy(desc(feeAdjustments.createdAt)).limit(6),
  ]);
  const mineIds = new Set(mine.map((m) => m.scholarshipId));

  return (
    <Card>
      <h2 className="font-semibold">Fee arrangement for this child</h2>
      <form action={setTransportRider.bind(null, slug, studentId)} className="mt-2.5 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[13.5px]">
          <input type="checkbox" name="rider" defaultChecked={s?.transportRider} />
          Uses school transport (transport fees apply)
        </label>
        <SubmitButton className={btnGhostCls + " px-2.5 py-1 text-[12.5px]"} pendingText="…">Save</SubmitButton>
      </form>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[13px] font-semibold">Scholarships &amp; discounts</p>
        <ul className="mt-1.5 space-y-1 text-[13px]">
          {mine.map((m) => {
            const sc = schols.find((x) => x.id === m.scholarshipId);
            return (
              <li key={m.scholarshipId} className="flex items-center justify-between gap-2">
                <span>{sc?.name ?? "—"}
                  <span className="ml-2 text-[11.5px] text-muted-foreground">granted by {m.grantedBy}{m.note ? ` · ${m.note}` : ""}</span>
                </span>
                <SubmitButton formAction={revokeScholarship.bind(null, slug, studentId, m.scholarshipId)}
                  className="text-[11.5px] text-danger underline-offset-2 hover:underline" pendingText="…">remove</SubmitButton>
              </li>
            );
          })}
          {!mine.length && <li className="text-muted-foreground">None.</li>}
        </ul>
        {schols.some((sc) => !mineIds.has(sc.id)) && (
          <form action={grantScholarship.bind(null, slug, studentId)} className="mt-2 flex flex-wrap items-end gap-2">
            <select name="scholarshipId" className={inputCls + " w-48"}>
              {schols.filter((sc) => !mineIds.has(sc.id)).map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
            <input name="note" placeholder="note (why)" className={inputCls + " w-40"} />
            <SubmitButton className={btnGhostCls} pendingText="…">Grant</SubmitButton>
          </form>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[13px] font-semibold">One-off adjustment</p>
        <p className="text-[12px] text-muted-foreground">
          Positive bills more (a fine, a lost book); negative waives. Applies to this term&apos;s
          bill — instantly if it&apos;s already issued.
        </p>
        <form action={addAdjustment.bind(null, slug, studentId)} className="mt-2 flex flex-wrap items-end gap-2">
          <input name="amountGhs" type="number" step="0.01" required placeholder="±GHS" className={inputCls + " w-24"} />
          <input name="reason" required placeholder="reason (required)" className={inputCls + " w-56"} />
          <SubmitButton className={btnGhostCls} pendingText="…">Apply</SubmitButton>
        </form>
        {adjs.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground" data-nums="">
            {adjs.map((a) => (
              <li key={a.id}>{a.createdAt.toISOString().slice(0, 10)} · {ghs(a.amountPesewas)} · {a.reason} · by {a.createdBy}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
