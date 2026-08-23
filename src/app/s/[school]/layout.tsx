import { requireSchool } from "@/core/school-context";
import { getNavBadges } from "@/core/badges";
import { getUnackedAnnouncements } from "@/modules/comms/unacked";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Flash } from "@/ui/feedback";
import { LiveSync } from "@/ui/live-sync";
import { AnnouncementGate } from "@/ui/announcement-gate";
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
  const [badges, unacked] = await Promise.all([
    getNavBadges(school.id, user.role, user.id),
    getUnackedAnnouncements(school.id, user.id, user.role),
  ]);
  if (unacked.length) badges["/comms"] = unacked.length;

  // school logo (top bar) + the user's own avatar (sidebar) — both optional
  const userImage = (user as { image?: string | null }).image ?? null;
  const [logoUrl, avatarUrl] = await Promise.all([
    school.branding.logoUrl && r2Enabled ? presignDownload(school.branding.logoUrl) : null,
    userImage && r2Enabled ? presignDownload(userImage) : null,
  ]);

  return (
    <Shell schoolName={school.name} role={user.role} userName={user.name} modules={modules}
      badges={badges} logoUrl={logoUrl} avatarUrl={avatarUrl}>
      {trialDays !== null && user.role === "admin" && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/30 bg-brand-soft px-4 py-2.5 text-[14px]">
          <span><b>Free trial</b> — {trialDays} day{trialDays === 1 ? "" : "s"} left. Your data stays safe either way.</span>
          <a href="/billing" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">
            Choose a plan
          </a>
        </div>
      )}
      {children}
      <Flash />
      <LiveSync slug={slug} />
      <AnnouncementGate slug={slug} items={unacked} />
    </Shell>
  );
}
