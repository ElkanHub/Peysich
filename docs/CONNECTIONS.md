# Connecting SchoolSpec to the outside world

Everything in this guide is something only the owner can do — accounts, DNS, keys.
Follow it top to bottom once; each section ends with a check so you know it worked.
Set every environment variable in **Vercel → your project → Settings → Environment
Variables** (Production), then **Redeploy** for it to take effect.

**One domain does everything: `schoolspec.com`.** You do not need a second domain.

| Host | Serves |
|---|---|
| `schoolspec.com` | the marketing page, sign-in and signup |
| `admin.schoolspec.com` | the platform console |
| `stmarys.schoolspec.com` | one per school — created by the app, never by hand |

The app tells the hosts apart by the hostname it was asked for, so one Vercel project
serves all of them. A new school is a database row; nobody touches DNS for it. That
works because of a **wildcard** (`*.schoolspec.com`), and Vercel only issues wildcard
certificates when it runs the domain's DNS — so the domain's nameservers move to
Vercel. Namecheap stays the registrar: registration, any hosting plan and Private
Email carry on billing there exactly as before.

---

## 1. The domain — Namecheap → Vercel

### 1a. Before you touch anything: write down the records you have
Namecheap → **Domain List → Manage** (next to `schoolspec.com`) → **Advanced DNS**.
Screenshot the whole page, and note every one of these if present:

- **Mail:** `MX` records (under *Mail Settings*), the SPF `TXT` on `@`
  (`v=spf1 …`), `default._domainkey` or any `…_domainkey` `TXT`, and any
  `mail` / `autodiscover` / `autoconfig` `CNAME`s.
- **Verification:** any `TXT` on `@` from Google, Microsoft, Resend etc.

Moving the nameservers does not delete these, but Namecheap's copy stops answering the
moment the move completes. You will recreate them in Vercel in step 1d. If the page
shows only a parking `URL Redirect` and Namecheap's default `CNAME` on `www`, there is
nothing to carry across.

### 1b. Add the four hosts in Vercel
Vercel → your project → **Settings → Domains → Add**, one after another:

| Add | Set it to |
|---|---|
| `schoolspec.com` | leave as-is — marketing, sign-in, signup |
| `www.schoolspec.com` | **Redirect to `schoolspec.com`** (308) |
| `admin.schoolspec.com` | leave as-is — the console |
| `*.schoolspec.com` | leave as-is — the wildcard every school lives under |

Each will say "Invalid configuration" and offer the **nameservers** option — normally
`ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Note the two it shows you; they can
differ per account. Keep that page open.

### 1c. Move the nameservers at Namecheap
1. Namecheap → **Domain List → Manage** (next to `schoolspec.com`).
2. On the **Domain** tab find **Nameservers** → change *Namecheap BasicDNS* to
   **Custom DNS**.
3. Enter the two nameservers Vercel showed, then click the green tick.

Namecheap warns that its DNS records for this domain stop working. That is intended —
Vercel is the DNS from now on.

**Then wait.** Usually 10–60 minutes, occasionally a few hours. Vercel's Domains page
turns green ("Valid configuration") on its own for all four entries.

### 1d. Recreate your records in Vercel DNS
Vercel → **your account (top-left) → Domains → `schoolspec.com` → DNS Records**. Vercel
already added the `A` / `CNAME` records for the app and the wildcard — never add those.
Add back everything you noted in 1a, with the same name, type, value and priority:

- your mailbox's `MX` records (Private Email: `mx1.privateemail.com` and
  `mx2.privateemail.com`, priority 10, on `@`)
- the SPF `TXT` on `@` (Private Email: `v=spf1 include:spf.privateemail.com ~all`)
- any `_domainkey` `TXT`, and `mail` / `autodiscover` / `autoconfig` `CNAME`s
- any verification `TXT`s

Enter names **without** the domain on the end (`@`, `www`, `mail`, `_dmarc`) — Vercel
appends it. This is also where sections 3 and 3a add their records.

**Check:** send yourself a mail from an outside account to your existing mailbox and
watch it arrive. If it does not within an hour, an `MX` was missed — compare against
the 1a screenshot.

### 1e. Tell the app which domain it lives on
In Vercel environment variables (Production):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `schoolspec.com` |
| `BETTER_AUTH_URL` | `https://schoolspec.com` |
| `NEXT_PUBLIC_MARKETING_DOMAIN` | **leave unset** — not used in this layout |

Then **Redeploy**. From this moment:

- `schoolspec.com` serves the marketing page, and sign-in / signup live on it too;
- signing in sends each person to `their-school.schoolspec.com`; one session cookie
  (`.schoolspec.com`) covers every school subdomain, so the hop never signs anyone out;
- the platform console is `https://admin.schoolspec.com`;
- creating a school in the console gives it `<slug>.schoolspec.com` immediately, with a
  valid certificate, nothing to configure.

Locally and on a `*.vercel.app` preview, leave `NEXT_PUBLIC_ROOT_DOMAIN` at
`localhost:3000` / the preview host: the app then selects a school by cookie
(`/t/<slug>`) instead of by subdomain, because those hosts have no wildcard.

**Check:** run `pnpm run check:proxy` — it asserts the routing (root, `www`, `admin`,
a school, nested hosts, the global app files) and prints `proxy: ok`.

**Check:** all of these must load over HTTPS with a valid padlock —
`https://schoolspec.com` (marketing), `https://www.schoolspec.com` (redirects to it),
`https://schoolspec.com/sign-in`, `https://admin.schoolspec.com` (console sign-in) and
`https://stmarys.schoolspec.com` for a real school slug. Then sign in on the root and
confirm you land on the school's subdomain, still signed in.

> **Why the nameservers have to move.** Vercel proves it controls the domain to the
> certificate authority by answering a DNS challenge for `*.schoolspec.com`. It can
> only answer if it is the DNS. Keeping Namecheap as DNS would mean adding every school
> to Vercel one at a time through its API on each signup — workable, but a network
> call in the middle of onboarding that can fail. The wildcard removes it.

---

## 2. Google sign-in (optional, recommended for admins)
1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**
   (External) → fill the app name "SchoolSpec", support email, and add
   `schoolspec.com` under authorised domains.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origins: `https://schoolspec.com`
   - Authorised redirect URI: `https://schoolspec.com/api/auth/callback/google`

   Google does not accept wildcards here, which is why sign-in lives on the root and
   the app hops to the school's subdomain afterwards with the cookie already set.
3. Copy the two values → Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Redeploy.

**Check:** the sign-in page shows "Continue with Google".

---

## 3. Email — Resend, on a sending subdomain
Transactional email (invoices, admission offers, parent email blasts, signing links).

**Send from `send.schoolspec.com`, never from `schoolspec.com` itself.** Mailbox
providers score reputation per sending domain, and a subdomain carries its own score.
If a blast ever gets you flagged, the damage is contained to `send.` — your own
business mail on the root, and the root's standing generally, are untouched. It costs
nothing to set up this way and is expensive to unpick later, so do it now.

1. resend.com → sign up → **Domains → Add Domain** → enter **`send.schoolspec.com`**
   (region: EU or US, either is fine).
2. Resend shows DNS records. Add each one in **Vercel → Domains → `schoolspec.com` →
   DNS Records** (section 1d) exactly as shown: name, type, value, priority. Typically:
   - `TXT` on `resend._domainkey.send` (DKIM)
   - `MX` on `send`, priority 10 → `feedback-smtp.<region>.amazonses.com`
   - `TXT` on `send` → `v=spf1 include:amazonses.com ~all`

   Names go in **without** the domain on the end: Resend shows
   `resend._domainkey.send.schoolspec.com`; you type `resend._domainkey.send`.
   The `send` `MX` sits alongside your mailbox's `MX` on `@` — different names, no
   collision.
3. Click **Verify** in Resend (a few minutes).
4. Add a DMARC record so Gmail trusts you. It goes on the **root** and covers every
   subdomain including `send.`:
   `TXT` on `_dmarc` → `v=DMARC1; p=none; rua=mailto:you@schoolspec.com`
   Leave it at `p=none` for a few weeks and read the reports before tightening it.
5. **API Keys → Create** ("SchoolSpec production", permission *Sending access*) → copy.
6. Vercel variables:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the key |
| `EMAIL_FROM` | `noreply@send.schoolspec.com` |

Redeploy.

> Nothing can receive mail at `send.schoolspec.com` — it is a sending domain only. Do
> not put a support address there; section 3a gives support its own inbox on the root.

**Check:** in a school, Fees → send an invoice by email to yourself; or Comms → email
blast. Resend → **Emails** shows it as *Delivered*. Until the key exists the app quietly
logs these as *queued* — nothing breaks.

### 3a. A support address people can actually write to
For an inbox on `support@schoolspec.com`, the root's `MX` records must point at a
mailbox provider — the ones you carried across in 1d. If you have Namecheap **Private
Email** on the domain, create a `support` mailbox or alias in it and you are done.

Otherwise, any of Namecheap Private Email, Zoho Mail (free tier) or Google Workspace
works. Each gives you `MX` records plus an SPF `TXT` for the root; add them in Vercel
DNS and leave the `send.` records alone.

One catch: the root (`@`) may have **only one SPF `TXT`**. Two SPF records on the same
name is a hard failure. If a second provider needs the root, merge the includes into one
record, e.g. `v=spf1 include:spf.privateemail.com ~all`. Resend's SPF sits on `send`,
a different name, so it never needs merging.

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
     "AllowedOrigins": ["https://schoolspec.com", "https://*.schoolspec.com"],
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
3. Webhook URL in Paystack: `https://schoolspec.com/api/webhooks/paystack`.
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
- [ ] Namecheap → `schoolspec.com` shows *Custom DNS* with both `vercel-dns.com` entries
- [ ] Vercel → Domains: `schoolspec.com`, `www`, `admin`, `*` all green
- [ ] Every record from the 1a screenshot recreated in Vercel DNS; existing mailbox
      still receives
- [ ] `https://schoolspec.com` serves marketing; `www.` redirects to it
- [ ] `https://schoolspec.com/sign-in`, `https://admin.schoolspec.com` and
      `https://<school>.schoolspec.com` all HTTPS with a valid padlock
- [ ] `NEXT_PUBLIC_ROOT_DOMAIN=schoolspec.com`, `BETTER_AUTH_URL=https://schoolspec.com`,
      `NEXT_PUBLIC_MARKETING_DOMAIN` unset
- [ ] `pnpm run check:proxy` prints `proxy: ok`
- [ ] Sign in on the root → lands on the school's subdomain, still signed in
- [ ] Create a school in the console → its subdomain loads immediately over HTTPS
- [ ] On a phone: **Add to Home Screen** → opens full-screen with the SchoolSpec icon
      and the dark splash; airplane mode → the offline chip appears and recently
      opened pages still open
- [ ] Resend domain `send.schoolspec.com` *Verified*, test email *Delivered*
- [ ] `_dmarc` present on the root; exactly one SPF `TXT` per name
- [ ] `support@schoolspec.com` receives mail from outside
- [ ] Arkesel sender ID *Approved*, test absence SMS received
- [ ] Push: test notification arrives on a phone
- [ ] R2 CORS set, logo upload works
- [ ] `pnpm run db:migrate` run against Neon after every pull with a new migration

### Common snags
- **"Invalid configuration" stays red for hours** → the nameservers didn't save at
  Namecheap; check the Domain tab shows *Custom DNS* with both `vercel-dns.com`
  entries, spelled exactly as Vercel showed them.
- **Your mailbox stopped receiving** → the `MX` records weren't recreated in Vercel DNS
  after the move. Add them from the 1a screenshot; mail queues at the sender for a
  while, so little is usually lost.
- **A school's subdomain shows the marketing page** → `NEXT_PUBLIC_ROOT_DOMAIN` still
  points at `vercel.app` or `localhost`; fix the variable and redeploy.
- **A school's subdomain shows a certificate warning** → the wildcard entry
  `*.schoolspec.com` is missing in Vercel's Domains, or the nameservers haven't
  finished propagating. Check the Domains page is green for `*`.
- **Signing in appears to work, then you are signed out on the school** → the cookie
  is host-only. `NEXT_PUBLIC_ROOT_DOMAIN` must be exactly `schoolspec.com` (no `www`,
  no port) for the `.schoolspec.com` cookie to be issued.
- **"Continue with Google" fails with redirect_uri_mismatch** → the redirect URI in
  Google must be exactly `https://schoolspec.com/api/auth/callback/google`; wildcards
  are not accepted there.
- **Resend record "not found"** → the record name was entered with the domain repeated
  (`send.schoolspec.com.schoolspec.com`). In Vercel DNS enter only the part before the
  domain (`send`, `resend._domainkey.send`, `_dmarc`).
- **Mail lands in spam after a big blast** → this is the case the `send.` subdomain was
  chosen for: the root is unaffected, so `support@schoolspec.com` still works. Warm the
  sending domain up (a few hundred a day before thousands) and keep `p=none` on DMARC
  until the reports are clean.
- **Notifications "not switched on yet"** on the Account page → the two VAPID variables
  are missing or the project wasn't redeployed after adding them.
- **Old SchoolSpec build keeps showing on a phone** → open the app, wait a second: the
  "new version ready" toast appears; tap **Update**. It checks every time the app returns
  to the foreground.
