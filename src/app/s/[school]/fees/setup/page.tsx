import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { feeTypes, feeItems, scholarships, levels, terms, academicYears } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { canFeeAction } from "@/core/access";
import { getFeesConfig } from "@/modules/fees/config";
import {
  addFeeType, updateFeeType, deleteFeeType, saveFeeItem, copyItemsFromTerm,
  addScholarship, deleteScholarship, saveFeesSettings,
} from "../actions";
import { Card, Field, PageHeader, Badge, Empty, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

const KINDS = [["tuition", "Tuition"], ["feeding", "Feeding"], ["transport", "Transport"],
  ["exam", "Exam"], ["pta", "PTA"], ["admission", "Admission (bills once)"],
  ["fine", "Fine"], ["other", "Other"]] as const;

/** The fee catalog & money settings — admin-defined, no student in sight.
 *  Amounts here feed generation; issued invoices never change with them. */
export default async function FeesSetup({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "fees", ["admin"]);
  if (!(await canFeeAction(school.id, user.id, user.role, "catalog"))) {
    return <Empty title="Catalog access needed"
      hint="Your access doesn't cover the fee catalog — ask a full admin under Settings → Team & access." />;
  }
  const term = await getCurrentTerm(school.id);
  if (!term) return <Empty title="No academic year yet" hint="Set up your year and terms in Settings first." />;
  const cfg = getFeesConfig(school.settings);

  const [types, items, schols, lvs, allTerms, yrs] = await Promise.all([
    db.select().from(feeTypes).where(eq(feeTypes.schoolId, school.id)).orderBy(feeTypes.sortOrder, feeTypes.name),
    db.select().from(feeItems).where(and(eq(feeItems.schoolId, school.id), eq(feeItems.termId, term.id))),
    db.select().from(scholarships).where(eq(scholarships.schoolId, school.id)),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
  ]);
  const yearName = new Map(yrs.map((y) => [y.id, y.name]));
  const itemFor = (typeId: string, levelId: string) =>
    items.find((i) => i.feeTypeId === typeId && i.levelId === levelId && !i.classId);
  const prevTerms = allTerms.filter((x) => x.id !== term.id && x.startsAt < term.startsAt)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 3);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Fee catalog & settings"
        sub={`${term.year?.name} · ${term.name} — what the school charges; issued invoices never move with edits here`}
        action={{ href: "/fees", label: "← Fees desk" }} />

      {/* ── amounts grid: types × levels ── */}
      <Card className="mb-5 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Amounts for {term.name}</h2>
          {prevTerms.length > 0 && items.length === 0 && (
            <form action={copyItemsFromTerm.bind(null, slug, prevTerms[0].id)}>
              <SubmitButton className={btnGhostCls + " text-[12.5px]"} pendingText="Copying…">
                Copy from {yearName.get(prevTerms[0].yearId)} {prevTerms[0].name}
              </SubmitButton>
            </form>
          )}
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Set an amount per level (blank = the level doesn&apos;t pay it). Transport applies only to
          children flagged as riders on their student file.
        </p>
        {types.length === 0 && (
          <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-[13px]">
            Add your fee types below first — Tuition, Feeding, PTA and so on.
          </p>
        )}
        <table className="mt-3 w-max min-w-full text-[13px]" data-nums="">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1.5 pr-3">Level</th>
              {types.map((tp) => (
                <th key={tp.id} className="px-2 py-1.5">
                  {tp.name}
                  {!tp.recurring && <span className="ml-1 font-normal normal-case text-faint">(once)</span>}
                  {tp.optional && <span className="ml-1 font-normal normal-case text-faint">(riders)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lvs.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="py-1.5 pr-3 font-medium">{l.name}</td>
                {types.map((tp) => {
                  const it = itemFor(tp.id, l.id);
                  return (
                    <td key={tp.id} className="px-2 py-1">
                      <form action={saveFeeItem.bind(null, slug)} className="flex items-center gap-1">
                        <input type="hidden" name="feeTypeId" value={tp.id} />
                        <input type="hidden" name="levelId" value={l.id} />
                        <input name="amountGhs" type="number" step="0.01" min="0"
                          defaultValue={it ? (it.amountPesewas / 100).toFixed(2) : ""}
                          placeholder="—" className="w-20 rounded-md border border-border px-2 py-1 text-[12.5px]" />
                        <SubmitButton className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted" pendingText="…">✓</SubmitButton>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid items-start gap-5 md:grid-cols-2">
        {/* ── fee types ── */}
        <Card>
          <h2 className="font-semibold">Fee types</h2>
          <ul className="mt-2 divide-y divide-border">
            {types.map((tp) => (
              <li key={tp.id} className="py-2">
                <form action={updateFeeType.bind(null, slug, tp.id)} className="flex flex-wrap items-center gap-1.5">
                  <input name="name" defaultValue={tp.name} className="w-32 rounded-md border border-border px-2 py-1 text-[13px]" />
                  <select name="kind" defaultValue={tp.kind} className="rounded-md border border-border px-1.5 py-1 text-[12px]">
                    {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select name="recurring" defaultValue={tp.recurring ? "termly" : "once"}
                    className="rounded-md border border-border px-1.5 py-1 text-[12px]">
                    <option value="termly">every term</option><option value="once">bills once</option>
                  </select>
                  <label className="flex items-center gap-1 text-[12px] text-muted-foreground"
                    title="Applies only to students flagged as transport riders">
                    <input type="checkbox" name="optional" defaultChecked={tp.optional} /> riders only
                  </label>
                  <SubmitButton className="rounded border border-border px-2 py-1 text-[11.5px] hover:bg-muted" pendingText="…">Save</SubmitButton>
                  <SubmitButton formAction={deleteFeeType.bind(null, slug, tp.id)}
                    className="text-[11.5px] text-danger underline-offset-2 hover:underline" pendingText="…">remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
          <form action={addFeeType.bind(null, slug)} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <Field label="New type"><input name="name" required placeholder="Feeding" className={inputCls} /></Field>
            <Field label="Kind">
              <select name="kind" className={inputCls}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <SubmitButton className={btnGhostCls}>Add type</SubmitButton>
          </form>
        </Card>

        {/* ── scholarships ── */}
        <Card>
          <h2 className="font-semibold">Scholarships & discounts</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Sibling discounts, staff children, sponsorships. Granted per child on the student
            file — every grant records who gave it and why.
          </p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {schols.map((sc) => (
              <li key={sc.id} className="flex items-center justify-between gap-2 py-1.5">
                <span data-nums="">
                  <b>{sc.name}</b>
                  <span className="ml-2 text-muted-foreground">
                    {sc.kind === "percent" ? `${sc.value}% off` : `GHS ${(sc.value / 100).toFixed(2)} off`}
                    {sc.feeTypeId ? ` ${types.find((tp) => tp.id === sc.feeTypeId)?.name ?? ""}` : " the whole bill"}
                  </span>
                </span>
                <form action={deleteScholarship.bind(null, slug, sc.id)}>
                  <SubmitButton className="text-[11.5px] text-danger underline-offset-2 hover:underline" pendingText="…">remove</SubmitButton>
                </form>
              </li>
            ))}
            {!schols.length && <li className="py-1.5 text-sm text-muted-foreground">None yet.</li>}
          </ul>
          <form action={addScholarship.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            <Field label="Name"><input name="name" required placeholder="Sibling discount" className={inputCls} /></Field>
            <Field label="Applies to">
              <select name="feeTypeId" className={inputCls}>
                <option value="">Whole bill</option>
                {types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name} only</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select name="kind" className={inputCls}>
                <option value="percent">Percent off</option><option value="fixed">Fixed GHS off</option>
              </select>
            </Field>
            <Field label="Value"><input name="value" type="number" step="0.01" min="0.01" required className={inputCls} /></Field>
            <SubmitButton className={btnGhostCls + " col-span-2"}>Add scholarship</SubmitButton>
          </form>
        </Card>
      </div>

      {/* ── money settings ── */}
      <Card className="mt-5">
        <h2 className="font-semibold">Money settings</h2>
        <form action={saveFeesSettings.bind(null, slug)} className="mt-3 max-w-xl space-y-3">
          <Field label="Payment channels shown to parents (one per line, exactly as they should read)">
            <textarea name="channelsText" rows={3} defaultValue={cfg.channelsText}
              placeholder={"MTN MoMo 024 XXX XXXX — YOUR SCHOOL\nCash at the school office"} className={inputCls} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Confirmation phone (parents call before sending money)">
              <input name="confirmPhone" defaultValue={cfg.confirmPhone} placeholder="030 XXX XXXX" className={inputCls} />
            </Field>
            <Field label="Invoices due (weeks after term starts)">
              <input name="dueWeeks" type="number" min={1} max={12} defaultValue={cfg.dueWeeks} className={inputCls} />
            </Field>
          </div>
          <Field label="Fee clearance on exits & leaving certificates">
            <select name="clearanceGate" defaultValue={cfg.clearanceGate} className={inputCls}>
              <option value="warn">Warn — show the balance, allow proceeding</option>
              <option value="block">Block until cleared or waived</option>
              <option value="off">Off — no check</option>
            </select>
          </Field>
          <div className="flex items-center gap-3">
            <SubmitButton className={btnCls} pendingText="Saving…">Save money settings</SubmitButton>
            <Badge tone="default">Receipts number themselves: {new Date().getFullYear()}-000123</Badge>
          </div>
          <p className="text-[12px] text-muted-foreground">
            The fraud warning always shows with these details — on the fee stub, on invoices and in
            emails. It cannot be switched off.
          </p>
        </form>
      </Card>
      <p className="mt-4 text-[12.5px] text-muted-foreground">
        Transport flags, scholarships and one-off adjustments per child live on the{" "}
        <Link href="/students" className="font-medium text-primary">student file</Link> → Fees &amp; Payments tab.
      </p>
    </div>
  );
}
