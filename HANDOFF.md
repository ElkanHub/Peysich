# HANDOFF — Owner Setup Checklist

Everything only you can do. Each item says where to do it and which env var it fills
(set env vars in Vercel → Project → Settings → Environment Variables).
**The app runs fully locally with none of these** (`npm run dev` + local Postgres).

Status: 🚧 maintained during the build; finalized at deployment. Items marked *later*
aren't needed until the phase shown.

## 1. Domain & DNS (Phase 0 deploy)
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

## 8. First platform login (after deploy)
- [ ] Run the production seed for plans only, then create your platform account
      (instructions will be finalized here at deployment).
