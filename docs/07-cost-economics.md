# 07 — Cost & Economics

The Gemini numbers were directionally right. Here they are consolidated, corrected where our
architecture changes them, and extended with the decisions that *keep* the curve flat.

## Why this architecture stays cheap (the four guardrails)

1. **Neon scale-to-zero** — schools work ~7am–5pm weekdays, ~36 weeks/year. Compute sleeps the
   other ~70% of the time. An always-on VPS/RDS can't do this.
2. **R2 with $0 egress + presigned direct transfer** — report cards, photos, and submissions
   never touch Vercel bandwidth, and downloads cost nothing no matter how many parents pull PDFs.
3. **Self-hosted auth (Better Auth)** — the silent margin killer avoided. Per-MAU auth pricing
   scales with *users* (students+parents = thousands per school) while our revenue scales with
   *schools*. Owning auth pins this cost at $0. *(This is why I push back on Clerk — decision #1.)*
4. **SMS as prepaid wallets with markup** — the only per-use cost that scales with engagement
   becomes a profit line instead of a cost line.

## Infrastructure cost by stage

| Stage | Schools (~students) | Neon | R2 | Vercel | Email | **Total /mo** |
|---|---|---|---|---|---|---|
| Build & MVP | 0–1 pilot | $0 (free tier) | $0 | $0 (Hobby) | $0 | **$0** |
| First customers | 2–5 (~1.5k) | $5–15 | $0 | $20 (Pro) | $0 | **$25–35** |
| Growth | 10–25 (~10k) | $15–40 | $2–5 | $20 | $0–20 | **$40–85** |
| Regional scale | 50 (~20k) | $40–80 | $5–15 | $20–40 | $20 | **$85–155** |
| Big | 150 (~60k) | $100–200 | $15–40 | $40–100 | $20 | **$175–360** |

Notes:
- Vercel stays ~$20 because pages are lightweight server-rendered JSON/HTML and files bypass it.
  The next real step is only if team seats grow (it's per-seat) — decision #5 keeps Render/Railway
  (~$20 flat) as a fallback if that ever stings.
- Neon storage grows slowly: school data is text-heavy, not blob-heavy (blobs are in R2).
  20k students of records is single-digit GB.
- Domains, monitoring (free tiers of Sentry/Axiom), and backups (Neon PITR included) round to ~$0–20.

## Revenue model recap (from doc 04)

Per-term plan billing, working numbers (GHS, ≈ shown in USD for margin math):

| Plan | /term (GHS) | ≈ /mo (USD) |
|---|---|---|
| Starter | 300–450 | ~$8–12 |
| Standard | 750–1,200 | ~$20–32 |
| Premium | 1,500–2,500 | ~$40–65 |

Plus: onboarding fees (one-time, pure margin), SMS bundle margin (20–30%), and later a
convenience margin on fee collection.

## Profit at each stage (conservative mix: 30% Starter / 50% Standard / 20% Premium)

| Stage | Schools | Avg rev/school/mo | Revenue /mo | Infra /mo | **Gross profit /mo** | Margin |
|---|---|---|---|---|---|---|
| First customers | 5 | ~$22 | ~$110 | ~$30 | **~$80** | ~73% |
| Growth | 20 | ~$24 | ~$480 | ~$60 | **~$420** | ~88% |
| Regional | 50 | ~$26 | ~$1,300 | ~$120 | **~$1,180** | ~91% |
| Big | 150 | ~$28 | ~$4,200 | ~$270 | **~$3,930** | ~94% |

(Excludes payment gateway % — Paystack takes its cut per transaction (~2%), priced into plans —
and excludes our time/support/marketing, which will dwarf infra and is where real money goes.)

**The shape that matters:** infra grows sub-linearly (~$1–2 per additional school) while revenue
grows linearly per school. Margin *improves* with scale. Break-even on infra is literally the
second paying school.

## Cost tripwires (we alert on these in the platform console)

- Neon CU-hours/month and storage GB vs plan thresholds.
- R2 storage per school vs plan caps (enforced at upload time, not just billed).
- Vercel bandwidth & function duration anomalies (a runaway query pattern shows up here first).
- SMS wallet liabilities vs gateway balance (never send unsold credit).
- Per-tenant usage outliers — one school doing something weird shouldn't be discovered on the invoice.
