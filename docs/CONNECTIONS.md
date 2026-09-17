# Connecting SchoolSpec to the outside world

Everything in this guide is something only the owner can do — accounts, DNS, keys.
Follow it top to bottom once; each section ends with a check so you know it worked.
Set every environment variable in **Vercel → your project → Settings → Environment
Variables** (Production), then **Redeploy** for it to take effect.

Replace `schoolspec.app` below with the domain you bought.

---

## 1. The domain — Namecheap → Vercel

SchoolSpec puts every school on its own subdomain (`stmarys.schoolspec.app`) and the
console on `admin.schoolspec.app`. That needs a **wildcard** (`*.schoolspec.app`), and
Vercel only issues wildcard certificates when it runs the domain's DNS. So the domain's
nameservers move to Vercel; Namecheap stays the registrar (you still renew it there).

### 1a. Add the domain in Vercel
1. Vercel → your project → **Settings → Domains → Add**.
2. Add these three, one after the other:
   - `schoolspec.app`
   - `www.schoolspec.app` → choose **Redirect to schoolspec.app**
   - `*.schoolspec.app`
3. Vercel will say the domain is "Invalid configuration" and show two nameservers,
   normally `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Keep that page open.

### 1b. Point Namecheap at Vercel
1. Namecheap → **Domain List → Manage** (next to the domain).
2. On the **Domain** tab, find **Nameservers** → change *Namecheap BasicDNS* to
   **Custom DNS**.
3. Enter the two nameservers Vercel showed, then click the green ✓ to save.
4. Wait. Nameserver changes usually take 10–60 minutes, occasionally a few hours.
   Vercel's Domains page turns green ("Valid configuration") on its own — you can press
   **Refresh** there.

> Namecheap will warn that its own DNS records stop working — correct, and intended.
> Any records you had at Namecheap (email forwarding etc.) must be recreated in Vercel
> DNS (section 1d).

### 1c. Tell the app its home
In Vercel environment variables set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `schoolspec.app` |
| `BETTER_AUTH_URL` | `https://schoolspec.app` |

Then **Redeploy**. From this moment the app runs in *subdomain mode*: signing in on the
root sends each person to `their-school.schoolspec.app`, one session cookie covers all
subdomains, and the platform console lives at `https://admin.schoolspec.app`.

### 1d. Where DNS records now live
Vercel → **your account (top-left) → Domains → schoolspec.app → DNS Records**. This is
where every record from the sections below is added. Vercel manages the `A`/`CNAME`
records for the app itself — you never add those.

**Check:** open `https://schoolspec.app` (marketing), `https://admin.schoolspec.app`
(console sign-in) and `https://stmarys.schoolspec.app` for any real school slug — all
three must load over HTTPS with a valid padlock.

---

## 2. Google sign-in (optional, recommended for admins)
1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**
   (External) → fill the app name "SchoolSpec", support email, and add your domain.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origins: `https://schoolspec.app`
   - Authorised redirect URI: `https://schoolspec.app/api/auth/callback/google`
3. Copy the two values → Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Redeploy.

**Check:** the sign-in page shows "Continue with Google".

---

## 3. Email — Resend
Transactional email (invoices, admission offers, parent email blasts, signing links).

1. resend.com → sign up → **Domains → Add Domain** → `schoolspec.app` (region: EU or US,
   either is fine).
2. Resend shows DNS records — typically:
   - `TXT` on `resend._domainkey` (DKIM)
   - `MX` on `send` (or `bounce`) with priority 10 → `feedback-smtp.<region>.amazonses.com`
   - `TXT` on `send` → `v=spf1 include:amazonses.com ~all`
   Add each one in **Vercel DNS** (section 1d) exactly as shown — name, type, value,
   priority. Then click **Verify** in Resend (a few minutes).
3. Optional but worth it: add a DMARC record so Gmail trusts you —
   `TXT` on `_dmarc` → `v=DMARC1; p=none; rua=mailto:you@schoolspec.app`.
4. **API Keys → Create** ("SchoolSpec production", permission *Sending access*) → copy.
5. Vercel variables:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the key |
| `EMAIL_FROM` | `noreply@schoolspec.app` (any address on the verified domain) |

Redeploy.

**Check:** in a school, Fees → send an invoice by email to yourself; or Comms → email
blast. Resend → **Emails** shows it as *Delivered*. Until the key exists the app quietly
logs these as *queued* — nothing breaks.

---

## 4. SMS — Arkesel
Absence alerts, fee reminders, register nudges and parent blasts.

1. sms.arkesel.com → create an account → verify the business → **buy credits**
   (SMS to Ghanaian networks; the app tracks cost per school).
2. **Sender ID → Request** a default sender ID (up to 11 characters, e.g. `SchoolSpec`).
   Arkesel approves sender IDs manually, usually within a working day. Schools that want
   their own name on the SMS request theirs in **Settings → School & identity → SMS
   sender ID** — approve those in your Arkesel account the same way.
3. **Settings → API Keys → Generate** (v2 key).
4. Vercel variable: `SMS_API_KEY` = the key. Redeploy.

**Check:** mark a student absent on today's register — the guardian's phone receives the
SMS, and Settings → (comms) shows it as *sent* instead of *queued*.

---

## 5. Push notifications (the installed app)
Announcements, report-card releases and register reminders on people's phones — even
with the app closed. Needs one pair of keys, generated once, never rotated casually
(rotating them silently disconnects every subscribed phone).

1. On your computer, in the project folder:
   ```
   npx web-push generate-vapid-keys
   ```
   It prints a **Public Key** and a **Private Key**.
2. Vercel variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:you@schoolspec.app` |

Redeploy.

**Check:** sign in on a phone → **My Account → Notifications → Turn on** → **Send a
test**. On iPhone/iPad the app must first be added to the home screen (iOS 16.4+); the
Account page explains this to the person on the spot.

---

## 6. File storage — Cloudflare R2 (photos, logos, signatures, stamps)
1. Cloudflare → **R2 → Create bucket** → name `schoolspec`.
2. **Manage R2 API Tokens → Create** (Object Read & Write) → copy the Access Key ID and
   Secret; the Account ID is on the R2 overview page.
3. Bucket → **Settings → CORS policy** → add:
   ```json
   [{
     "AllowedOrigins": ["https://schoolspec.app", "https://*.schoolspec.app"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }]
   ```
4. Vercel variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET=schoolspec`. Redeploy.

**Check:** My Account → change your photo; Settings → upload the school logo.

---

## 7. Payments — Paystack
1. Paystack business account (needs KYC) → **Settings → API Keys & Webhooks**.
2. Vercel variables: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`.
3. Webhook URL in Paystack: `https://schoolspec.app/api/webhooks/paystack`.
4. Redeploy. Until the keys exist, checkout runs in fake mode (instant success) so you
   can rehearse the flow.

---

## 8. Database — Neon, and the migration rule
- `DATABASE_URL` = the **pooled** Neon connection string.
- **Every time you pull code that adds a migration** (files in `drizzle/`), run it against
  production once from your machine: with `.env` pointing at Neon, `pnpm run db:migrate`.
  The marketing page is built to survive a missed migration, but the new features won't
  work until it has run. Current migration: **0030** (push subscriptions).

---

## 9. The final checklist
- [ ] `https://schoolspec.app`, `https://admin.…`, `https://<school>.…` all HTTPS ✓
- [ ] `NEXT_PUBLIC_ROOT_DOMAIN`, `BETTER_AUTH_URL` set to the real domain
- [ ] Sign in on the root → lands on the school's subdomain
- [ ] On a phone: **Add to Home Screen** → opens full-screen with the SchoolSpec icon and
      the dark splash; airplane mode → the offline chip appears and recently opened pages
      still open
- [ ] Resend domain *Verified*, test email *Delivered*
- [ ] Arkesel sender ID *Approved*, test absence SMS received
- [ ] Push: test notification arrives on a phone
- [ ] R2 CORS set, logo upload works
- [ ] `pnpm run db:migrate` run against Neon after every pull with a new migration

### Common snags
- **"Invalid configuration" stays red for hours** → the nameservers didn't save at
  Namecheap; check the Domain tab shows *Custom DNS* with both `vercel-dns.com` entries.
- **Subdomain shows the marketing page** → `NEXT_PUBLIC_ROOT_DOMAIN` still points at
  `vercel.app`; fix the variable and redeploy.
- **Resend record "not found"** → the record name was entered with the domain repeated
  (`send.schoolspec.app.schoolspec.app`). In Vercel DNS enter only the part before the
  domain (`send`, `resend._domainkey`, `_dmarc`).
- **Notifications "not switched on yet"** on the Account page → the two VAPID variables
  are missing or the project wasn't redeployed after adding them.
- **Old SchoolSpec build keeps showing on a phone** → open the app, wait a second: the
  "new version ready" toast appears; tap **Update**. It checks every time the app returns
  to the foreground.
