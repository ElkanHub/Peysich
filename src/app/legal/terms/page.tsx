import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { A, CO, H2, H3, P, Summary, Ul } from "../prose";

export const metadata: Metadata = pageMeta({
  title: "Terms of service", path: "/legal/terms",
  description: "The agreement between a school and SchoolSpec: accounts, the free trial, subscriptions, SMS costs, each side’s responsibilities, and liability.",
});

export default function Terms() {
  return (
    <>
      <p className="lp-eyebrow">terms of service</p>
      <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.04] tracking-[-.035em] text-balance">The agreement between your school and SchoolSpec</h1>
      <Summary items={[
        "You get a working school system, we get the subscription. That is the deal.",
        "The school owns its data and is responsible for what it puts in and who it gives logins to.",
        "14 days free, then a plan paid by the term or by the academic year, by card or mobile money. Cancel any time.",
        "SMS you send from the app is charged at the rate shown before you send.",
        "We are liable up to what you paid us in the last 12 months. We are not liable for what a school does with the system.",
      ]} />

      <H2 id="who">1. Who this is between</H2>
      <P>These terms are between the school that creates an account (“the school”, “you”) and the operator of SchoolSpec, working from {CO.address} (“SchoolSpec”, “we”). They apply to the website at {CO.site}, every school’s address under it (for example <i>stmarys.{CO.site}</i>), the installable app, and everything sent from them.</P>
      <P>The person who creates the school account confirms that they are the proprietor, head, or an officer with authority to bind the school. Teachers, office staff, parents and students who are given a login use the service on the school’s behalf; the school is responsible for them, and the <A href="/legal/privacy">privacy policy</A> tells them how their information is handled.</P>

      <H2 id="service">2. What the service is</H2>
      <P>SchoolSpec is school management software: attendance registers, scores and report cards, fee records and receipts, announcements and SMS to parents, timetables, homework, admissions, and the other modules on the plan a school chooses. It is delivered over the internet and works on phones and computers. Some parts keep working without a connection and send themselves later.</P>
      <P>We keep improving it. Features may change, be added, or be retired. We will not remove something a school depends on without telling the school’s administrators first and giving a way to get the data out.</P>

      <H2 id="account">3. Accounts and logins</H2>
      <Ul items={[
        "The school’s administrator creates logins for staff, parents and students, and can limit what each one can open.",
        "Every person is responsible for keeping their password to themselves. The school office resets passwords; SchoolSpec never emails them.",
        "Tell us at once if you believe an account has been used by someone it does not belong to.",
        "One person may hold two logins (a teacher who is also a parent). Each login is separate.",
      ]} />

      <H2 id="data">4. The school’s data, and who is responsible for it</H2>
      <P>Everything a school enters — pupils, parents, staff, attendance, marks, fees, documents, messages — belongs to the school. Under Ghana’s Data Protection Act, 2012 (Act 843), the school is the <b>data controller</b> and SchoolSpec is a <b>data processor</b> acting on the school’s instructions. The <A href="/legal/data-processing">data processing agreement</A> sets that out in full and is part of these terms.</P>
      <P>The school is responsible for:</P>
      <Ul items={[
        "having the right to collect and enter the information it puts in, including the consent of parents and guardians where the law requires it, and telling them that the school uses SchoolSpec;",
        "the accuracy of what it enters, and correcting it when asked;",
        "the content of every announcement, SMS and email sent from the school’s account, and having the recipients’ agreement to be contacted;",
        "who it gives logins to, and removing logins when people leave;",
        "its own obligations under the Data Protection Act, including any registration the Act requires of it.",
      ]} />
      <P>We will never sell the school’s data, use it for advertising, or show one school’s data to another. We look at it only to run the service, support the school when asked, and as the data processing agreement allows.</P>

      <H2 id="money">5. Money</H2>
      <H3>The free trial</H3>
      <P>A new school gets 14 days free with everything switched on. No card is needed. On day 14 the school chooses a plan or the account pauses; nothing is deleted.</P>
      <H3>Plans and payment</H3>
      <Ul items={[
        "Plans are priced in Ghana cedis per term or per academic year, as shown on the billing page. A term payment covers four months from the day you pay; an academic year covers twelve, for the price of two and a half terms.",
        "Payment is by card or mobile money through Paystack. The subscription renews automatically at the end of each period until cancelled.",
        "Prices may change. We give at least 30 days’ notice by email to the school’s administrators, and a change never applies to a period already paid for.",
        "A plan has a student limit. If the school passes it, we will ask it to move to the next plan; we will not switch anything off without warning.",
        "Custom plans agreed by phone are confirmed in writing and form part of these terms.",
      ]} />
      <H3>SMS</H3>
      <P>SMS sent from the school’s account (absence alerts, receipts, reminders, blasts) is charged per message segment at the rate shown in the app before you send. A message longer than 160 characters counts as more than one segment. SMS charges are added to the next invoice or deducted from credit, as the billing page shows. SMS credits are not refundable.</P>
      <H3>Parents’ fees</H3>
      <P><b>No parent money passes through SchoolSpec.</b> Parents pay the school directly, by mobile money to the school’s own number or in cash at the office, and the school records it in the app. SchoolSpec is not a party to those payments and does not hold money on a school’s behalf. The only online payment in the app is the school’s own subscription.</P>
      <H3>Cancelling and refunds</H3>
      <P>The school can request cancellation from its billing page at any time, and it takes effect at the end of the period already paid for. What is and is not refunded is in the <A href="/legal/refunds">refunds and cancellation policy</A>.</P>

      <H2 id="use">6. Fair use</H2>
      <P>Use the service for running a school. Do not:</P>
      <Ul items={[
        "send SMS or email to people who have not agreed to hear from the school, or send anything unlawful, abusive or misleading;",
        "enter information you have no right to hold, or about people who are not connected to the school;",
        "try to reach another school’s data, break into the service, overload it, or copy it;",
        "share a login, or resell the service.",
      ]} />
      <P>If a school does any of these, we may suspend the account after telling the administrators, and in serious cases end it.</P>

      <H2 id="availability">7. Availability and support</H2>
      <P>We aim to keep the service available at all times, and most weeks it is. Maintenance is done at quiet hours and announced in the app when it will be noticeable. We are not responsible for outages caused by the school’s internet, phone networks, the SMS carrier, the payment provider, or events outside our control.</P>
      <P>Support is by WhatsApp and email at {CO.email} on working days. Every page in the app has a <b>Show me how</b> button and a full <b>How to do things</b> page.</P>

      <H2 id="leaving">8. When a school leaves</H2>
      <Ul items={[
        "Nothing is deleted when a school cancels or a trial ends. The account pauses and the data stays.",
        "For 90 days after the end of the last paid period, the school can ask for a full export (spreadsheets of every record, and its documents) and we provide it free within 14 days.",
        "After 90 days we delete the school’s data from our live systems, and from backups within a further 35 days, unless the school has asked us in writing to keep it, or a law requires us to keep part of it (for example, invoices).",
        "A school can ask for deletion earlier at any time.",
      ]} />

      <H2 id="ip">9. Ownership</H2>
      <P>SchoolSpec owns the software, its design and its name. The school owns its data and its own branding (crest, colour, signatures) and gives us permission to use them only to run the service for the school. Report cards, receipts and other papers the app produces belong to the school.</P>

      <H2 id="liability">10. Liability</H2>
      <P>We provide the service with reasonable skill and care. Beyond what the law does not allow us to exclude:</P>
      <Ul items={[
        "our total liability to a school for everything arising under these terms in any twelve-month period is limited to the amount the school paid us in that period;",
        "we are not liable for loss of profit, loss of business, or indirect loss;",
        "we are not liable for the content of anything a school enters or sends, for decisions a school takes based on the system, or for the acts of the people the school gives logins to;",
        "the school will meet any claim brought against us because of the school’s breach of section 4 or 6.",
      ]} />
      <P>Nothing in these terms limits liability for death, personal injury, or fraud.</P>

      <H2 id="changes">11. Changes to these terms</H2>
      <P>We may update these terms. For a change that matters we email the school’s administrators at least 30 days before it takes effect and show a notice in the app. Using the service after that date is acceptance. If a school does not accept a change, it may cancel before the date and section 8 applies.</P>

      <H2 id="law">12. Law and disputes</H2>
      <P>These terms are governed by the laws of the Republic of Ghana. If there is a disagreement, we talk first; either side may then ask for mediation before any court. The courts of Ghana have jurisdiction.</P>

      <H2 id="contact">13. Contact</H2>
      <P>SchoolSpec, {CO.address}. Email {CO.email}. Data protection questions: {CO.privacyEmail}.</P>
    </>
  );
}
