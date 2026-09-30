import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { A, CO, H2, P, Summary, Table, Ul } from "../prose";

export const metadata: Metadata = pageMeta({
  title: "Data processing agreement", path: "/legal/data-processing",
  description: "How SchoolSpec processes a school’s pupil, parent and staff data on the school’s instructions under Ghana’s Data Protection Act, 2012.",
});

export default function DPA() {
  return (
    <>
      <p className="mk-hand">data processing agreement</p>
      <h1 className="mt-2 text-[clamp(36px,5vw,56px)] font-medium leading-[.98] tracking-[-.035em]">How we handle your school’s data on your instructions</h1>
      <Summary items={[
        "The school is the controller. SchoolSpec is the processor. We act only on the school’s instructions.",
        "We keep the data confidential, secure, inside the school’s own space, and with the named providers only.",
        "We tell you about a breach within 72 hours, help you answer people’s requests, and hand everything back or delete it when you leave.",
      ]} />
      <P>This agreement is part of the <A href="/legal/terms">terms of service</A> and applies from the moment a school creates its account. Words in it have the meanings given in the Data Protection Act, 2012 (Act 843).</P>

      <H2>1. The parties and their roles</H2>
      <P>The school (the <b>controller</b>) and the operator of SchoolSpec (the <b>processor</b>, “SchoolSpec”). The school decides what personal data is entered and why; SchoolSpec processes it only to provide the service described in the terms and as the school instructs through the app.</P>

      <H2>2. What is processed</H2>
      <Table head={["Item", "Detail"]} rows={[
        ["Subject matter", "Running the school: attendance, assessment and report cards, fees and receipts, communications with parents, timetables, homework, admissions and the other modules on the school’s plan"],
        ["Duration", "For as long as the school has an account, plus the retention period in section 8"],
        ["Nature", "Storage, organisation, retrieval, display to authorised users, sending of messages the school composes or triggers, computation (totals, grades, positions, balances), production of printable papers, backup"],
        ["Categories of people", "Pupils (mostly children), their parents and guardians, teachers and other staff, applicants for admission and their guardians"],
        ["Categories of data", "Names and contact details, sex and date of birth, identification numbers, photographs, health notes recorded by the school, attendance, marks and reports, fee accounts, employment and payroll details of staff, documents the school uploads, messages sent"],
        ["Special categories", "Health notes about pupils, if the school records them. The school confirms it has a lawful basis to hold them"],
      ]} />

      <H2>3. The school’s instructions</H2>
      <P>The school’s instructions are: the terms of service, this agreement, and what the school’s authorised users do in the app (entering, editing, sending, printing, exporting). SchoolSpec will not process the data for any other purpose. If we believe an instruction breaks the law, we tell the school and may pause that instruction until it is resolved.</P>

      <H2>4. Confidentiality</H2>
      <P>Every SchoolSpec person with access to school data is bound by a written duty of confidentiality, has access only as far as their job needs, and that access is logged.</P>

      <H2>5. Security</H2>
      <Ul items={[
        "Encryption in transit (HTTPS everywhere) and at rest at the database and file providers.",
        "Every school in its own logical space; every request checks the person’s school, role and granted pages.",
        "Passwords hashed; uploads by short-lived signed links; sessions expire.",
        "Continuous database backups kept for 30 days; restore tested.",
        "Providers chosen for their certified security programmes (see section 7) and bound by contract.",
        "A written record of processing activities.",
      ]} />

      <H2>6. Breaches</H2>
      <P>If SchoolSpec becomes aware of a personal data breach affecting a school’s data, it tells the school’s administrators without undue delay and within 72 hours, with what is known: what happened, whose data, the likely effect, what we have done and what we suggest. We help the school with any notification the Act requires, and we keep a record of every breach.</P>

      <H2>7. Sub-processors</H2>
      <P>The school authorises SchoolSpec to use the providers listed in the <A href="/legal/privacy#who-sees">privacy policy</A> (Vercel, Neon, Cloudflare, Arkesel, Resend, Paystack, and Google for optional sign-in). Each is bound by a written contract that imposes duties at least as protective as this agreement. We tell the school’s administrators by email at least 30 days before adding or replacing one; a school that objects on reasonable data-protection grounds may cancel under the terms without penalty.</P>

      <H2>8. Return and deletion</H2>
      <Ul items={[
        "Any time, the school can export its records from the app (spreadsheets) and its documents, or ask us for a full export, provided free within 14 days.",
        "When the account ends, the data stays for 90 days so the school can retrieve it. Then it is deleted from live systems and, within a further 35 days, from backups, unless the school has instructed us to keep it or a law requires retention of part of it.",
        "On the school’s written request we delete earlier and confirm in writing.",
      ]} />

      <H2>9. Helping the school</H2>
      <P>SchoolSpec helps the school answer requests from parents, pupils and staff about their data (access, correction, deletion, objection), and answers the school’s reasonable questions for its own compliance, including once a year a written security questionnaire. Where a request takes real work beyond the service, we may charge a reasonable fee agreed in advance.</P>

      <H2>10. Audits</H2>
      <P>The school may ask, once a year or after a breach, for the information needed to show that SchoolSpec meets this agreement. Where that is not enough, an audit may be carried out by an independent auditor agreed by both sides, at the school’s cost, at a reasonable time, with 30 days’ notice, and under confidentiality.</P>

      <H2>11. Transfers outside Ghana</H2>
      <P>Data is stored with providers in Germany and on global networks as listed. SchoolSpec ensures each transfer has safeguards recognised under the Act and the Commission’s guidance, and will move storage if the law requires it.</P>

      <H2>12. Liability and term</H2>
      <P>Liability under this agreement is subject to the limits in the terms of service. This agreement lasts as long as SchoolSpec holds any of the school’s data.</P>

      <P className="mt-8">Contact for anything under this agreement: {CO.privacyEmail}.</P>
    </>
  );
}
