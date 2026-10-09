import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { A, CO, H2, H3, P, Summary, Table, Ul } from "../prose";

export const metadata: Metadata = pageMeta({
  title: "Privacy policy", path: "/legal/privacy",
  description: "What SchoolSpec collects about heads, teachers, parents and pupils, why, who it is shared with, how long it stays, and your rights under Ghana’s Data Protection Act.",
});

export default function Privacy() {
  return (
    <>
      <p className="lp-eyebrow">privacy policy</p>
      <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.04] tracking-[-.035em] text-balance">What we know about you, and what we do with it</h1>
      <Summary items={[
        "Your school entered your information to run the school. We keep it for the school; we do not sell it or use it for advertising.",
        "Children’s records are handled on the school’s instructions only, and never shown to anyone outside that school.",
        "It is stored with a small number of named providers, in Europe and Ghana, under contracts that bind them to the same rules.",
        "You can ask to see, correct or delete what is held about you. Ask the school first; ask us if that does not work.",
        "No tracking cookies. Two cookies keep you signed in and route you to your school; everything else is on your own device.",
      ]} />

      <H2 id="who">1. Who we are, and the two hats we wear</H2>
      <P>SchoolSpec is operated from {CO.address}. Write to {CO.privacyEmail} about anything in this policy.</P>
      <P>Under the Data Protection Act, 2012 (Act 843) we wear two hats:</P>
      <Ul items={[
        <><b>Processor</b> for everything a school enters about its pupils, parents, staff and money. The school decides why and how that information is used; we act on its instructions under a <A href="/legal/data-processing">data processing agreement</A>. If you are a parent, pupil or teacher, the school is the controller of your record, and it is the first place to ask about it.</>,
        <><b>Controller</b> for the small amount of information we collect ourselves: the account of the person who signs the school up, billing, support conversations, the demo-request form on our website, and the technical logs of the service.</>,
      ]} />

      <H2 id="what">2. What is collected</H2>
      <Table head={["About whom", "What", "Entered by"]} rows={[
        ["Pupils", "Name, sex, date of birth, class, admission number, photo, ID or birth-certificate number, health notes, previous school, attendance, marks and report cards, homework hand-ins, fee bills and receipts, documents the school uploads", "The school (office or teachers)"],
        ["Parents and guardians", "Name, phone, email, relationship to the child, how they prefer to be reached, login details, messages the school sends them", "The school"],
        ["Teachers and staff", "Name, phone, email, ID number, employment details, qualifications, bank and SSNIT details if the school records them, signature, what they can open, what they entered and when", "The school and the person"],
        ["The school’s administrator", "Name, email, password (stored hashed), the school’s name and address, billing history", "The person, at sign-up"],
        ["Website visitors", "Name, school and phone if you fill in the walkthrough form; nothing otherwise — no tracking", "You"],
        ["Everyone signed in", "Technical logs: address, device type, time, what was requested; push-notification subscription if you turn it on", "Automatically"],
      ]} />
      <P>We never ask for a parent’s card or mobile-money details: parents pay the school directly, outside the app. Only the school’s own subscription is paid online, and the card details go to Paystack, not to us.</P>

      <H2 id="why">3. Why, and on what legal basis</H2>
      <Ul items={[
        <><b>To run the school</b> (registers, report cards, fee records, timetables, notices): the school’s instructions, under its own lawful basis — its contract with the family or its legitimate interest in running the school, and consent from parents where the school needs it.</>,
        <><b>To send messages the school asks us to send</b> (an absence SMS, a receipt, a notice): the school’s instructions. Parents may ask the school to change how they are contacted.</>,
        <><b>To run your account, bill the school, and answer support</b>: our contract with the school.</>,
        <><b>To keep the service secure and working</b> (logs, backups, error reports): our legitimate interest.</>,
        <><b>To reply when you ask for a walkthrough on the website</b>: your request.</>,
      ]} />
      <P>We do not use anyone’s information for advertising, profiling, or to train anything. We do not sell it.</P>

      <H2 id="children">4. Children</H2>
      <P>Most pupils are children. Their records exist because their school keeps them, as schools always have; the app is the exercise book. The school decides what is recorded and who may see it. A pupil’s own login (JHS only, if the school switches it on) shows that pupil only their own timetable, homework and results, never fees or other pupils. We do not contact children directly. Photos are shown only inside the school’s account and on the papers the school prints.</P>

      <H2 id="who-sees">5. Who sees it</H2>
      <H3>Inside the school</H3>
      <P>The school’s administrators see everything in their school. Teachers see only the classes they teach. Parents see only their own children. A limited office login (a cashier, for example) sees only the pages the school granted. No school can see another school.</P>
      <H3>At SchoolSpec</H3>
      <P>A small number of our staff can reach a school’s data to run the service and to help when the school asks. Each is bound by confidentiality, and access is logged.</P>
      <H3>The providers that store or carry it</H3>
      <Table head={["Provider", "What it does", "Where", "What it holds"]} rows={[
        ["Vercel", "Runs the application", "Global network; functions in the EU", "Every request passes through it; nothing is stored at rest"],
        ["Neon", "The database", "Frankfurt, Germany", "All records"],
        ["Cloudflare R2", "File storage", "Cloudflare network", "Photos, crests, signatures, uploaded documents, PDFs"],
        ["Arkesel", "Sends SMS", "Ghana", "The phone number and the text of each SMS"],
        ["Resend", "Sends email", "USA / EU", "The address and the text of each email"],
        ["Paystack", "Takes the school’s subscription payment", "Nigeria / Ghana", "The payer’s card or mobile-money details — never seen by us"],
        ["Google", "Optional 'Continue with Google’ sign-in", "Global", "Your Google email and name, only if you choose that button"],
      ]} />
      <P>Each provider is bound by a contract that allows it to use the data only to provide its service to us. Where data leaves Ghana (Germany, the EU, the USA) it goes to providers with recognised safeguards and certifications; the Data Protection Commission’s rules on transfers are followed. We will tell schools’ administrators before adding or replacing a provider.</P>
      <H3>Nobody else, except</H3>
      <P>We disclose information outside this list only if the law requires it, or to protect someone’s safety, and then only what is necessary. If SchoolSpec is ever sold or merged, the data goes with it under this same policy, and schools are told.</P>

      <H2 id="how-long">6. How long it stays</H2>
      <Ul items={[
        "As long as the school uses SchoolSpec, its records stay, because a school’s records are permanent by nature: a report card from three years ago is still a report card.",
        "When a school leaves, nothing is deleted at once. After 90 days the school’s data is deleted from the live systems and, within a further 35 days, from backups — unless the school asks us to keep it, or a law says we must keep part of it (invoices, for example).",
        "Sent SMS and email are logged for 24 months so the school can see what was sent and what it cost.",
        "Technical logs are kept for 30 days.",
        "A walkthrough request from the website is kept for 12 months, then deleted.",
      ]} />

      <H2 id="security">7. How it is protected</H2>
      <Ul items={[
        "Every connection is encrypted (HTTPS). Data is encrypted at rest at the database and file providers.",
        "Every school lives in its own space and every request checks that the person belongs to that school and may open that page.",
        "Passwords are stored hashed and never sent by email. Uploads go straight to storage through short-lived signed links.",
        "The database is backed up continuously; backups are kept for 30 days.",
        "If we ever discover a breach that affects a school’s data, we tell that school’s administrators within 72 hours of knowing, with what happened and what we are doing, and we notify the Data Protection Commission where the Act requires it.",
      ]} />

      <H2 id="rights">8. Your rights</H2>
      <P>Under Act 843 you may ask to see the information held about you, have it corrected, have it deleted where there is no longer a reason to keep it, and object to how it is used. You may also complain to the Data Protection Commission of Ghana.</P>
      <P>If your record was entered by a school, ask the school office first: it holds the record and can change it directly. If the school does not act within a reasonable time, write to {CO.privacyEmail} and we will help, and answer within 30 days. We may need to confirm who you are before we act.</P>
      <P>To stop SMS from a school, tell the school office; they change your preference in the app. To turn off push notifications, use My account → Notifications, or your phone’s settings.</P>

      <H2 id="cookies">9. Cookies and things saved on your device</H2>
      <P>Two cookies: one keeps you signed in, one routes you to your school. Nothing tracks you across sites. Some things are saved on your own phone or computer so the app works without a connection and remembers your choices. The full list is on the <A href="/legal/cookies">cookies page</A>. Because none of it needs consent, there is no cookie pop-up.</P>

      <H2 id="changes">10. Changes</H2>
      <P>When this policy changes in a way that matters, we tell schools’ administrators by email and show a notice in the app. The date at the side of this page is the date of the current version.</P>

      <H2 id="contact">11. Contact</H2>
      <P>SchoolSpec, {CO.address}. Data protection: {CO.privacyEmail}. General: {CO.email}.</P>
    </>
  );
}
