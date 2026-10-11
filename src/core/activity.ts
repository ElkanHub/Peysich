import { sql } from "drizzle-orm";
import { db } from "@/db";

/* ─────────────────────────────────────────────────────────────────────────
 * The activity log (docs/12 §3.2): one feed over everything that happens on
 * the platform and in every school, as EVENTS, never contents. A school's
 * row says "register marked for Basic 4 A", "payment recorded, GHS 150",
 * "3 absence alerts by SMS" — never a child's name, a mark, a phone number
 * or the text of a message. Built from the tables that already exist; the
 * log writes nothing of its own.
 * ──────────────────────────────────────────────────────────────────────── */

export const ACTIVITY_KINDS: Record<string, string> = {
  console: "Console action", ops: "SchoolSpec ↔ school", signin: "Sign-in", register: "Register marked",
  scores: "Scores entered", reports: "Report cards", bills: "Bills", payments: "Payments", messages: "Messages sent",
};

export type ActivityRow = {
  at: Date; schoolId: string | null; schoolName: string | null;
  actorName: string | null; actorRole: string | null; kind: string; summary: string;
};

export type ActivityFilter = {
  school?: string; role?: string; kind?: string; from?: string; to?: string; q?: string;
  page?: number; perPage?: number;
};

/** The union, as SQL, so Postgres does the sorting and paging. Every arm
 *  yields (at, school_id, actor_user_id, actor_role, kind, summary). */
const FEED = sql`
  select a.created_at as at, a.school_id, a.actor_user_id, u.role as actor_role, 'console' as kind,
         a.action || case when a.detail->>'reason' is not null then ': ' || (a.detail->>'reason') else '' end as summary
    from platform_audit_logs a left join "user" u on u.id = a.actor_user_id
  union all
  select t.created_at, t.school_id, null, case when t.by is null then 'system' else 'platform_admin' end, 'ops',
         t.event || ': ' || left(t.detail, 140)
    from platform_timeline t
  union all
  select s.created_at, u.school_id, s.user_id, u.role, 'signin', 'Signed in'
    from session s join "user" u on u.id = s.user_id
  union all
  select r.day, r.school_id, r.marked_by, u.role, 'register', 'Register marked for ' || coalesce(c.name, 'a class') || ' (' || r.n || ' children)'
    from (select school_id, class_id, marked_by, max(created_at) as day, count(*) as n
            from attendance_records group by school_id, class_id, marked_by, date) r
    left join classes c on c.id = r.class_id left join "user" u on u.id = r.marked_by
  union all
  select r.day, r.school_id, r.entered_by, u.role, 'scores', 'Scores entered for ' || coalesce(c.name, 'a class') || ' · ' || coalesce(sb.name, 'a subject') || ' (' || r.n || ')'
    from (select school_id, class_id, subject_id, entered_by, max(updated_at) as day, count(*) as n
            from component_scores group by school_id, class_id, subject_id, entered_by, date(updated_at)) r
    left join classes c on c.id = r.class_id left join subjects sb on sb.id = r.subject_id left join "user" u on u.id = r.entered_by
  union all
  select r.day, r.school_id, null, 'admin', 'reports', r.n || ' report cards sent to families'
    from (select school_id, max(published_at) as day, count(*) as n from report_cards
           where published = true and published_at is not null group by school_id, date(published_at)) r
  union all
  select r.day, r.school_id, null, 'admin', 'bills', r.n || ' bills created, GHS ' || round(r.total / 100.0)
    from (select school_id, max(created_at) as day, count(*) as n, sum(total_pesewas) as total
            from fee_invoices group by school_id, date(created_at)) r
  union all
  select p.created_at, p.school_id, p.recorded_by, u.role, 'payments',
         'Payment recorded, GHS ' || round(p.amount_pesewas / 100.0) || ' by ' || p.method || case when p.voided_by is not null then ' (voided)' else '' end
    from fee_payments p left join "user" u on u.id = p.recorded_by
  union all
  select r.hour, r.school_id, null, 'system', 'messages', r.n || ' ' || r.kind || ' by ' || r.channel || case when r.status = 'failed' then ' (failed)' when r.status = 'held' then ' (held, no balance)' else '' end
    from (select school_id, kind, channel, status, date_trunc('hour', created_at) as hour, count(*) as n
            from outbox where plane = 'school' group by school_id, kind, channel, status, date_trunc('hour', created_at)) r
`;

export async function activityFeed(f: ActivityFilter) {
  const perPage = f.perPage ?? 50, page = Math.max(1, f.page ?? 1);
  const where = [sql`true`];
  if (f.school) where.push(sql`e.school_id = ${f.school}`);
  if (f.role) where.push(sql`e.actor_role = ${f.role}`);
  if (f.kind) where.push(sql`e.kind = ${f.kind}`);
  if (f.from) where.push(sql`e.at >= ${f.from}::date`);
  if (f.to) where.push(sql`e.at < (${f.to}::date + 1)`);
  if (f.q) where.push(sql`(e.summary ilike ${"%" + f.q + "%"} or s.name ilike ${"%" + f.q + "%"} or u.name ilike ${"%" + f.q + "%"})`);
  const cond = sql.join(where, sql` and `);
  const base = sql`from (${FEED}) e left join schools s on s.id = e.school_id left join "user" u on u.id = e.actor_user_id where ${cond}`;
  const [rows, [{ n }]] = await Promise.all([
    db.execute(sql`select e.at, e.school_id, s.name as school_name, u.name as actor_name, e.actor_role, e.kind, e.summary ${base}
      order by e.at desc limit ${perPage} offset ${(page - 1) * perPage}`),
    db.execute(sql`select count(*)::int as n ${base}`) as unknown as Promise<[{ n: number }]>,
  ]);
  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      at: new Date(r.at as string), schoolId: r.school_id as string | null, schoolName: r.school_name as string | null,
      actorName: r.actor_name as string | null, actorRole: r.actor_role as string | null, kind: r.kind as string, summary: r.summary as string,
    })) as ActivityRow[],
    count: Number(n),
  };
}
