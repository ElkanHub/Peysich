import { requireSchool } from "@/core/school-context";
import { getNavBadges } from "@/core/badges";
import { getUnackedAnnouncements } from "@/modules/comms/unacked";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Flash } from "@/ui/feedback";
import { LiveSync } from "@/ui/live-sync";
import { AnnouncementGate } from "@/ui/announcement-gate";
import { Shell } from "@/ui/shell";
import { cn } from "@/lib/utils";
import { getBalance, ghs, LOW_BALANCE_PESEWAS } from "@/messaging/wallet";
import { deleteAfter, fmtDay, getWorkingTerm, schoolWritable } from "@/core/terms";
import type { Metadata } from "next";

/** A school's pages are private. Belt and braces with the proxy's
 *  X-Robots-Tag on every subdomain response. */
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

/** A suspended Neon compute can take ~10s to wake; the platform's default
 *  function window kills the first request after a quiet spell mid-flight
 *  ("error → try again → works"). Give every school page and its server
 *  actions room to ride the wake-up out. */
export const maxDuration = 60;

const daysUntil = (d: Date) => Math.max(0, Math.ceil((+d - Date.now()) / 86400000));

export default async function SchoolLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ school: string }>;
}) {
  const { school: slug } = await params;
  const { school, user, modules, grants } = await requireSchool(slug);


  const trialDays = school.status === "trial" && school.trialEndsAt
    ? daysUntil(school.trialEndsAt) : null;
  const [badges, unacked, balance] = await Promise.all([
    getNavBadges(school.id, user.role, user.id),
    getUnackedAnnouncements(school.id, user.id, user.role),
    user.role === "admin" ? getBalance(school.id) : null,
  ]);
  const walletLow = balance !== null && balance < LOW_BALANCE_PESEWAS;
  // frozen: the subscription lapsed, or no term can take writes. Everything
  // stays readable; the server refuses writes; one card says what to do.
  const lapsed = !schoolWritable(school.status);
  const term = await getWorkingTerm(school.id);
  const frozen = lapsed || (term !== null && !term.writable);
  const until = lapsed ? await deleteAfter(school) : null;
  if (unacked.length) badges["/comms"] = unacked.length;

  // school logo (top bar) + the user's own avatar (sidebar) — both optional
  const userImage = (user as { image?: string | null }).image ?? null;
  const [logoUrl, avatarUrl] = await Promise.all([
    school.branding.logoUrl && r2Enabled ? presignDownload(school.branding.logoUrl) : null,
    userImage && r2Enabled ? presignDownload(userImage) : null,
  ]);

  return (
    <Shell schoolName={school.name} role={user.role} userName={user.name} modules={modules}
      badges={badges} logoUrl={logoUrl} avatarUrl={avatarUrl} allowedTabs={grants?.tabs ?? null}>
      {trialDays !== null && user.role === "admin" && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/30 bg-brand-soft px-4 py-2.5 text-[14px]">
          <span>
            {trialDays <= 1
              ? <><b>Your free trial ends {trialDays === 1 ? "tomorrow" : "today"}.</b> Choose a plan to keep going — nothing is deleted either way.</>
              : <><b>Free trial</b> — {trialDays} days left. Your data stays safe either way.</>}
          </span>
          <a href="/billing" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">
            Choose a plan
          </a>
        </div>
      )}
      {frozen && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-[14px] shadow-[var(--shadow-sm)]">
          <span>
            {lapsed
              ? user.role === "admin"
                ? <><b>Your subscription has ended.</b> Everything is kept and readable{until ? ` until ${fmtDay(until)}` : ""}. Renew to open the next term.</>
                : <><b>The school&apos;s account is paused.</b> Records are kept and readable.</>
              : term?.state === "closed"
                ? <><b>{term.year.name} is closed.</b> {user.role === "admin" ? "Open the next term when school resumes." : "Records stay readable until the next term opens."}</>
                : <><b>{term?.name} has ended.</b> {user.role === "admin" ? "Close it from Home, then open the next term." : "Records stay readable until the next term opens."}</>}
          </span>
          {user.role === "admin" && lapsed && (
            <a href="/billing" className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">Renew</a>
          )}
        </div>
      )}
      {school.status === "past_due" && user.role === "admin" && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-2.5 text-[14px]">
          <span><b>The payment for your plan did not go through.</b> The school stays open for 14 days. Your data is safe.</span>
          <a href="/billing" className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">
            Pay now
          </a>
        </div>
      )}
      {walletLow && (
        <div className={cn("mb-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-[14px]",
          balance <= 0 ? "border-danger/40 bg-danger-soft" : "border-warning/60 bg-warning-soft")}>
          <span>
            {balance <= 0
              ? <><b>Messaging balance is empty.</b> WhatsApp and SMS to parents and teachers have stopped; absence alerts and emergencies still go. Notices still reach the app and Telegram.</>
              : <><b>Messaging balance is low</b> — {ghs(balance)} left. Top up so WhatsApp and SMS keep going.</>}
          </span>
          <a href="/billing" className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">
            Top up
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
