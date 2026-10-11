# 12 — The platform console, second pass

What the console must do for the people who run SchoolSpec: let a small team work in it
without seeing everything, find any account, read what any school is doing without reading
its private contents, run sales and onboarding from one place, know the money properly, see
what messaging costs and earns, and speak to every school or only some of its people. This
document records what was there in October 2026, the research behind the money pages, and
the build.

---

## 1. What was there

- **One role, no grants.** Every console login is `platform_admin` and sees every tab. The
  settings page invites a new admin; nothing limits what they open.
- **All users** lists every account with a role filter and a search box. No school filter,
  no date filter.
- **Audit log** is the last 100 rows of `platform_audit_logs`: console actions and the few
  school actions that write there (score unlocks, term open and close). No filter, no
  school activity.
- **Schools, Onboarding and Leads** are three tabs about the same schools: the pipeline
  board and list, the setup-progress dots, and the marketing-page leads. A lead and the
  school it became are not linked.
- **Financials** shows four tiles, a 12-month bar list of subscription payments, the mix by
  plan and the last 12 payments. Messaging top-ups, installation fees and refunds are not
  counted; nothing is per school; nothing is exportable.
- **Top-up** from a school's Billing page opens Paystack through a server action. When
  Paystack refuses, the action throws, and the school sees the generic error screen with
  "Try again" and no reason. The wallet reference is `wal_<pesewas>_<id>`; Paystack's
  documented reference alphabet is letters, digits, `-`, `.` and `=`.
- **Messaging** shows this month's charges, costs and margin by school and channel, and
  the providers' health. No trend, no log, no delivery rates.
- **Broadcast** posts one announcement into every active school's feed. No audience choice,
  no promo, no scheduling.

## 2. Research: what the money pages should answer

For a subscription business selling by the term to schools in Ghana, the questions that
come up are, in order of how often they are asked:

1. **How much came in, and from where?** Revenue by stream: subscriptions, messaging
   top-ups, installation fees. Cash collected this month, this year, all time.
2. **What is the recurring base?** MRR (every active plan's term price over four months, a
   year price over twelve), ARR, paying schools, average revenue per school. MRR movement
   per month: new, expansion (plan up), contraction, churn.
3. **Are we converting?** Signed up → set up → live → paying, as counts and rates, and the
   median days to first payment.
4. **Who is about to pay, and who has not?** Renewals due in the next 30 days, past due
   with days late, lapsed.
5. **Does messaging pay for itself?** Charged to schools against provider cost, by month and
   channel, and the margin.
6. **What did one school do?** Every transaction on that school with reference, date,
   stream and amount, its subscription periods, its wallet ledger, exportable as a file the
   school can be sent.
7. **Are we on target?** A monthly revenue target to draw against the trend.
8. **Fees processed** (the schools' own money recorded through the app) is not our revenue,
   but it is the clearest signal that a school is alive. It stays as an activity figure,
   per school, never in a revenue total.

Charts that carry those answers, in the house style (direct-labelled, beside a table):
revenue trend with the target rule; revenue by stream segment bar; MRR movement columns;
funnel bars; renewal buckets; messaging charged-against-cost trend; cohort retention grid
by signup month.

## 3. Decisions

| # | Decision | Chosen |
|---|---|---|
| 1 | Console access model | one role, per-person grants mirroring Team & access in schools: a `platform_access` row lists the tabs a member may open; no row = owner, everything |
| 2 | What the activity log shows of a school | events, never contents: sign-ins by role, registers marked, scores entered, report cards sent, bills and payments (amounts, not names of children), messages sent (channel and kind, never the text or number), terms opened and closed, console actions on that school |
| 3 | Schools, Onboarding, Leads | one Schools area with tabs: Board, List, Onboarding, Leads; a lead can be linked to the school it became |
| 4 | Revenue definition | subscriptions + wallet top-ups and manual credits paid for + installation fees − refunds; fees processed is activity, not revenue |
| 5 | MRR | term price ÷ 4, year price ÷ 12, over schools with status active |
| 6 | Revenue target | one monthly number in platform settings |
| 7 | Top-up | the action catches Paystack's refusal and shows its sentence; the reference becomes `wal-<pesewas>-<id>`; the callback accepts both spellings |
| 8 | Broadcast audience | roles (admins, teachers, parents, students) × schools (all live, or chosen); a notice lands in the feed and pings through the one door; a promo takes the screen |
| 9 | Promo cadence | shown on a fresh open, dismissable, shown again after `every` hours (default 24) until `endsAt`; counted per person on the device, no server round-trip |

## 4. Data model

```
platform_access      user_id pk, tabs jsonb text, updated_at
leads                + school_id (the school it became)
platform_broadcasts  + kind notice|promo, roles jsonb, school_ids jsonb|null, cta_label, cta_url,
                       starts_at, ends_at, every_hours, image_url
platform settings    + revenue_target_pesewas
```

## 5. The build

1. **Top-up fix** and the schema above, one migration.
2. **Console core** `src/core/console.ts`: the tab list, `getConsoleGrants`, `requireConsole(tab)`;
   the layout filters the nav; every page asserts its tab.
3. **Team** `/platform/team`: members, their tabs with presets (owner, sales, support,
   finance), invite, remove.
4. **All users**: filters for school, role, joined-since, platform-only; sortable.
5. **Activity log** `src/core/activity.ts`: one feed from audit rows, the ops timeline,
   sign-ins, registers, scores, report cards, bills, payments, outbox counts and term
   events, with filters school, role, kind, dates, search; paged; linked from every school.
6. **Schools hub**: tabs Board, List, Onboarding, Leads under `/platform/schools`; old routes
   redirect; leads get a status filter, a note, and a link to the school.
7. **Messaging**: this month's tiles with delivery and failure rates, a six-month trend of
   messages and money, by kind, by school, provider health, and a log tab with filters.
8. **Broadcast**: audience, kind, schedule, promo fields; the promo gate in the school app.
9. **Financials**: overview with the target; analytics; per-school statement; CSV export.

---

## 6. Shipped (October 2026)

See the commit "Console: team access, activity log, schools hub, money, messaging,
broadcast and promos". Deliberate shortcuts are marked `ponytail:` in the code:

- Installation revenue is read from the ops timeline's "paid" entries and the fee quoted on
  the school, since no ledger row is written for it.
- Promo "seen" counts live on the device; the console shows reach, not views.
- Activity log events come from existing tables; nothing new is written for it.
