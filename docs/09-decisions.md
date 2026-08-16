# 09 — Decisions For You

Everything else in these docs I'm confident in. These are the calls that are genuinely yours —
each with my recommendation and why. Reply with a list like "1A, 2A, 3A, 4A, 5A, 6-later"
and building starts.

---

## 1. Auth provider — **the one I feel strongest about**

| Option | Cost at 20 schools (~20k users) | Trade-off |
|---|---|---|
| **A. Better Auth (self-hosted)** ⭐ | **$0** | We own login/sessions/reset code (~a few days of Phase 0 work, well-trodden library) |
| B. Clerk (the video's choice) | ~$200–400/mo and climbing | Fastest to integrate, but per-MAU pricing scales with students+parents while revenue scales per school — it structurally eats the margin this whole architecture protects |

**Recommendation: A.** The video used Clerk because it's a tutorial for one school under the free
tier. We're a multi-tenant platform; user count is our growth metric and shouldn't be a cost metric.

**Confirmed requirement:** sign-in methods are **email/password + Google**. Better Auth ships a
Google provider out of the box (free; needs a Google OAuth client ID/secret — listed in HANDOFF.md).
Google accounts link to existing users by verified email. School-created student/parent accounts
without email still use username/password — Google is an addition, not a replacement.

## 2. ORM

| Option | Trade-off |
|---|---|
| **A. Drizzle** ⭐ | Lighter/faster on serverless (smaller cold starts), SQL-transparent, clean RLS story |
| B. Prisma (the video's choice) | More familiar from the tutorial, heavier runtime; totally workable |

**Recommendation: A.** Every query pattern in the video (transactions, includes/selects,
where-builders) maps 1:1 to Drizzle. If you'd rather stay literally on the video's toolchain,
B costs us some cold-start speed, not correctness.

## 3. Payment gateway

| Option | Trade-off |
|---|---|
| **A. Paystack** ⭐ | MoMo + cards, subscriptions API, split payments (for school-fee collection), strong Ghana presence |
| B. Flutterwave | Similar coverage; API ergonomics slightly rougher in my read |
| C. Stripe | Best API, weak Ghana/MoMo story — wrong market fit |

**Recommendation: A**, with the gateway wrapped behind our own billing interface so switching later
is contained.

## 4. Tenant URLs

| Option | Trade-off |
|---|---|
| **A. Subdomain per school** (`stmarys.peysich.com`) ⭐ | Premium feel, clean auth scoping, wildcard DNS on Vercel; slightly more middleware work |
| B. Path-based (`peysich.com/stmarys`) | Simpler, feels cheaper, cookie scoping is messier |

**Recommendation: A.** It also gives us custom domains as a Premium perk for free later.

## 5. Hosting

| Option | Trade-off |
|---|---|
| **A. Vercel** ⭐ | Best Next.js DX, previews, $20 flat at our scale (files bypass it) |
| B. Render/Railway | Flat-rate insurance if Vercel per-seat pricing ever stings; worse DX |

**Recommendation: A now**, keep the app free of Vercel-only APIs so B stays a weekend migration.

## 6. Pricing numbers (not blocking — needed by Phase 3)

The plan *structure* (3 + custom, per-term anchor, module bundles, student caps) is settled in
doc 04. The actual GHS figures are a market call: my working numbers are Starter 300–450 /
Standard 750–1,200 / Premium 1,500–2,500 per term + onboarding fee. Validate against 3–5 real
schools during the pilot before locking. You can answer "later" here.

## 7. Product name check

Docs assume **Peysich** (the repo name) is the product/brand. Confirm, or give the real name
before the marketing site phase.

---

### Also flagged, decided by default unless you object

- **English-only UI at launch** (translation layer in from day one).
- **No native mobile apps in v1** — responsive web + installable PWA; native apps are a
  later phase if parent engagement demands it.
- **Student logins optional per school** (parents are the primary "student-view" consumers
  below JHS).
- **We are not a money custodian**: parent fee payments settle directly to school accounts via
  split payments; we never pool schools' money.
