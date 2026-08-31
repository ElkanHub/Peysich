import Link from "next/link";
import { requireModule } from "@/core/school-context";
import { getStructure, SECTIONS, SECTION_LABELS, type Section } from "@/core/academics";
import { PageHeader, Card, Badge, Field, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import {
  saveScheme, saveSkillScale, addSkillArea, renameSkillArea, deleteSkillArea,
} from "./actions";

const ERR: Record<string, string> = {
  dupname: "Two entries carry the same name — every name must be unique.",
  noname: "Every component needs a name.",
  scale2: "The rating scale needs at least two labels.",
  hasmarks: "A component you're removing already has marks recorded — tick “I understand, remove anyway” to confirm.",
  hasratings: "That area already has children rated in it — tick the confirm box to remove it along with those ratings.",
};

/** ONE home for how each section is assessed: preschool configures the skills
 *  list and its rating scale; primary/JHS configure the named tests + exam
 *  whose weights must land on exactly 100. */
export default async function AssessmentScheme({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ s?: string; err?: string; t?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const S = await getStructure(school.id);
  const section = (SECTIONS.includes(sp.s as Section) ? sp.s : "primary") as Section;
  const skills = section === "preschool";
  const comps = S.componentsFor(section);
  const total = comps.reduce((a, c) => a + c.weight, 0);
  const scale = S.skillScaleFor(section);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Assessment scheme"
        sub="What each section is assessed on — score sheets, publishing and report cards all follow this." />

      {sp.err && (ERR[sp.err] || sp.err === "total") && (
        <div className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {sp.err === "total"
            ? `The weights must add up to exactly 100 — right now they total ${sp.t}.`
            : ERR[sp.err]}
          <span className="block text-[13px] opacity-80">Nothing was saved — adjust and try again.</span>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {SECTIONS.map((s) => (
          <Link key={s} href={`?s=${s}`}
            className={`rounded-md border px-3.5 py-1.5 text-sm font-medium ${s === section
              ? "border-primary/40 bg-brand-container text-on-brand-container"
              : "border-border hover:bg-muted"}`}>
            {SECTION_LABELS[s]}
          </Link>
        ))}
      </div>

      {skills ? (
        <>
          {/* ── rating scale ── */}
          <Card className="mb-5">
            <h2 className="font-semibold">Rating scale</h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              The steps a child can be rated on, lowest first. The skills grid cycles through these.
            </p>
            <form action={saveSkillScale.bind(null, slug)} className="mt-3">
              <input type="hidden" name="section" value={section} />
              <div className="flex flex-wrap items-center gap-2">
                {scale.map((l, i) => (
                  <input key={i} name="label" defaultValue={l} className={inputCls + " w-32"} />
                ))}
                <input name="label" placeholder="Add a step…" className={inputCls + " w-32"} />
              </div>
              <SubmitButton className={btnCls + " mt-3"} pendingText="Saving…">Save scale</SubmitButton>
              <span className="ml-3 text-[13px] text-muted-foreground">Clear a box to remove that step.</span>
            </form>
          </Card>

          {/* ── skill areas ── */}
          <Card>
            <h2 className="font-semibold">Skills assessed</h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              The areas every preschool child is rated on. Rename freely — removing an area
              also removes any ratings already given in it.
            </p>
            <ul className="mt-3 space-y-2">
              {S.skillDomains.map((d) => (
                <li key={d.id}>
                  <form action={renameSkillArea.bind(null, slug, d.id)}
                    className="flex flex-wrap items-center gap-2">
                    <input name="name" defaultValue={d.name} className={inputCls + " w-56"} />
                    <SubmitButton className={btnGhostCls + " px-2.5 py-1.5 text-[13.5px]"} pendingText="…">Save</SubmitButton>
                    <SubmitButton formAction={deleteSkillArea.bind(null, slug, d.id)}
                      className="rounded-md px-2 py-1.5 text-[13.5px] text-danger hover:bg-danger/10" pendingText="…">
                      Remove
                    </SubmitButton>
                    <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <input type="checkbox" name="confirm" /> confirm removal if rated
                    </label>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addSkillArea.bind(null, slug)} className="mt-4 flex items-end gap-2 border-t border-border pt-3">
              <Field label="New skill area">
                <input name="name" required placeholder="e.g. Listening & Attention" className={inputCls + " w-64"} />
              </Field>
              <SubmitButton className={btnCls} pendingText="Adding…">Add area</SubmitButton>
            </form>
          </Card>
        </>
      ) : (
        /* ── test scheme for primary / jhs ── */
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{SECTION_LABELS[section]} marking scheme</h2>
            <span className={`text-sm font-semibold ${total === 100 ? "text-success" : "text-danger"}`} data-nums="">
              Total: {total}/100 {total === 100 ? "✓" : "— must be 100"}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Name the tests the way your school calls them. Each weight is the marks that
            component carries out of the final 100 — teachers can mark over any number
            (say, 30) and it converts automatically.
          </p>
          <form action={saveScheme.bind(null, slug)} className="mt-4">
            <input type="hidden" name="section" value={section} />
            <div className="space-y-2">
              {comps.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <input name={`name_${c.id}`} defaultValue={c.name} className={inputCls + " w-52"} />
                  <span className="text-[13px] text-muted-foreground">weight</span>
                  <input name={`weight_${c.id}`} type="number" min={0} max={100}
                    defaultValue={c.weight} className={inputCls + " w-20"} data-nums="" />
                  {c.isExam ? (
                    <Badge tone="brand">exam — publishes with the report</Badge>
                  ) : (
                    <label className="ml-auto flex items-center gap-1.5 text-[13px] text-danger">
                      <input type="checkbox" name={`del_${c.id}`} /> remove
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <Field label="Add a test">
                <input name="newName" placeholder="e.g. Class Test 4" className={inputCls + " w-52"} />
              </Field>
              <Field label="Weight">
                <input name="newWeight" type="number" min={0} max={100} className={inputCls + " w-20"} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SubmitButton className={btnCls} pendingText="Saving…">Save scheme</SubmitButton>
              <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <input type="checkbox" name="confirmDelete" /> I understand, remove ticked tests even if they hold marks
              </label>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Saving refuses unless the weights total exactly 100, so the terminal report always tallies.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
