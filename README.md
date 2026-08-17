# Peysich — School Management SaaS

Multi-tenant school management platform for **Preschool → JHS** (no SHS, no university).
Low-cost at any scale, fast, modular, self-serve subscriptions.

> **Status: Built through Phase 5.** All six roadmap phases are implemented and verified
> (see `docs/08-roadmap.md`). Deployment needs the owner steps in **HANDOFF.md**.

## Run it locally

```bash
docker compose up -d          # Postgres (or any PG on :5432, creds in .env.example)
cp .env.example .env
npm install
npm run db:migrate            # apply migrations
npm run db:seed               # plans + 2 demo schools + users (password123)
npx tsx --env-file=.env src/db/seed-roster.ts   # 221-student demo roster
npm run dev
```

Then open `stmarys.localhost:3000` (admin@stmarys.test), `littlestars.localhost:3000`,
`admin.localhost:3000` (platform@peysich.test), or `localhost:3000/signup` for the
self-serve funnel. Payments run in fake mode until Paystack keys exist.

**No wildcard subdomains where you're hosting (e.g. `*.vercel.app`)?** The app falls back
to preview mode on the root host: enter a school at `/t/<slug>`, leave with `/t/exit`,
platform console at `/platform`. Subdomain mode activates automatically once a real
domain + wildcard is configured (see HANDOFF.md §0–1).

## The docs (read in order)

| # | Doc | What it answers |
|---|-----|-----------------|
| 0 | [docs/00-overview.md](docs/00-overview.md) | The whole map — what we are building, in one picture |
| 1 | [docs/01-architecture.md](docs/01-architecture.md) | Tech stack, how the pieces talk, why each choice |
| 2 | [docs/02-multi-tenancy.md](docs/02-multi-tenancy.md) | Tenant model, platform plane vs school plane, data isolation |
| 3 | [docs/03-modules.md](docs/03-modules.md) | The module system, the switchboard, every module we'll ever sell |
| 4 | [docs/04-plans-billing.md](docs/04-plans-billing.md) | The 3 plans + custom, self-serve subscription flow, payments |
| 5 | [docs/05-data-model.md](docs/05-data-model.md) | Database schema — core entities and how they relate |
| 6 | [docs/06-ui-ux.md](docs/06-ui-ux.md) | shadcn/ui premium morph, layout rules, table principles |
| 7 | [docs/07-cost-economics.md](docs/07-cost-economics.md) | Infra cost vs revenue vs profit at every stage |
| 8 | [docs/08-roadmap.md](docs/08-roadmap.md) | Build order — phases, what ships when |
| 9 | [docs/09-decisions.md](docs/09-decisions.md) | **⬅ The calls only you can make. Start or end here.** |
| 10 | [docs/10-role-flows.md](docs/10-role-flows.md) | What each role actually does in the app, flow by flow, and how pages are tuned for them |

## The one-paragraph pitch

One codebase, one database, many schools. Each school gets its own subdomain, its own users
(admin, teachers, students, parents), and only the modules their plan (or our switchboard) turns on.
We run a platform control panel above all schools — onboarding, billing, module toggles, health.
Infrastructure is serverless and scale-to-zero (Neon + Vercel + Cloudflare R2), so cost stays
near-flat while revenue scales per school.
