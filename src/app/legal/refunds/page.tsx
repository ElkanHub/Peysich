import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { A, CO, H2, P, Summary, Ul } from "../prose";

export const metadata: Metadata = pageMeta({
  title: "Refunds & cancellation", path: "/legal/refunds",
  description: "SchoolSpec’s free trial, how to cancel, what happens to your data, and when money comes back.",
});

export default function Refunds() {
  return (
    <>
      <p className="lp-eyebrow">refunds & cancellation</p>
      <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.04] tracking-[-.035em] text-balance">Cancel any time. Nothing is deleted.</h1>
      <Summary items={[
        "14 days free, no card. Nothing to refund if you stop.",
        "Term plan: cancel any time; you keep access to the end of the term you paid for (four months from payment). No refund for that term.",
        "Academic-year plan: cancel within 30 days of paying and we refund the unused whole months. After that, you keep access to the end of the year.",
        "If the service was broken and we could not fix it, we refund the affected period, whatever the plan.",
        "SMS credits are not refundable. Parents’ fees never pass through us, so we cannot refund those; ask the school.",
      ]} />

      <H2>The free trial</H2>
      <P>Every new school gets 14 days with everything switched on and no card taken. If you do not choose a plan, the account pauses on day 14. Your data stays; sign in and choose a plan any time to carry on where you left off.</P>

      <H2>How to cancel</H2>
      <Ul items={[
        "Sign in as the school’s administrator, open Your SchoolSpec plan, and tap I want to cancel. Tell us why in a sentence — it helps.",
        "We call within one working day to confirm. Nothing changes until we have spoken; nothing is deleted at all.",
        "Cancellation takes effect at the end of the period you have paid for. You are not billed again.",
      ]} />

      <H2>What comes back</H2>
      <Ul items={[
        <><b>Term plans.</b> No refund for the current term; you keep using the service until it ends. A term payment covers four months from the day you pay.</>,
        <><b>Academic-year plans, within 30 days of payment.</b> We refund the whole months you have not started. Example: paid for a year on 1 September, cancelled on 20 September — ten of the twelve months are refunded.</>,
        <><b>Academic-year plans, after 30 days.</b> No refund; you keep the service until the year ends.</>,
        <><b>If we failed you.</b> If the service was unavailable or materially broken for your school for more than two working days in a month and we could not put it right, we refund that month, or credit it if you stay. Tell us at {CO.email} within 30 days.</>,
        <><b>Charged in error.</b> A duplicate or mistaken charge is refunded in full as soon as we see it.</>,
      ]} />
      <P>Refunds go back to the card or mobile-money account that paid, through Paystack, and usually arrive within 10 working days. We confirm by email when it is sent.</P>

      <H2>Not refundable</H2>
      <Ul items={[
        "SMS credits, once bought, and SMS already sent.",
        "Custom plan set-up or on-site training days already delivered.",
        "Parents’ school fees: they are paid to the school, not to SchoolSpec, and only the school can refund them.",
      ]} />

      <H2>Your data after cancelling</H2>
      <P>Nothing is deleted when you cancel. For 90 days you can export everything, free, and reopen the account by choosing a plan. After that we delete the school’s data as the <A href="/legal/terms#leaving">terms</A> describe. Ask us at any time to delete sooner.</P>

      <H2>If you disagree with a decision</H2>
      <P>Write to {CO.email} with the school’s name and what happened. A person reads it and answers within five working days. If we still cannot agree, the <A href="/legal/terms#law">terms</A> say how disputes are settled.</P>
    </>
  );
}
