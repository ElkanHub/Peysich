# 02 — Multi-Tenancy

## The model: shared database, shared schema, `school_id` on every row

Three standard options were weighed:

| Model | Isolation | Cost at 50 schools | Ops burden | Verdict |
|---|---|---|---|---|
| Database per school | Strongest | ~50 Neon projects/branches to migrate, monitor, pay for | Heavy | ❌ kills the cost curve and the "self-serve in minutes" flow |
| Schema per school | Strong | One DB but 50 schemas × every migration | Medium-heavy | ❌ migration pain grows linearly with sales success |
| **Shared schema + `school_id` column** | Logical (enforced in code + RLS) | **One database, flat cost** | Light | ✅ chosen |

Shared-schema is what virtually every SaaS at our price point runs. Isolation is enforced by
**three layers**, so a single mistake cannot leak data across schools:

1. **Tenant context, resolved once.** Middleware maps subdomain → `schoolId`, verifies the session
   user belongs to that school, and stamps the request. No handler ever takes `schoolId` from user input.
2. **Scoped data access.** All queries go through a per-request repository that injects
   `WHERE school_id = ?` automatically. Writing a raw unscoped query on tenant tables is a lint error.
3. **Postgres Row-Level Security as the backstop.** RLS policies on every tenant table check
   `school_id = current_setting('app.school_id')`. Even a buggy query returns nothing cross-tenant.
   (This is the layer that lets us sell "bank-grade isolation" honestly.)

Platform-plane tables (tenants, plans, subscriptions, platform users) have **no** `school_id` —
they live above tenants and are reachable only from `(platform)` routes.

## Tenant identity & URLs

- **Each school gets a subdomain**: `stmarys.peysich.com` *(decision #4 — recommended over path-based)*.
  - Feels owned/premium to the school; clean cookie + auth scoping; one wildcard DNS record on Vercel.
  - Slug chosen at signup, changeable once via support.
- `admin.peysich.com` → platform plane. `peysich.com` / `www` → marketing + signup.
- Custom domains (`portal.stmarys.edu.gh`) become a **premium/custom plan perk** later — Vercel
  supports it natively.

### How subdomains actually work (no per-school DNS work — ever)

Subdomains are **not** created per school. There is one wildcard record, set up once, and after
that a "new subdomain" is nothing but a row in our `schools` table:

1. **One-time setup (you, ~15 minutes, in HANDOFF.md):** point the domain's nameservers at
   Vercel (wildcard domains on Vercel require their nameservers), then add `*.peysich.com` as a
   domain on the Vercel project. Vercel issues and renews a wildcard TLS certificate
   automatically. *(Alternative if you prefer keeping DNS at Cloudflare: proxy `*` through
   Cloudflare to Vercel — either works; pick one in HANDOFF.md.)*
2. **From then on, DNS matches every subdomain automatically.** `anything.peysich.com` already
   resolves to our app — whether or not a school exists with that slug.
3. **The app decides what a subdomain means.** Middleware reads the `Host` header on each
   request, extracts the slug (`stmarys` from `stmarys.peysich.com`), looks it up in `schools`
   (cached), and either serves that tenant's `(school)` routes or shows a "school not found"
   page. Reserved slugs (`www`, `admin`, `api`, `app`, `mail`, …) are blocked at signup.
4. **School signup = one DB insert.** The subdomain is live the same second the row exists.
   Zero DNS work, zero certificates, zero deploys, zero involvement from you per school.

Local dev mirrors this with `*.localhost` (e.g. `stmarys.localhost:3000`), which browsers
resolve natively, so tenancy is exercised on every dev machine, not just production.

## The tenant lifecycle

```mermaid
stateDiagram-v2
    [*] --> Trial: self-serve signup
    Trial --> Active: subscribes & pays
    Trial --> Expired: 14 days, no payment
    Active --> PastDue: payment fails
    PastDue --> Active: pays (grace: 7 days)
    PastDue --> Suspended: grace ends
    Suspended --> Active: pays outstanding
    Expired --> Active: subscribes
    Suspended --> Archived: 90 days
    Expired --> Archived: 90 days
    Archived --> [*]: data export offered, then delete
```

- **Trial**: full Standard-plan features, capped (e.g. 50 students) — enough to feel it, not run on it.
- **Suspended**: read-only lock, not deletion. Admins see a "settle payment" wall; data intact.
  Schools mistrust systems that can vanish their records — we never hard-delete on payment failure.
- **Archived → delete**: export (CSV/PDF bundle) offered before any destruction. Deletion is a
  platform-plane action with confirmation, never automatic without notice.

## What the platform plane manages (our console)

| Area | Capabilities |
|---|---|
| Tenants | Create (or approve), view, suspend/reactivate, archive, slug/domain management |
| Switchboard | Per-school module toggles (plan defaults + per-school overrides), limits (student caps), trial extensions |
| Billing | Plans, prices, custom-plan composer (pick modules → set price), invoices, payment history, dunning status |
| Users | Platform staff accounts & roles (owner, support); **impersonate school admin** (audited, visible banner) |
| Health | Per-tenant usage (students, storage, SMS credits), error rates, slow queries, activity |
| Audit | Every platform action logged: who, what, which tenant, when |

## Onboarding flow (self-serve, target < 10 minutes to usable)

1. Sign up (name, email/phone, password) → verify.
2. Create school: name, slug, levels offered (creche → JHS9), academic year + term dates.
3. Pick plan → pay via Paystack (or start trial).
4. Guided setup checklist inside the dashboard: add classes → add staff (bulk invite) →
   add students (CSV import or forms) → link parents.
5. Switchboard auto-provisions the plan's modules; dashboard composes itself accordingly.

CSV import for students/staff is **first-class from day one** — it is the single biggest
onboarding friction for real schools, and doing it well is a sales weapon.

## Cross-tenant safety rules (enforced, not aspirational)

- Uploaded files are keyed `school/{schoolId}/...` in R2; presigned URLs are generated only after
  a tenant-scoped permission check.
- Search, exports, and reports run through the same scoped repository — no side doors.
- Per-tenant rate limits on writes and SMS sends so one school can't degrade others.
- Backups: Neon PITR covers disasters; per-tenant export covers "school leaves" cleanly.
