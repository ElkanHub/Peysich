import { requireSchool } from "@/core/school-context";
import { Flash } from "@/ui/feedback";
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

  const trialDays = school.status === "trial" && school.trialEndsAt
    ? Math.max(0, Math.ceil((+school.trialEndsAt - Date.now()) / 86400000)) : null;

  return (
    <Shell schoolName={school.name} role={user.role} userName={user.name} modules={modules}>
      {trialDays !== null && user.role === "admin" && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/30 bg-brand-soft px-4 py-2.5 text-[13px]">
          <span><b>Free trial</b> — {trialDays} day{trialDays === 1 ? "" : "s"} left. Your data stays safe either way.</span>
          <a href="/billing" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">
            Choose a plan
          </a>
        </div>
      )}
      {children}
      <Flash />
    </Shell>
  );
}
