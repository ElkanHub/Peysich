import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { messageLinks, messages, schools } from "@/db/schema";
import { presignDownload, r2Enabled } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Message from your school", robots: { index: false, follow: false } };

/** The one-tap link in a ping: one message, the school's name and crest,
 *  nothing else. The token is the whole credential — no sign-in. Opening it
 *  marks it read, which is what the school's "Read by n" counts.
 *  ponytail: any GET counts as read, so a phone that previews links can mark
 *  one early; move the mark to a client beacon if the counts read too high. */
export default async function OneMessage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = /^[A-Za-z0-9_-]{12}$/.test(token)
    ? await db.select({ m: messages, school: schools }).from(messageLinks)
        .innerJoin(messages, eq(messageLinks.messageId, messages.id))
        .innerJoin(schools, eq(messages.schoolId, schools.id))
        .where(eq(messageLinks.token, token))
    : [];
  if (!row) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-xl font-bold">This link does not open anything</h1>
        <p className="mt-2 text-[16px] text-muted-foreground">Please check the message again, or call the school.</p>
      </main>
    );
  }
  await db.update(messageLinks).set({ openedAt: new Date() })
    .where(and(eq(messageLinks.token, token), isNull(messageLinks.openedAt)));
  const { m, school } = row;
  const crest = school.branding.logoUrl && r2Enabled ? await presignDownload(school.branding.logoUrl).catch(() => null) : null;

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {crest && <img src={crest} alt="" className="h-12 w-12 rounded-md object-contain" />}
        <p className="text-[17px] font-bold">{school.name}</p>
      </div>
      <h1 className="mt-6 text-[24px] font-bold leading-snug">{m.title}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {m.createdAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Accra" })}
      </p>
      <p className="mt-5 whitespace-pre-wrap text-[19px] leading-relaxed">{m.body}</p>
      {school.branding.phone && (
        <p className="mt-8 rounded-lg bg-muted px-4 py-3 text-[16px]">
          Questions? Call the school on <a href={`tel:${school.branding.phone}`} className="font-semibold text-primary">{school.branding.phone}</a>.
        </p>
      )}
    </main>
  );
}
