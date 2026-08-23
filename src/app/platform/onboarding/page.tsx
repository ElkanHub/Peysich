import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getOnboardingStages, getSchoolUsers } from "@/core/onboarding";
import { DataTable, PageHeader, Tr, Td, Badge } from "@/ui/kit";
import { cn } from "@/lib/utils";

/** Where every school is in its journey — signup → running (doc 10 funnel). */
export default async function Onboarding() {
  const rows = await db.select().from(schools).orderBy(desc(schools.createdAt)).limit(50);
  const enriched = await Promise.all(rows.map(async (s) => ({
    school: s,
    stages: await getOnboardingStages(s.id),
    admin: (await getSchoolUsers(s.id)).find((u) => u.role === "admin"),
  })));

  return (
    <div>
      <PageHeader title="Onboarding"
        sub="Every school's setup journey — chase the red dots before they churn" />
      <DataTable head={["School", "Signed up", "Admin contact", "Progress", "Stage detail"]}>
        {enriched.map(({ school: s, stages, admin }) => {
          const done = stages.filter((st) => st.done).length;
          return (
            <Tr key={s.id}>
              <Td>
                <Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link>
                <span className="ml-2"><Badge tone={s.status === "active" ? "success" : s.status === "trial" ? "brand" : "danger"}>{s.status.replace("_", " ")}</Badge></span>
              </Td>
              <Td className="text-muted-foreground">{s.createdAt.toISOString().slice(0, 10)}</Td>
              <Td className="text-[14px]">
                {admin ? <>{admin.name}<br /><span className="text-muted-foreground">{admin.email}</span></> : "—"}
              </Td>
              <Td>
                <span data-nums="" className={cn("font-semibold",
                  done === stages.length ? "text-success" : done <= 2 ? "text-danger" : "text-warning")}>
                  {done}/{stages.length}
                </span>
              </Td>
              <Td>
                <span className="flex gap-1">
                  {stages.map((st) => (
                    <span key={st.key} title={st.label}
                      className={cn("h-2.5 w-2.5 rounded-full",
                        st.done ? "bg-success" : "bg-danger/40")} />
                  ))}
                </span>
              </Td>
            </Tr>
          );
        })}
      </DataTable>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Dots, in order: academic year · classes · staff · students · first register · first invoices.
      </p>
    </div>
  );
}
