import Link from "next/link";
import { eq, ilike, and, or, sql, inArray, notInArray } from "drizzle-orm";
import { Phone, MessageSquare, MonitorSmartphone } from "lucide-react";
import { db } from "@/db";
import { guardians, students, studentGuardians, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { DataTable, Empty, PageHeader, Stat, Tr, Td, Badge } from "@/ui/kit";
import { Pagination, SearchBox, FilterSelect } from "@/ui/list-controls";
import { PER_PAGE } from "@/lib/utils";

const PREF_ICON = { phone: Phone, sms: MessageSquare, portal: MonitorSmartphone } as const;

/** Guardians are MANY-TO-MANY with students: one parent, all their children,
 *  shown on one row. Default view = guardians with at least one active child;
 *  the rest are history, kept (never deleted) for re-admissions. */
export default async function Guardians({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ page?: string; search?: string; show?: string; reach?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const page = Math.max(1, Number(sp.page) || 1);
  const show = sp.show === "all" || sp.show === "inactive" ? sp.show : "active";

  // guardians having ≥1 active child (the working set for the front desk)
  const activeGuardianIds = db.select({ id: studentGuardians.guardianId })
    .from(studentGuardians)
    .innerJoin(students, eq(studentGuardians.studentId, students.id))
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));

  const where = and(
    eq(guardians.schoolId, school.id),
    sp.search ? or(ilike(guardians.name, `%${sp.search}%`), ilike(guardians.phone, `%${sp.search}%`)) : undefined,
    show === "active" ? inArray(guardians.id, activeGuardianIds) : undefined,
    show === "inactive" ? notInArray(guardians.id, activeGuardianIds) : undefined,
    sp.reach && sp.reach in PREF_ICON ? eq(guardians.contactPref, sp.reach) : undefined,
  );

  const [rows, [{ n }], prefMix] = await Promise.all([
    db.select().from(guardians).where(where).orderBy(guardians.name)
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(guardians).where(where),
    db.select({ pref: guardians.contactPref, n: sql<number>`count(*)` })
      .from(guardians)
      .where(and(eq(guardians.schoolId, school.id), inArray(guardians.id, activeGuardianIds)))
      .groupBy(guardians.contactPref),
  ]);

  // one query: every child of the guardians on this page
  const kidRows = rows.length
    ? await db.select({
        guardianId: studentGuardians.guardianId, studentId: students.id,
        firstName: students.firstName, status: students.status, className: classes.name,
      }).from(studentGuardians)
        .innerJoin(students, eq(studentGuardians.studentId, students.id))
        .leftJoin(classes, eq(students.classId, classes.id))
        .where(inArray(studentGuardians.guardianId, rows.map((r) => r.id)))
    : [];
  const kidsOf = new Map<string, typeof kidRows>();
  for (const k of kidRows) {
    if (!kidsOf.has(k.guardianId)) kidsOf.set(k.guardianId, []);
    kidsOf.get(k.guardianId)!.push(k);
  }
  const tally = (p: string) => Number(prefMix.find((m) => m.pref === p)?.n ?? 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Guardians" sub={`${n} shown`} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Portal users" value={String(tally("portal"))} tone="success" />
        <Stat label="Phone-only" value={String(tally("phone"))} tone={tally("phone") ? "warning" : undefined} />
        <Stat label="SMS" value={String(tally("sms"))} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Name or phone…" />
        <FilterSelect name="show" allLabel="With active children"
          options={[{ value: "all", label: "All guardians" }, { value: "inactive", label: "No active children" }]} />
        <FilterSelect name="reach" allLabel="Any contact method"
          options={[{ value: "phone", label: "Phone-only" }, { value: "sms", label: "SMS" }, { value: "portal", label: "Portal" }]} />
      </div>

      {rows.length === 0 ? (
        <Empty title="No guardians found"
          hint="Guardians are created during admission and stay linked to every child of theirs." />
      ) : (
        <DataTable head={["Guardian", "Reach them", "Children", "Portal", ""]}>
          {rows.map((g) => {
            const kids = kidsOf.get(g.id) ?? [];
            const active = kids.filter((k) => k.status === "active");
            const Icon = PREF_ICON[(g.contactPref as keyof typeof PREF_ICON) ?? "phone"] ?? Phone;
            return (
              <Tr key={g.id}>
                <Td className="font-medium">
                  <Link href={`/guardians/${g.id}`} className="text-primary">{g.name}</Link>
                  <p className="text-[13px] font-normal capitalize text-muted-foreground">
                    {g.relation}{g.occupation ? ` · ${g.occupation}` : ""}
                  </p>
                </Td>
                <Td>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Icon size={13} className={g.contactPref === "portal" ? "text-muted-foreground" : "text-warning"} />
                    {g.phone}
                  </span>
                </Td>
                <Td>
                  {kids.length === 0
                    ? <span className="text-muted-foreground">—</span>
                    : <span className="text-[14px]">
                        {active.map((k) => `${k.firstName} (${k.className ?? "—"})`).join(", ")}
                        {kids.length > active.length &&
                          <span className="text-muted-foreground"> +{kids.length - active.length} left/alumni</span>}
                      </span>}
                </Td>
                <Td>{g.userId
                  ? <Badge tone="success">active</Badge>
                  : <span className="text-xs text-muted-foreground">no login</span>}</Td>
                <Td className="text-right">
                  <Link href={`/guardians/${g.id}`} className="text-primary">Open profile</Link>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      )}
      <Pagination page={page} count={Number(n)} />
    </div>
  );
}
