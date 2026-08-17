# HANDOFF — Owner Setup Checklist

Everything only you can do. Each item says where to do it and which env var it fills
(set env vars in Vercel → Project → Settings → Environment Variables).
**The app runs fully locally with none of these** (`npm run dev` + local Postgres).

Status: 🚧 maintained during the build; finalized at deployment. Items marked *later*
aren't needed until the phase shown.

## 0. Deploy WITHOUT a domain first (preview mode — works today)
No domain needed to see it live. On `yourapp.vercel.app` the app runs in **preview mode**:
schools are entered via a link instead of a subdomain (auth still verifies membership —
same security, different URL shape).
- [ ] Vercel: import the repo, set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and:
      `NEXT_PUBLIC_ROOT_DOMAIN=yourapp.vercel.app`, `BETTER_AUTH_URL=https://yourapp.vercel.app`.
- [ ] Migrate + seed Neon (section 2), then:
      - Marketing/signup: `https://yourapp.vercel.app`
      - A school: visit `https://yourapp.vercel.app/t/<school-slug>` once, then sign in
        (`/t/exit` returns to the marketing site)
      - Platform console: `https://yourapp.vercel.app/platform`
When you later complete section 1 (real domain + wildcard) and update the two env vars +
redeploy, subdomain mode takes over automatically — no code changes.

## 1. Domain & DNS (when you buy the domain)
- [ ] Buy the domain (e.g. `peysich.com`).
- [ ] In Vercel: add the project, then add domains `peysich.com`, `www`, and `*.peysich.com`.
- [ ] Point the domain's **nameservers to Vercel** (required for wildcard TLS). Vercel shows the
      two NS values when you add the domain.
- [ ] Set `NEXT_PUBLIC_ROOT_DOMAIN=peysich.com`.

## 2. Database — Neon (Phase 0 deploy)
- [ ] Create a Neon project (region: closest available to Ghana, e.g. AWS eu-west).
- [ ] Copy the pooled connection string → `DATABASE_URL`.

## 3. Auth (Phase 0 deploy)
- [ ] Generate a secret: `openssl rand -base64 32` → `BETTER_AUTH_SECRET`.
- [ ] Set `BETTER_AUTH_URL=https://peysich.com`.
- [ ] **Google sign-in**: Google Cloud console → create project → OAuth consent screen
      (external) → Credentials → OAuth client (Web). Authorized redirect URI:
      `https://peysich.com/api/auth/callback/google` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## 4. File storage — Cloudflare R2 (Phase 1)
- [ ] Cloudflare account → R2 → create bucket `peysich` → API token (Object Read & Write)
      → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

## 5. Payments — Paystack (*later*, Phase 3)
- [ ] Register/verify a Paystack business account (needs business KYC docs).
- [ ] Copy live keys → `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`.
- [ ] Set webhook URL in Paystack dashboard: `https://peysich.com/api/webhooks/paystack`.

## 6. Email — Resend (*later*, Phase 1–2)
- [ ] Resend account → verify sending domain (add their DNS records in Vercel DNS)
      → `RESEND_API_KEY`.

## 7. SMS — Arkesel or Hubtel (*later*, Phase 4)
- [ ] Create account, buy initial credits, register default sender ID → `SMS_API_KEY`.

## 8. First deploy & platform login
- [ ] Vercel: import the GitHub repo, set all env vars above, deploy.
- [ ] Run migrations against Neon: locally set `DATABASE_URL` to the Neon URL, then
      `npm run db:migrate`, then seed plans only: `npx tsx --env-file=.env -e` —
      or simplest: run `npm run db:seed` once and delete the two demo schools in the
      platform console afterwards.
- [ ] Promote your account: sign up at `/signup` skipping school creation is not possible,
      so instead run against Neon:
      `psql "$DATABASE_URL" -c "update \"user\" set role='platform_admin', school_id=null where email='<your email>'"`.
- [ ] Open `admin.<your-domain>` — you should see the platform console.
- [ ] Add a Vercel Cron hitting `/api/cron/dunning` daily (route wraps `dunningSweep`;
      create it when enabling — one 10-line route).

## Notes
- Payments run in **fake mode** (instant success) until `PAYSTACK_SECRET_KEY` is set.
- SMS logs as `queued` (cost-tracked) until `SMS_API_KEY` is set.
- Google button appears automatically once its two env vars exist.
- Report cards are print-to-PDF HTML today; the R2 pipeline is the swap-in when
  R2 creds exist (template unchanged).
