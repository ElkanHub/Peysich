# Peysich — School Management SaaS

Multi-tenant school management platform for **Preschool → JHS** (no SHS, no university).
Low-cost at any scale, fast, modular, self-serve subscriptions.

> **Status: Planning phase.** This branch contains the full architecture blueprint for review.
> Nothing here is code yet — read the docs, make the calls in `docs/09-decisions.md`, and building starts.

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
