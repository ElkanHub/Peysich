import Link from "next/link";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { getStudentSelf, getParentChildren } from "@/core/portal";
import {
  getStructure, SECTIONS, SECTION_LABELS, DAYS, DAY_LABELS, fmtMin,
  type Day, type Section, type Structure,
} from "@/core/academics";
import { PageHeader, Card, Empty, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { placeEntry, clearEntry } from "./actions";

const ERR: Record<string, string> = {
  clash: "", // detail carries the message
  notsubject: "That subject isn't on this class's list — adjust it under Settings → Day plan & subjects.",
};

/** Short label so a grid cell stays a grid cell. */
function abbr(name: string) {
  const known: Record<string, string> = {
    "Mathematics": "Maths", "English Language": "English", "Ghanaian Language": "Ghanaian",
    "Religious & Moral Education": "RME", "Our World Our People": "OWOP",
    "Creative Arts": "Cr. Arts", "Social Studies": "Soc. Studies",
  };
  if (known[name]) return known[name];
  return name.length > 13 ? name.split(/\s+/).map((w) => w[0]).join("").toUpperCase() : name;
}

const KIND_TINT: Record<string, string> = {
  assembly: "bg-primary/5 text-primary/70",
  break: "bg-warning/10 text-warning",
  lunch: "bg-warning/10 text-warning",
};

/** One class's week: rows = days, columns = the section's period slots. */
function ClassGrid({ S, classId, base, sel, canEdit, focusSubjectId }: {
  S: Structure; classId: string; base: string; sel?: string;
  canEdit: boolean; focusSubjectId?: string;
}) {
  const cls = S.classById.get(classId);
  if (!cls) return null;
  const slots = S.slotsBySection(S.sectionOfClass(cls));
  const mine = S.entries.filter((e) => e.classId === classId);
  const at = new Map(mine.map((e) => [`${e.day}:${e.slotId}`, e]));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-muted/60">
            <th className="border-b border-r border-border px-2 py-2 text-left font-semibold"></th>
            {slots.map((sl) => (
              <th key={sl.id} className={`border-b border-border px-1.5 py-1.5 text-center font-medium ${sl.kind !== "teaching" ? "text-muted-foreground" : ""}`}>
                <div>{sl.name}</div>
                <div className="text-[10px] font-normal text-faint" data-nums="">{fmtMin(sl.startMin)}–{fmtMin(sl.endMin)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d} className="border-t border-border">
              <td className="border-r border-border px-2 py-2 font-semibold">{DAY_LABELS[d].slice(0, 3)}</td>
              {slots.map((sl) => {
                if (sl.kind !== "teaching") {
                  return <td key={sl.id} className={`px-1.5 py-2 text-center text-[10px] uppercase tracking-wide ${KIND_TINT[sl.kind] ?? "bg-muted/40 text-faint"}`}>{sl.kind === "assembly" ? "🏫" : "☕"}</td>;
                }
                const e = at.get(`${d}:${sl.id}`);
                const isSel = sel === `${d}:${sl.id}`;
                const dim = focusSubjectId && e && e.subjectId !== focusSubjectId;
                const inner = e
                  ? <span className={dim ? "text-faint" : "font-medium"}>{abbr(S.subjectById.get(e.subjectId)?.name ?? "?")}</span>
                  : canEdit ? <span className="text-faint">+</span> : <span className="text-faint">·</span>;
                const cell = (e || canEdit)
                  ? <Link href={`${base}&sel=${d}:${sl.id}`} className="block px-1 py-2">{inner}</Link>
                  : <span className="block px-1 py-2">{inner}</span>;
                return (
                  <td key={sl.id}
                    className={`text-center align-middle ${isSel ? "bg-primary/10 ring-1 ring-inset ring-primary" : e && !dim ? "bg-success/5" : ""} ${focusSubjectId && e?.subjectId === focusSubjectId ? "bg-primary/10" : ""}`}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Timetable({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ view?: string; c?: string; t?: string; sub?: string; sec?: string; d?: string; sel?: string; err?: string; detail?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school, user } = await requireModule(slug, "timetable");
  const S = await getStructure(school.id);
  const isAdmin = ["admin", "platform_admin"].includes(user.role);

  // ── role scoping: which classes / which teacher can this viewer see? ──
  let allowedClassIds: Set<string> | null = null; // null = all
  let selfStaffId: string | null = null;
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    allowedClassIds = scope ? scope.allClassIds : new Set();
    selfStaffId = scope?.staffId ?? null;
  } else if (user.role === "student") {
    const me = await getStudentSelf(school.id, user.id);
    allowedClassIds = new Set(me?.classId ? [me.classId] : []);
  } else if (user.role === "parent") {
    const kids = await getParentChildren(school.id, user.id);
    allowedClassIds = new Set(kids.map((k) => k.classId).filter(Boolean) as string[]);
  }

  const visibleClasses = S.classes
    .filter((c) => !allowedClassIds || allowedClassIds.has(c.id))
    .sort((a, b) => (S.levelById.get(a.levelId)?.sortOrder ?? 0) - (S.levelById.get(b.levelId)?.sortOrder ?? 0) || a.name.localeCompare(b.name));

  const tabs = isAdmin
    ? (["class", "teacher", "subject", "level"] as const)
    : user.role === "teacher" ? (["teacher", "class"] as const) : (["class"] as const);
  const view = (tabs as readonly string[]).includes(sp.view ?? "") ? sp.view! : tabs[0];

  const clashes = isAdmin ? S.findClashes() : [];
  const detailMsg = sp.err === "clash" && sp.detail ? sp.detail : sp.err ? ERR[sp.err] : null;

  // ── shared bits ──
  const header = (
    <>
      <PageHeader title="Timetable"
        sub={isAdmin ? "Click any period to see details or place a lesson — who teaches it follows your allocations automatically." : "Click any period for its details."} />
      {detailMsg && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{detailMsg}</p>
      )}
      {clashes.length > 0 && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">⚠ {clashes.length} timetable clash{clashes.length === 1 ? "" : "es"}</p>
          <ul className="mt-1.5 space-y-1 text-[13px]">
            {clashes.slice(0, 6).map((cl, i) => (
              <li key={i}>
                <b>{cl.teacherName}</b> is double-booked {DAY_LABELS[cl.day]} {cl.time}: {cl.classes.join(" and ")}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Usually caused by changing allocations after lessons were placed — move one of the lessons, or change the allocation.
          </p>
        </div>
      )}
      {tabs.length > 1 && (
        <div className="mb-5 flex gap-2">
          {tabs.map((v) => (
            <Link key={v} href={`?view=${v}`}
              className={`rounded-md border px-3.5 py-1.5 text-sm font-medium capitalize ${v === view ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {v === "level" ? "Level" : v} timetable
            </Link>
          ))}
        </div>
      )}
    </>
  );

  /* ═══ CLASS VIEW ═══ */
  if (view === "class") {
    const active = visibleClasses.find((c) => c.id === sp.c) ?? visibleClasses[0];
    if (!active) return <div>{header}<Empty title="No timetable yet" hint="No classes are linked to your account." /></div>;
    const base = `?view=class&c=${active.id}`;
    const mode = S.modeBySection.get(S.sectionOfClass(active));

    // selected slot detail / editor
    let detail: React.ReactNode = null;
    if (sp.sel) {
      const [d, slotId] = sp.sel.split(":");
      const slot = S.slotById.get(slotId);
      const entry = S.entries.find((e) => e.classId === active.id && e.day === d && e.slotId === slotId);
      if (slot) {
        const effIds = S.effectiveSubjectIds(active.id);
        const teacherId = entry ? S.teacherFor(active.id, entry.subjectId) : null;
        const teacher = teacherId ? S.staffById.get(teacherId) : null;
        detail = (
          <Card className="mb-4 border-primary/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {DAY_LABELS[d as Day]} · {slot.name} · <span data-nums="">{fmtMin(slot.startMin)}–{fmtMin(slot.endMin)}</span>
                </p>
                {entry ? (
                  <>
                    <p className="mt-1 text-lg font-semibold">{S.subjectById.get(entry.subjectId)?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {teacher
                        ? <>Taught by {isAdmin ? <Link href={`/staff/${teacher.id}`} className="text-primary">{teacher.name}</Link> : <b>{teacher.name}</b>}
                          {mode === "class_teacher" && " (class teacher)"}</>
                        : <span className="text-warning">No teacher allocated yet — set it on Teaching &amp; allocations.</span>}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Free period — nothing placed here yet.</p>
                )}
              </div>
              <Link href={base} className={btnGhostCls}>Close</Link>
            </div>
            {isAdmin && (
              <div className="mt-3 border-t border-border pt-3">
                <form action={placeEntry.bind(null, slug, active.id, d, slotId)} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="back" value={base} />
                  <select name="subjectId" defaultValue={entry?.subjectId ?? ""} required
                    className="h-9 rounded-md border border-border bg-card px-2.5 text-sm">
                    <option value="" disabled>Choose subject…</option>
                    {effIds.map((sid2) => {
                      const tid = S.teacherFor(active.id, sid2);
                      const tn = tid ? S.staffById.get(tid)?.name : null;
                      return (
                        <option key={sid2} value={sid2}>
                          {S.subjectById.get(sid2)?.name}{tn ? ` — ${tn}` : " — no teacher yet"}
                        </option>
                      );
                    })}
                  </select>
                  <SubmitButton className={btnCls} pendingText="Placing…">{entry ? "Replace" : "Place lesson"}</SubmitButton>
                  {entry && (
                    <SubmitButton formAction={clearEntry.bind(null, slug, entry.id)}
                      className="rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10" pendingText="…">
                      Remove
                    </SubmitButton>
                  )}
                </form>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  The teacher comes from the allocation — a placement that double-books a teacher is refused.
                </p>
              </div>
            )}
          </Card>
        );
      }
    }

    return (
      <div>
        {header}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {visibleClasses.map((c) => (
            <Link key={c.id} href={`?view=class&c=${c.id}`}
              className={`rounded-md border px-2.5 py-1 text-[12.5px] font-medium ${c.id === active.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        {detail}
        <ClassGrid S={S} classId={active.id} base={base} sel={sp.sel} canEdit={isAdmin} />
        {mode === "class_teacher" && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {SECTION_LABELS[S.sectionOfClass(active)]} runs in class-teacher mode — every lesson here is taught by the class teacher.
          </p>
        )}
      </div>
    );
  }

  /* ═══ TEACHER VIEW ═══ */
  if (view === "teacher") {
    const teachers = S.staff.filter((t) => t.staffType !== "support").sort((a, b) => a.name.localeCompare(b.name));
    const activeTeacher = isAdmin
      ? (teachers.find((t) => t.id === sp.t) ?? teachers[0])
      : S.staffById.get(selfStaffId ?? "");
    if (!activeTeacher) return <div>{header}<Empty title="No staff record" hint="Your login isn't linked to a staff record yet — ask your admin." /></div>;

    const myEntries = S.entries.filter((e) => S.teacherFor(e.classId, e.subjectId) === activeTeacher.id);
    const mySections = [...new Set(myEntries.map((e) => {
      const c = S.classById.get(e.classId); return c ? S.sectionOfClass(c) : null;
    }).filter(Boolean))] as Section[];
    if (mySections.length === 0) {
      const c = S.classes.find((x) => x.classTeacherId === activeTeacher.id);
      if (c) mySections.push(S.sectionOfClass(c));
    }
    const periodsPerWeek = myEntries.length;

    return (
      <div>
        {header}
        {isAdmin && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {teachers.map((t) => (
              <Link key={t.id} href={`?view=teacher&t=${t.id}`}
                className={`rounded-md border px-2.5 py-1 text-[12.5px] font-medium ${t.id === activeTeacher.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                {t.name}
              </Link>
            ))}
          </div>
        )}
        <p className="mb-3 text-sm text-muted-foreground">
          <b className="text-foreground">{activeTeacher.name}</b> · <span data-nums="">{periodsPerWeek}</span> period{periodsPerWeek === 1 ? "" : "s"} a week — green slots are free.
        </p>
        {mySections.length === 0 && <Empty title="No lessons yet" hint="Nothing on the timetable resolves to this teacher — place lessons on a class timetable, or check Teaching & allocations." />}
        {mySections.map((section) => {
          const slots = S.slotsBySection(section);
          return (
            <div key={section} className="mb-6">
              {mySections.length > 1 && <h2 className="mb-2 text-sm font-semibold">{SECTION_LABELS[section]} day</h2>}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="border-b border-r border-border px-2 py-2"></th>
                      {slots.map((sl) => (
                        <th key={sl.id} className={`border-b border-border px-1.5 py-1.5 text-center font-medium ${sl.kind !== "teaching" ? "text-muted-foreground" : ""}`}>
                          <div>{sl.name}</div>
                          <div className="text-[10px] font-normal text-faint" data-nums="">{fmtMin(sl.startMin)}–{fmtMin(sl.endMin)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((d) => (
                      <tr key={d} className="border-t border-border">
                        <td className="border-r border-border px-2 py-2 font-semibold">{DAY_LABELS[d].slice(0, 3)}</td>
                        {slots.map((sl) => {
                          if (sl.kind !== "teaching")
                            return <td key={sl.id} className={`px-1.5 py-2 text-center text-[10px] uppercase ${KIND_TINT[sl.kind] ?? "bg-muted/40 text-faint"}`}>{sl.kind === "assembly" ? "🏫" : "☕"}</td>;
                          // any entry of this teacher overlapping this slot's time on this day
                          const hit = myEntries.find((e) => {
                            if (e.day !== d) return false;
                            const es = S.slotById.get(e.slotId);
                            return !!es && es.startMin < sl.endMin && sl.startMin < es.endMin;
                          });
                          return (
                            <td key={sl.id} className={`px-1 py-2 text-center ${hit ? "bg-primary/10" : "bg-success/5"}`}>
                              {hit ? (
                                <Link href={`?view=class&c=${hit.classId}&sel=${d}:${hit.slotId}`} className="block">
                                  <span className="font-medium">{S.classById.get(hit.classId)?.name}</span>
                                  <span className="block text-[10.5px] text-muted-foreground">{abbr(S.subjectById.get(hit.subjectId)?.name ?? "")}</span>
                                </Link>
                              ) : <span className="text-[10.5px] text-success">free</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ═══ SUBJECT VIEW (admin) ═══ */
  if (view === "subject") {
    const subs = S.subjects.sort((a, b) => a.name.localeCompare(b.name));
    const activeSub = subs.find((s) => s.id === sp.sub) ?? subs[0];
    if (!activeSub) return <div>{header}<Empty title="No subjects yet" hint="Add subjects under Settings first." /></div>;
    const takers = visibleClasses.filter((c) => S.effectiveSubjectIds(c.id).includes(activeSub.id));
    const activeCls = takers.find((c) => c.id === sp.c) ?? takers[0];
    const idx = activeCls ? takers.findIndex((c) => c.id === activeCls.id) : -1;
    const prev = idx > 0 ? takers[idx - 1] : takers[takers.length - 1];
    const next = idx >= 0 && idx < takers.length - 1 ? takers[idx + 1] : takers[0];
    const counts = new Map<string, number>();
    for (const e of S.entries.filter((e) => e.subjectId === activeSub.id))
      counts.set(e.classId, (counts.get(e.classId) ?? 0) + 1);

    return (
      <div>
        {header}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {subs.map((s) => (
            <Link key={s.id} href={`?view=subject&sub=${s.id}`}
              className={`rounded-md border px-2.5 py-1 text-[12.5px] font-medium ${s.id === activeSub.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {s.name}
            </Link>
          ))}
        </div>
        {!activeCls ? (
          <Empty title={`No class takes ${activeSub.name}`} hint="Add it to a section's subject set under Settings → Day plan & subjects." />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <Link href={`?view=subject&sub=${activeSub.id}&c=${prev?.id}`} className={btnGhostCls}>‹ {prev?.name}</Link>
              <p className="text-sm">
                <b>{activeSub.name}</b> in <b>{activeCls.name}</b> ·{" "}
                <span data-nums="">{counts.get(activeCls.id) ?? 0}</span> period{(counts.get(activeCls.id) ?? 0) === 1 ? "" : "s"}/week
                <span className="text-muted-foreground" data-nums=""> · class {idx + 1} of {takers.length}</span>
              </p>
              <Link href={`?view=subject&sub=${activeSub.id}&c=${next?.id}`} className={btnGhostCls}>{next?.name} ›</Link>
            </div>
            <ClassGrid S={S} classId={activeCls.id} base={`?view=subject&sub=${activeSub.id}&c=${activeCls.id}`}
              sel={sp.sel} canEdit={isAdmin} focusSubjectId={activeSub.id} />
            <div className="mt-4 flex flex-wrap gap-2">
              {takers.map((c) => (
                <Link key={c.id} href={`?view=subject&sub=${activeSub.id}&c=${c.id}`}
                  className={`rounded-md border px-2.5 py-1 text-[12px] ${c.id === activeCls.id ? "border-primary" : "border-border"}`}>
                  {c.name} <span className="text-muted-foreground" data-nums="">{counts.get(c.id) ?? 0}×</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ═══ LEVEL VIEW (admin): whole section, one day ═══ */
  const section = (SECTIONS.includes(sp.sec as Section) ? sp.sec : "primary") as Section;
  const todayIdx = new Date().getDay() - 1;
  const day = (DAYS.includes(sp.d as Day) ? sp.d : DAYS[todayIdx >= 0 && todayIdx < 5 ? todayIdx : 0]) as Day;
  const secClasses = visibleClasses.filter((c) => S.sectionOfClass(c) === section);
  const slots = S.slotsBySection(section);
  const entryAt = new Map(S.entries.filter((e) => e.day === day).map((e) => [`${e.classId}:${e.slotId}`, e]));

  return (
    <div>
      {header}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SECTIONS.map((s) => (
          <Link key={s} href={`?view=level&sec=${s}&d=${day}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${s === section ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
            {SECTION_LABELS[s]}
          </Link>
        ))}
        <span className="mx-1 text-faint">·</span>
        {DAYS.map((d) => (
          <Link key={d} href={`?view=level&sec=${section}&d=${d}`}
            className={`rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium ${d === day ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
            {DAY_LABELS[d].slice(0, 3)}
          </Link>
        ))}
      </div>
      {secClasses.length === 0 ? (
        <Empty title={`No classes in ${SECTION_LABELS[section]}`} hint="Add levels & classes under Settings → Academic structure." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-muted/60">
                <th className="border-b border-r border-border px-2 py-2 text-left font-semibold">{DAY_LABELS[day]}</th>
                {secClasses.map((c) => (
                  <th key={c.id} className="border-b border-border px-1.5 py-2 text-center font-medium">
                    <Link href={`?view=class&c=${c.id}`} className="hover:text-primary">{c.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((sl) => (
                <tr key={sl.id} className="border-t border-border">
                  <td className={`border-r border-border px-2 py-1.5 ${sl.kind !== "teaching" ? "text-muted-foreground" : "font-medium"}`}>
                    {sl.name} <span className="block text-[10px] text-faint" data-nums="">{fmtMin(sl.startMin)}–{fmtMin(sl.endMin)}</span>
                  </td>
                  {sl.kind !== "teaching"
                    ? <td colSpan={secClasses.length} className={`px-2 py-1.5 text-center text-[10.5px] uppercase tracking-wider ${KIND_TINT[sl.kind] ?? "bg-muted/40 text-faint"}`}>{sl.name}</td>
                    : secClasses.map((c) => {
                        const e = entryAt.get(`${c.id}:${sl.id}`);
                        const tid = e ? S.teacherFor(c.id, e.subjectId) : null;
                        return (
                          <td key={c.id} className={`px-1 py-1.5 text-center ${e ? "bg-success/5" : ""}`}>
                            {e ? (
                              <Link href={`?view=class&c=${c.id}&sel=${day}:${sl.id}`} className="block">
                                <span className="font-medium">{abbr(S.subjectById.get(e.subjectId)?.name ?? "?")}</span>
                                <span className="block text-[10px] text-muted-foreground">
                                  {tid ? S.staffById.get(tid)?.name.split(" ")[0] : "—"}
                                </span>
                              </Link>
                            ) : <span className="text-faint">·</span>}
                          </td>
                        );
                      })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
