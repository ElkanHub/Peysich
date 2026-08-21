import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "@/db";
import { announcements, events, classes, smsLog } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { postAnnouncement, createEvent, sendBlast } from "./actions";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

export default async function Comms({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "comms");
  const [anns, evts, cls, [sms]] = await Promise.all([
    db.select().from(announcements).where(eq(announcements.schoolId, school.id))
      .orderBy(desc(announcements.createdAt)).limit(15),
    db.select().from(events).where(eq(events.schoolId, school.id))
      .orderBy(desc(events.startsAt)).limit(10),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)`, cost: sql<number>`coalesce(sum(cost_pesewas),0)` })
      .from(smsLog).where(and(eq(smsLog.schoolId, school.id))),
  ]);
  const className = new Map(cls.map((c) => [c.id, c.name]));
  // parents/students see school-wide + their own classes only (video's model)
  let visible: Set<string> | null = null;
  if (user.role === "parent")
    visible = new Set((await getParentChildren(school.id, user.id)).map((k) => k.classId).filter(Boolean) as string[]);
  else if (user.role === "student")
    visible = new Set([(await getStudentSelf(school.id, user.id))?.classId].filter(Boolean) as string[]);
  const seeAnns = visible ? anns.filter((a) => !a.classId || visible.has(a.classId)) : anns;
  const seeEvts = visible ? evts.filter((e) => !e.classId || visible.has(e.classId)) : evts;
  const canPost = ["admin", "teacher", "platform_admin"].includes(user.role);
  const isAdmin = ["admin", "platform_admin"].includes(user.role);

  return (
    <div className="grid max-w-4xl gap-5 md:grid-cols-2">
      <div>
        <PageHeader title="Announcements" />
        <div className="space-y-3">
          {seeAnns.map((a) => (
            <Card key={a.id}>
              <p className="font-medium">{a.title}
                <span className="ml-2 text-xs text-muted-foreground">
                  {a.classId ? className.get(a.classId) : "School-wide"} · {a.createdAt.toISOString().slice(0, 10)}
                </span></p>
              <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
            </Card>
          ))}
        </div>
        {canPost && (
          <Card className="mt-4">
            <form action={postAnnouncement.bind(null, slug)} className="space-y-2">
              <Field label="Title"><input name="title" required className={inputCls} /></Field>
              <Field label="Message"><textarea name="body" rows={2} required className={inputCls} /></Field>
              <Field label="Audience">
                <select name="classId" className={inputCls}>
                  <option value="">School-wide</option>
                  {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <SubmitButton className={btnCls}>Post</SubmitButton>
            </form>
          </Card>
        )}
      </div>
      <div>
        <PageHeader title="Events" />
        <div className="space-y-3">
          {seeEvts.map((e) => (
            <Card key={e.id}>
              <p className="font-medium">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {e.startsAt.toISOString().slice(0, 16).replace("T", " ")} · {e.classId ? className.get(e.classId) : "School-wide"}
              </p>
            </Card>
          ))}
        </div>
        {isAdmin && (
          <>
            <Card className="mt-4">
              <form action={createEvent.bind(null, slug)} className="space-y-2">
                <Field label="Event title"><input name="title" required className={inputCls} /></Field>
                <Field label="Starts"><input name="startsAt" type="datetime-local" required className={inputCls} /></Field>
                <SubmitButton className={btnCls}>Add event</SubmitButton>
              </form>
            </Card>
            <Card className="mt-4">
              <h2 className="font-semibold">SMS blast</h2>
              <p className="text-xs text-muted-foreground">
                {String(sms.n)} sent · GHS {(Number(sms.cost) / 100).toFixed(2)} used. Cost shown before send.
              </p>
              <form action={sendBlast.bind(null, slug)} className="mt-2 space-y-2">
                <Field label="Message (to all guardians)">
                  <textarea name="body" rows={2} maxLength={160} required className={inputCls} />
                </Field>
                <SubmitButton className={btnCls}>Send to all guardians</SubmitButton>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
