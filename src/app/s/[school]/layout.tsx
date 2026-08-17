import { requireSchool } from "@/core/school-context";
import { Shell } from "@/ui/shell";

export default async function SchoolLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ school: string }>;
}) {
  const { school: slug } = await params;
  const { school, user, modules } = await requireSchool(slug);

  if (school.status === "suspended" && user.role !== "platform_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">Account suspended</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {school.name}&apos;s subscription needs attention. Your data is safe.
            Please contact the school office or settle the outstanding payment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Shell schoolName={school.name} role={user.role} userName={user.name} modules={modules}>
      {children}
    </Shell>
  );
}
