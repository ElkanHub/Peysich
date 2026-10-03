# Messaging: the build plan

How everything in `MESSAGING_COSTS.md` and `MESSAGING_SETUP.md` becomes code and
screens. Written before any code so the shape is agreed first. Steps 1 to 4 need
nothing from Meta and can go live with the first schools; step 5 is WhatsApp.

Design rules carried over from the simplicity work and applied to every screen
here: one job per screen, big words and buttons, say what will happen before and
what happened after, confirm only money and messages, plain words, works on a
phone first.

---

## 1 · The one door: `notify()`

Today seven places build their own SMS text and call `sendSms`. All of them move
to one function. Nothing else in the app sends a message.

```
notify({
  school,                       // or "platform"
  to: { kind: "guardian" | "staff" | "owner", id },
  kind: "absence" | "receipt" | "bill" | "reminder" | "emergency" | "notice" |
        "announcement" | "results" | "report_card" | "staff_nudge" | "login" | ...,
  vars: { child, amount, title, ... },
  link?: string,                // one-tap link to the full text, when there is one
  urgent?: boolean,             // emergency: WhatsApp and SMS both
})
```

What it does, in order:

1. Looks up the kind in the **template table** and renders the one fixed sentence
   for each channel. Same wording everywhere; the WhatsApp text is the text Meta
   approved.
2. Loads the recipient's channels: push subscription, Telegram chat, WhatsApp
   number and consent, SMS number, contact preference.
3. **Routes:** push and Telegram always (free). Then WhatsApp if number and consent,
   else SMS. Urgent: WhatsApp and SMS. A guardian whose preference is "phone"
   (no smartphone) gets the full text by SMS instead of a ping with a link.
4. **Prices the paid sends** from the price settings and checks the school's
   wallet. Enough balance, or an allowed overdraft for urgent and absence: write
   the charge and queue. Not enough: queue only the free channels, mark the paid
   ones as "held: wallet empty", and raise the banner.
5. Writes one row per channel to the **outbox** with status queued.
6. Returns what it did, so the caller's toast can say "Saved. 3 parents told
   (2 WhatsApp, 1 SMS)".

The platform plane uses the same door with `school: "platform"`, its own template
set, and no wallet.

### Providers

Three thin modules, same interface: `send(rendered) → { providerId }`, plus a
webhook handler each.

- `providers/arkesel.ts` — what `sendSms` does today, moved.
- `providers/whatsapp.ts` — Meta Cloud API: `POST /{phone_number_id}/messages`
  with the template name and variables; webhook for delivery and replies.
- `providers/telegram.ts` — `sendMessage` to a chat id; webhook for `/start`
  (account linking) and replies.
- Email stays as it is (Resend), reached from the same door for the platform plane.

Which WhatsApp number a plane uses is a setting. One number now; a second for
platform-to-school is a config change later.

## 2 · Data

New tables, all small. Nothing existing is dropped; `sms_log` is read once into
the new log and then retired.

| Table | What it holds |
|---|---|
| `message_templates` | kind, channel, text with `{{n}}` slots, WhatsApp template name and approval status, variable names, category. Seeded from a file; editable from the console |
| `messages` | the free text that lives in the app: school, kind (notice, announcement, emergency), title, body, audience (all, a class, one child), created by, created at |
| `message_links` | signed token → message and recipient; opened at |
| `outbox` | one row per recipient per channel: message or notify call, channel, rendered text, status (queued, sent, delivered, read, failed, held), provider id, parts, price, attempts, next try |
| `wallet_ledger` | school, kind (top-up, charge, refund, starting credit, manual), pesewas signed, reference (outbox row, Paystack reference, console user), price at the time, created at. **Balance = sum. No balance column.** |
| `price_settings` | one row per channel: price in pesewas, cost in pesewas (for your report), effective from |
| `contact_channels` | per guardian or staff: WhatsApp number, WhatsApp consent, Telegram chat id, linked at |
| `platform_timeline` | per school: event (stage change, message sent, message skipped and why, call logged, visit logged, paused), by whom, when |
| `platform_schedule` | per school and event key (trial_day11, dunning_day3 …): due date, sent at or skipped reason. One row per pair, so nothing sends twice |

On `schools`: `stage` (lead, signed_up, setting_up, live, trial_ending, paying,
past_due, suspended, left), `ownerPhone`, `autoMessagesPaused`.

## 3 · Sending in the background

- A **worker** route runs every minute from Vercel cron, takes up to N queued
  outbox rows, sends them, writes status. Retries three times with backoff;
  failures past that are marked failed and refunded to the wallet.
- A **daily sweep** (the existing dunning cron, grown) walks `platform_schedule`:
  for every row due today it checks the condition now (is the roll still empty?
  is a plan still unchosen?) and sends or writes "skipped: condition no longer
  true". It also moves schools between stages.
- **Meta's daily limit:** the worker counts distinct recipients today; past the
  limit it holds the rest until midnight rather than failing them.
- **Webhooks:** Paystack (top-ups, subscription), WhatsApp (delivered, read,
  failed, replies), Telegram (`/start`, replies). Replies to the shared number are
  auto-answered with the school's office number and forwarded to your Telegram.

## 4 · Free text in the app, with a one-tap link

- A notice, announcement or emergency is a `messages` row first. The ping is
  built from its title and a link.
- `/n/[token]` renders that one message, branded with the school's crest, with
  no sign-in. Opening it marks the link read. The school's page shows who has
  read it and who has not, with a **Remind the rest** button.
- Emergencies keep their fixed reason in the ping (illness, injury …) plus the
  office number, so the ping is enough on its own; the detail is in the app.

## 5 · Screens

### School side

**Billing → Messaging card** (the new part of the existing billing page)

```
┌──────────────────────────────────────────────┐
│  Messaging balance        GHS 84.20          │
│  [ Top up ]                                  │
│                                              │
│  Prices   WhatsApp 8p · SMS 6p per part      │
│           Telegram and the app: free         │
│                                              │
│  This term                                   │
│  WhatsApp     1,940 messages      GHS 155.20 │
│  SMS            310 parts         GHS  18.60 │
│  Telegram       420 messages      free       │
│  App          1,100 notifications free       │
│                                              │
│  By kind      absence 410 · receipts 500 ·   │
│               notices 1,800 · …              │
│  [ Every message and top-up → ]              │
└──────────────────────────────────────────────┘
```

Top up: amount with four big presets (20, 50, 100, 200), Paystack, back with a
toast "GHS 50 added. Balance GHS 134.20."

**The send confirm** (already exists for SMS) gains the channel split and the
cost: "Send to 180 parents? 153 by WhatsApp and 27 by SMS. Cost GHS 13.86.
Balance after GHS 70.34." When the wallet cannot cover it: "Not enough balance.
This will reach the app and Telegram for free; top up GHS 14 to send the pings."

**The wallet banner** on Home when the balance is under GHS 20 or empty, in the
school's words, with Top up.

**Parent and staff records** gain: WhatsApp number, "agrees to WhatsApp" tick,
Telegram linked or not with a **Link Telegram** button that opens the bot. The
import sheet gets a Parent WhatsApp column.

**Emergency, from a child's page:** six big buttons with the reasons, one short
detail line, **Send now**. The confirm says who will get it and how.

**Notice read tracking:** on each notice, "Read by 112 of 180" with the list and
**Remind the rest**.

### Parent and student side

- `/n/[token]`: the message, big text, the school's name and crest, nothing else.
- My account: **Get messages on Telegram, free** with the link button; WhatsApp
  consent shown and changeable.

### Console

**Pipeline** (Console → Schools): a board by stage, each school a card with days
in stage, balance, next automatic message due, and a paused flag.

**A school's page → Timeline:** newest first, every message sent, delivered, read;
every skipped message and why; every logged call or visit; stage changes.
Buttons: **Log a call**, **Log a visit**, **Pause automatic messages**, **Add
credit**.

**Messaging settings:** the price per channel, your cost per channel, the
overdraft limit, the starting credit, the ops phone number, which WhatsApp
number each plane uses, the daily WhatsApp cap.

**Costs:** this month by school and channel: charged, cost, margin; failed sends;
Meta's quality rating; Arkesel and Resend balances.

### Your alerts (Telegram, ops bot)

New lead, sign-up, plan request, cancellation request, failed payment,
suspension, wallet overdraft used, provider failure rate over 5% in an hour,
Meta quality rating drop, and a 7:00 digest.

## 6 · The platform calendar

| Day or event | Message | Channel | Condition at send time |
|---|---|---|---|
| Sign-up | Welcome | Email | — |
| Trial day 2 | setup_day2 | Telegram to you (auto-send after 10 schools) | roll empty |
| Trial day 5 | setup_day5 | same | no register saved |
| Trial day 11 | trial_3_days | WhatsApp, email, banner | no plan chosen |
| Trial day 14 | trial_ended | WhatsApp, email | no plan chosen |
| Day 21, 60 | data still here | Email | still no plan |
| Day 80 | deletion_10_days | WhatsApp, email | still no plan |
| Payment received | receipt | Email | — |
| Renewal − 7 | renewal coming | Email | — |
| Renewal − 1 | renewal_tomorrow | WhatsApp | — |
| Payment failed, day 0, 3, 7 | payment_failed | WhatsApp, email, banner | still unpaid |
| Past due day 14 | suspended | WhatsApp, email | still unpaid |
| Reactivated, plan changed, cancellation | confirmations | Email | — |
| Wallet < 20 | wallet_low | WhatsApp, banner | once per dip |
| Wallet = 0 | wallet_empty | WhatsApp, email | once |
| Top-up | receipt | Email | — |
| Export ready, new admin login | notice | Email | — |

Every automatic message to a school is suppressed for seven days after you log
a call or a visit, and entirely while the school is paused.

## 7 · Order of work

| Step | Builds | Live needs |
|---|---|---|
| 1 | `notify()` door, template table seeded, Arkesel moved behind it, all seven senders switched over; `wallet_ledger`, `price_settings`, charges on every paid send; Messaging card and Top up; send confirm with cost; wallet banner; starting credit | Arkesel, Paystack |
| 2 | `messages`, `/n/[token]`, notice and announcement pings with links, emergency buttons, read tracking, phone-only fallback | — |
| 3 | `outbox` and the minute worker, retries, refunds on failure, daily cap | — |
| 4 | Telegram provider, `/start` linking, My account button, ops bot alerts | Telegram bots |
| 5 | WhatsApp provider, template sync and status, webhook, contact channels and consent, import column, sign-up owner phone | Meta account, templates; verification to go wide |
| 6 | Platform plane: email template, the calendar in the sweep, `platform_schedule`, stages, pipeline board, timeline, pause, log call or visit, console settings and cost pages | Resend domain |

Each step ships on its own and is verified before the next: typecheck, lint,
build, the smoke test extended to the new pages, and a real send on each channel
to a test phone.

## 8 · Acceptance checks, in the person's words

- A head tops up GHS 50 by MoMo and sees the balance change within a minute.
- A teacher saves a register with two absent children; two parents get an SMS
  (or WhatsApp) within a minute; the wallet shows two charges of 6p (or 8p).
- A notice to 180 parents shows "153 by WhatsApp, 27 by SMS, GHS 13.86" before
  sending, and "Read by n" afterwards.
- With an empty wallet, an emergency still sends; a notice reaches the app and
  Telegram and the banner says why the pings did not go.
- A parent with no smartphone, marked phone-only, gets the whole notice by SMS.
- A new school that you visited on day 1 gets no day-2 message; the timeline
  shows it skipped.
- Every price on the Messaging card matches `price_settings`; every charge row
  matches a message in the outbox; the console's cost report adds up to the
  providers' invoices.

## 9 · Not in this build, on purpose

- A second WhatsApp number for the platform plane.
- Per-school WhatsApp numbers or sender names on WhatsApp.
- Two-way chat with parents beyond the auto-reply and forwarding to you.
- Per-school email domains.
- Expiring credits or promotional bundles.
