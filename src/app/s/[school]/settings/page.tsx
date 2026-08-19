import { eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, terms, levels, classes, subjects, staff, gradingSchemes, rooms } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { LEVEL_TEMPLATE } from "@/lib/levels";
import { createYear, setCurrentTerm, setupLevels, addClass, saveBranding } from "../actions";
import { setClassTeacher } from "../accounts-actions";
import { addRoom, deleteRoom, setClassRoom } from "../actions-rooms";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { GradingEditor } from "./grading";
import { LogoUploader } from "./logo";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { SubmitButton } from "@/ui/feedback";

export default async function Settings({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [yrs, tms, lvs, cls, subs, tchs, rms] = await Promise.all([
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
    db.select().from(staff).where(eq(staff.schoolId, school.id)),
    db.select().from(rooms).where(eq(rooms.schoolId, school.id)).orderBy(rooms.name),
  ]);
  const [scheme] = await db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, school.id));
  const b = school.branding;
  const logoUrl = b.logoUrl && r2Enabled ? await presignDownload(b.logoUrl) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="School Settings" sub="Academic setup, structure and branding" />

      <Card>
        <h2 className="font-semibold">Academic year & terms</h2>
        {yrs.map((y) => (
          <div key={y.id} className="mt-3 text-sm">
            <p className="font-medium">{y.name} {y.isCurrent && <span className="text-success">· current</span>}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {tms.filter((t) => t.yearId === y.id).map((t) => (
                <form key={t.id} action={setCurrentTerm.bind(null, slug, t.id)}>
                  <button className={t.isCurrent ? btnCls : btnGhostCls}>{t.name}</button>
                </form>
              ))}
            </div>
          </div>
        ))}
        <form action={createYear.bind(null, slug)} className="mt-4 grid grid-cols-3 gap-3">
          <Field label="Year name"><input name="name" placeholder="2025/2026" required className={inputCls} /></Field>
          <Field label="Starts"><input name="startsAt" type="date" required className={inputCls} /></Field>
          <Field label="Ends"><input name="endsAt" type="date" required className={inputCls} /></Field>
          <SubmitButton className={btnCls + " col-span-3"}>Create year (3 terms auto-created)</SubmitButton>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">Levels, classes & subjects</h2>
        {lvs.length === 0 ? (
          <form action={setupLevels.bind(null, slug)} className="mt-3">
            <p className="text-sm text-muted-foreground">Tick the levels your school runs — one class per level and the standard subject list are created for you.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {LEVEL_TEMPLATE.map(([code, name]) => (
                <label key={code} className="flex items-center gap-2">
                  <input type="checkbox" name={`lv_${code}`} defaultChecked /> {name}
                </label>
              ))}
            </div>
            <SubmitButton className={btnCls + " mt-4"}>Create structure</SubmitButton>
          </form>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {cls.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <form action={setClassTeacher.bind(null, slug, c.id)} className="flex items-center gap-1">
                    <select name="staffId" defaultValue={c.classTeacherId ?? ""}
                      className="rounded-md border border-border px-2 py-1 text-xs">
                      <option value="">No class teacher</option>
                      {tchs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Set</button>
                  </form>
                  <form action={setClassRoom.bind(null, slug, c.id)} className="flex items-center gap-1">
                    <select name="roomId" defaultValue={c.roomId ?? ""}
                      className="rounded-md border border-border px-2 py-1 text-xs">
                      <option value="">No home room</option>
                      {rms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Set</button>
                  </form>
                </div>
              </div>
            ))}
            <form action={addClass.bind(null, slug)} className="mt-3 flex items-end gap-2">
              <Field label="Level">
                <select name="levelId" className={inputCls}>
                  {lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Class name"><input name="name" placeholder="Basic 4 B" required className={inputCls} /></Field>
              <SubmitButton className={btnCls}>Add class</SubmitButton>
            </form>
            <p className="mt-2 text-muted-foreground">Subjects: {subs.map((s) => s.name).join(", ")}</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Rooms & facilities</h2>
        <p className="text-sm text-muted-foreground">
          Physical spaces — classrooms, labs, library, hall. Assign a home room to each class above; the timetable and reports can refer to them.
        </p>
        {rms.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {rms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-xs capitalize text-muted-foreground">
                    {r.kind.replace(/_/g, " ")}{r.capacity ? ` · seats ${r.capacity}` : ""}{r.notes ? ` · ${r.notes}` : ""}
                  </span>
                </span>
                <form action={deleteRoom.bind(null, slug, r.id)}>
                  <button className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-muted">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addRoom.bind(null, slug)} className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <Field label="Room name"><input name="name" required placeholder="Science Lab" className={inputCls} /></Field>
          <Field label="Type">
            <select name="kind" className={inputCls}>
              {[["classroom", "Classroom"], ["science_lab", "Science lab"], ["ict_lab", "ICT lab"],
                ["library", "Library"], ["hall", "Hall"], ["office", "Office"], ["other", "Other"]]
                .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Capacity"><input name="capacity" type="number" min={1} placeholder="35" className={inputCls} /></Field>
          <Field label="Notes"><input name="notes" placeholder="Block B, upstairs" className={inputCls} /></Field>
          <SubmitButton className={btnGhostCls + " col-span-2 sm:col-span-4"}>Add room</SubmitButton>
        </form>
      </Card>

      <GradingEditor slug={slug}
        caWeight={scheme?.caWeight ?? 50} examWeight={scheme?.examWeight ?? 50}
        bands={scheme?.bands ?? [
          { min: 80, grade: "1", remark: "Excellent" }, { min: 70, grade: "2", remark: "Very Good" },
          { min: 60, grade: "3", remark: "Good" }, { min: 55, grade: "4", remark: "Credit" },
          { min: 50, grade: "5", remark: "Average" }, { min: 40, grade: "6", remark: "Below Average" },
          { min: 35, grade: "7", remark: "Pass" }, { min: 30, grade: "8", remark: "Weak Pass" },
          { min: 0, grade: "9", remark: "Fail" }]} />

      <Card>
        <h2 className="font-semibold">Branding</h2>
        <p className="text-sm text-muted-foreground">Used on report cards, invoices, receipts, emails and SMS.</p>
        <form action={saveBranding.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Motto"><input name="motto" defaultValue={b.motto} className={inputCls} /></Field>
          <Field label="Primary color"><input name="primaryColor" defaultValue={b.primaryColor} placeholder="#5E1D3E" className={inputCls} /></Field>
          <Field label="Address"><input name="address" defaultValue={b.address} className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={b.phone} className={inputCls} /></Field>
          <Field label="Email"><input name="email" defaultValue={b.email} className={inputCls} /></Field>
          <Field label="SMS sender ID"><input name="smsSenderId" defaultValue={b.smsSenderId} maxLength={11} className={inputCls} /></Field>
          <SubmitButton className={btnCls + " col-span-2"} pendingText="Saving…">Save branding</SubmitButton>
        </form>
        <div className="mt-4"><LogoUploader slug={slug} enabled={r2Enabled} currentUrl={logoUrl} /></div>
      </Card>

      <Card>
        <h2 className="font-semibold text-danger">Year end</h2>
        <p className="text-sm text-muted-foreground">
          Guided promotion: choose each class&apos;s destination, tick the students repeating,
          graduate the top level, and open the new academic year — in one pass.
        </p>
        <a href="/settings/promotion" className={btnCls + " mt-3 inline-block bg-danger"}>Start year-end promotion</a>
      </Card>
    </div>
  );
}
