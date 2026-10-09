# Messaging: what you set up yourself

Everything outside the code that has to exist before the messaging system can run.
In the order to do it. Each item says what it unlocks, so the code can be built
and switched on piece by piece. The build plan itself is `MESSAGING_BUILD_PLAN.md`;
the prices are in `MESSAGING_COSTS.md`.

Nothing here needs the business to be registered except the one step marked so.

---

## 0 · The decisions, with the defaults the build assumes

Change any of these and tell me before the build starts.

| Decision | Default in the build |
|---|---|
| Price of a WhatsApp ping | **8 pesewas** |
| Price of an SMS | **6 pesewas per 160-character part** |
| Price of Telegram, the app's notification, email | **Free** |
| What is in the plan fee | **Nothing messaging-related.** The fee is software only |
| What the wallet pays for | **Every ping the school sends**, including to teachers |
| When the wallet is empty | Pings stop and fall back to the app and Telegram, with a banner. **Emergencies and absence alerts still go**, overdrawing up to GHS 20 |
| Starting credit for a new school | **GHS 20** on sign-up |
| Does the balance expire | **Never.** Non-refundable, as the refund page already says |
| Paystack's fee on top-ups | **Absorbed** in the prices |
| Channel order for parents and teachers | App notification and Telegram always, free. Then **WhatsApp if there is a number and consent, else SMS** |
| Emergencies | **WhatsApp and SMS both** |
| Free text (notices, announcements, emergencies) | **Lives in the app.** The ping carries the title and a one-tap link. Phone-only parents get the full text by SMS |
| Platform to schools | **Email** for what they keep, **WhatsApp** for what they must see today, a banner in the app. No SMS |
| Owner's WhatsApp number at sign-up | **Required** |
| Onboarding nudges (day 2, day 5) | **Sent to you on Telegram first**; you decide to send or to call. Automatic after the first ten schools |
| WhatsApp numbers | **One** for everything now. A second for platform-to-school later, under the same business |
| Providers | **Arkesel** for SMS, **Meta direct** for WhatsApp, **Telegram Bot API**, **Resend** for email |
| Minimum top-up | **GHS 20** |

---

## 1 · Arkesel (SMS) — do first, unlocks everything in cedis

Already wired in the app; this is housekeeping.

1. Sign in at arkesel.com. Under **Sender IDs**, register **SchoolSpec** (11 characters max). This is the name on every SMS a school sends until the school's own sender ID is approved.
2. Buy **no-expiry** credits, not the 3-month ones. GHS 2,000 buys about 80,000 SMS at 2.5p; smaller bundles cost more per SMS. Start with GHS 500 (about 20,000 SMS) for the pilot.
3. Set a **low-balance alert** in Arkesel to your email at 5,000 credits.
4. Copy the API key into Vercel as `SMS_API_KEY` (it is already there; confirm it is the live key).
5. For each school that wants its own name on SMS: Arkesel registers sender IDs per name and needs the school's name and a short justification. Do it from your account on the school's behalf when they ask; the app already shows "the name parents see on SMS" under School settings.

**Unlocks:** steps 1 to 4 of the build (wallet, pings, links, everything by SMS).

## 2 · Resend (email) — thirty minutes, unlocks the platform plane

1. In Resend, add the domain **`send.schoolspec.com`** (a subdomain, so bounces never touch your main domain's reputation).
2. Resend shows three DNS records: SPF (TXT), DKIM (TXT or CNAME) and the return-path (CNAME). Add them in **Vercel → Domains → schoolspec.com → DNS Records**, since Vercel runs the domain's DNS now.
3. Add a DMARC record on the root: TXT at `_dmarc.schoolspec.com` with value `v=DMARC1; p=quarantine; rua=mailto:dmarc@schoolspec.com`. Start with `p=none` for two weeks if you want to watch first.
4. Wait for Resend to show the domain **Verified**.
5. Set these in Vercel: `EMAIL_FROM=notices@send.schoolspec.com`, `EMAIL_BILLING_FROM=billing@send.schoolspec.com`, `EMAIL_REPLY_TO=hello@schoolspec.com`. Make sure `hello@schoolspec.com` is a real inbox someone reads (Namecheap Private Email, or forward it to Gmail).
6. Stay on the free plan: 3,000 emails a month, 100 a day. That covers about 100 schools of platform mail. Move to Pro ($20) when the daily cap bites.

**Unlocks:** every platform-to-school email; parent-facing document emails already work and simply get the new sender.

## 3 · Telegram — ten minutes, free

1. In Telegram, open **@BotFather**, send `/newbot`. Name: **SchoolSpec**. Username: something like `schoolspec_bot`.
2. Copy the token into Vercel as `TELEGRAM_BOT_TOKEN`.
3. Send `/setdescription` ("School notices, free, from your school on SchoolSpec") and `/setuserpic` with the logo.
4. Create a second bot the same way for **your own alerts**, username like `schoolspec_ops_bot`, token in Vercel as `TELEGRAM_OPS_TOKEN`. Send it `/start` from your phone; the code will capture your chat id on first run.

**Unlocks:** free staff and parent notifications, and your operator alerts (leads, sign-ups, failed payments, suspensions).

## 4 · Paystack — for wallet top-ups

Already set up for subscriptions. Two things to add:

1. In the Paystack dashboard, confirm the **webhook URL** is `https://schoolspec.com/api/webhooks/paystack` and that it is enabled for live mode. Top-ups use the same webhook with a different reference prefix.
2. Decide whether the **2% fee** is absorbed (the default) or added at checkout. If absorbed, nothing to do.

**Unlocks:** top-ups by MoMo and card.

## 5 · Meta and WhatsApp — start now, finish after registration

Do the first part today. It costs nothing and the account is what everything later attaches to.

### Now, without registration

1. Create a **Meta Business account** at business.facebook.com in your name, business name **SchoolSpec**.
2. In the business account, open **WhatsApp Manager** and add a **WhatsApp Business Account** (WABA).
3. Add a **phone number** for it. It must be a number that is not on any WhatsApp app already. A new SIM is simplest. Display name **SchoolSpec**. Meta reviews the display name; it must match the business name.
4. Create a **Meta app** at developers.facebook.com of type Business, add the WhatsApp product, and generate a **permanent system-user token** with `whatsapp_business_messaging` and `whatsapp_business_management`. Put in Vercel: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN` (any long random string, used to confirm the webhook).
5. Under the app's WhatsApp settings, set the **webhook** to `https://schoolspec.com/api/webhooks/whatsapp` with that verify token, subscribed to `messages`. The code provides the endpoint.
6. **Submit the templates** in WhatsApp Manager, category **Utility**, language English, exactly as listed in section 7. Meta usually answers within a day. Any rejection comes back with a reason; adjust the wording and resubmit.
7. At this point the number can send to **250 different people a day**. That is enough for one pilot school.

### After the business is registered

8. **Business verification** in Meta Business Settings → Security Centre: upload the certificate of incorporation, proof of address, and confirm the business phone or email. Takes a few days to a few weeks.
9. Once verified, the daily limit rises to 1,000, then 10,000 and 100,000 as the number keeps a good quality rating. Switch WhatsApp on for every school from the console.

### If you prefer a provider in between

Zernio or 360dialog use the same WABA you created in steps 1 to 3, so nothing above is wasted. Zernio: connect the WABA, about $3 a month, no verification waiver. 360dialog: €49 a month from about fifteen schools. Neither raises the 250-a-day limit without Meta verification.

**Unlocks:** step 5 of the build.

## 6 · In the app, when the build lands

- **Sign-up** gains the owner's WhatsApp number. Existing schools: add it under School settings → School & identity.
- **Student import sheet** gains a "Parent WhatsApp" column. The admission form asks for it.
- **Consent line** on the admission form and the parent's record: "Agree to receive school messages on WhatsApp."
- **School settings → The name parents see on SMS**: already there.

## 7 · The WhatsApp templates to submit

Category **Utility** unless marked. Variables in `{{n}}`. Keep the wording exactly; Meta approves text, not meaning. The footer line is the same on all: *"Questions? Call {{phone}}."*

**School to parents and teachers**

| Name | Body |
|---|---|
| `absence_alert` | {{1}}: {{2}} was marked absent today. Contact the office on {{3}} if unexpected. |
| `receipt` | {{1}}: GHS {{2}} received for {{3}}. Receipt {{4}}. Balance GHS {{5}}. |
| `bill_created` | {{1}}: {{2}}'s fees for {{3}} are GHS {{4}}, due {{5}}. Pay by MoMo to {{6}} (name: {{1}}) or at the office. |
| `fee_reminder` | {{1}}: GHS {{2}} is still owing for {{3}}, due {{4}}. MoMo {{5}} (name: {{1}}) or the office. Thank you. |
| `notice_ping` | {{1}}: new notice — "{{2}}". Read it: {{3}} |
| `announcement_ping` | {{1}}: announcement — "{{2}}". Read it: {{3}} |
| `results_ready` | {{1}}: {{2}}'s {{3}} results are ready. See them: {{4}} |
| `report_card_ready` | {{1}}: {{2}}'s report card for {{3}} is ready. See it: {{4}} |
| `invoice_ready` | {{1}}: {{2}}'s bill for {{3}} is GHS {{4}}{{5}}. The invoice is in your email and on Telegram. {{6}} |
| `emergency_illness` | {{1}}: {{2}} is unwell at school. Please call {{3}} now. Details: {{4}} |
| `emergency_injury` | {{1}}: {{2}} has had an accident at school and is being looked after. Please call {{3}}. Details: {{4}} |
| `emergency_medical` | {{1}}: {{2}} needs medical attention. Please call {{3}} immediately. Details: {{4}} |
| `emergency_behaviour` | {{1}}: the head would like to speak with you about {{2}} today. Please call {{3}}. Details: {{4}} |
| `emergency_come` | {{1}}: please come to the school about {{2}} as soon as you can. Details: {{3}} |
| `emergency_pickup` | {{1}}: please collect {{2}} early today at {{3}}. Details: {{4}} |
| `parent_login` | {{1}}: your parent login for SchoolSpec is {{2}}, password {{3}}. Please change it after signing in. |
| `staff_login` | {{1}}: your SchoolSpec login is {{2}}, password {{3}}. Please change it after signing in. |
| `register_reminder` | {{1}}: the {{2}} register for today is not marked yet. Mark it in SchoolSpec: {{3}} |
| `scores_reminder` | {{1}}: {{2}} · {{3}} scores are still missing this term. Enter them: {{4}} |
| `homework_set` | {{1}}: new homework for {{2}} — {{3}}, due {{4}}. |

**Platform to schools** (sent from the same number; {{1}} is the head's first name)

| Name | Body |
|---|---|
| `trial_3_days` | Hello {{1}}, {{2}}'s free trial on SchoolSpec ends in 3 days. Choose a plan here: {{3}}. Nothing is deleted either way. |
| `trial_ended` | Hello {{1}}, {{2}}'s trial has ended. Your data is safe. Choose a plan any time: {{3}} |
| `payment_failed` | Hello {{1}}, the payment for {{2}}'s SchoolSpec plan did not go through. Try again here: {{3}}. The school stays open for 14 days. |
| `suspended` | Hello {{1}}, {{2}}'s SchoolSpec account is paused today because the plan is unpaid. Pay here and it reopens at once: {{3}} |
| `renewal_tomorrow` | Hello {{1}}, {{2}}'s SchoolSpec plan renews tomorrow: GHS {{3}}. |
| `wallet_low` | Hello {{1}}, {{2}}'s messaging balance is GHS {{3}}. Top up here: {{4}} |
| `wallet_empty` | Hello {{1}}, {{2}}'s messaging balance is empty, so paid pings have stopped. Notices still reach the app and Telegram. Top up: {{3}} |
| `setup_day2` | Hello {{1}}, shall I come and set {{2}} up with you this week? One hour. Reply here or call {{3}}. |
| `setup_day5` | Hello {{1}}, has a teacher at {{2}} marked a register yet? If anything is in the way, call {{3}}. |
| `deletion_10_days` | Hello {{1}}, {{2}}'s data on SchoolSpec will be deleted in 10 days unless you ask us to keep it. Reply here or call {{3}}. |
| `incident` | SchoolSpec: {{1}}. We will update you here. |

Thirty templates. If Meta files any as Marketing, rewrite it to be more plainly about the recipient's own account or child, and resubmit.

## 8 · The environment variables, all in one place

| Variable | From |
|---|---|
| `SMS_API_KEY` | Arkesel (exists) |
| `RESEND_API_KEY` | Resend (exists) |
| `EMAIL_FROM`, `EMAIL_BILLING_FROM`, `EMAIL_REPLY_TO` | Section 2 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OPS_TOKEN` | Section 3 |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN` | Section 5 |
| `WHATSAPP_APP_SECRET` | The Meta app's **App secret** (App settings → Basic). Meta signs every webhook with it; without it the WhatsApp webhook refuses everything in production |
| `MESSAGING_LINK_SECRET` | Any long random string; signs the Telegram link tokens and the Telegram webhook secret |
| `CRON_SECRET` | Any long random string. Vercel sends it to the daily sweep at 07:00. The outbox worker is called every minute by cron-job.org: GET `https://schoolspec.com/api/cron/outbox` with the header `Authorization: Bearer <CRON_SECRET>` |
| `OPS_PHONE` | Your number, shown in every platform template |

### In the console, once the variables are set

- **Settings → Connect Telegram bots** points both bots' webhooks at the site. Then send `/start` to the ops bot from your phone; that chat gets the alerts.
- **Settings → WhatsApp templates → Check with Meta** reads each template's status. A message goes by WhatsApp only once its template shows *approved*; until then it goes by SMS. The daily sweep re-checks.
- **Settings → Messaging settings** holds the overdraft, the starting credit, the ops phone, the WhatsApp number per plane and the daily cap.

## 9 · Order, and what each step switches on

| You do | The build can then switch on |
|---|---|
| 1 Arkesel housekeeping | Wallet, prices, SMS pings, notice links, the Messaging card |
| 2 Resend domain | Platform emails, receipts, the welcome |
| 3 Telegram bots | Free staff and parent channel; your alerts |
| 4 Paystack webhook check | Top-ups |
| 5a Meta account, number, templates | WhatsApp for one pilot school at 250 a day |
| 5b Business verification | WhatsApp for every school |
