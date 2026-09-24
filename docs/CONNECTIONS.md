# Connecting SchoolSpec to the outside world

Everything in this guide is something only the owner can do — accounts, DNS, keys.
Follow it top to bottom once; each section ends with a check so you know it worked.
Set every environment variable in **Vercel → your project → Settings → Environment
Variables** (Production), then **Redeploy** for it to take effect.

Two domains are in play, and they do different jobs:

| Domain | Holds | Why separate |
|---|---|---|
| **`schoolspec.com`** (main) | the marketing page and its images | the public face; its reputation and SEO stay yours alone |
| **`schoolspec.app`** (app) | sign-in, the console, every school | one wildcard certificate covers `*.schoolspec.app` |

Replace both names below with the domains you actually bought. Everything else in
this guide hangs off that split, so do section 1 first and in order.

---

## 1. The two domains — Namecheap → Vercel

**One Vercel project serves both.** The marketing page and the app are the same
codebase, so you attach both domains to the same project; the app decides what to
serve from the hostname it was asked for.

SchoolSpec puts every school on its own subdomain (`stmarys.schoolspec.app`) and the
console on `admin.schoolspec.app`. That needs a **wildcard** (`*.schoolspec.app`), and
Vercel only issues wildcard certificates when it runs the domain's DNS. So **only
`schoolspec.app`'s nameservers move to Vercel.**

`schoolspec.com` has no subdomains to serve, so it **stays on Namecheap DNS** and simply
points its website records at Vercel. Your mailbox, and any other records on the `.com`,
keep working untouched, with nothing to copy across.

Namecheap stays the registrar for both domains. Registration, any hosting plan and
Private Email carry on billing there exactly as before.

### 1a. Add all five entries in Vercel
Vercel -> your project -> **Settings -> Domains -> Add**, one after another:

| Add | Set it to |
|---|---|
| `schoolspec.com` | leave as-is — this is the marketing home |
| `www.schoolspec.com` | **Redirect to `schoolspec.com`** |
| `schoolspec.app` | leave as-is |
| `www.schoolspec.app` | **Redirect to `schoolspec.app`** |
| `*.schoolspec.app` | leave as-is — the wildcard every school lives under |

Vercel will say "Invalid configuration" for each entry and show what it wants. For
`schoolspec.app` pick the **nameservers** option (normally `ns1.vercel-dns.com` and
`ns2.vercel-dns.com`). For `schoolspec.com` pick the **A / CNAME records** option. Keep
that page open.

> Do **not** add `*.schoolspec.com`. The marketing domain has no subdomains to serve,
> and a wildcard there would only invite someone to point one at you.

### 1b. Point Namecheap at Vercel — differently for each domain

**`schoolspec.app`: nameservers move to Vercel.**

1. Namecheap -> **Domain List -> Manage** (next to `schoolspec.app`).
2. On the **Domain** tab, find **Nameservers** -> change *Namecheap BasicDNS* to
   **Custom DNS**.
3. Enter the two nameservers Vercel showed, then click the green tick to save.

> Namecheap will warn that its own DNS records for this domain stop working. That is
> correct and intended. If `schoolspec.app` has any records you care about (it
> normally has none), screenshot **Advanced DNS** first and recreate them in Vercel
> DNS (section 1d).

**`schoolspec.com`: nameservers stay at Namecheap.** Leave it on *Namecheap BasicDNS*.

1. Namecheap -> **Domain List -> Manage** (next to `schoolspec.com`) -> **Advanced DNS**.
2. Delete any existing `A`, `CNAME` or `URL Redirect` records on `@` and `www` (often
   Namecheap's parking page). **Leave every mail record alone**: `MX`, the SPF `TXT`,
   `default._domainkey`, and `mail`/`autodiscover`/`autoconfig`.
3. Add the two records Vercel showed for the domain, typically:
   - `A` on `@` -> `76.76.21.21`
   - `CNAME` on `www` -> `cname.vercel-dns.com`

   Use Vercel's values if they differ.

**Then wait.** Changes usually take 10–60 minutes, occasionally a few hours. Vercel's
Domains page turns green ("Valid configuration") on its own; you can press
**Refresh** there.

### 1c. Tell the app about both
In Vercel environment variables (Production) set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `schoolspec.app` |
| `NEXT_PUBLIC_MARKETING_DOMAIN` | `schoolspec.com` |
| `BETTER_AUTH_URL` | `https://schoolspec.app` |

Then **Redeploy**. From this moment:

- `schoolspec.com` serves the marketing page, and **only** that page — any other path
  typed there (`/sign-in`, `/signup`, a school) is redirected across to the app domain.
- `schoolspec.app` signs people in and sends each person to
  `their-school.schoolspec.app`; one session cookie (`.schoolspec.app`) covers every
  school subdomain; the platform console is `https://admin.schoolspec.app`.
- A signed-**out** visitor who lands on `https://schoolspec.app` is sent to the
  marketing domain, so the marketing page exists at exactly one address and Google
  never sees two copies of it.

> **Why the app cannot simply live on the main domain too.** The session cookie is
> scoped to `.schoolspec.app` so that it covers every school subdomain. A sign-in form
> served from `schoolspec.com` cannot set that cookie — a browser refuses a cookie for
> a domain that is not its own — so it would appear to work and silently do nothing.
> That is why the redirect in the first bullet exists rather than a second sign-in page.

`NEXT_PUBLIC_MARKETING_DOMAIN` is **left empty locally and in preview**. With it unset
the root host serves the marketing page itself, which is what you want on
`localhost:3000` and on a `*.vercel.app` preview.

**Check:** run `pnpm run check:proxy` — it asserts the whole split (11 routing cases,
including that a signed-in person is *not* bounced to marketing).

### 1d. Where DNS records now live
The two domains keep their records in different places:

- **`schoolspec.com`**: **Namecheap -> Manage -> Advanced DNS**. Mail, Resend
  (section 3), DMARC and support-inbox records all go here.
- **`schoolspec.app`**: **Vercel -> your account (top-left) -> Domains ->
  `schoolspec.app` -> DNS Records**. Vercel manages the `A`/`CNAME` records for the app
  itself; you never add those, and nothing else normally goes here.

**Check:** all four must load over HTTPS with a valid padlock —
`https://schoolspec.com` (marketing), `https://schoolspec.app` (bounces to marketing
while signed out), `https://admin.schoolspec.app` (console sign-in) and
`https://stmarys.schoolspec.app` for a real school slug. Then confirm
`https://schoolspec.com/sign-in` lands you on `https://schoolspec.app/sign-in`.

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

## 3. Email — Resend, on a sending subdomain
Transactional email (invoices, admission offers, parent email blasts, signing links).

**Send from `send.schoolspec.com`, never from `schoolspec.com` itself.** Mailbox
providers score reputation per sending domain, and a subdomain carries its own score.
If a blast ever gets you flagged, the damage is contained to `send.` — your own
business mail on the root domain, and the root's standing generally, are untouched.
It costs nothing to set up this way and is expensive to unpick later, so do it now.

1. resend.com -> sign up -> **Domains -> Add Domain** -> enter **`send.schoolspec.com`**
   (region: EU or US, either is fine).
2. Resend shows DNS records. Add each one in **Namecheap -> `schoolspec.com` ->
   Advanced DNS** (section 1d) exactly as shown: name, type, value, priority.
   Typically:
   - `TXT` on `resend._domainkey.send` (DKIM)
   - `MX` on `send` with priority 10 -> `feedback-smtp.<region>.amazonses.com`
   - `TXT` on `send` -> `v=spf1 include:amazonses.com ~all`

   Enter the host **without** the domain on the end, because Namecheap appends it.
   Resend shows `resend._domainkey.send.schoolspec.com`; you type
   `resend._domainkey.send`.

   The `MX` record goes under **Mail Settings**, not the host records list. If that is
   set to *Private Email* and won't take an extra `MX`, switch it to **Custom MX**. Then
   re-add your mailbox's own `MX` records on `@` alongside the `send` one (for Private
   Email: `mx1.privateemail.com` and `mx2.privateemail.com`, priority 10). Note them
   down before switching.
3. Click **Verify** in Resend (a few minutes).
4. Add a DMARC record so Gmail trusts you. This one goes on the **root**, where it
   covers every subdomain including `send.`:
   `TXT` on `_dmarc` -> `v=DMARC1; p=none; rua=mailto:you@schoolspec.com`
   Leave it at `p=none` for a few weeks and read the reports before tightening it.
5. **API Keys -> Create** ("SchoolSpec production", permission *Sending access*) -> copy.
6. Vercel variables:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the key |
| `EMAIL_FROM` | `noreply@send.schoolspec.com` |

Redeploy.

> Nothing can receive mail at `send.schoolspec.com` — it is a sending domain only. So
> do not put a support address there. Section 3a gives support its own inbox on the
> root, which is where people expect to find it anyway.

**Check:** in a school, Fees -> send an invoice by email to yourself; or Comms -> email
blast. Resend -> **Emails** shows it as *Delivered*. Until the key exists the app quietly
logs these as *queued* — nothing breaks.

### 3a. A support address people can actually write to
For an inbox on `support@schoolspec.com`, the root domain's `MX` records must point at a
mailbox provider. Those records live in **Namecheap -> `schoolspec.com` -> Advanced
DNS**. If you already have a Namecheap **Private Email** mailbox there, it is already
set up; just create a `support` mailbox or alias in it.

Otherwise, any of Namecheap **Private Email**, Zoho Mail (free tier) or Google
Workspace works. Each gives you `MX` records plus an SPF `TXT` for the root. Add them in
Advanced DNS and leave the `send.` records alone. The two do not collide, which is
exactly the point of the split.

One catch: the root (`@`) may have **only one SPF `TXT`**. Two SPF records on the same
name is a hard failure, not a warning. If a second provider needs the root, merge the
includes into one record, e.g. for Private Email:
`v=spf1 include:spf.privateemail.com ~all`. Resend's SPF sits on `send`, a different
name, so it never needs merging.

**Check:** send yourself a mail at `support@schoolspec.com` from an outside account and
watch it arrive.

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
| `VAPID_SUBJECT` | `mailto:you@schoolspec.com` |

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
- [ ] `https://schoolspec.com` serves marketing; `www.` redirects to it
- [ ] `https://schoolspec.com/sign-in` lands on `https://schoolspec.app/sign-in`
- [ ] `https://schoolspec.app` while signed out goes to the marketing domain
- [ ] `https://admin.schoolspec.app` and `https://<school>.schoolspec.app` both HTTPS
- [ ] `pnpm run check:proxy` prints `proxy: ok`
- [ ] `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_MARKETING_DOMAIN`, `BETTER_AUTH_URL` set
- [ ] Sign in on `schoolspec.app` -> lands on the school's subdomain
- [ ] On a phone: **Add to Home Screen** -> opens full-screen with the SchoolSpec icon
      and the dark splash; airplane mode -> the offline chip appears and recently
      opened pages still open
- [ ] Resend domain `send.schoolspec.com` *Verified*, test email *Delivered*
- [ ] `_dmarc` present on the root; exactly one SPF `TXT` per name
- [ ] `support@schoolspec.com` receives mail from outside
- [ ] Arkesel sender ID *Approved*, test absence SMS received
- [ ] Push: test notification arrives on a phone
- [ ] R2 CORS set, logo upload works
- [ ] `pnpm run db:migrate` run against Neon after every pull with a new migration

### Common snags
- **"Invalid configuration" stays red for hours** -> for `schoolspec.app`, the
  nameservers didn't save at Namecheap; check the Domain tab shows *Custom DNS* with
  both `vercel-dns.com` entries. For `schoolspec.com`, check Advanced DNS has the `A` on
  `@` and the `CNAME` on `www`, and that no parking or `URL Redirect` record is still
  on them.
- **Your mailbox stopped receiving** -> someone switched `schoolspec.com`'s nameservers
  to Vercel. Switch it back to *Namecheap BasicDNS*; its records are still there.
- **The marketing page appears on `schoolspec.app` too** ->
  `NEXT_PUBLIC_MARKETING_DOMAIN` is missing or the project wasn't redeployed. Google
  will index both copies if you leave it.
- **Signing in appears to work, then you are signed out again** -> you were on
  `schoolspec.com/sign-in`. It should have redirected you; if it did not, the same
  variable is missing. The cookie is scoped to `.schoolspec.app` and a form on the
  `.com` cannot set it.
- **Subdomain shows the marketing page** -> `NEXT_PUBLIC_ROOT_DOMAIN` still points at
  `vercel.app`; fix the variable and redeploy.
- **Resend record "not found"** -> the record name was entered with the domain repeated
  (`send.schoolspec.com.schoolspec.com`). In Namecheap's Advanced DNS enter only the
  part before the domain (`send`, `resend._domainkey.send`, `_dmarc`), on
  **`schoolspec.com`**, not the `.app`.
- **Mail lands in spam after a big blast** -> this is the case the `send.` subdomain was
  chosen for: the root is unaffected, so `support@schoolspec.com` still works. Warm the
  sending domain up (a few hundred a day before thousands) and keep `p=none` on DMARC
  until the reports are clean.
- **Notifications "not switched on yet"** on the Account page -> the two VAPID variables
  are missing or the project wasn't redeployed after adding them.
- **Old SchoolSpec build keeps showing on a phone** -> open the app, wait a second: the
  "new version ready" toast appears; tap **Update**. It checks every time the app returns
  to the foreground.
