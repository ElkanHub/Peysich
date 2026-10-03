# What messaging costs, channel by channel

Baseline: **10 schools, 200 pupils each**. Prices checked on 2 October 2026.
Everything is in Ghana cedis unless marked.

## The answer first

1. **In Ghana, SMS is the cheap channel, not WhatsApp.** One SMS costs about
   2.5 pesewas. One WhatsApp message through Twilio costs about 10.6 pesewas, four
   times as much. Twilio's own fee alone (5.9 pesewas) is more than two SMS.
2. **Putting every message on WhatsApp through Twilio would cost about GHS 1,500 a
   year per school**, which is 77% of your lowest plan. It does not fit.
3. **The blend that fits:** SMS for the short urgent things, the app's own free
   notifications first for broadcasts, WhatsApp only where it earns its price
   (documents, long notices, replies). That is about **GHS 400 a year per school**,
   20% of the lowest plan, and it drops further as parents install the app.
4. **The way to absorb it:** the essentials are included in the fee; broadcast SMS
   is paid from a prepaid wallet at 9 pesewas, which the app already supports. One
   blast a month from each school pays for that school's essentials.
5. **A blocker to know before building WhatsApp:** Meta limits an unverified
   business to about 250 different people a day, and verification needs business
   registration documents. Ten schools sending one notice is 1,800 parents.
   **WhatsApp at this scale has to wait for the registration. SMS does not.**

---

## 1 · The prices

| Channel | Provider | Price per message | In pesewas | Source |
|---|---|---|---|---|
| **SMS** | Arkesel | GHS 0.0219 to 0.031 per SMS, by bundle size. No-expiry credits: GHS 0.025 at GHS 2,000+ | **2.5p** | arkesel.com/pricing, fetched 2 Oct 2026 |
| **WhatsApp, a notice the school starts** (utility template) | Twilio | Twilio fee $0.005 + Meta fee about $0.004 = **$0.009** | **10.6p** | twilio.com/en-us/whatsapp/pricing; Meta fee is my figure for the "Rest of Africa" market, see the note below |
| **WhatsApp, a promotional message** (marketing template) | Twilio | $0.005 + about $0.0225 = $0.0275 | **32.3p** | same |
| **WhatsApp, a reply inside 24 hours of the parent writing** | Twilio | Meta free + Twilio $0.005 | **5.9p** | Twilio pricing page |
| **WhatsApp, a parent's message arriving** | Twilio | $0.005 | **5.9p** | Twilio charges inbound too |
| **WhatsApp direct from Meta** (Cloud API, no Twilio) | Meta | About $0.004 utility, free replies | **4.7p** | Meta pricing docs |
| **Email** | Resend | Free up to 3,000 a month (100 a day). Then $20 a month for 50,000 | **0 to 0.5p** | resend.com/pricing, fetched 2 Oct 2026 |
| **Telegram** | Telegram Bot API | Free | **0** | Telegram charges nothing per message |
| **App notification** (push) | Already built | Free | **0** | — |

Exchange rate used: **1 USD = GHS 11.73** (open.er-api.com, 2 Oct 2026). WhatsApp
and email are priced in dollars, so they move with the cedi. SMS does not.

> **One number to confirm.** Meta publishes its rates in a rate card I could not
> open today. Ghana falls in the "Rest of Africa" market. I have used $0.004 for a
> utility message and $0.0225 for a marketing message, which are the figures I know
> for that market. Twilio's page showed $0.0034 for the default market. Check the
> rate card in your Meta Business account before committing; the conclusions below
> hold at either figure, because Twilio's fee dominates.

**A long SMS is several SMS.** 160 characters is one. Beyond that each 153
characters is another. A 300-character notice is two SMS: 5p. WhatsApp charges per
message whatever the length, so WhatsApp only starts to compete on long messages.

---

## 2 · What one school sends in a month

A school of 200 pupils, about 180 parents (siblings share one), 15 staff, 21 school
days. These are estimates from how the app works; change them as real schools show
their habits.

| Message | A month | SMS parts | Cost by SMS | By WhatsApp (Twilio) | By WhatsApp (direct) |
|---|---|---|---|---|---|
| Absence alert (4% absent a day) | 168 | 168 | 4.20 | 17.74 | 7.88 |
| Bill created (one per child per term) | 67 | 134 | 3.35 | 7.07 | 3.14 |
| Payment receipt (2.5 payments per child per term) | 167 | 167 | 4.17 | 17.63 | 7.84 |
| Fee reminder (40% owing, three a term) | 80 | 160 | 4.00 | 8.45 | 3.75 |
| Emergency to one parent | 10 | 20 | 0.50 | 1.06 | 0.47 |
| **Notice to all parents (four a month)** | **720** | **1,440** | **36.00** | **76.01** | **33.78** |
| Results or report card ready (two a term) | 120 | 120 | 3.00 | 12.67 | 5.63 |
| To teachers and staff (reminders, notices) | 90 | 90 | 2.25 | 9.50 | 4.22 |
| **Total** | **1,422** | **2,299** | **GHS 57.48** | **GHS 150.12** | **GHS 66.72** |

**Read the bold row.** Notices to every parent are 63% of the SMS bill. Everything
that is about one child, one day, one payment, the things the school cannot do
without, costs **GHS 16.23 a month**. The rest is broadcasting.

---

## 3 · The routes compared

A year is taken as 10 months of activity. The three plans are your proposed
academic-year prices: GHS 1,950 (650 a term), 3,500 and 5,000.

| Route | One school a month | One school a year | 10 schools a month | 10 schools a year | Share of the 1,950 plan | Of 3,500 | Of 5,000 |
|---|---|---|---|---|---|---|---|
| Everything by SMS (today) | 57.48 | 575 | 575 | 5,748 | 29% | 16% | 12% |
| Everything by WhatsApp through Twilio | 150.12 | 1,501 | 1,501 | 15,012 | **77%** | 43% | 30% |
| Everything by WhatsApp direct from Meta | 66.72 | 667 | 667 | 6,672 | 34% | 19% | 13% |
| **Your suggestion:** WhatsApp for the 70% of parents on it, SMS for the rest (Twilio) | 117.25 | 1,173 | 1,173 | 11,725 | **60%** | 34% | 24% |
| SMS for short alerts, WhatsApp only for broadcasts to parents on it (Twilio) | 92.25 | 923 | 923 | 9,225 | 47% | 26% | 19% |
| Same, WhatsApp direct from Meta | 57.76 | 578 | 578 | 5,776 | 30% | 17% | 12% |
| **Recommended: essentials by SMS, broadcasts to the app first, staff free** | **39.62** | **396** | **396** | **3,963** | **20%** | **11%** | **8%** |

Per pupil, the recommended route is about **GHS 2 a year**. Your suggestion is
about GHS 5.90.

**Platform to schools** (you to the ten heads): about 6 messages a school a month.
By email it is free (60 a month against Resend's 3,000). By WhatsApp through
Twilio it is GHS 6.33 a month for all ten. Trivial either way.

---

## 4 · The recommended blend

Your plan was: schools to parents and teachers on **WhatsApp and SMS**; you to
schools on **WhatsApp and email**. The shape is right. The change I recommend is
which channel goes first, because of what each costs.

### School to parents

| What | First | If that does not reach them | Why |
|---|---|---|---|
| Absence alert | **SMS** | — | Short, urgent, must land on any phone, 2.5p |
| Emergency to one parent | **SMS and WhatsApp together** | Then the school phones | 15.6p for both. Worth it every time |
| Receipt, bill, fee reminder | **SMS** | — | Short. A parent keeps the SMS as proof |
| Notice to all parents | **App notification** (free) | SMS from the school's wallet, or WhatsApp once it is live | Broadcasts are the expensive part |
| Report card or results ready | **App notification** | WhatsApp with the PDF, or one SMS with the link | WhatsApp earns its price when it carries the document |
| A conversation (the parent replies) | **WhatsApp** | — | The only channel where a parent can answer |

### School to teachers

App notification first, **Telegram** second (free, and teachers are the people most
likely to have it), SMS only for "the register is not marked" at 8:00.

### You to schools

**Email** for anything they keep (invoices, receipts, policy changes). **WhatsApp**
for anything they must see today (trial ending, payment failed, a new feature).
No SMS. Volume is tiny, so the cost does not matter; use whatever gets read.

---

## 5 · How the cost is absorbed

**Included in every plan: the essentials.** Absence alerts, receipts, bills,
reminders, emergencies. About 650 SMS a month for a 200-pupil school: **GHS 16 a
month, GHS 162 a year, 8% of the lowest plan.** A school never has to think about
whether an absence alert is "worth sending".

**Paid from the school's wallet: broadcast SMS.** The app already shows the count
and the cost before a blast and charges 9 pesewas per SMS. It costs you 2.5p.

| One notice to 180 parents, two SMS long | |
|---|---|
| The school pays | GHS 32.40 |
| It costs you | GHS 9.00 |
| Margin | GHS 23.40 |

One paid blast a month from a school more than covers that school's essentials
(GHS 16). A school that prefers not to pay sends the notice to the app for free.
That is also the nudge that gets parents to install it.

**Suggested allowances by plan** (essentials are unlimited in all three):

| Plan | A year | Free broadcast SMS included a term | What that is | Cost to you a year |
|---|---|---|---|---|
| Lowest (650 a term) | 1,950 | 400 | About one notice to every parent a term | about GHS 190 (10%) |
| Second | 3,500 | 1,500 | About one a month | about GHS 275 (8%) |
| Premium | 5,000 | 4,000 | About one a week | about GHS 460 (9%) |

These costs are for a 200-pupil school. Essentials scale with the roll at about
**81 pesewas per pupil per year**, so a 600-pupil school on the second plan costs
about GHS 490 a year for essentials plus its allowance, still under 15%.

Beyond the allowance the wallet takes over. Messaging stays at or under 10% of
revenue on every plan, and the heavy senders pay for themselves.

**For ten schools, a month:** about GHS 160 for essentials, plus whatever
broadcasts the schools buy (which you profit on), plus GHS 0 for email. Call it
**under GHS 400 a month all in** on the recommended route, against GHS 1,500 if
everything went through Twilio.

---

## 6 · WhatsApp: one shared number, and what that means

You want one SchoolSpec number for every school, with the school's name in the
message. That works, with these facts:

- **The name parents see is "SchoolSpec".** The school's name goes in the text:
  *"St Mary's School: Ama was marked absent today. Call the office on 024…"*
- **Every message the school starts must be a template Meta approved in advance.**
  You cannot send free text to a parent who has not written to you in the last 24
  hours. Each template is fixed wording with blanks. Plan on about twelve.
- **Emergencies need templates too.** A template that is one big blank gets
  rejected or priced as marketing. So: fixed reasons with a short blank for detail.

  | Template | Reads |
  |---|---|
  | Illness | *{school}: {child} is unwell at school. Please call the office on {phone} now. {short note}* |
  | Injury | *{school}: {child} has had an accident at school and is being looked after. Please call {phone}. {short note}* |
  | Allergy or medical | *{school}: {child} needs medical attention. Please call {phone} immediately. {short note}* |
  | Behaviour | *{school}: the head would like to speak with you about {child} today. Please call {phone}. {short note}* |
  | Come to the school | *{school}: please come to the school about {child} as soon as you can. {short note}* |
  | Pick up early | *{school}: please collect {child} early today at {time}. {short note}* |

  The same six go out by SMS at the same moment, where the wording is free.
- **Flexible, within the window.** Once a parent replies, the school can write
  anything for 24 hours, and Meta charges nothing for it.
- **Parents must agree first.** WhatsApp requires opt-in. One line on the
  admission form and a tick on the parent's record covers it.
- **One number, shared risk.** If parents block or report messages from one
  school, the quality rating of the shared number drops for all ten. Keep
  marketing off it entirely.
- **Replies arrive at one number.** A parent's reply has to be routed to the right
  school by their phone number. Until that inbox is built, the templates should
  say "call the office on…" and the number should auto-reply with that. Each
  incoming message also costs 5.9p through Twilio.
- **The daily limit.** A new, unverified WhatsApp Business account can start
  conversations with about 250 different people in 24 hours. Verified accounts
  start at 1,000 and climb to 10,000 and beyond as quality holds. Verification
  asks for business registration documents. **This is the real gate on WhatsApp,
  more than the price.**

### Twilio, or Meta direct?

| | Twilio | Meta Cloud API direct |
|---|---|---|
| Price of a school-started notice | 10.6p | 4.7p |
| Price of a reply in the window | 5.9p | Free |
| Setup | Fastest: a sandbox today, one API for WhatsApp and SMS | A Meta developer app and a webhook; a few days more |
| When it makes sense | To prototype this month | Before real volume |

**Recommendation:** prototype on Twilio because it is quick, and write the sending
code behind one function so the provider can be swapped. Move to Meta direct before
you pass a few thousand WhatsApp messages a month; the saving is more than half.

---

## 7 · Email, across many schools

You already send through Resend from one address on your own domain. Keep one
domain for now:

- **From:** *St Mary's School via SchoolSpec* `<notices@send.schoolspec.com>`
- **Reply-To:** the school's own email, so a parent's reply goes to the school.
- The school's crest and colour in the email body, as the receipts already do.

This costs nothing up to 3,000 emails a month and needs no setup per school. A
school that wants mail from its own domain (`office@stmarys.edu.gh`) can have it
later as a Premium perk: Resend's $20 plan allows 10 domains.

You are right that parents rarely read email. Use it for the school's office and
for documents (a bill, a report card PDF), not for anything urgent.

---

## 8 · Telegram

Free to send, no templates, no approval, pictures and files and buttons all
allowed. The catch is that the person must have Telegram and must tap **Start**
on your bot once; you cannot message a phone number cold.

**How to offer it:** a line on the parent's and teacher's account page, *"Get
school messages on Telegram, free"*, with a link that opens the SchoolSpec bot
and ties it to their account. Anyone who links it gets broadcasts there at no cost
to you or the school.

**Where it pays off first:** teachers and staff. Register reminders, score
reminders and staff notices become free, and staff are the most likely to have it.
Among parents in this market Telegram is far less common than WhatsApp, so treat
it as a bonus channel, not the plan.

---

## 9 · What to build, in order

1. **Now, no registration needed:** keep SMS for essentials; make broadcasts go to
   the app first with "also send by SMS (costs GHS X)" as the paid option; add the
   plan allowances. The six emergency messages by SMS, one tap each from a child's
   page.
2. **Next:** the Telegram bot for staff, then parents. Free, a few days of work.
3. **After the business is registered:** WhatsApp. Verify with Meta, submit the
   twelve templates, prototype on Twilio, move to Meta direct.
4. **Later:** the shared inbox for parent replies; per-school email domains.

## Assumptions to replace with real numbers

| Assumption | Used here | How to get the real one |
|---|---|---|
| Daily absence rate | 4% | The app's own attendance data after a term |
| Payments per child per term | 2.5 | The fees ledger |
| Notices to all parents | 4 a month | The announcements log |
| Parents on WhatsApp who opt in | 70% | The opt-in tick |
| Parents with the app installed | 40% | Push subscriptions |
| Meta utility rate, Rest of Africa | $0.004 | The rate card in Meta Business |
| Exchange rate | 11.73 | It moves; WhatsApp and email move with it |
