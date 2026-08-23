import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { Megaphone, CalendarDays, MessageSquareText, Mail, CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { announcements, announcementAcks, events, classes, smsLog } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { postAnnouncement, createEvent, sendBlast, acknowledgeOne } from "./actions";
import { Card, Field, PageHeader, Empty, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** One place for everything the school says: announcements (wine accent),
 *  events (calendar block) and blasts (SMS/email, admin only) — each shaped
 *  differently so a glance tells you what you're looking at. */
export default async function Comms({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "comms");
  const [anns, evts, cls, blasts, myAcks] = await Promise.all([
    db.select().from(announcements).where(eq(announcements.schoolId, school.id))
      .orderBy(desc(announcements.createdAt)).limit(15),
    db.select().from(events).where(eq(events.schoolId, school.id))
      .orderBy(desc(events.startsAt)).limit(10),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    ["admin", "platform_admin"].includes(user.role)
      ? db.select({
          body: smsLog.body, kind: smsLog.kind, n: sql<number>`count(*)`,
          at: sql<Date>`max(created_at)`,
        }).from(smsLog)
          .where(and(eq(smsLog.schoolId, school.id),
            inArray(smsLog.kind, ["blast", "email-blast"])))
          .groupBy(smsLog.body, smsLog.kind)
          .orderBy(desc(sql`max(created_at)`)).limit(6)
      : [],
    db.select({ annId: announcementAcks.announcementId }).from(announcementAcks)
      .where(and(eq(announcementAcks.schoolId, school.id), eq(announcementAcks.userId, user.id))),
  ]);
  const acked = new Set(myAcks.map((a) => a.annId));
  const className = new Map(cls.map((c) => [c.id, c.name]));
  let visible: Set<string> | null = null;
  if (user.role === "parent")
    visible = new Set((await getParentChildren(school.id, user.id)).map((k) => k.classId).filter(Boolean) as string[]);
  else if (user.role === "student")
    visible = new Set([(await getStudentSelf(school.id, user.id))?.classId].filter(Boolean) as string[]);
  const seeAnns = visible ? anns.filter((a) => !a.classId || visible.has(a.classId)) : anns;
  const seeEvts = visible ? evts.filter((e) => !e.classId || visible.has(e.classId)) : evts;
  const canPost = ["admin", "teacher", "platform_admin"].includes(user.role);
  const isAdmin = ["admin", "platform_admin"].includes(user.role);

  // one feed, newest first, typed
  type FeedItem =
    | { type: "ann"; at: Date; a: typeof seeAnns[number] }
    | { type: "evt"; at: Date; e: typeof seeEvts[number] }
    | { type: "blast"; at: Date; b: typeof blasts[number] };
  const feed: FeedItem[] = [
    ...seeAnns.map((a) => ({ type: "ann" as const, at: a.createdAt, a })),
    ...seeEvts.map((e) => ({ type: "evt" as const, at: e.startsAt, e })),
    ...blasts.map((b) => ({ type: "blast" as const, at: new Date(b.at), b })),
  ].sort((x, y) => +y.at - +x.at);

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader title="Announcements"
          sub="Everything the school has said — notices, events and messages to guardians, in one stream" />
        <div className="space-y-3">
          {feed.map((item, i) => {
            if (item.type === "ann") {
              const a = item.a;
              return (
                <div key={`a${a.id}`} className="rounded-lg border-l-4 border-primary bg-card p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
                      <Megaphone size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-normal text-muted-foreground">
                          {a.classId ? className.get(a.classId) : "School-wide"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>
                      <p className="mt-1 flex items-center gap-2 text-[12px] text-faint" data-nums="">
                        {a.createdAt.toISOString().slice(0, 10)}
                        {acked.has(a.id) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11.5px] font-medium text-success">
                            <CheckCircle2 size={11} /> Acknowledged
                          </span>
                        ) : (
                          <form action={acknowledgeOne.bind(null, slug, a.id)} className="inline">
                            <SubmitButton pendingText="…"
                              className="rounded-full border border-primary/40 px-2 py-0.5 text-[11.5px] font-medium text-primary hover:bg-brand-soft">
                              Acknowledge
                            </SubmitButton>
                          </form>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            if (item.type === "evt") {
              const e = item.e;
              const d = e.startsAt;
              return (
                <div key={`e${e.id}`} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted/60">
                      <span className="text-[10px] font-bold tracking-wider text-danger">{MONTHS[d.getMonth()]}</span>
                      <span className="text-lg font-bold leading-none" data-nums="">{d.getDate()}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium"><CalendarDays size={13} className="mr-1 inline text-muted-foreground" />{e.title}</p>
                      <p className="mt-0.5 text-[13.5px] text-muted-foreground" data-nums="">
                        {d.toISOString().slice(0, 16).replace("T", " · ")} · {e.classId ? className.get(e.classId) : "School-wide"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            const b = item.b;
            const isEmail = b.kind === "email-blast";
            return (
              <div key={`b${i}`} className="rounded-lg border border-dashed border-border bg-muted/30 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {isEmail ? <Mail size={14} /> : <MessageSquareText size={14} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {isEmail ? "Email" : "SMS"} to guardians
                      <span className="ml-2 font-normal normal-case" data-nums="">{String(b.n)} recipients · {new Date(b.at).toISOString().slice(0, 10)}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{b.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {feed.length === 0 && <Empty title="Nothing yet" hint="Announcements, events and guardian messages will appear here." />}
        </div>
      </div>

      {(canPost || isAdmin) && (
        <div className="space-y-4">
          {canPost && (
            <Card>
              <h2 className="flex items-center gap-2 font-semibold"><Megaphone size={15} className="text-primary" /> Post an announcement</h2>
              <form action={postAnnouncement.bind(null, slug)} className="mt-3 space-y-2.5">
                <Field label="Title"><input name="title" required className={inputCls} /></Field>
                <Field label="Message"><textarea name="body" rows={3} required className={inputCls} /></Field>
                <Field label="Audience">
                  <select name="classId" className={inputCls}>
                    <option value="">School-wide</option>
                    {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <SubmitButton className={btnCls + " w-full"} pendingText="Posting…">Post</SubmitButton>
                <p className="text-[12.5px] text-muted-foreground">
                  Shows to everyone it concerns the next time they open the app, until acknowledged.
                </p>
              </form>
            </Card>
          )}
          {isAdmin && (
            <>
              <Card>
                <h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={15} className="text-danger" /> Add an event</h2>
                <form action={createEvent.bind(null, slug)} className="mt-3 space-y-2.5">
                  <Field label="Event title"><input name="title" required className={inputCls} /></Field>
                  <Field label="Starts"><input name="startsAt" type="datetime-local" required className={inputCls} /></Field>
                  <SubmitButton className={btnCls + " w-full"} pendingText="Adding…">Add event</SubmitButton>
                </form>
              </Card>
              <Card>
                <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText size={15} className="text-muted-foreground" /> Message all guardians</h2>
                <form action={sendBlast.bind(null, slug)} className="mt-3 space-y-2.5">
                  <Field label="Message">
                    <textarea name="body" rows={3} maxLength={300} required className={inputCls} />
                  </Field>
                  <div className="flex gap-4 text-[14px]">
                    <label className="flex items-center gap-1.5"><input type="checkbox" name="viaSms" defaultChecked /> SMS</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" name="viaEmail" /> Email</label>
                  </div>
                  <SubmitButton className={btnCls + " w-full"} pendingText="Sending…">Send</SubmitButton>
                  <p className="text-[12.5px] text-muted-foreground">
                    Goes only to {school.name}&apos;s guardians, signed with the school&apos;s name.
                    Email reaches guardians with an email on file.
                  </p>
                </form>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
