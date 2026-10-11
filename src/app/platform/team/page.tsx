import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { platformAccess, user as userTable } from "@/db/schema";
import { CONSOLE_PRESETS, CONSOLE_TABS, requireConsoleOwner } from "@/core/console";
import { Badge, Card, PageHeader, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { ConfirmButton } from "@/ui/confirm";
import { InviteAdmin } from "../settings/invite";
import { TabPicker } from "./tab-picker";
import { removeMember, setMemberTabs } from "./actions";

/** Team & access for the console: who has a login, and which tabs each one
 *  may open. Owners see everything; a member sees only what is ticked. */
export default async function Team() {
  const me = await requireConsoleOwner();
  const members = await db.select().from(userTable).where(eq(userTable.role, "platform_admin")).orderBy(userTable.createdAt);
  const grants = members.length
    ? await db.select().from(platformAccess).where(inArray(platformAccess.userId, members.map((m) => m.id))) : [];
  const tabsOf = new Map(grants.map((g) => [g.userId, g.tabs]));

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Team" sub="Who can open the console, and which tabs each person sees" />
      {members.map((m) => {
        const tabs = tabsOf.get(m.id) ?? null;
        const self = m.id === me.id;
        return (
          <Card key={m.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{m.name}{self && <span className="ml-2 text-[13px] font-normal text-muted-foreground">you</span>}</p>
                <p className="text-[13.5px] text-muted-foreground">{m.email} · joined {m.createdAt.toISOString().slice(0, 10)}</p>
              </div>
              {tabs ? <Badge tone="warning">{tabs.length} of {CONSOLE_TABS.length} tabs</Badge> : <Badge tone="success">owner · every tab</Badge>}
            </div>
            {!self && (
              <div className="mt-3 border-t border-border pt-3">
                <form action={setMemberTabs.bind(null, m.id)}>
                  <TabPicker tabs={CONSOLE_TABS} presets={CONSOLE_PRESETS} initial={tabs ?? CONSOLE_TABS.map((t) => t.key)} />
                  <SubmitButton className={btnGhostCls + " mt-3"} pendingText="Saving…">Save access</SubmitButton>
                </form>
                <form action={removeMember.bind(null, m.id)} className="mt-2 text-right">
                  <ConfirmButton className="text-[13px] text-danger hover:underline" danger
                    title={`Remove ${m.name}'s console login?`} body="They can no longer sign in to the console. Nothing else changes." confirmLabel="Remove">
                    Remove login
                  </ConfirmButton>
                </form>
              </div>
            )}
          </Card>
        );
      })}
      <Card>
        <h2 className="font-semibold">Invite someone</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">They start as an owner. Tick fewer tabs above once they are in.</p>
        <div className="mt-3"><InviteAdmin /></div>
      </Card>
    </div>
  );
}
