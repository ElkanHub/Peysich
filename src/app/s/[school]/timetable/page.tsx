import Link from "next/link";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { getStudentSelf, getParentChildren } from "@/core/portal";
import {
  getStructure, SECTIONS, SECTION_LABELS, DAYS, DAY_LABELS, fmtMin,
  type Day, type Section, type Structure,
} from "@/core/academics";
import { PageHeader, Card, Empty, btnGhostCls } from "@/ui/kit";
import { SlotEditor } from "./slot-editor";

const ERR: Record<string, string> = {
  clash: "", // detail carries the message
  notsubject: "That subject isn't on this class's list — adjust it under Settings → Day plan & subjects.",
  notpool: "That teacher isn't on this subject for this class — add it to their profile first.",
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
function ClassGrid({ S, slug, classId, base, sel, canEdit, focusSubjectId }: {
  S: Structure; slug: string; classId: string; base: string; sel?: string;
  canEdit: boolean; focusSubjectId?: string;
}) {
  const cls = S.classById.get(classId);
  if (!cls) return null;
  const slots = S.slotsBySection(S.sectionOfClass(cls));
  const gridSubjects = S.effectiveSubjectIds(classId)
    .map((id) => {
      const tid = S.teacherFor(classId, id);
      return {
        id, name: S.subjectById.get(id)?.name ?? "?",
        teacher: tid ? S.staffById.get(tid)?.name ?? null : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const mine = S.entries.filter((e) => e.classId === classId);
  const at = new Map(mine.map((e) => [`${e.day}:${e.slotId}`, e]));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-muted/60">
            <th className="border-b border-r border-border px-2 py-2 text-left font-semibold"></th>
            {slots.map((sl) => (
              <th key={sl.id} className={`border-b border-border px-1.5 py-1.5 text-center font-medium ${sl.kind !== "teaching" ? "text-muted-foreground" : ""}`}>
                <div>{sl.name}</div>
                <div className="text-[11px] font-normal text-faint" data-nums="">{fmtMin(sl.startMin)}–{fmtMin(sl.endMin)}</div>
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
                  return <td key={sl.id} className={`px-1.5 py-2 text-center text-[11px] uppercase tracking-wide ${KIND_TINT[sl.kind] ?? "bg-muted/40 text-faint"}`}>{sl.kind === "assembly" ? "🏫" : "☕"}</td>;
                }
                const e = at.get(`${d}:${sl.id}`);
                const isSel = sel === `${d}:${sl.id}`;
                const dim = focusSubjectId && e && e.subjectId !== focusSubjectId;
                const tName = e ? (() => {
                  const tid = S.teacherFor(classId, e.subjectId, e.teacherId);
                  return tid ? S.staffById.get(tid)?.name ?? null : null;
                })() : null;
                const cell = canEdit ? (
                  <SlotEditor slug={slug} classId={classId} day={d} slotId={sl.id} base={base}
                    label={e ? abbr(S.subjectById.get(e.subjectId)?.name ?? "?") : null}
                    subjects={gridSubjects}
                    entry={e ? {
                      id: e.id, subjectId: e.subjectId, chosen: !!e.teacherId, teacherName: tName,
                      pool: S.poolFor(classId, e.subjectId).map((pm) => ({
                        id: pm.staffId, name: S.staffById.get(pm.staffId)?.name ?? "?", role: pm.role,
                      })),
                    } : null} />
                ) : (
                  <span className="block px-1 py-2"
                    title={e ? `${S.subjectById.get(e.subjectId)?.name ?? ""}${tName ? ` — ${tName}` : ""}` : undefined}>
                    {e
                      ? <span className={dim ? "text-faint" : "font-medium"}>{abbr(S.subjectById.get(e.subjectId)?.name ?? "?")}</span>
                      : <span className="text-faint">·</span>}
                  </span>
                );
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
          <ul className="mt-1.5 space-y-1 text-[14px]">
            {clashes.slice(0, 6).map((cl, i) => (
              <li key={i}>
                <b>{cl.teacherName}</b> is double-booked {DAY_LABELS[cl.day]} {cl.time}: {cl.classes.join(" and ")}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Usually caused by changing allocations after lessons were placed — move one of the lessons, or change the allocation.
          </p>
        </div>
      )}
      {tabs.length > 1 && (
        <div className="mb-5 flex gap-2">
          {tabs.map((v) => (
            <Link key={v} href={`?view=${v}`}
              className={`rounded-md border px-3.5 py-1.5 text-sm font-medium capitalize ${v === view ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
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

    return (
      <div>
        {header}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {visibleClasses.map((c) => (
            <Link key={c.id} href={`?view=class&c=${c.id}`}
              className={`rounded-md border px-2.5 py-1 text-[13.5px] font-medium ${c.id === active.id ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <ClassGrid S={S} slug={slug} classId={active.id} base={base} sel={sp.sel} canEdit={isAdmin} />
        {mode === "class_teacher" && (
          <p className="mt-2 text-[13px] text-muted-foreground">
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

    const myEntries = S.entries.filter((e) => S.teacherFor(e.classId, e.subjectId, e.teacherId) === activeTeacher.id);
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
                className={`rounded-md border px-2.5 py-1 text-[13.5px] font-medium ${t.id === activeTeacher.id ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
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
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="border-b border-r border-border px-2 py-2"></th>
                      {slots.map((sl) => (
                        <th key={sl.id} className={`border-b border-border px-1.5 py-1.5 text-center font-medium ${sl.kind !== "teaching" ? "text-muted-foreground" : ""}`}>
                          <div>{sl.name}</div>
                          <div className="text-[11px] font-normal text-faint" data-nums="">{fmtMin(sl.startMin)}–{fmtMin(sl.endMin)}</div>
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
                            return <td key={sl.id} className={`px-1.5 py-2 text-center text-[11px] uppercase ${KIND_TINT[sl.kind] ?? "bg-muted/40 text-faint"}`}>{sl.kind === "assembly" ? "🏫" : "☕"}</td>;
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
                                  <span className="block text-[11.5px] text-muted-foreground">{abbr(S.subjectById.get(hit.subjectId)?.name ?? "")}</span>
                                </Link>
                              ) : <span className="text-[11.5px] text-success">free</span>}
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
              className={`rounded-md border px-2.5 py-1 text-[13.5px] font-medium ${s.id === activeSub.id ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
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
            <ClassGrid S={S} slug={slug} classId={activeCls.id} base={`?view=subject&sub=${activeSub.id}&c=${activeCls.id}`}
              sel={sp.sel} canEdit={isAdmin} focusSubjectId={activeSub.id} />
            <div className="mt-4 flex flex-wrap gap-2">
              {takers.map((c) => (
                <Link key={c.id} href={`?view=subject&sub=${activeSub.id}&c=${c.id}`}
                  className={`rounded-md border px-2.5 py-1 text-[13px] ${c.id === activeCls.id ? "border-primary" : "border-border"}`}>
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
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${s === section ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
            {SECTION_LABELS[s]}
          </Link>
        ))}
        <span className="mx-1 text-faint">·</span>
        {DAYS.map((d) => (
          <Link key={d} href={`?view=level&sec=${section}&d=${d}`}
            className={`rounded-md border px-2.5 py-1.5 text-[13.5px] font-medium ${d === day ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
            {DAY_LABELS[d].slice(0, 3)}
          </Link>
        ))}
      </div>
      {secClasses.length === 0 ? (
        <Empty title={`No classes in ${SECTION_LABELS[section]}`} hint="Add levels & classes under Settings → Academic structure." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[13px]">
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
                    {sl.name} <span className="block text-[11px] text-faint" data-nums="">{fmtMin(sl.startMin)}–{fmtMin(sl.endMin)}</span>
                  </td>
                  {sl.kind !== "teaching"
                    ? <td colSpan={secClasses.length} className={`px-2 py-1.5 text-center text-[11.5px] uppercase tracking-wider ${KIND_TINT[sl.kind] ?? "bg-muted/40 text-faint"}`}>{sl.name}</td>
                    : secClasses.map((c) => {
                        const e = entryAt.get(`${c.id}:${sl.id}`);
                        const tid = e ? S.teacherFor(c.id, e.subjectId, e.teacherId) : null;
                        return (
                          <td key={c.id} className={`px-1 py-1.5 text-center ${e ? "bg-success/5" : ""}`}>
                            {e ? (
                              <Link href={`?view=class&c=${c.id}&sel=${day}:${sl.id}`} className="block">
                                <span className="font-medium">{abbr(S.subjectById.get(e.subjectId)?.name ?? "?")}</span>
                                <span className="block text-[11px] text-muted-foreground">
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
