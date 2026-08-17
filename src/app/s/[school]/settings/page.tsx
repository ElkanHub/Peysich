import { eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, terms, levels, classes, subjects } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { LEVEL_TEMPLATE } from "@/lib/levels";
import { createYear, setCurrentTerm, setupLevels, addClass, saveBranding, promoteAll } from "../actions";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";

export default async function Settings({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [yrs, tms, lvs, cls, subs] = await Promise.all([
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
  ]);
  const b = school.branding;

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
          <button className={btnCls + " col-span-3"}>Create year (3 terms auto-created)</button>
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
            <button className={btnCls + " mt-4"}>Create structure</button>
          </form>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {lvs.map((l) => (
              <p key={l.id}><span className="font-medium">{l.name}:</span>{" "}
                {cls.filter((c) => c.levelId === l.id).map((c) => c.name).join(", ") || "—"}</p>
            ))}
            <form action={addClass.bind(null, slug)} className="mt-3 flex items-end gap-2">
              <Field label="Level">
                <select name="levelId" className={inputCls}>
                  {lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Class name"><input name="name" placeholder="Basic 4 B" required className={inputCls} /></Field>
              <button className={btnCls}>Add class</button>
            </form>
            <p className="mt-2 text-muted-foreground">Subjects: {subs.map((s) => s.name).join(", ")}</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Branding</h2>
        <p className="text-sm text-muted-foreground">Used on report cards, invoices, receipts, emails and SMS.</p>
        <form action={saveBranding.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Motto"><input name="motto" defaultValue={b.motto} className={inputCls} /></Field>
          <Field label="Primary color"><input name="primaryColor" defaultValue={b.primaryColor} placeholder="#4338ca" className={inputCls} /></Field>
          <Field label="Address"><input name="address" defaultValue={b.address} className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={b.phone} className={inputCls} /></Field>
          <Field label="Email"><input name="email" defaultValue={b.email} className={inputCls} /></Field>
          <Field label="SMS sender ID"><input name="smsSenderId" defaultValue={b.smsSenderId} maxLength={11} className={inputCls} /></Field>
          <button className={btnCls + " col-span-2"}>Save branding</button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-danger">Year end</h2>
        <p className="text-sm text-muted-foreground">Promote all students one level up; top level graduates to alumni. Creates the new academic year.</p>
        <form action={promoteAll.bind(null, slug)} className="mt-3 flex items-end gap-2">
          <Field label="New year name"><input name="yearName" placeholder="2026/2027" className={inputCls} /></Field>
          <button className={btnCls + " bg-danger"}>Promote all students</button>
        </form>
      </Card>
    </div>
  );
}
