# 08 — Roadmap

Principle: **ship the smallest thing a real school will pay for, on the final architecture.**
Tenancy, modules, and the switchboard are Phase 0 — retrofitting them later is a rewrite,
so they come first even though they're invisible to customers.

## Phase 0 — Foundation (the platform skeleton)

*Everything else stands on this. No school-facing features yet.*

- Repo, CI, environments (local Docker PG / Neon branches / Vercel previews).
- Design tokens + morphed shadcn base kit + app shell (sidebar/topbar/page-header/DataTable/forms).
- Auth (Better Auth): login, sessions, password reset; role model.
- Tenancy: schools table, subdomain middleware, scoped repository, RLS policies, audit log.
- Module system: manifest type, registry, `isEnabled`, nav/route/action gating.
- Platform plane v0: create school, list schools, the switchboard, impersonation.

**Exit test:** two dummy schools on two subdomains, different module sets, provably isolated data.

> **HANDOFF.md** — maintained from Phase 0 and finalized at deployment: every credential,
> account, and DNS step that only the owner can do (domain nameservers + wildcard, Neon, R2,
> Google OAuth client, Paystack keys + webhook, Resend, SMS gateway), each with exact
> instructions and the env var it fills. The app runs locally with none of them (Docker
> Postgres, auth without Google, fake payment mode) so the build never blocks on credentials.

## Phase 1 — Core SIS (the Starter plan exists)

- Academic structure: years, terms, levels, classes, subjects.
- Students & guardians: profiles, photos (R2 presigned), linking, **CSV import**.
- Staff: profiles, invites, roles.
- Enrolment + end-of-year promotion wizard.
- Role dashboards v1 (admin/teacher/parent) + My Account + School Settings.

**Exit test:** a real school's full roster imported and browsable in under an hour.

## Phase 2 — Attendance + Assessment (the daily-use loop)

- Attendance: daily register (per-lesson mode arrives with timetable), reports, absence flags.
- Assessment: grading scheme config (CA/exam weights, grade bands), score entry (fast,
  keyboard-first, per class-subject), terminal report cards → PDF in R2, parent visibility.
- Preschool skills-based reporting mode.

**Exit test:** a term closed end-to-end: attendance marked, scores entered, report cards
generated and downloaded by a parent. **This is the pilot-school milestone — go live free
with 1–2 friendly schools here.**

## Phase 3 — Monetization (the business exists)

- Plans as data, trial flow, Paystack subscriptions + webhooks + dunning states.
- Self-serve signup → school creation → checkout (the doc 04 funnel).
- Billing page in school plane; custom-plan composer in platform console.
- Marketing site + pricing page.

**Exit test:** a school signs up, pays with MoMo, and onboards with zero contact from us.

## Phase 4 — Standard plan features (the upsell exists)

- Timetable (clash detection, teacher/student views) → unlocks per-lesson attendance.
- Homework & assignments (submissions → R2, marking feeds assessment).
- Comms: announcements & events (class-scoped or school-wide), SMS wallets + blasts.
- Fees module: structures, invoices, MoMo collection via Paystack split payments, receipts,
  arrears & defaulters reporting.

**Exit test:** a Standard school runs a full term including fee collection through the system.

## Phase 5 — Premium modules & scale polish

- Admissions pipeline, Library, Transport, Inventory, HR-lite, Advanced analytics —
  **in whatever order paying customers actually request** (the module system makes order cheap
  to change).
- Platform analytics & cost tripwires dashboard, per-tenant exports, dark mode,
  custom domains, French/Twi strings.

## Working rhythm

- Ship to `main` behind module flags — the switchboard doubles as a feature-flag system,
  so half-built modules can be force-on for pilot schools only.
- Every phase ends with its exit test against a **seeded realistic school**
  (600 students, 25 staff — the video's seed approach, scaled up) plus a load-sanity pass
  on the hot tables.
- Pilot feedback between phases 2→4 decides Phase 5 order.
