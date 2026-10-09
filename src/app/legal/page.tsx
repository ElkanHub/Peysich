import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { A, H2, P, Summary, Ul } from "./prose";

export const metadata: Metadata = pageMeta({
  title: "Legal", path: "/legal",
  description: "SchoolSpec’s terms of service, privacy policy, data processing agreement, cookie notice and refund policy, written in plain English.",
});

export default function LegalIndex() {
  return (
    <>
      <p className="lp-eyebrow">plain english, on purpose</p>
      <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.04] tracking-[-.035em] text-balance">The legal pages</h1>
      <P>Five documents. Each one starts with the short version, then says the whole thing without hiding anything in the long version.</P>
      <Summary items={[
        "Your school’s data is yours. We process it for you and never sell it.",
        "No parent money passes through SchoolSpec. Only the school’s own subscription is paid online.",
        "No tracking cookies, no advertising, no cookie pop-up — because there is nothing to consent to.",
        "Cancel any time from your billing page. Nothing is deleted when you do.",
        "Ghanaian law, the Data Protection Act 2012 (Act 843), and Ghanaian courts.",
      ]} />
      <H2>Which one do you need?</H2>
      <Ul items={[
        <><A href="/legal/terms">Terms of service</A> — the agreement between a school and SchoolSpec: accounts, subscriptions, SMS costs, responsibilities, liability.</>,
        <><A href="/legal/privacy">Privacy policy</A> — for everyone who uses the app: what is collected, why, who sees it, how long it stays, and your rights.</>,
        <><A href="/legal/data-processing">Data processing agreement</A> — for the school as the data controller: how SchoolSpec handles children’s and staff data on your instructions.</>,
        <><A href="/legal/cookies">Cookies & local storage</A> — the two cookies we set and the things saved on your own device, and why there is no pop-up.</>,
        <><A href="/legal/refunds">Refunds & cancellation</A> — the free trial, what happens when you cancel, and when money comes back.</>,
      ]} />
    </>
  );
}
